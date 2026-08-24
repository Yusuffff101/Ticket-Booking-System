/**
 * High-Concurrency Seat Hold & Booking Test Suite
 * Validates:
 * 1. 5 concurrent customer requests trying to hold the exact same seat simultaneously.
 * 2. Strict isolation: Exactly 1 succeeds (HTTP 201), 4 rejected with 409 Conflict.
 * 3. Booking creation with atomic transition to BOOKED + QR code generation.
 * 4. Verification that non-holding users cannot book a seat held by someone else.
 */
import http from 'http';
import { createApp } from '../app.js';
import { initSocketServer } from '../sockets/socket.gateway.js';
import prisma from '../config/prisma.js';

const PORT = 5097;
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
  const data = (await res.json()) as any;
  return { status: res.status, data };
}

async function runConcurrencyTests() {
  const app = createApp();
  const server = http.createServer(app);
  initSocketServer(server);

  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`🧪 Concurrency Test Server listening on http://localhost:${PORT}`);

  try {
    // ── Setup: Register 5 distinct customers + 1 Admin + 1 Organiser ────────
    console.log('\n--- 1. Registering test users ---');
    const adminRes = await post(`${BASE}/auth/register`, {
      name: 'Admin Test',
      email: `admin_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'ADMIN',
    });
    const adminToken = adminRes.data.data.tokens.accessToken;

    const orgRes = await post(`${BASE}/auth/register`, {
      name: 'Organiser Test',
      email: `org_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'ORGANISER',
    });
    const orgToken = orgRes.data.data.tokens.accessToken;

    const customers: { id: string; email: string; token: string }[] = [];
    for (let i = 1; i <= 5; i++) {
      const email = `customer_${i}_${Date.now()}@test.com`;
      const res = await post(`${BASE}/auth/register`, {
        name: `Customer ${i}`,
        email,
        password: 'Password123!',
        role: 'CUSTOMER',
      });
      customers.push({
        id: res.data.data.user.id,
        email,
        token: res.data.data.tokens.accessToken,
      });
    }
    console.log(`✅ Registered 1 Admin, 1 Organiser, and 5 Customers`);

    // ── Setup Venue, Event, Show ──────────────────────────────────────────
    console.log('\n--- 2. Setting up Venue, Event, and Show ---');
    const venueRes = await post(
      `${BASE}/venues`,
      {
        name: 'Concurrency Arena',
        address: '100 Race Condition Blvd',
        city: 'Bengaluru',
        totalRows: 2,
        totalCols: 5,
        gridLayout: [
          { row: 'A', startCol: 1, endCol: 5, category: 'PREMIUM' },
          { row: 'B', startCol: 1, endCol: 5, category: 'STANDARD' },
        ],
      },
      adminToken
    );
    const venueId = venueRes.data.data.id;

    const eventRes = await post(
      `${BASE}/events`,
      {
        title: 'Coldplay: Music of the Spheres Live',
        description: 'High-demand stadium concert with explosive traffic.',
        type: 'CONCERT',
        durationMinutes: 150,
      },
      orgToken
    );
    const eventId = eventRes.data.data.id;

    const showRes = await post(
      `${BASE}/shows`,
      {
        eventId,
        venueId,
        startTime: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        endTime: new Date(Date.now() + 51 * 3600 * 1000).toISOString(),
        categoryPricing: { PREMIUM: 5000, STANDARD: 2500, ECONOMY: 1000 },
      },
      orgToken
    );
    const showId = showRes.data.data.show.id;

    // Get the target seat (Seat A-1)
    const targetShowSeat = await prisma.showSeat.findFirst({
      where: { showId, seat: { row: 'A', col: 1 } },
      include: { seat: true },
    });
    if (!targetShowSeat) throw new Error('Target seat A-1 not found');
    console.log(`🎯 Target Contested Seat: ${targetShowSeat.seat.seatNumber} (ID: ${targetShowSeat.id})`);

    // ── CONCURRENCY BATTLE: 5 requests hit the exact same seat simultaneously ─
    console.log('\n--- 3. Launching 5 SIMULTANEOUS seat hold requests for Seat A-1 ---');
    const holdPromises = customers.map((c, index) =>
      post(
        `${BASE}/shows/${showId}/seats/hold`,
        { seatIds: [targetShowSeat.id] },
        c.token
      ).then((res) => ({ customerIndex: index + 1, customerId: c.id, ...res }))
    );

    const results = await Promise.all(holdPromises);

    console.log('\n📊 Concurrency Battle Results:');
    let successCount = 0;
    let conflictCount = 0;
    let winnerCustomerId = '';

    for (const r of results) {
      console.log(
        `   Customer ${r.customerIndex} (${r.customerId.slice(0, 8)}...): Status ${r.status} ${
          r.status === 201 ? '🏆 HELD (SUCCESS)' : '❌ REJECTED (' + (r.data.error || 'Conflict') + ')'
        }`
      );
      if (r.status === 201) {
        successCount++;
        winnerCustomerId = r.customerId;
      } else if (r.status === 409) {
        conflictCount++;
      }
    }

    console.log(`\n🔎 Concurrency Invariants:`);
    console.log(`   Successes (Expected: 1): ${successCount}`);
    console.log(`   Conflicts (Expected: 4): ${conflictCount}`);

    if (successCount !== 1) {
      throw new Error(`CRITICAL RACE CONDITION: Expected exactly 1 success, got ${successCount}`);
    }
    if (conflictCount !== 4) {
      throw new Error(`Expected exactly 4 conflicts (409), got ${conflictCount}`);
    }
    console.log('✅ ZERO DOUBLE-BOOKING INVARIANT VERIFIED: 1 Success, 4 Conflicts.');

    // ── Verify DB state for the held seat ──────────────────────────────────
    console.log('\n--- 4. Verifying database state for Seat A-1 ---');
    const freshShowSeat = await prisma.showSeat.findUnique({
      where: { id: targetShowSeat.id },
    });
    if (!freshShowSeat) throw new Error('ShowSeat not found in DB');
    console.log(`   Status: ${freshShowSeat.status} (Expected: HELD)`);
    console.log(`   Held By: ${freshShowSeat.heldById} (Winner: ${winnerCustomerId})`);
    console.log(`   Hold Expires At: ${freshShowSeat.expiresAt?.toISOString()}`);

    if (freshShowSeat.status !== 'HELD') throw new Error('DB status is not HELD');
    if (freshShowSeat.heldById !== winnerCustomerId) throw new Error('Winner ID mismatch in DB');
    console.log('✅ Database state strictly matches the winning transaction.');

    // ── Test Unauthorized Booking by a Loser ────────────────────────────────
    console.log('\n--- 5. Verifying that a non-holding customer CANNOT book this seat ---');
    const loser = customers.find((c) => c.id !== winnerCustomerId)!;
    const fraudBookingRes = await post(
      `${BASE}/bookings`,
      { showId, showSeatIds: [targetShowSeat.id] },
      loser.token
    );
    console.log(`   Loser Attempt Status: ${fraudBookingRes.status} (Expected: 409)`);
    if (fraudBookingRes.status !== 409) {
      throw new Error(`Security breach: Non-holding user got status ${fraudBookingRes.status}`);
    }
    console.log('✅ Unauthorized booking rejected with HTTP 409.');

    // ── Complete Booking with the Winner ───────────────────────────────────
    console.log('\n--- 6. Completing Booking & Generating QR Ticket for Winner ---');
    const winner = customers.find((c) => c.id === winnerCustomerId)!;
    const bookingRes = await post(
      `${BASE}/bookings`,
      { showId, showSeatIds: [targetShowSeat.id] },
      winner.token
    );

    if (bookingRes.status !== 201) {
      throw new Error(`Booking confirmation failed: ${JSON.stringify(bookingRes.data)}`);
    }

    const booking = bookingRes.data.data.booking;
    console.log(`✅ Booking Confirmed!`);
    console.log(`   Booking Reference: ${booking.bookingReference}`);
    console.log(`   Total Amount: ₹${booking.totalAmount}`);
    console.log(`   QR Code Generated: Data URL starts with "${booking.qrCodeDataUrl.slice(0, 30)}..."`);
    console.log(`   Status: ${booking.status}`);

    if (!booking.bookingReference.startsWith('BK-')) {
      throw new Error('Invalid booking reference format');
    }
    if (!booking.qrCodeDataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('Invalid QR code data URL');
    }

    // ── Final DB verification ──────────────────────────────────────────────
    console.log('\n--- 7. Verifying final ShowSeat status in DB ---');
    const finalSeat = await prisma.showSeat.findUnique({
      where: { id: targetShowSeat.id },
    });
    console.log(`   Final Status: ${finalSeat?.status} (Expected: BOOKED)`);
    console.log(`   Booking ID: ${finalSeat?.bookingId}`);
    if (finalSeat?.status !== 'BOOKED') throw new Error('Seat not in BOOKED status');
    if (!finalSeat?.bookingId) throw new Error('Seat missing bookingId association');
    console.log('✅ Final seat state is confirmed BOOKED in PostgreSQL.');

    // ── Cleanup ────────────────────────────────────────────────────────────
    console.log('\n--- 8. Cleaning up test data ---');
    await prisma.booking.deleteMany({ where: { showId } });
    await prisma.show.delete({ where: { id: showId } });
    await prisma.event.delete({ where: { id: eventId } });
    await prisma.venue.delete({ where: { id: venueId } });
    await prisma.user.deleteMany({
      where: {
        id: { in: [adminRes.data.data.user.id, orgRes.data.data.user.id, ...customers.map((c) => c.id)] },
      },
    });
    console.log('✅ Cleaned up all concurrency test records.');

    console.log('\n🎉 ALL CONCURRENCY & TICKETING TESTS PASSED WITH 100% ISOLATION! 🎉\n');
  } finally {
    await prisma.$disconnect();
    server.close();
  }
}

runConcurrencyTests().catch((err) => {
  console.error('\n❌ Concurrency test failed:', err);
  process.exit(1);
});
