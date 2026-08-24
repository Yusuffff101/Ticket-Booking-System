import prisma from '../config/prisma.js';

export class AnalyticsService {
  /**
   * Provides detailed operational and financial metrics for a specific event.
   */
  static async getEventSummary(eventId: string, organiserId: string, isAdmin = false) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        shows: {
          include: {
            venue: { select: { name: true, city: true } },
            showSeats: {
              include: {
                seat: { select: { category: true } },
              },
            },
            bookings: {
              where: { status: 'CONFIRMED' },
            },
            waitlistEntries: {
              where: { status: { in: ['PENDING', 'OFFERED'] } },
            },
          },
        },
      },
    });

    if (!event) {
      throw Object.assign(new Error('Event not found'), { statusCode: 404 });
    }

    if (!isAdmin && event.organiserId !== organiserId) {
      throw Object.assign(new Error('You do not have permission to view analytics for this event'), {
        statusCode: 403,
      });
    }

    // Aggregate metrics across all shows
    let totalSeats = 0;
    let totalBookedSeats = 0;
    let totalHeldSeats = 0;
    let totalAvailableSeats = 0;
    let totalRevenue = 0;

    const categoryBreakdown: Record<
      string,
      { total: number; booked: number; held: number; available: number; revenue: number }
    > = {
      PREMIUM: { total: 0, booked: 0, held: 0, available: 0, revenue: 0 },
      STANDARD: { total: 0, booked: 0, held: 0, available: 0, revenue: 0 },
      ECONOMY: { total: 0, booked: 0, held: 0, available: 0, revenue: 0 },
    };

    const waitlistDepthByCategory: Record<string, number> = {
      PREMIUM: 0,
      STANDARD: 0,
      ECONOMY: 0,
    };

    for (const show of event.shows) {
      // Bookings revenue
      for (const booking of show.bookings) {
        totalRevenue += Number(booking.totalAmount);
      }

      // Seats breakdown
      for (const ss of show.showSeats) {
        totalSeats++;
        const cat = ss.seat.category as string;
        if (!categoryBreakdown[cat]) {
          categoryBreakdown[cat] = { total: 0, booked: 0, held: 0, available: 0, revenue: 0 };
        }

        categoryBreakdown[cat].total++;

        if (ss.status === 'BOOKED') {
          totalBookedSeats++;
          categoryBreakdown[cat].booked++;
          categoryBreakdown[cat].revenue += Number(ss.price);
        } else if (ss.status === 'HELD') {
          totalHeldSeats++;
          categoryBreakdown[cat].held++;
        } else {
          totalAvailableSeats++;
          categoryBreakdown[cat].available++;
        }
      }

      // Waitlist depth
      for (const wl of show.waitlistEntries) {
        const cat = wl.category as string;
        waitlistDepthByCategory[cat] = (waitlistDepthByCategory[cat] || 0) + 1;
      }
    }

    const occupancyRate = totalSeats > 0 ? ((totalBookedSeats / totalSeats) * 100).toFixed(1) : '0';

    return {
      event: {
        id: event.id,
        title: event.title,
        type: event.type,
        durationMinutes: event.durationMinutes,
        bannerUrl: event.bannerUrl,
      },
      metrics: {
        totalShows: event.shows.length,
        totalCapacity: totalSeats,
        ticketsSold: totalBookedSeats,
        activeHolds: totalHeldSeats,
        availableSeats: totalAvailableSeats,
        totalRevenue,
        occupancyRate: parseFloat(occupancyRate),
        totalWaitlistCount: Object.values(waitlistDepthByCategory).reduce((a, b) => a + b, 0),
      },
      categoryBreakdown,
      waitlistDepthByCategory,
      shows: event.shows.map((s) => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        venue: s.venue,
        totalSeats: s.showSeats.length,
        bookedSeats: s.showSeats.filter((ss) => ss.status === 'BOOKED').length,
        revenue: s.bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0),
      })),
    };
  }

  /**
   * Top-level dashboard for an organiser summarizing all their events.
   */
  static async getOrganiserDashboard(organiserId: string, isAdmin = false) {
    const events = await prisma.event.findMany({
      where: isAdmin ? {} : { organiserId },
      include: {
        shows: {
          include: {
            venue: { select: { name: true, city: true } },
            showSeats: { select: { status: true, price: true } },
            bookings: { where: { status: 'CONFIRMED' }, select: { totalAmount: true } },
            waitlistEntries: { where: { status: 'PENDING' }, select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let overallRevenue = 0;
    let overallTicketsSold = 0;
    let overallCapacity = 0;
    let overallActiveHolds = 0;

    const eventSummaries = events.map((event) => {
      let eventRev = 0;
      let eventSold = 0;
      let eventCap = 0;
      let eventHolds = 0;
      let eventWaitlist = 0;

      for (const show of event.shows) {
        eventRev += show.bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
        eventCap += show.showSeats.length;
        eventSold += show.showSeats.filter((s) => s.status === 'BOOKED').length;
        eventHolds += show.showSeats.filter((s) => s.status === 'HELD').length;
        eventWaitlist += show.waitlistEntries.length;
      }

      overallRevenue += eventRev;
      overallTicketsSold += eventSold;
      overallCapacity += eventCap;
      overallActiveHolds += eventHolds;

      const occupancy = eventCap > 0 ? ((eventSold / eventCap) * 100).toFixed(1) : '0';

      return {
        id: event.id,
        title: event.title,
        type: event.type,
        bannerUrl: event.bannerUrl,
        showCount: event.shows.length,
        totalCapacity: eventCap,
        ticketsSold: eventSold,
        activeHolds: eventHolds,
        waitlistDepth: eventWaitlist,
        revenue: eventRev,
        occupancyRate: parseFloat(occupancy),
      };
    });

    const overallOccupancy =
      overallCapacity > 0 ? ((overallTicketsSold / overallCapacity) * 100).toFixed(1) : '0';

    return {
      overview: {
        totalEvents: events.length,
        totalRevenue: overallRevenue,
        totalTicketsSold: overallTicketsSold,
        totalCapacity: overallCapacity,
        activeHolds: overallActiveHolds,
        overallOccupancyRate: parseFloat(overallOccupancy),
      },
      events: eventSummaries,
    };
  }
}
