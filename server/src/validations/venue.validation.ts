import { z } from 'zod';
import { SeatCategory } from '../constants/index.js';

export const seatDefinitionSchema = z.object({
  row: z.string().min(1).max(5),
  col: z.number().int().min(1).max(200),
  seatNumber: z.string().min(1).max(20),
  category: z.nativeEnum(SeatCategory),
});

export const createVenueSchema = z.object({
  name: z.string().min(2, 'Venue name must be at least 2 characters').max(200),
  address: z.string().min(5, 'Address must be at least 5 characters').max(500),
  city: z.string().min(2, 'City must be at least 2 characters').max(100),
  totalRows: z.number().int().min(1).max(50),
  totalCols: z.number().int().min(1).max(100),
  // Layout generation via grid config
  gridLayout: z.array(
    z.object({
      row: z.string().min(1).max(5),
      startCol: z.number().int().min(1),
      endCol: z.number().int().min(1),
      category: z.nativeEnum(SeatCategory),
    })
  ).min(1, 'At least one row configuration is required'),
});

export const updateVenueSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  address: z.string().min(5).max(500).optional(),
  city: z.string().min(2).max(100).optional(),
});

export type CreateVenueInput = z.infer<typeof createVenueSchema>;
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>;
