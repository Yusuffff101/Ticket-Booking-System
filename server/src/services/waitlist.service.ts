import crypto from 'crypto';
import prisma from '../config/prisma.js';
import { config } from '../config/env.js';
import { SeatCategory } from '../constants/index.js';
import { emitSeatStatusUpdate } from '../sockets/socket.gateway.js';
import { generateBookingReference, generateQRCode } from '../utils/qr.js';
import { sendWaitlistOfferEmail, sendBookingConfirmationEmail } from './email.service.js';

export class WaitlistService {
  /**
   * Join the FIFO waitlist for a specific show and category.
   */
  static async joinWaitlist(showId: string, customerId: string, category: SeatCategory) {
    // 1. Verify show exists
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: { event: { select: { title: true } }, venue: { select: { name: true } } },
    });
    if (!show) {
      throw Object.assign(new Error('Show not found'), { statusCode: 404 });
    }

    // 2. Check if customer already has a pending or offered entry for this show & category
    const existing = await prisma.waitlist.findFirst({
      where: {
        showId,
        customerId,
        category,
        status: { in: ['PENDING', 'OFFERED'] },
      },
    });
    if (existing) {
      throw Object.assign(
        new Error(`You are already on the active waitlist for ${category} seats for this show`),
        { statusCode: 409 }
      );
    }

    // 3. Create waitlist record
    const entry = await prisma.waitlist.create({
      data: {
        showId,
        customerId,
        category,
        status: 'PENDING',
      },
    });

    // 4. Calculate position in FIFO queue
    const position = await prisma.waitlist.count({
      where: {
        showId,
        category,
        status: 'PENDING',
        joinedAt: { lte: entry.joinedAt },
      },
    });

    return {
      waitlist: entry,
      position,
      show: {
        id: show.id,
        eventTitle: show.event.title,
        venueName: show.venue.name,
      },
    };
  }

  /**
   * Reallocates a freed / cancelled ShowSeat to the next waitlisted customer in FIFO order.
   * If no waitlist entry exists, returns the seat to AVAILABLE and broadcasts via WebSocket.
   *
   * Called on:
   * 1. Booking cancellation
   * 2. Offer expiration (recursive cascade)
   */
  static async reallocateSeat(showSeatId: string) {
    const showSeat = await prisma.showSeat.findUnique({
      where: { id: showSeatId },
      include: {
        seat: true,
        show: {
          include: {
            event: { select: { title: true } },
            venue: { select: { name: true, city: true } },
          },
        },
      },
    });

    if (!showSeat) return { reallocated: false, error: 'ShowSeat not found' };

    const category = showSeat.seat.category as SeatCategory;

    // Look for oldest PENDING waitlist entry
    const nextWaitlistEntry = await prisma.waitlist.findFirst({
      where: {
        showId: showSeat.showId,
        category,
        status: 'PENDING',
      },
      orderBy: { joinedAt: 'asc' },
      include: { customer: true },
    });

    // Case 1: No waitlist -> revert seat to AVAILABLE
    if (!nextWaitlistEntry) {
      await prisma.showSeat.update({
        where: { id: showSeatId },
        data: {
          status: 'AVAILABLE',
          heldById: null,
          heldAt: null,
          expiresAt: null,
          bookingId: null,
          offerId: null,
          version: { increment: 1 },
        },
      });

      emitSeatStatusUpdate({
        showId: showSeat.showId,
        seatId: showSeat.seatId,
        showSeatId: showSeat.id,
        status: 'AVAILABLE',
        seatNumber: showSeat.seat.seatNumber,
        row: showSeat.seat.row,
        col: showSeat.seat.col,
        category: showSeat.seat.category,
        heldByUserId: null,
        expiresAt: null,
      });

      return { reallocated: false, seatStatus: 'AVAILABLE' };
    }

    // Case 2: Waitlisted customer exists -> create time-limited Offer
    const offerTtlMinutes = config.waitlistOfferTtlMinutes || 15;
    const offerExpiresAt = new Date(Date.now() + offerTtlMinutes * 60 * 1000);
    const token = crypto.randomBytes(24).toString('hex');

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Offer
      const offer = await tx.offer.create({
        data: {
          waitlistId: nextWaitlistEntry.id,
          seatId: showSeat.seatId,
          token,
          offerExpiresAt,
          status: 'PENDING',
        },
      });

      // 2. Update Waitlist status
      await tx.waitlist.update({
        where: { id: nextWaitlistEntry.id },
        data: { status: 'OFFERED' },
      });

      // 3. Mark ShowSeat as HELD by the offer recipient
      await tx.showSeat.update({
        where: { id: showSeatId },
        data: {
          status: 'HELD',
          heldById: nextWaitlistEntry.customerId,
          heldAt: new Date(),
          expiresAt: offerExpiresAt,
          offerId: offer.id,
          bookingId: null,
          version: { increment: 1 },
        },
      });

      return offer;
    });

    // Emit socket update so map shows seat as HELD
    emitSeatStatusUpdate({
      showId: showSeat.showId,
      seatId: showSeat.seatId,
      showSeatId: showSeat.id,
      status: 'HELD',
      seatNumber: showSeat.seat.seatNumber,
      row: showSeat.seat.row,
      col: showSeat.seat.col,
      category: showSeat.seat.category,
      heldByUserId: nextWaitlistEntry.customerId,
      expiresAt: offerExpiresAt.toISOString(),
    });

    // Send email to the waitlisted customer
    sendWaitlistOfferEmail({
      toEmail: nextWaitlistEntry.customer.email,
      toName: nextWaitlistEntry.customer.name,
      eventTitle: showSeat.show.event.title,
      showTime: showSeat.show.startTime.toLocaleString('en-IN'),
      venueName: `${showSeat.show.venue.name}, ${showSeat.show.venue.city}`,
      category: showSeat.seat.category,
      seatNumber: showSeat.seat.seatNumber,
      price: Number(showSeat.price),
      token,
      offerExpiresAt,
    }).catch((err) => console.error('[Waitlist Email Error]', err));

    return {
      reallocated: true,
      offerId: result.id,
      token,
      customerId: nextWaitlistEntry.customerId,
      offerExpiresAt,
    };
  }

  /**
   * Accepts a time-limited offer, converting it atomically into a confirmed Booking.
   */
  static async acceptOffer(token: string, customerId: string) {
    const offer = await prisma.offer.findUnique({
      where: { token },
      include: {
        waitlist: {
          include: {
            customer: true,
            show: {
              include: {
                event: { select: { title: true, type: true } },
                venue: { select: { name: true, city: true } },
              },
            },
          },
        },
        seat: true,
        showSeat: true,
      },
    });

    if (!offer) {
      throw Object.assign(new Error('Offer not found or invalid token'), { statusCode: 404 });
    }

    if (offer.waitlist.customerId !== customerId) {
      throw Object.assign(new Error('This offer is reserved for another user'), { statusCode: 403 });
    }

    if (offer.status !== 'PENDING') {
      throw Object.assign(new Error(`Offer is no longer active (Status: ${offer.status})`), { statusCode: 409 });
    }

    if (offer.offerExpiresAt < new Date()) {
      throw Object.assign(new Error('Offer has expired. The seat has been allocated to the next person.'), {
        statusCode: 409,
      });
    }

    if (!offer.showSeat) {
      throw Object.assign(new Error('Associated seat record not found'), { statusCode: 500 });
    }

    const showSeat = offer.showSeat;
    const show = offer.waitlist.show;
    const customer = offer.waitlist.customer;
    const seat = offer.seat;
    const totalAmount = Number(showSeat.price);

    // Generate booking reference & QR code
    const bookingReference = generateBookingReference();
    const qrPayload = {
      ref: bookingReference,
      showId: show.id,
      eventTitle: show.event.title,
      seats: [seat.seatNumber],
      venueName: show.venue.name,
    };
    const qrCodeDataUrl = await generateQRCode(qrPayload);

    // Transactionally confirm booking & fulfill waitlist
    const booking = await prisma.$transaction(async (tx) => {
      const createdBooking = await tx.booking.create({
        data: {
          bookingReference,
          customerId,
          showId: show.id,
          totalAmount,
          status: 'CONFIRMED',
          qrCodeData: JSON.stringify(qrPayload),
          qrCodeUrl: qrCodeDataUrl,
        },
      });

      await tx.showSeat.update({
        where: { id: showSeat.id },
        data: {
          status: 'BOOKED',
          bookingId: createdBooking.id,
          offerId: null,
          heldById: null,
          heldAt: null,
          expiresAt: null,
          version: { increment: 1 },
        },
      });

      await tx.offer.update({
        where: { id: offer.id },
        data: { status: 'ACCEPTED' },
      });

      await tx.waitlist.update({
        where: { id: offer.waitlistId },
        data: { status: 'FULFILLED' },
      });

      return createdBooking;
    });

    // Socket update -> BOOKED
    emitSeatStatusUpdate({
      showId: show.id,
      seatId: seat.id,
      showSeatId: showSeat.id,
      status: 'BOOKED',
      seatNumber: seat.seatNumber,
      row: seat.row,
      col: seat.col,
      category: seat.category,
      heldByUserId: null,
      expiresAt: null,
    });

    // Send confirmation email
    sendBookingConfirmationEmail({
      toEmail: customer.email,
      toName: customer.name,
      bookingReference,
      eventTitle: show.event.title,
      showTime: show.startTime.toLocaleString('en-IN'),
      venueName: `${show.venue.name}, ${show.venue.city}`,
      seatNumbers: [seat.seatNumber],
      totalAmount,
      qrCodeDataUrl,
    }).catch(() => {});

    return {
      booking: {
        id: booking.id,
        bookingReference,
        showId: show.id,
        totalAmount,
        status: 'CONFIRMED',
        seatNumber: seat.seatNumber,
        category: seat.category,
        qrCodeDataUrl,
        createdAt: booking.createdAt,
      },
    };
  }

  /**
   * Get Offer details by token.
   */
  static async getOfferByToken(token: string) {
    const offer = await prisma.offer.findUnique({
      where: { token },
      include: {
        waitlist: {
          include: {
            show: {
              include: {
                event: { select: { title: true, type: true, bannerUrl: true } },
                venue: { select: { name: true, city: true, address: true } },
              },
            },
            customer: { select: { id: true, name: true, email: true } },
          },
        },
        seat: true,
        showSeat: { select: { id: true, price: true } },
      },
    });

    if (!offer) {
      throw Object.assign(new Error('Offer not found'), { statusCode: 404 });
    }

    const isExpired = offer.offerExpiresAt < new Date() || offer.status === 'EXPIRED';

    return {
      offer: {
        id: offer.id,
        token: offer.token,
        status: isExpired && offer.status === 'PENDING' ? 'EXPIRED' : offer.status,
        expiresAt: offer.offerExpiresAt,
        price: offer.showSeat ? Number(offer.showSeat.price) : 0,
        seat: {
          seatNumber: offer.seat.seatNumber,
          row: offer.seat.row,
          col: offer.seat.col,
          category: offer.seat.category,
        },
        show: {
          id: offer.waitlist.show.id,
          startTime: offer.waitlist.show.startTime,
          endTime: offer.waitlist.show.endTime,
          event: offer.waitlist.show.event,
          venue: offer.waitlist.show.venue,
        },
        customer: offer.waitlist.customer,
      },
    };
  }

  /**
   * Get all active waitlist entries for a customer.
   */
  static async getMyWaitlists(customerId: string) {
    const entries = await prisma.waitlist.findMany({
      where: { customerId },
      orderBy: { joinedAt: 'desc' },
      include: {
        show: {
          include: {
            event: { select: { title: true, type: true } },
            venue: { select: { name: true, city: true } },
          },
        },
        offers: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return entries.map((entry) => ({
      ...entry,
      activeOfferToken: entry.offers?.[0]?.token || null,
    }));
  }
}
