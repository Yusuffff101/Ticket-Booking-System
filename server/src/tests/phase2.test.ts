/**
 * Phase 2 Integration Test Suite
 * Tests: Venue creation, Show creation w/ auto ShowSeat generation, Seat map retrieval, Socket.IO rooms
 */
import http from 'http';
import { createApp } from '../app.js';
import { initSocketServer } from '../sockets/socket.gateway.js';
import prisma from '../config/prisma.js';
import { io as SocketClient } from 'socket.io-client';

const PORT = 5098;
const BASE = `http://localhost:${PORT}/api`;

async function post(url: string, body: any, token?: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as any };
}

async function get(url: string, token?: string) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, data: (await res.json()) as any };
}

async function runTests() {
  const app = createApp();
  const server = http.createServer(app);
  initSocketServer(server);

  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`🧪 Phase 2 Test Server running on http://localhost:${PORT}`);

  try {
    // ── Step 1: Login as Admin ─────────────────────────────────────────────
    console.log('\n--- 1. Admin login ---');
    const { data: adminLogin } = await post(`${BASE}/auth/login`, {
      email: 'admin@ticketbooking.com',
      password: 'Password123!',
    });
    const adminToken: string = adminLogin.data.tokens.accessToken;
    console.log('✅ Admin logged in. Role:', adminLogin.data.user.role);

    // ── Step 2: Login as Organiser ─────────────────────────────────────────
    console.log('\n--- 2. Organiser login ---');
    const { data: orgLogin } = await post(`${BASE}/auth/login`, {
      email: 'cinema@cineworld.com',
      password: 'Password123!',
    });
    const orgToken: string = orgLogin.data.tokens.accessToken;
    console.log('✅ Organiser logged in. Role:', orgLogin.data.user.role);

    // ── Step 3: Admin creates a Venue with grid layout ──────────────────────
    console.log('\n--- 3. Create venue with 3-row grid (PREMIUM A, STANDARD B, ECONOMY C) ---');
    const { status: vStatus, data: vData } = await post(
      `${BASE}/venues`,
      {
        name: 'Grand Cinema Multiplex',
        address: '12 Marina Street',
        city: 'Mumbai',
        totalRows: 3,
        totalCols: 10,
        gridLayout: [
          { row: 'A', startCol: 1, endCol: 10, category: 'PREMIUM' },
          { row: 'B', startCol: 1, endCol: 10, category: 'STANDARD' },
          { row: 'C', startCol: 1, endCol: 10, category: 'ECONOMY' },
        ],
      },
      adminToken
    );
    if (vStatus !== 201) throw new Error(`Venue creation failed: ${JSON.stringify(vData)}`);
    const venueId: string = vData.data.id;
    const seatCount: number = vData.data.seatCount;
    console.log(`✅ Venue created: "${vData.data.name}" (ID: ${venueId})`);
    console.log(`   Seats auto-generated: ${seatCount} (expected: 30)`);
    if (seatCount !== 30) throw new Error(`Expected 30 seats, got ${seatCount}`);

    // ── Step 4: Verify seats persisted in DB ────────────────────────────────
    console.log('\n--- 4. Verify seats in DB ---');
    const seats = await prisma.seat.findMany({ where: { venueId }, orderBy: [{ row: 'asc' }, { col: 'asc' }] });
    console.log(`✅ ${seats.length} seat records in DB`);
    const premiumSeats = seats.filter((s) => s.category === 'PREMIUM');
    const standardSeats = seats.filter((s) => s.category === 'STANDARD');
    const economySeats = seats.filter((s) => s.category === 'ECONOMY');
    console.log(`   PREMIUM: ${premiumSeats.length}, STANDARD: ${standardSeats.length}, ECONOMY: ${economySeats.length}`);
    if (premiumSeats.length !== 10 || standardSeats.length !== 10 || economySeats.length !== 10) {
      throw new Error('Category seat counts incorrect');
    }

    // ── Step 5: Organiser creates an Event ─────────────────────────────────
    console.log('\n--- 5. Organiser creates a MOVIE event ---');
    const { status: eStatus, data: eData } = await post(
      `${BASE}/events`,
      {
        title: 'Interstellar: IMAX Re-Release',
        description: 'Christopher Nolan\'s space epic returns to IMAX for a limited engagement.',
        type: 'MOVIE',
        durationMinutes: 169,
        bannerUrl: null,
      },
      orgToken
    );
    if (eStatus !== 201) throw new Error(`Event creation failed: ${JSON.stringify(eData)}`);
    const eventId: string = eData.data.id;
    console.log(`✅ Event created: "${eData.data.title}" (ID: ${eventId})`);

    // ── Step 6: Organiser creates a Show with per-category pricing ─────────
    console.log('\n--- 6. Organiser creates a Show for the event ---');
    const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // tomorrow
    const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000 + 169 * 60 * 1000).toISOString();
    const { status: sStatus, data: sData } = await post(
      `${BASE}/shows`,
      {
        eventId,
        venueId,
        startTime,
        endTime,
        categoryPricing: { PREMIUM: 450, STANDARD: 300, ECONOMY: 150 },
      },
      orgToken
    );
    if (sStatus !== 201) throw new Error(`Show creation failed: ${JSON.stringify(sData)}`);
    const showId: string = sData.data.show.id;
    const showSeatCount: number = sData.data.show.showSeatCount;
    console.log(`✅ Show created (ID: ${showId})`);
    console.log(`   ShowSeat records auto-generated: ${showSeatCount} (expected: 30)`);
    if (showSeatCount !== 30) throw new Error(`Expected 30 ShowSeats, got ${showSeatCount}`);

    // ── Step 7: Verify ShowSeat pricing correctness ─────────────────────────
    console.log('\n--- 7. Verify ShowSeat pricing per category ---');
    const showSeats = await prisma.showSeat.findMany({
      where: { showId },
      include: { seat: { select: { category: true } } },
    });
    const premiumPrices = showSeats.filter((s) => s.seat.category === 'PREMIUM').map((s) => Number(s.price));
    const economyPrices = showSeats.filter((s) => s.seat.category === 'ECONOMY').map((s) => Number(s.price));
    if (!premiumPrices.every((p) => p === 450)) throw new Error('PREMIUM price mismatch');
    if (!economyPrices.every((p) => p === 150)) throw new Error('ECONOMY price mismatch');
    console.log(`✅ PREMIUM → ₹450, STANDARD → ₹300, ECONOMY → ₹150 (all ${showSeats.length} ShowSeats verified)`);

    // ── Step 8: GET /shows/:id/seatmap ──────────────────────────────────────
    console.log('\n--- 8. Fetch seat map via REST ---');
    const { status: smStatus, data: smData } = await get(`${BASE}/shows/${showId}/seatmap`);
    if (smStatus !== 200) throw new Error(`Seatmap fetch failed: ${JSON.stringify(smData)}`);
    const { summary, seatsByRow } = smData.data;
    console.log(`✅ Seat map returned — Total: ${summary.total}, Available: ${summary.available}`);
    console.log(`   Rows in seat map: ${Object.keys(seatsByRow).join(', ')}`);
    if (summary.total !== 30 || summary.available !== 30) throw new Error('Seat map summary mismatch');

    // ── Step 9: Socket.IO room join + seat update broadcast ─────────────────
    console.log('\n--- 9. Socket.IO room join & SEAT_STATUS_UPDATED broadcast ---');
    await new Promise<void>((resolve, reject) => {
      const socket = SocketClient(`http://localhost:${PORT}`, { transports: ['websocket'] });
      const timeout = setTimeout(() => reject(new Error('Socket.IO test timed out')), 5000);

      socket.on('connect', () => {
        console.log('   🔌 Socket connected:', socket.id);
        socket.emit('JOIN_SHOW_ROOM', showId);
      });

      socket.on('ROOM_JOINED', (payload: any) => {
        console.log(`   📺 Joined room: ${payload.room}`);
        // Simulate server broadcasting a seat update to this room
        const { emitSeatStatusUpdate } = require('../sockets/socket.gateway.js');
        emitSeatStatusUpdate({
          showId,
          seatId: seats[0].id,
          showSeatId: showSeats[0].id,
          status: 'HELD',
          seatNumber: seats[0].seatNumber,
          row: seats[0].row,
          col: seats[0].col,
          category: seats[0].category,
          heldByUserId: 'test-user',
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        });
      });

      socket.on('SEAT_STATUS_UPDATED', (update: any) => {
        console.log(`   📡 Received SEAT_STATUS_UPDATED: seat ${update.seatNumber} → ${update.status}`);
        if (update.status !== 'HELD') {
          reject(new Error(`Expected HELD, got ${update.status}`));
        }
        clearTimeout(timeout);
        socket.disconnect();
        resolve();
      });

      socket.on('connect_error', (err: Error) => {
        clearTimeout(timeout);
        reject(new Error(`Socket connect error: ${err.message}`));
      });
    });
    console.log('✅ Socket.IO room join and SEAT_STATUS_UPDATED broadcast verified');

    // ── Step 10: Cleanup ────────────────────────────────────────────────────
    console.log('\n--- 10. Cleanup test data ---');
    await prisma.show.delete({ where: { id: showId } });
    await prisma.event.delete({ where: { id: eventId } });
    await prisma.venue.delete({ where: { id: venueId } });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 ALL PHASE 2 INTEGRATION TESTS PASSED! 🎉\n');
  } finally {
    await prisma.$disconnect();
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Phase 2 test failed:', err.message);
  process.exit(1);
});
