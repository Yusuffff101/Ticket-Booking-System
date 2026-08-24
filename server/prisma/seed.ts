import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing users
  await prisma.user.deleteMany({});

  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  // 1. Super Admin
  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@ticketbooking.com',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  // 2. Organisers
  const organiser1 = await prisma.user.create({
    data: {
      name: 'Cineworld Manager',
      email: 'cinema@cineworld.com',
      passwordHash,
      role: Role.ORGANISER,
    },
  });

  const organiser2 = await prisma.user.create({
    data: {
      name: 'Live Nation Promoter',
      email: 'concerts@livenation.com',
      passwordHash,
      role: Role.ORGANISER,
    },
  });

  // 3. Customers
  const customer1 = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      passwordHash,
      role: Role.CUSTOMER,
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      name: 'Bob Smith',
      email: 'bob@example.com',
      passwordHash,
      role: Role.CUSTOMER,
    },
  });

  const customer3 = await prisma.user.create({
    data: {
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      passwordHash,
      role: Role.CUSTOMER,
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log('---------------------------------------------------------');
  console.log('Default Password for all seeded accounts:', defaultPassword);
  console.log('Seeded Users:');
  console.log(`- ADMIN:     ${admin.email} (Role: ${admin.role})`);
  console.log(`- ORGANISER: ${organiser1.email} (Role: ${organiser1.role})`);
  console.log(`- ORGANISER: ${organiser2.email} (Role: ${organiser2.role})`);
  console.log(`- CUSTOMER:  ${customer1.email} (Role: ${customer1.role})`);
  console.log(`- CUSTOMER:  ${customer2.email} (Role: ${customer2.role})`);
  console.log(`- CUSTOMER:  ${customer3.email} (Role: ${customer3.role})`);
  console.log('---------------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
