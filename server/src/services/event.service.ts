import prisma from '../config/prisma.js';
import { CreateEventInput, UpdateEventInput, ListEventsInput } from '../validations/event.validation.js';

export class EventService {
  static async createEvent(organiserId: string, input: CreateEventInput) {
    return prisma.event.create({
      data: {
        organiserId,
        title: input.title,
        description: input.description,
        type: input.type as any,
        durationMinutes: input.durationMinutes,
        bannerUrl: input.bannerUrl || null,
      },
      include: {
        organiser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  static async listEvents(filters: ListEventsInput) {
    const { type, venueId, dateFrom, dateTo, search, page, limit } = filters;
    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (type) whereClause.type = type;
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by shows that use a specific venue or date range
    if (venueId || dateFrom || dateTo) {
      whereClause.shows = {
        some: {
          ...(venueId && { venueId }),
          ...(dateFrom && { startTime: { gte: new Date(dateFrom) } }),
          ...(dateTo && { startTime: { lte: new Date(dateTo) } }),
        },
      };
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organiser: { select: { id: true, name: true } },
          shows: {
            take: 5,
            orderBy: { startTime: 'asc' },
            where: { startTime: { gte: new Date() } },
            include: {
              venue: { select: { id: true, name: true, city: true } },
              _count: {
                select: {
                  showSeats: true,
                  bookings: true,
                },
              },
            },
          },
          _count: { select: { shows: true } },
        },
      }),
      prisma.event.count({ where: whereClause }),
    ]);

    return {
      events,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getEventById(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organiser: { select: { id: true, name: true, email: true } },
        shows: {
          orderBy: { startTime: 'asc' },
          include: {
            venue: {
              select: { id: true, name: true, address: true, city: true },
            },
            _count: {
              select: { showSeats: true, bookings: true },
            },
          },
        },
      },
    });

    if (!event) throw new Error('Event not found');
    return event;
  }

  static async updateEvent(eventId: string, organiserId: string, input: UpdateEventInput) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new Error('Event not found');
    if (event.organiserId !== organiserId) throw new Error('You do not own this event');

    return prisma.event.update({
      where: { id: eventId },
      data: {
        ...(input.title && { title: input.title }),
        ...(input.description && { description: input.description }),
        ...(input.durationMinutes && { durationMinutes: input.durationMinutes }),
        ...(input.bannerUrl !== undefined && { bannerUrl: input.bannerUrl }),
      },
    });
  }

  static async deleteEvent(eventId: string, organiserId: string, isAdmin: boolean) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new Error('Event not found');
    if (!isAdmin && event.organiserId !== organiserId) throw new Error('You do not own this event');

    // Check for confirmed bookings
    const bookedCount = await prisma.booking.count({
      where: {
        show: { eventId },
        status: 'CONFIRMED',
      },
    });
    if (bookedCount > 0) {
      throw new Error('Cannot delete event with confirmed bookings');
    }

    await prisma.event.delete({ where: { id: eventId } });
    return { deleted: true };
  }
}
