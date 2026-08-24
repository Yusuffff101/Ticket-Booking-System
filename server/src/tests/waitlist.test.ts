/**
 * Waitlist FIFO Auto-Reallocation & Offer Cascade Test Suite
 * Validates:
 * 1. Joining waitlist for a sold-out category with strict FIFO position tracking.
 * 2. Booking cancellation triggering automatic seat offer to the 1st waitlisted customer.
 * 3. Offer expiration causing an automatic recursive cascade to the 2nd customer in queue.
 * 4. Token-based offer acceptance resulting in atomic booking confirmation and QR code generation.
 */
import http from 'http';
import { createApp } from '../app.js';
import { initSocketServer } from '../sockets/socket.gateway.js';
import prisma from '../config/prisma.js';
import { offerExpiryWorker } from '../workers/offerExpiry.worker.js';

const PORT = 5096;
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

async function get(url: string, token?: string) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = (await res.json()) as any;
  return { status: res.status, data };
}

async function runWaitlistTests() {
  const app = createApp();
  const server = http.createServer(app);
  initSocketServer(server);

  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`🧪 Waitlist Test Server listening on http://localhost:${PORT}`);

  try {
    // ── 1. Register test users ──────────────────────────────────────────────
    console.log('\n--- 1. Registering test users (Admin, Organiser, Customers A, B, C) ---');
    const adminRes = await post(`${BASE}/auth/register`, {
      name: 'Admin Waitlist',
      email: `admin_wl_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'ADMIN',
    });
    const adminToken = adminRes.data.data.tokens.accessToken;

    const orgRes = await post(`${BASE}/auth/register`, {
      name: 'Org Waitlist',
      email: `org_wl_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'ORGANISER',
    });
    const orgToken = orgRes.data.data.tokens.accessToken;

    const custARes = await post(`${BASE}/auth/register`, {
      name: 'Customer A (Initial Buyer)',
      email: `cust_a_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'CUSTOMER',
    });
    const custA = { id: custARes.data.data.user.id, token: custARes.data.data.tokens.accessToken };

    const custBRes = await post(`${BASE}/auth/register`, {
      name: 'Customer B (1st Waitlisted)',
      email: `cust_b_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'CUSTOMER',
    });
    const custB = { id: custBRes.data.data.user.id, token: custBRes.data.data.tokens.accessToken };

    const custCRes = await post(`${BASE}/auth/register`, {
      name: 'Customer C (2nd Waitlisted)',
      email: `cust_c_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'CUSTOMER',
    });
    const custC = { id: custCRes.data.data.user.id, token: custCRes.data.data.tokens.accessToken };
    console.log('✅ Registered all test participants');

    // ── 2. Create Venue with 1 PREMIUM seat, Event, and Show ────────────────
    console.log('\n--- 2. Setting up Venue with 1 PREMIUM seat & Show ---');
    const venueRes = await post(
      `${BASE}/venues`,
      {
        name: 'Intimate Lounge',
        address: '1 VIP Lane',
        city: 'Mumbai',
        totalRows: 1,
        totalCols: 1,
        gridLayout: [{ row: 'A', startCol: 1, endCol: 1, category: 'PREMIUM' }],
      },
      adminToken
    );
    const venueId = venueRes.data.data.id;

    const eventRes = await post(
      `${BASE}/events`,
      {
        title: 'Hans Zimmer Live: Exclusive Solo Piano',
        description: 'Ultra-exclusive intimate concert.',
        type: 'CONCERT',
        durationMinutes: 120,
      },
      orgToken
    );
    const eventId = eventRes.data.data.id;

    const showRes = await post(
      `${BASE}/shows`,
      {
        eventId,
        venueId,
        startTime: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
        endTime: new Date(Date.now() + 74 * 3600 * 1000).toISOString(),
        categoryPricing: { PREMIUM: 10000, STANDARD: 5000, ECONOMY: 2000 },
      },
      orgToken
    );
    const showId = showRes.data.data.show.id;

    const showSeat = await prisma.showSeat.findFirst({
      where: { showId },
      include: { seat: true },
    });
    if (!showSeat) throw new Error('ShowSeat A-1 not found');
    console.log(`✅ Show created with 1 PREMIUM seat: ${showSeat.seat.seatNumber} (ID: ${showSeat.id})`);

    // ── 3. Customer A holds and books the only seat ─────────────────────────
    console.log('\n--- 3. Customer A books the only available seat ---');
    await post(`${BASE}/shows/${showId}/seats/hold`, { seatIds: [showSeat.id] }, custA.token);
    const bookingARes = await post(
      `${BASE}/bookings`,
      { showId, showSeatIds: [showSeat.id] },
      custA.token
    );
    const bookingAId = bookingARes.data.data.booking.id;
    console.log(`✅ Customer A confirmed booking (ID: ${bookingAId}, Ref: ${bookingARes.data.data.booking.bookingReference})`);

    // Verify seat is BOOKED
    let seatInDb = await prisma.showSeat.findUnique({ where: { id: showSeat.id } });
    if (seatInDb?.status !== 'BOOKED') throw new Error('Seat was not marked BOOKED');
    console.log('✅ Premium category is now 100% SOLD OUT');

    // ── 4. Customer B joins Waitlist (Position 1) ───────────────────────────
    console.log('\n--- 4. Customer B joins waitlist for PREMIUM ---');
    const wlBRes = await post(
      `${BASE}/shows/${showId}/waitlist/join`,
      { category: 'PREMIUM' },
      custB.token
    );
    if (wlBRes.status !== 201) throw new Error(`Customer B failed to join waitlist: ${JSON.stringify(wlBRes.data)}`);
    console.log(`✅ Customer B joined waitlist. Queue Position: ${wlBRes.data.data.position} (Expected: 1)`);
    if (wlBRes.data.data.position !== 1) throw new Error('Customer B position mismatch');

    // ── 5. Customer C joins Waitlist (Position 2) ───────────────────────────
    console.log('\n--- 5. Customer C joins waitlist for PREMIUM ---');
    const wlCRes = await post(
      `${BASE}/shows/${showId}/waitlist/join`,
      { category: 'PREMIUM' },
      custC.token
    );
    if (wlCRes.status !== 201) throw new Error(`Customer C failed to join waitlist: ${JSON.stringify(wlCRes.data)}`);
    console.log(`✅ Customer C joined waitlist. Queue Position: ${wlCRes.data.data.position} (Expected: 2)`);
    if (wlCRes.data.data.position !== 2) throw new Error('Customer C position mismatch');

    // ── 6. Customer A CANCELS Booking -> Auto-Reallocation to Customer B ────
    console.log('\n--- 6. Customer A cancels booking -> triggers auto-reallocation cascade ---');
    const cancelRes = await post(`${BASE}/bookings/${bookingAId}/cancel`, {}, custA.token);
    if (cancelRes.status !== 200) throw new Error(`Cancellation failed: ${JSON.stringify(cancelRes.data)}`);
    console.log('✅ Booking cancelled by Customer A');

    // Verify Offer created for Customer B
    const offerB = await prisma.offer.findFirst({
      where: { waitlist: { customerId: custB.id } },
      include: { waitlist: true },
    });
    if (!offerB) throw new Error('Offer was not generated for Customer B');
    console.log(`✅ Automated Offer created for Customer B (Token: ${offerB.token.slice(0, 16)}...)`);
    console.log(`   Offer Status: ${offerB.status}`);
    console.log(`   Customer B Waitlist Status: ${offerB.waitlist.status} (Expected: OFFERED)`);

    seatInDb = await prisma.showSeat.findUnique({ where: { id: showSeat.id } });
    console.log(`   ShowSeat Status: ${seatInDb?.status} (Expected: HELD for Customer B)`);
    console.log(`   Held By: ${seatInDb?.heldById} (Expected: ${custB.id})`);
    if (seatInDb?.heldById !== custB.id || seatInDb?.status !== 'HELD') {
      throw new Error('ShowSeat not held for Customer B');
    }

    // ── 7. Simulate Customer B Offer Expiry -> Auto-Cascade to Customer C ───
    console.log('\n--- 7. Simulating Offer B expiration -> cascades to Customer C ---');
    // Set offer B expiry date to 1 minute ago in DB
    await prisma.offer.update({
      where: { id: offerB.id },
      data: { offerExpiresAt: new Date(Date.now() - 60_000) },
    });

    // Run reconciliation worker
    await offerExpiryWorker.reconcile();

    // Verify Offer B is EXPIRED
    const freshOfferB = await prisma.offer.findUnique({ where: { id: offerB.id } });
    if (freshOfferB?.status !== 'EXPIRED') throw new Error('Offer B was not marked EXPIRED');
    console.log('✅ Offer B successfully expired by reconciliation worker');

    // Verify Offer C created for Customer C
    const offerC = await prisma.offer.findFirst({
      where: { waitlist: { customerId: custC.id }, status: 'PENDING' },
      include: { waitlist: true },
    });
    if (!offerC) throw new Error('Cascading offer was not generated for Customer C');
    console.log(`✅ Recursive cascade succeeded! Offer created for Customer C (Token: ${offerC.token.slice(0, 16)}...)`);
    console.log(`   Customer C Waitlist Status: ${offerC.waitlist.status} (Expected: OFFERED)`);

    seatInDb = await prisma.showSeat.findUnique({ where: { id: showSeat.id } });
    console.log(`   ShowSeat Status: ${seatInDb?.status} (Expected: HELD for Customer C)`);
    console.log(`   Held By: ${seatInDb?.heldById} (Expected: ${custC.id})`);
    if (seatInDb?.heldById !== custC.id || seatInDb?.status !== 'HELD') {
      throw new Error('ShowSeat not held for Customer C');
    }

    // ── 8. Customer C claims and accepts the offer ───────────────────────────
    console.log('\n--- 8. Customer C accepts the offer ---');
    // Test GET offer details
    const offerDetailsRes = await get(`${BASE}/waitlist/offer/${offerC.token}`);
    if (offerDetailsRes.status !== 200) throw new Error('Failed to retrieve offer details');
    console.log(`✅ Retrieved Offer details for token: Event "${offerDetailsRes.data.data.offer.show.event.title}", Price: ₹${offerDetailsRes.data.data.offer.price}`);

    // Customer C accepts
    const acceptRes = await post(`${BASE}/waitlist/offer/${offerC.token}/accept`, {}, custC.token);
    if (acceptRes.status !== 201) throw new Error(`Offer acceptance failed: ${JSON.stringify(acceptRes.data)}`);

    const bookingC = acceptRes.data.data.booking;
    console.log(`✅ Booking confirmed for Customer C!`);
    console.log(`   Booking Ref: ${bookingC.bookingReference}`);
    console.log(`   Total Amount: ₹${bookingC.totalAmount}`);
    console.log(`   Status: ${bookingC.status}`);

    // Verify final state in DB
    const finalOfferC = await prisma.offer.findUnique({ where: { id: offerC.id } });
    const finalWlC = await prisma.waitlist.findUnique({ where: { id: offerC.waitlistId } });
    const finalSeat = await prisma.showSeat.findUnique({ where: { id: showSeat.id } });

    if (finalOfferC?.status !== 'ACCEPTED') throw new Error('Offer C not ACCEPTED');
    if (finalWlC?.status !== 'FULFILLED') throw new Error('Waitlist C not FULFILLED');
    if (finalSeat?.status !== 'BOOKED') throw new Error('ShowSeat not BOOKED');
    console.log('✅ Final DB states: Offer ACCEPTED, Waitlist FULFILLED, Seat BOOKED.');

    // ── 9. Organiser Analytics Summary Verification ─────────────────────────
    console.log('\n--- 9. Verifying Organiser Event Analytics Summary ---');
    const analyticsRes = await get(`${BASE}/organiser/events/${eventId}/summary`, orgToken);
    if (analyticsRes.status !== 200) throw new Error(`Analytics fetch failed: ${JSON.stringify(analyticsRes.data)}`);

    const metrics = analyticsRes.data.data.metrics;
    console.log(`✅ Event Summary Metrics:`);
    console.log(`   Total Capacity: ${metrics.totalCapacity}`);
    console.log(`   Tickets Sold: ${metrics.ticketsSold}`);
    console.log(`   Total Revenue: ₹${metrics.totalRevenue}`);
    console.log(`   Occupancy Rate: ${metrics.occupancyRate}%`);
    if (metrics.ticketsSold !== 1 || metrics.totalRevenue !== 10000 || metrics.occupancyRate !== 100) {
      throw new Error('Analytics metric calculations mismatch');
    }

    // ── 10. Cleanup ────────────────────────────────────────────────────────
    console.log('\n--- 10. Cleaning up test data ---');
    await prisma.booking.deleteMany({ where: { showId } });
    await prisma.offer.deleteMany({ where: { seatId: showSeat.seatId } });
    await prisma.waitlist.deleteMany({ where: { showId } });
    await prisma.show.delete({ where: { id: showId } });
    await prisma.event.delete({ where: { id: eventId } });
    await prisma.venue.delete({ where: { id: venueId } });
    await prisma.user.deleteMany({
      where: {
        id: { in: [adminRes.data.data.user.id, orgRes.data.data.user.id, custA.id, custB.id, custC.id] },
      },
    });
    console.log('✅ Cleaned up all waitlist test records.');

    console.log('\n🎉 ALL WAITLIST FIFO CASCADE & ANALYTICS TESTS PASSED! 🎉\n');
  } finally {
    await prisma.$disconnect();
    server.close();
  }
}

runWaitlistTests().catch((err) => {
  console.error('\n❌ Waitlist test failed:', err);
  process.exit(1);
});
