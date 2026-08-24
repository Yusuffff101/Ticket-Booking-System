import prisma from '../config/prisma.js';
import { WaitlistService } from '../services/waitlist.service.js';

/**
 * Offer Expiry Reconciliation Worker
 * Scans for Waitlist Offers with status=PENDING and offerExpiresAt < NOW().
 * Marks expired offers and waitlist entries as EXPIRED,
 * and recursively calls WaitlistService.reallocateSeat to cascade the freed seat
 * to the next person waiting in the FIFO queue.
 */
export class OfferExpiryWorker {
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(intervalMs = 30_000) {
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.timer) return;
    console.log(`⏳ Offer Expiry Worker started (scan every ${this.intervalMs / 1000}s)`);
    this.timer = setInterval(() => this.reconcile(), this.intervalMs);
    this.reconcile();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('⏳ Offer Expiry Worker stopped');
    }
  }

  async reconcile(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();

      // Find expired pending offers
      const expiredOffers = await prisma.offer.findMany({
        where: {
          status: 'PENDING',
          offerExpiresAt: { lt: now },
        },
        include: {
          showSeat: true,
          waitlist: true,
        },
      });

      if (expiredOffers.length === 0) return;

      console.log(`⏳ [OfferWorker] Found ${expiredOffers.length} expired offer(s). Reallocating...`);

      for (const offer of expiredOffers) {
        // 1. Mark Offer as EXPIRED
        await prisma.offer.update({
          where: { id: offer.id },
          data: { status: 'EXPIRED' },
        });

        // 2. Mark Waitlist entry as EXPIRED
        await prisma.waitlist.update({
          where: { id: offer.waitlistId },
          data: { status: 'EXPIRED' },
        });

        // 3. Reallocate the seat to next in FIFO queue or release to AVAILABLE
        if (offer.showSeat) {
          console.log(`⏳ [OfferWorker] Cascading seat ${offer.showSeat.id} to next in queue...`);
          await WaitlistService.reallocateSeat(offer.showSeat.id);
        }
      }
    } catch (err) {
      console.error('[OfferWorker] Reconciliation error:', err);
    } finally {
      this.isRunning = false;
    }
  }
}

export const offerExpiryWorker = new OfferExpiryWorker(
  parseInt(process.env.OFFER_WORKER_INTERVAL_MS || '30000', 10)
);
