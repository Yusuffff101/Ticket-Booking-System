import prisma from '../config/prisma.js';
import { CreateVenueInput, UpdateVenueInput } from '../validations/venue.validation.js';

export class VenueService {
  /**
   * Creates a venue and atomically generates all Seat records for the grid layout.
   */
  static async createVenue(input: CreateVenueInput) {
    // Derive layout JSON from gridLayout config
    const layoutJson = input.gridLayout.map((rowCfg) => ({
      row: rowCfg.row,
      startCol: rowCfg.startCol,
      endCol: rowCfg.endCol,
      category: rowCfg.category,
    }));

    // Build seat creation data
    const seatData: Array<{
      row: string;
      col: number;
      seatNumber: string;
      category: string;
    }> = [];

    for (const rowCfg of input.gridLayout) {
      for (let col = rowCfg.startCol; col <= rowCfg.endCol; col++) {
        seatData.push({
          row: rowCfg.row,
          col,
          seatNumber: `${rowCfg.row}-${col}`,
          category: rowCfg.category,
        });
      }
    }

    // Transaction: create venue + seats atomically
    const venue = await prisma.$transaction(async (tx) => {
      const createdVenue = await tx.venue.create({
        data: {
          name: input.name,
          address: input.address,
          city: input.city,
          totalRows: input.totalRows,
          totalCols: input.totalCols,
          layoutJson,
        },
      });

      if (seatData.length > 0) {
        await tx.seat.createMany({
          data: seatData.map((s) => ({
            venueId: createdVenue.id,
            row: s.row,
            col: s.col,
            seatNumber: s.seatNumber,
            category: s.category as any,
          })),
          skipDuplicates: true,
        });
      }

      return createdVenue;
    });

    const seatCount = await prisma.seat.count({ where: { venueId: venue.id } });

    return { ...venue, seatCount };
  }

  static async getAllVenues(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [venues, total] = await Promise.all([
      prisma.venue.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { seats: true, shows: true } },
        },
      }),
      prisma.venue.count(),
    ]);

    return {
      venues,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getVenueById(venueId: string) {
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: {
        seats: {
          orderBy: [{ row: 'asc' }, { col: 'asc' }],
        },
        _count: { select: { shows: true } },
      },
    });

    if (!venue) {
      throw new Error('Venue not found');
    }

    return venue;
  }

  static async updateVenue(venueId: string, input: UpdateVenueInput) {
    const existing = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!existing) throw new Error('Venue not found');

    return prisma.venue.update({
      where: { id: venueId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.address && { address: input.address }),
        ...(input.city && { city: input.city }),
      },
    });
  }
}
