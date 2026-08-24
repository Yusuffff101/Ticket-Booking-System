import prisma from '../config/prisma.js';
import { emitSeatStatusUpdate } from '../sockets/socket.gateway.js';
import { config } from '../config/env.js';

/**
 * Hold TTL Reconciliation Worker
 * Scans for ShowSeats with status=HELD and expiresAt < NOW()
 * Releases them back to AVAILABLE and broadcasts socket updates.
 *
 * Designed to run:
 *   - On a recurring interval (setInterval) on server startup
 *   - Can be replaced with BullMQ delayed jobs in production
 */
export class HoldExpiryWorker {
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(intervalMs = 30_000) {
    // Default: scan every 30 seconds
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.timer) return;
    console.log(`⏱️  Hold Expiry Worker started (scan every ${this.intervalMs / 1000}s)`);
    this.timer = setInterval(() => this.reconcile(), this.intervalMs);
    // Also run immediately on startup
    this.reconcile();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('⏱️  Hold Expiry Worker stopped');
    }
  }

  private async reconcile(): Promise<void> {
    if (this.isRunning) return; // Skip if previous run still in progress
    this.isRunning = true;

    try {
      const now = new Date();

      // Fetch all expired holds
      const expiredHolds = await prisma.showSeat.findMany({
        where: {
          status: 'HELD',
          expiresAt: { lt: now },
        },
        include: {
          seat: {
            select: { id: true, row: true, col: true, seatNumber: true, category: true },
          },
        },
      });

      if (expiredHolds.length === 0) return;

      console.log(`⏱️  [HoldWorker] Releasing ${expiredHolds.length} expired hold(s)...`);

      // Bulk update all expired holds to AVAILABLE
      const expiredIds = expiredHolds.map((ss) => ss.id);
      await prisma.showSeat.updateMany({
        where: {
          id: { in: expiredIds },
          status: 'HELD',
          expiresAt: { lt: now },
        },
        data: {
          status: 'AVAILABLE',
          heldById: null,
          heldAt: null,
          expiresAt: null,
          version: { increment: 1 },
        },
      });

      // Broadcast each released seat via Socket.IO
      for (const ss of expiredHolds) {
        emitSeatStatusUpdate({
          showId: ss.showId,
          seatId: ss.seatId,
          showSeatId: ss.id,
          status: 'AVAILABLE',
          seatNumber: ss.seat.seatNumber,
          row: ss.seat.row,
          col: ss.seat.col,
          category: ss.seat.category,
          heldByUserId: null,
          expiresAt: null,
        });
      }

      console.log(`⏱️  [HoldWorker] Released ${expiredHolds.length} expired seat(s) — broadcast complete`);
    } catch (err) {
      console.error('[HoldWorker] Reconciliation error:', err);
    } finally {
      this.isRunning = false;
    }
  }
}

// Singleton instance
export const holdExpiryWorker = new HoldExpiryWorker(
  parseInt(process.env.HOLD_WORKER_INTERVAL_MS || '30000', 10)
);
