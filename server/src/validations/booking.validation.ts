import { z } from 'zod';

export const holdSeatsSchema = z.object({
  seatIds: z
    .array(z.string().uuid('Each seatId must be a valid UUID'))
    .min(1, 'Select at least one seat')
    .max(10, 'Cannot hold more than 10 seats at once'),
});

export const releaseSeatsSchema = z.object({
  seatIds: z
    .array(z.string().uuid())
    .min(1, 'Provide at least one ShowSeat ID to release'),
});

export const createBookingSchema = z.object({
  showId: z.string().uuid('Invalid showId'),
  showSeatIds: z
    .array(z.string().uuid('Each showSeatId must be a valid UUID'))
    .min(1, 'Booking requires at least one seat')
    .max(10, 'Cannot book more than 10 seats at once'),
});

export type HoldSeatsInput = z.infer<typeof holdSeatsSchema>;
export type ReleaseSeatsInput = z.infer<typeof releaseSeatsSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
