import { z } from 'zod';
import { EventType, SeatCategory } from '../constants/index.js';

export const createEventSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(300),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
  type: z.nativeEnum(EventType),
  durationMinutes: z.number().int().min(1).max(600),
  bannerUrl: z.string().url('Banner must be a valid URL').optional().nullable(),
});

export const updateEventSchema = z.object({
  title: z.string().min(2).max(300).optional(),
  description: z.string().min(10).max(5000).optional(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  bannerUrl: z.string().url().optional().nullable(),
});

const categoryPricingSchema = z.object({
  PREMIUM: z.number().positive('PREMIUM price must be positive'),
  STANDARD: z.number().positive('STANDARD price must be positive'),
  ECONOMY: z.number().positive('ECONOMY price must be positive'),
}).partial().refine(
  (data) => Object.keys(data).length > 0,
  'At least one category price must be provided'
);

export const createShowSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
  venueId: z.string().uuid('Invalid venue ID'),
  startTime: z.string().datetime('startTime must be a valid ISO 8601 datetime'),
  endTime: z.string().datetime('endTime must be a valid ISO 8601 datetime'),
  categoryPricing: categoryPricingSchema,
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: 'endTime must be after startTime', path: ['endTime'] }
);

export const listEventsSchema = z.object({
  type: z.nativeEnum(EventType).optional(),
  venueId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateShowInput = z.infer<typeof createShowSchema>;
export type ListEventsInput = z.infer<typeof listEventsSchema>;
