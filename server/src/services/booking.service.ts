import prisma from '../config/prisma.js';
import redis from '../config/redis.js';
import { config } from '../config/env.js';
import { emitSeatStatusUpdate } from '../sockets/socket.gateway.js';
import { generateBookingReference, generateQRCode } from '../utils/qr.js';
import { sendBookingConfirmationEmail } from './email.service.js';
import type { HoldSeatsInput, CreateBookingInput } from '../validations/booking.validation.js';

// Redis lock TTL for atomic seat claim (5 seconds — fast, prevents race during DB write)
const LOCK_TTL_MS = 5000;
// How long to hold a seat before auto-release
const HOLD_TTL_MINUTES = config.seatHoldTtlMinutes;

/**
 * Acquire a Redis NX lock for a specific seat.
 * Returns true if lock acquired, false if already locked.
 */
const acquireSeatLock = async (showId: string, seatId: string, userId: string): Promise<boolean> => {
  const lockKey = `lock:show:${showId}:seat:${seatId}`;
  const result = await (redis as any).set(lockKey, userId, 'PX', LOCK_TTL_MS, 'NX');
  return result === 'OK';
};

const releaseSeatLock = async (showId: string, seatId: string): Promise<void> => {
  const lockKey = `lock:show:${showId}:seat:${seatId}`;
  await (redis as any).del(lockKey);
};

// ─────────────────────────────────────────────────────────────────────────────
// HOLD ENGINE
// ─────────────────────────────────────────────────────────────────────────────
export class HoldService {
  /**
   * Atomically holds a set of ShowSeats for a customer.
   * Uses Redis NX locks as a fast first-line defence, then a DB transaction
   * with conditional UPDATE to guarantee no double-holds.
   *
   * @throws 409-able errors when any seat is unavailable.
   */
  static async holdSeats(showId: string, userId: string, input: HoldSeatsInput) {
    const { seatIds: showSeatIds } = input;

    // 1. Fetch target ShowSeats and validate ownership/status
    const showSeats = await prisma.showSeat.findMany({
      where: { id: { in: showSeatIds }, showId },
      include: { seat: { select: { id: true, row: true, col: true, seatNumber: true, category: true } } },
    });

    if (showSeats.length !== showSeatIds.length) {
      throw Object.assign(new Error('One or more seats not found for this show'), { statusCode: 404 });
    }

    // Check all AVAILABLE
    const unavailable = showSeats.filter((ss) => ss.status !== 'AVAILABLE');
    if (unavailable.length > 0) {
      const ids = unavailable.map((s) => s.seat.seatNumber).join(', ');
      throw Object.assign(
        new Error(`Seats already held or booked: ${ids}`),
        { statusCode: 409 }
      );
    }

    // 2. Acquire Redis NX locks for each seat
    const locksAcquired: string[] = [];
    try {
      for (const ss of showSeats) {
        const acquired = await acquireSeatLock(showId, ss.seatId, userId);
        if (!acquired) {
          // Another request grabbed this seat in the last 5 s
          throw Object.assign(
            new Error(`Seat ${ss.seat.seatNumber} is currently being held by another user`),
            { statusCode: 409 }
          );
        }
        locksAcquired.push(ss.seatId);
      }

      // 3. Atomic DB transaction — conditional UPDATE prevents double-booking
      const holdExpiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);

      const updatedSeats = await prisma.$transaction(async (tx) => {
        const results = [];
        for (const ss of showSeats) {
          // Conditional update: only succeeds if still AVAILABLE
          const updated = await tx.showSeat.updateMany({
            where: { id: ss.id, showId, status: 'AVAILABLE', heldById: null },
            data: {
              status: 'HELD',
              heldById: userId,
              heldAt: new Date(),
              expiresAt: holdExpiresAt,
              version: { increment: 1 },
            },
          });

          if (updated.count === 0) {
            // Race condition: seat was just taken between lock and DB write
            throw Object.assign(
              new Error(`Seat ${ss.seat.seatNumber} was taken by another user. Please refresh and try again.`),
              { statusCode: 409 }
            );
          }
          results.push({ ...ss, status: 'HELD' as const, expiresAt: holdExpiresAt });
        }
        return results;
      });

      // 4. Broadcast real-time updates to all show room subscribers
      for (const ss of updatedSeats) {
        emitSeatStatusUpdate({
          showId,
          seatId: ss.seatId,
          showSeatId: ss.id,
          status: 'HELD',
          seatNumber: ss.seat.seatNumber,
          row: ss.seat.row,
          col: ss.seat.col,
          category: ss.seat.category,
          heldByUserId: userId,
          expiresAt: holdExpiresAt.toISOString(),
        });
      }

      return {
        heldSeats: updatedSeats.map((ss) => ({
          showSeatId: ss.id,
          seatNumber: ss.seat.seatNumber,
          row: ss.seat.row,
          col: ss.seat.col,
          category: ss.seat.category,
          status: 'HELD',
          expiresAt: holdExpiresAt.toISOString(),
        })),
        expiresAt: holdExpiresAt.toISOString(),
        holdTtlMinutes: HOLD_TTL_MINUTES,
      };
    } finally {
      // Always release Redis locks after DB write (success or failure)
      for (const seatId of locksAcquired) {
        await releaseSeatLock(showId, seatId);
      }
    }
  }

  /**
   * Manually release held seats back to AVAILABLE.
   * Only the holding customer can release their own holds.
   */
  static async releaseSeats(showId: string, userId: string, showSeatIds: string[]) {
    const showSeats = await prisma.showSeat.findMany({
      where: { id: { in: showSeatIds }, showId, status: 'HELD', heldById: userId },
      include: { seat: { select: { row: true, col: true, seatNumber: true, category: true } } },
    });

    if (showSeats.length === 0) {
      throw Object.assign(
        new Error('No held seats found for this user on this show'),
        { statusCode: 404 }
      );
    }

    await prisma.showSeat.updateMany({
      where: { id: { in: showSeats.map((s) => s.id) }, heldById: userId },
      data: {
        status: 'AVAILABLE',
        heldById: null,
        heldAt: null,
        expiresAt: null,
        version: { increment: 1 },
      },
    });

    // Broadcast release
    for (const ss of showSeats) {
      emitSeatStatusUpdate({
        showId,
        seatId: ss.seatId,
        showSeatId: ss.id,
        status: 'AVAILABLE',
        seatNumber: ss.seat.seatNumber,
        row: ss.seat.row,
        col: ss.seat.col,
        category: ss.seat.category,
        heldByUserId: null,
        expiresAt: null,
      });
    }

    return { released: showSeats.length };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING CONFIRMATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────
export class BookingService {
  static async createBooking(userId: string, input: CreateBookingInput) {
    const { showId, showSeatIds } = input;

    // 1. Fetch user + show + target ShowSeats
    const [user, show, showSeats] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.show.findUnique({
        where: { id: showId },
        include: {
          event: { select: { title: true, type: true } },
          venue: { select: { name: true, city: true } },
        },
      }),
      prisma.showSeat.findMany({
        where: { id: { in: showSeatIds }, showId },
        include: { seat: { select: { row: true, col: true, seatNumber: true, category: true } } },
      }),
    ]);

    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 401 });
    if (!show) throw Object.assign(new Error('Show not found'), { statusCode: 404 });
    if (showSeats.length !== showSeatIds.length) {
      throw Object.assign(new Error('One or more seats not found'), { statusCode: 404 });
    }

    // 2. Validate all seats are HELD by this user and not expired
    const now = new Date();
    for (const ss of showSeats) {
      if (ss.status !== 'HELD') {
        throw Object.assign(
          new Error(`Seat ${ss.seat.seatNumber} is not in HELD state. Please hold it first.`),
          { statusCode: 409 }
        );
      }
      if (ss.heldById !== userId) {
        throw Object.assign(
          new Error(`Seat ${ss.seat.seatNumber} is held by another user`),
          { statusCode: 409 }
        );
      }
      if (ss.expiresAt && ss.expiresAt < now) {
        throw Object.assign(
          new Error(`Hold for seat ${ss.seat.seatNumber} has expired. Please re-select.`),
          { statusCode: 409 }
        );
      }
    }

    // 3. Calculate total amount
    const totalAmount = showSeats.reduce((sum, ss) => sum + Number(ss.price), 0);

    // 4. Generate booking reference and QR code
    const bookingReference = generateBookingReference();
    const qrPayload = {
      ref: bookingReference,
      showId,
      eventTitle: show.event.title,
      seats: showSeats.map((ss) => ss.seat.seatNumber),
      venueName: show.venue.name,
    };
    const qrCodeDataUrl = await generateQRCode(qrPayload);

    // 5. Atomic transaction: mark seats BOOKED + create Booking record
    const booking = await prisma.$transaction(async (tx) => {
      // Confirm seats still held by this user (final guard inside transaction)
      const freshSeats = await tx.showSeat.findMany({
        where: { id: { in: showSeatIds }, showId, status: 'HELD', heldById: userId },
      });
      if (freshSeats.length !== showSeatIds.length) {
        throw Object.assign(
          new Error('One or more seats were released before booking could complete'),
          { statusCode: 409 }
        );
      }

      const createdBooking = await tx.booking.create({
        data: {
          bookingReference,
          customerId: userId,
          showId,
          totalAmount,
          status: 'CONFIRMED',
          qrCodeData: JSON.stringify(qrPayload),
          qrCodeUrl: qrCodeDataUrl,
        },
      });

      await tx.showSeat.updateMany({
        where: { id: { in: showSeatIds } },
        data: {
          status: 'BOOKED',
          bookingId: createdBooking.id,
          heldById: null,
          heldAt: null,
          expiresAt: null,
          version: { increment: 1 },
        },
      });

      return createdBooking;
    });

    // 6. Broadcast BOOKED status to all show room subscribers
    for (const ss of showSeats) {
      emitSeatStatusUpdate({
        showId,
        seatId: ss.seatId,
        showSeatId: ss.id,
        status: 'BOOKED',
        seatNumber: ss.seat.seatNumber,
        row: ss.seat.row,
        col: ss.seat.col,
        category: ss.seat.category,
        heldByUserId: null,
        expiresAt: null,
      });
    }

    // 7. Send confirmation email (non-blocking — failure is non-fatal)
    sendBookingConfirmationEmail({
      toEmail: user.email,
      toName: user.name,
      bookingReference,
      eventTitle: show.event.title,
      showTime: show.startTime.toLocaleString('en-IN'),
      venueName: `${show.venue.name}, ${show.venue.city}`,
      seatNumbers: showSeats.map((ss) => ss.seat.seatNumber),
      totalAmount,
      qrCodeDataUrl,
    }).catch(() => {});

    return {
      booking: {
        id: booking.id,
        bookingReference,
        showId,
        totalAmount,
        status: 'CONFIRMED',
        seats: showSeats.map((ss) => ({
          showSeatId: ss.id,
          seatNumber: ss.seat.seatNumber,
          row: ss.seat.row,
          col: ss.seat.col,
          category: ss.seat.category,
          price: Number(ss.price),
        })),
        qrCodeDataUrl,
        createdAt: booking.createdAt,
      },
    };
  }

  static async getMyBookings(userId: string) {
    return prisma.booking.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        show: {
          select: {
            startTime: true,
            endTime: true,
            event: { select: { title: true, type: true } },
            venue: { select: { name: true, city: true } },
          },
        },
        showSeats: {
          include: {
            seat: { select: { row: true, col: true, seatNumber: true, category: true } },
          },
        },
      },
    });
  }

  static async getBookingByRef(bookingReference: string, userId: string) {
    const booking = await prisma.booking.findUnique({
      where: { bookingReference },
      include: {
        show: {
          include: {
            event: true,
            venue: { select: { name: true, address: true, city: true } },
          },
        },
        showSeats: {
          include: { seat: true },
        },
      },
    });

    if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
    if (booking.customerId !== userId) {
      throw Object.assign(new Error('Access denied to this booking'), { statusCode: 403 });
    }
    return booking;
  }

  static async cancelBooking(bookingId: string, userId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        showSeats: {
          include: { seat: { select: { row: true, col: true, seatNumber: true, category: true } } },
        },
        show: { select: { startTime: true } },
      },
    });

    if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
    if (booking.customerId !== userId) {
      throw Object.assign(new Error('You can only cancel your own bookings'), { statusCode: 403 });
    }
    if (booking.status === 'CANCELLED') {
      throw Object.assign(new Error('Booking is already cancelled'), { statusCode: 409 });
    }

    // Mark booking CANCELLED and clear booking association from seats
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      });

      await tx.showSeat.updateMany({
        where: { bookingId },
        data: {
          status: 'AVAILABLE',
          bookingId: null,
          heldById: null,
          heldAt: null,
          expiresAt: null,
          version: { increment: 1 },
        },
      });
    });

    // Cascading Reallocation to FIFO Waitlist (or return to AVAILABLE)
    const { WaitlistService } = await import('./waitlist.service.js');
    for (const ss of booking.showSeats) {
      await WaitlistService.reallocateSeat(ss.id);
    }

    return { cancelled: true, bookingId };
  }
}

