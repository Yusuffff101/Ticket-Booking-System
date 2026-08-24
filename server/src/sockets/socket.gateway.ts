import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { config } from '../config/env.js';

export enum SocketEvent {
  // Client → Server
  JOIN_SHOW_ROOM = 'JOIN_SHOW_ROOM',
  LEAVE_SHOW_ROOM = 'LEAVE_SHOW_ROOM',
  // Server → Client
  SEAT_STATUS_UPDATED = 'SEAT_STATUS_UPDATED',
  ROOM_JOINED = 'ROOM_JOINED',
  ROOM_LEFT = 'ROOM_LEFT',
  SHOW_SEAT_MAP_SYNC = 'SHOW_SEAT_MAP_SYNC',
  ERROR = 'SOCKET_ERROR',
}

export interface SeatStatusUpdate {
  showId: string;
  seatId: string;
  showSeatId: string;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
  seatNumber: string;
  row: string;
  col: number;
  category: string;
  heldByUserId?: string | null;
  expiresAt?: string | null;
}

let io: SocketIOServer | null = null;

export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [config.clientUrl, 'http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Client requests to join a show room for live seat map updates
    socket.on(SocketEvent.JOIN_SHOW_ROOM, async (showId: string) => {
      if (!showId || typeof showId !== 'string') {
        socket.emit(SocketEvent.ERROR, { message: 'Invalid showId' });
        return;
      }
      const room = `show:${showId}`;
      socket.join(room);
      console.log(`📺 Socket ${socket.id} joined room [${room}]`);
      socket.emit(SocketEvent.ROOM_JOINED, { showId, room });
    });

    // Client leaves a show room (e.g., navigating away)
    socket.on(SocketEvent.LEAVE_SHOW_ROOM, (showId: string) => {
      const room = `show:${showId}`;
      socket.leave(room);
      console.log(`🚪 Socket ${socket.id} left room [${room}]`);
      socket.emit(SocketEvent.ROOM_LEFT, { showId, room });
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
    });

    socket.on('error', (err) => {
      console.error(`Socket error on ${socket.id}:`, err);
    });
  });

  console.log('⚡ Socket.IO server initialized');
  return io;
};

/**
 * Broadcast a seat status update to all clients watching a specific show room.
 * Called from services (Phase 3 hold, release, booking confirmation flows).
 */
export const emitSeatStatusUpdate = (update: SeatStatusUpdate): void => {
  if (!io) {
    console.warn('[Socket] IO server not initialized — cannot emit seat update');
    return;
  }
  const room = `show:${update.showId}`;
  io.to(room).emit(SocketEvent.SEAT_STATUS_UPDATED, update);
};

/**
 * Broadcast multiple seat status updates at once (e.g., on show creation or hold release).
 */
export const emitBulkSeatStatusUpdate = (updates: SeatStatusUpdate[]): void => {
  if (!io || updates.length === 0) return;
  // Group by showId to send to correct rooms
  const byShow: Record<string, SeatStatusUpdate[]> = {};
  for (const update of updates) {
    if (!byShow[update.showId]) byShow[update.showId] = [];
    byShow[update.showId].push(update);
  }
  for (const [showId, showUpdates] of Object.entries(byShow)) {
    io.to(`show:${showId}`).emit(SocketEvent.SHOW_SEAT_MAP_SYNC, showUpdates);
  }
};

export const getIO = (): SocketIOServer | null => io;

export default { initSocketServer, emitSeatStatusUpdate, emitBulkSeatStatusUpdate, getIO };
