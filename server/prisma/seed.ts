import { PrismaClient, Role, EventType, SeatCategory, SeatStatus, BookingStatus, WaitlistStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Decimal } from '@prisma/client/runtime/library.js';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

const generateQR = async (payload: object): Promise<string> => {
  return QRCode.toDataURL(JSON.stringify(payload), {
    errorCorrectionLevel: 'H',
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    width: 250,
  });
};

async function main() {
  console.log('🌱 Starting comprehensive database seeding...\n');

  // Clean all existing tables in reverse dependency order
  console.log('🧹 Cleaning existing records...');
  await prisma.offer.deleteMany({});
  await prisma.waitlist.deleteMany({});
  await prisma.showSeat.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.show.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.seat.deleteMany({});
  await prisma.venue.deleteMany({});
  await prisma.user.deleteMany({});

  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  // ── 1. Create Users ───────────────────────────────────────────────────────
  console.log('👥 Creating user accounts...');
  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@ticketbooking.com',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const orgCinema = await prisma.user.create({
    data: {
      name: 'Cineworld Manager',
      email: 'cinema@cineworld.com',
      passwordHash,
      role: Role.ORGANISER,
    },
  });

  const orgConcerts = await prisma.user.create({
    data: {
      name: 'Live Nation Promoter',
      email: 'concerts@livenation.com',
      passwordHash,
      role: Role.ORGANISER,
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      name: 'Main Customer',
      email: 'customer1@example.com',
      passwordHash,
      role: Role.CUSTOMER,
    },
  });

  const customerAlice = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      passwordHash,
      role: Role.CUSTOMER,
    },
  });

  const customerBob = await prisma.user.create({
    data: {
      name: 'Bob Smith',
      email: 'bob@example.com',
      passwordHash,
      role: Role.CUSTOMER,
    },
  });

  console.log('   ✅ 6 Users created (1 Admin, 2 Organisers, 3 Customers)');

  // ── 2. Create Venues & Custom Seat Grids ──────────────────────────────────
  console.log('\n🏛️ Creating Venues and Seat Grids...');

  // Venue 1: IMAX Grand Theater (8 rows × 10 cols = 80 seats)
  const venue1 = await prisma.venue.create({
    data: {
      name: 'IMAX Grand Theater',
      address: '70mm Cinepolis Blvd, Forum Mall',
      city: 'Bengaluru',
      totalRows: 8,
      totalCols: 10,
      layoutJson: [
        { row: 'A', startCol: 1, endCol: 10, category: 'PREMIUM' },
        { row: 'B', startCol: 1, endCol: 10, category: 'PREMIUM' },
        { row: 'C', startCol: 1, endCol: 10, category: 'STANDARD' },
        { row: 'D', startCol: 1, endCol: 10, category: 'STANDARD' },
        { row: 'E', startCol: 1, endCol: 10, category: 'STANDARD' },
        { row: 'F', startCol: 1, endCol: 10, category: 'STANDARD' },
        { row: 'G', startCol: 1, endCol: 10, category: 'ECONOMY' },
        { row: 'H', startCol: 1, endCol: 10, category: 'ECONOMY' },
      ],
    },
  });

  const v1Seats: any[] = [];
  const v1RowCategories: Record<string, SeatCategory> = {
    A: SeatCategory.PREMIUM,
    B: SeatCategory.PREMIUM,
    C: SeatCategory.STANDARD,
    D: SeatCategory.STANDARD,
    E: SeatCategory.STANDARD,
    F: SeatCategory.STANDARD,
    G: SeatCategory.ECONOMY,
    H: SeatCategory.ECONOMY,
  };

  for (const [row, cat] of Object.entries(v1RowCategories)) {
    for (let col = 1; col <= 10; col++) {
      v1Seats.push({
        venueId: venue1.id,
        row,
        col,
        seatNumber: `${row}-${col}`,
        category: cat,
      });
    }
  }
  await prisma.seat.createMany({ data: v1Seats });
  console.log('   ✅ Venue 1: IMAX Grand Theater (80 seats: 20 Premium, 40 Standard, 20 Economy)');

  // Venue 2: Arena Concert Bowl (10 rows × 12 cols = 120 seats)
  const venue2 = await prisma.venue.create({
    data: {
      name: 'Arena Concert Bowl',
      address: '42 Stadium Road, Olympic Park',
      city: 'Mumbai',
      totalRows: 10,
      totalCols: 12,
      layoutJson: [
        { row: 'A', startCol: 1, endCol: 12, category: 'PREMIUM' },
        { row: 'B', startCol: 1, endCol: 12, category: 'PREMIUM' },
        { row: 'C', startCol: 1, endCol: 12, category: 'PREMIUM' },
        { row: 'D', startCol: 1, endCol: 12, category: 'STANDARD' },
        { row: 'E', startCol: 1, endCol: 12, category: 'STANDARD' },
        { row: 'F', startCol: 1, endCol: 12, category: 'STANDARD' },
        { row: 'G', startCol: 1, endCol: 12, category: 'STANDARD' },
        { row: 'H', startCol: 1, endCol: 12, category: 'ECONOMY' },
        { row: 'I', startCol: 1, endCol: 12, category: 'ECONOMY' },
        { row: 'J', startCol: 1, endCol: 12, category: 'ECONOMY' },
      ],
    },
  });

  const v2Seats: any[] = [];
  const v2RowCategories: Record<string, SeatCategory> = {
    A: SeatCategory.PREMIUM,
    B: SeatCategory.PREMIUM,
    C: SeatCategory.PREMIUM,
    D: SeatCategory.STANDARD,
    E: SeatCategory.STANDARD,
    F: SeatCategory.STANDARD,
    G: SeatCategory.STANDARD,
    H: SeatCategory.ECONOMY,
    I: SeatCategory.ECONOMY,
    J: SeatCategory.ECONOMY,
  };

  for (const [row, cat] of Object.entries(v2RowCategories)) {
    for (let col = 1; col <= 12; col++) {
      v2Seats.push({
        venueId: venue2.id,
        row,
        col,
        seatNumber: `${row}-${col}`,
        category: cat,
      });
    }
  }
  await prisma.seat.createMany({ data: v2Seats });
  console.log('   ✅ Venue 2: Arena Concert Bowl (120 seats: 36 Premium, 48 Standard, 36 Economy)');

  // ── 3. Create Events & Shows ──────────────────────────────────────────────
  console.log('\n🎬 Creating Events & Shows...');

  // Event 1: Oppenheimer (Movie)
  const event1 = await prisma.event.create({
    data: {
      title: 'Oppenheimer — 70mm IMAX Special',
      description: 'Christopher Nolan’s historical masterpiece presented in pristine 70mm IMAX format with uncompressed high-fidelity sound.',
      type: EventType.MOVIE,
      durationMinutes: 180,
      organiserId: orgCinema.id,
    },
  });

  // Event 2: Coldplay (Concert)
  const event2 = await prisma.event.create({
    data: {
      title: 'Coldplay: Music of the Spheres World Tour Live',
      description: 'The spectacular global stadium show featuring kinetic dance floors, sustainable power, laser spectacles, and greatest hits.',
      type: EventType.CONCERT,
      durationMinutes: 150,
      organiserId: orgConcerts.id,
    },
  });

  // Event 3: Hans Zimmer (Sold-out concert for waitlist testing)
  const event3 = await prisma.event.create({
    data: {
      title: 'Hans Zimmer Live Solo: World Tour',
      description: 'An intimate solo orchestral showcase of iconic scores: Interstellar, Inception, Dune, and The Dark Knight.',
      type: EventType.CONCERT,
      durationMinutes: 140,
      organiserId: orgConcerts.id,
    },
  });

  // Schedule Show 1: Oppenheimer (Tonight)
  const now = new Date();
  const show1 = await prisma.show.create({
    data: {
      eventId: event1.id,
      venueId: venue1.id,
      startTime: new Date(now.getTime() + 4 * 3600 * 1000), // in 4 hours
      endTime: new Date(now.getTime() + 7 * 3600 * 1000),
      categoryPricingJson: { PREMIUM: 600, STANDARD: 400, ECONOMY: 250 },
    },
  });

  // Schedule Show 2: Oppenheimer (Tomorrow evening)
  const show2 = await prisma.show.create({
    data: {
      eventId: event1.id,
      venueId: venue1.id,
      startTime: new Date(now.getTime() + 28 * 3600 * 1000), // tomorrow
      endTime: new Date(now.getTime() + 31 * 3600 * 1000),
      categoryPricingJson: { PREMIUM: 650, STANDARD: 450, ECONOMY: 280 },
    },
  });

  // Schedule Show 3: Coldplay (This Weekend)
  const show3 = await prisma.show.create({
    data: {
      eventId: event2.id,
      venueId: venue2.id,
      startTime: new Date(now.getTime() + 52 * 3600 * 1000),
      endTime: new Date(now.getTime() + 55 * 3600 * 1000),
      categoryPricingJson: { PREMIUM: 6500, STANDARD: 3500, ECONOMY: 1500 },
    },
  });

  // Schedule Show 4: Hans Zimmer (Sold out show for waitlist testing)
  const show4 = await prisma.show.create({
    data: {
      eventId: event3.id,
      venueId: venue1.id,
      startTime: new Date(now.getTime() + 76 * 3600 * 1000),
      endTime: new Date(now.getTime() + 79 * 3600 * 1000),
      categoryPricingJson: { PREMIUM: 8000, STANDARD: 4500, ECONOMY: 2000 },
    },
  });

  console.log('   ✅ 4 Shows scheduled across 3 Events');

  // ── 4. Populate ShowSeats for all Shows ────────────────────────────────────
  console.log('\n💺 Generating ShowSeat records with category pricing...');

  const allV1Seats = await prisma.seat.findMany({ where: { venueId: venue1.id } });
  const allV2Seats = await prisma.seat.findMany({ where: { venueId: venue2.id } });

  const populateShowSeats = (show: any, seats: any[], pricing: Record<string, number>) => {
    return seats.map((seat) => ({
      showId: show.id,
      seatId: seat.id,
      status: SeatStatus.AVAILABLE,
      price: new Decimal(pricing[seat.category] || 300),
    }));
  };

  await prisma.showSeat.createMany({
    data: populateShowSeats(show1, allV1Seats, { PREMIUM: 600, STANDARD: 400, ECONOMY: 250 }),
  });
  await prisma.showSeat.createMany({
    data: populateShowSeats(show2, allV1Seats, { PREMIUM: 650, STANDARD: 450, ECONOMY: 280 }),
  });
  await prisma.showSeat.createMany({
    data: populateShowSeats(show3, allV2Seats, { PREMIUM: 6500, STANDARD: 3500, ECONOMY: 1500 }),
  });
  await prisma.showSeat.createMany({
    data: populateShowSeats(show4, allV1Seats, { PREMIUM: 8000, STANDARD: 4500, ECONOMY: 2000 }),
  });

  console.log('   ✅ Generated 360 ShowSeat records (Show 1: 80, Show 2: 80, Show 3: 120, Show 4: 80)');

  // ── 5. Create Realistic Initial Bookings with QR Codes ────────────────────
  console.log('\n🎟️ Creating Initial Confirmed Bookings & QR Codes...');

  // Booking 1: Alice books 2 seats on Oppenheimer (A-5, A-6)
  const show1Seats = await prisma.showSeat.findMany({
    where: { showId: show1.id },
    include: { seat: true },
  });

  const aliceSeatIds = show1Seats
    .filter((s) => s.seat.seatNumber === 'A-5' || s.seat.seatNumber === 'A-6')
    .map((s) => s.id);

  const aliceBookingRef = 'BK-OPP-ALICE1';
  const aliceQRPayload = {
    ref: aliceBookingRef,
    showId: show1.id,
    eventTitle: event1.title,
    seats: ['A-5', 'A-6'],
    venueName: venue1.name,
  };
  const aliceQR = await generateQR(aliceQRPayload);

  const aliceBooking = await prisma.booking.create({
    data: {
      bookingReference: aliceBookingRef,
      customerId: customerAlice.id,
      showId: show1.id,
      totalAmount: new Decimal(1200),
      status: BookingStatus.CONFIRMED,
      qrCodeData: JSON.stringify(aliceQRPayload),
      qrCodeUrl: aliceQR,
    },
  });

  await prisma.showSeat.updateMany({
    where: { id: { in: aliceSeatIds } },
    data: { status: SeatStatus.BOOKED, bookingId: aliceBooking.id },
  });
  console.log('   ✅ Alice Johnson: Confirmed booking for Oppenheimer (Seats: A-5, A-6, Ref: BK-OPP-ALICE1)');

  // Booking 2: Bob books 2 seats on Coldplay (A-1, A-2)
  const show3Seats = await prisma.showSeat.findMany({
    where: { showId: show3.id },
    include: { seat: true },
  });

  const bobSeatIds = show3Seats
    .filter((s) => s.seat.seatNumber === 'A-1' || s.seat.seatNumber === 'A-2')
    .map((s) => s.id);

  const bobBookingRef = 'BK-CLD-BOB02';
  const bobQRPayload = {
    ref: bobBookingRef,
    showId: show3.id,
    eventTitle: event2.title,
    seats: ['A-1', 'A-2'],
    venueName: venue2.name,
  };
  const bobQR = await generateQR(bobQRPayload);

  const bobBooking = await prisma.booking.create({
    data: {
      bookingReference: bobBookingRef,
      customerId: customerBob.id,
      showId: show3.id,
      totalAmount: new Decimal(13000),
      status: BookingStatus.CONFIRMED,
      qrCodeData: JSON.stringify(bobQRPayload),
      qrCodeUrl: bobQR,
    },
  });

  await prisma.showSeat.updateMany({
    where: { id: { in: bobSeatIds } },
    data: { status: SeatStatus.BOOKED, bookingId: bobBooking.id },
  });
  console.log('   ✅ Bob Smith: Confirmed booking for Coldplay (Seats: A-1, A-2, Ref: BK-CLD-BOB02)');

  // Booking 3: Customer 1 books 1 Standard seat on Oppenheimer Show 2 (C-5)
  const show2Seats = await prisma.showSeat.findMany({
    where: { showId: show2.id },
    include: { seat: true },
  });

  const c1SeatIds = show2Seats
    .filter((s) => s.seat.seatNumber === 'C-5')
    .map((s) => s.id);

  const c1BookingRef = 'BK-OPP-CUST01';
  const c1QRPayload = {
    ref: c1BookingRef,
    showId: show2.id,
    eventTitle: event1.title,
    seats: ['C-5'],
    venueName: venue1.name,
  };
  const c1QR = await generateQR(c1QRPayload);

  const c1Booking = await prisma.booking.create({
    data: {
      bookingReference: c1BookingRef,
      customerId: customer1.id,
      showId: show2.id,
      totalAmount: new Decimal(450),
      status: BookingStatus.CONFIRMED,
      qrCodeData: JSON.stringify(c1QRPayload),
      qrCodeUrl: c1QR,
    },
  });

  await prisma.showSeat.updateMany({
    where: { id: { in: c1SeatIds } },
    data: { status: SeatStatus.BOOKED, bookingId: c1Booking.id },
  });
  console.log('   ✅ Main Customer: Confirmed booking for Oppenheimer Show 2 (Seat: C-5, Ref: BK-OPP-CUST01)');

  // ── 6. Sold-Out Show 4 Setup for Waitlist Testing ──────────────────────────
  console.log('\n⏳ Setting up Sold-Out Show & Waitlist Queue for Hans Zimmer...');

  const show4Seats = await prisma.showSeat.findMany({ where: { showId: show4.id } });
  
  // Create a batch booking covering all seats on Hans Zimmer show
  const zimmerBookingRef = 'BK-ZIM-SOLDOUT';
  const zimmerQRPayload = { ref: zimmerBookingRef, showId: show4.id, eventTitle: event3.title, seats: ['ALL'] };
  const zimmerQR = await generateQR(zimmerQRPayload);

  const zimmerBooking = await prisma.booking.create({
    data: {
      bookingReference: zimmerBookingRef,
      customerId: customerAlice.id,
      showId: show4.id,
      totalAmount: new Decimal(380000),
      status: BookingStatus.CONFIRMED,
      qrCodeData: JSON.stringify(zimmerQRPayload),
      qrCodeUrl: zimmerQR,
    },
  });

  // Mark all 80 seats as BOOKED
  await prisma.showSeat.updateMany({
    where: { showId: show4.id },
    data: { status: SeatStatus.BOOKED, bookingId: zimmerBooking.id },
  });
  console.log('   ✅ Hans Zimmer Show: All 80 seats set to BOOKED (100% Sold Out)');

  // Waitlist Entry 1: customer1@example.com (Position 1 for PREMIUM)
  await prisma.waitlist.create({
    data: {
      showId: show4.id,
      customerId: customer1.id,
      category: SeatCategory.PREMIUM,
      status: WaitlistStatus.PENDING,
      joinedAt: new Date(Date.now() - 30 * 60 * 1000), // 30m ago
    },
  });

  // Waitlist Entry 2: bob@example.com (Position 2 for PREMIUM)
  await prisma.waitlist.create({
    data: {
      showId: show4.id,
      customerId: customerBob.id,
      category: SeatCategory.PREMIUM,
      status: WaitlistStatus.PENDING,
      joinedAt: new Date(Date.now() - 10 * 60 * 1000), // 10m ago
    },
  });

  console.log('   ✅ Waitlist Queue populated: Position 1 (customer1@example.com), Position 2 (bob@example.com)');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log('🎉 SEED COMPLETED SUCCESSFULLY WITH PERSISTENT PRODUCTION DATA!');
  console.log('===============================================================');
  console.log('Default Password for all accounts:', defaultPassword);
  console.log('\nAvailable Test Accounts:');
  console.log('  👑 Admin:     admin@ticketbooking.com');
  console.log('  🎬 Organiser: cinema@cineworld.com');
  console.log('  🎵 Organiser: concerts@livenation.com');
  console.log('  🎟️ Customer:  customer1@example.com (Has active bookings & waitlist position #1)');
  console.log('  🎟️ Customer:  alice@example.com (Has Oppenheimer ticket + Zimmer sellout booking)');
  console.log('  🎟️ Customer:  bob@example.com (Has Coldplay ticket + Zimmer waitlist position #2)');
  console.log('===============================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
