import { z } from 'zod';
import { SeatCategory } from '../constants/index.js';

export const joinWaitlistSchema = z.object({
  category: z.nativeEnum(SeatCategory, {
    errorMap: () => ({ message: 'Category must be PREMIUM, STANDARD, or ECONOMY' }),
  }),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
