import { Decimal } from '@prisma/client/runtime/library.js';
import prisma from '../config/prisma.js';
import { CreateShowInput } from '../validations/event.validation.js';
import { SeatCategory } from '../constants/index.js';

export class ShowService {
  /**
   * Create a show and auto-populate ShowSeat records for every seat in the venue.
   * Pricing is derived from categoryPricingJson by matching seat.category.
   */
  static async createShow(organiserId: string, input: CreateShowInput) {
    // 1. Validate event ownership
    const event = await prisma.event.findUnique({ where: { id: input.eventId } });
    if (!event) throw new Error('Event not found');
    if (event.organiserId !== organiserId) throw new Error('You do not own this event');

    // 2. Validate venue
    const venue = await prisma.venue.findUnique({
      where: { id: input.venueId },
      include: { seats: true },
    });
    if (!venue) throw new Error('Venue not found');
    if (venue.seats.length === 0) throw new Error('Venue has no seats configured');

    // 3. Normalize pricing
    const pricing = input.categoryPricing as Record<string, number>;

    // 4. Transactionally create show + ShowSeat entries
    const show = await prisma.$transaction(async (tx) => {
      const createdShow = await tx.show.create({
        data: {
          eventId: input.eventId,
          venueId: input.venueId,
          startTime: new Date(input.startTime),
          endTime: new Date(input.endTime),
          categoryPricingJson: pricing,
        },
      });

      // Auto-generate ShowSeat for every seat at the venue
      const showSeatData = venue.seats
        .map((seat) => {
          const categoryKey = seat.category as string; // e.g. 'PREMIUM'
          const price = pricing[categoryKey];
          if (price === undefined) return null; // skip seats with no price
          return {
            showId: createdShow.id,
            seatId: seat.id,
            status: 'AVAILABLE' as const,
            price: new Decimal(price),
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      if (showSeatData.length > 0) {
        await tx.showSeat.createMany({ data: showSeatData, skipDuplicates: true });
      }

      return createdShow;
    });

    const showSeatCount = await prisma.showSeat.count({ where: { showId: show.id } });

    return {
      show: {
        ...show,
        showSeatCount,
      },
    };
  }

  static async getShowsByEvent(eventId: string) {
    return prisma.show.findMany({
      where: { eventId },
      orderBy: { startTime: 'asc' },
      include: {
        venue: { select: { id: true, name: true, city: true } },
        _count: { select: { showSeats: true, bookings: true } },
      },
    });
  }

  static async getShowById(showId: string) {
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        event: true,
        venue: {
          select: { id: true, name: true, address: true, city: true, totalRows: true, totalCols: true, layoutJson: true },
        },
        _count: { select: { showSeats: true, bookings: true, waitlistEntries: true } },
      },
    });
    if (!show) throw new Error('Show not found');
    return show;
  }

  /**
   * Returns the full seat map for a show — each ShowSeat with its Seat details.
   * This is what the frontend renders as the visual seat grid.
   */
  static async getSeatMap(showId: string) {
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        event: { select: { id: true, title: true, type: true } },
        venue: {
          select: {
            id: true,
            name: true,
            city: true,
            totalRows: true,
            totalCols: true,
            layoutJson: true,
          },
        },
      },
    });
    if (!show) throw new Error('Show not found');

    const showSeats = await prisma.showSeat.findMany({
      where: { showId },
      include: {
        seat: {
          select: { id: true, row: true, col: true, seatNumber: true, category: true },
        },
        heldBy: { select: { id: true } },
      },
      orderBy: [{ seat: { row: 'asc' } }, { seat: { col: 'asc' } }],
    });

    // Build categorized summary
    const summary = {
      total: showSeats.length,
      available: showSeats.filter((s) => s.status === 'AVAILABLE').length,
      held: showSeats.filter((s) => s.status === 'HELD').length,
      booked: showSeats.filter((s) => s.status === 'BOOKED').length,
    };

    // Group by row for grid rendering
    const seatsByRow: Record<string, typeof showSeats> = {};
    for (const ss of showSeats) {
      const row = ss.seat.row;
      if (!seatsByRow[row]) seatsByRow[row] = [];
      seatsByRow[row].push(ss);
    }

    return {
      show: {
        id: show.id,
        startTime: show.startTime,
        endTime: show.endTime,
        categoryPricingJson: show.categoryPricingJson,
        event: show.event,
        venue: show.venue,
      },
      summary,
      seatsByRow,
      seats: showSeats,
    };
  }

  static async deleteShow(showId: string, organiserId: string, isAdmin: boolean) {
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: { event: { select: { organiserId: true } } },
    });
    if (!show) throw new Error('Show not found');
    if (!isAdmin && show.event.organiserId !== organiserId) {
      throw new Error('You do not own this show');
    }

    const confirmedBookings = await prisma.booking.count({
      where: { showId, status: 'CONFIRMED' },
    });
    if (confirmedBookings > 0) {
      throw new Error('Cannot delete show with confirmed bookings. Cancel all bookings first.');
    }

    await prisma.show.delete({ where: { id: showId } });
    return { deleted: true };
  }
}
