import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import 'dotenv/config';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required for seeding');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding Medora 2.0 PostgreSQL database...');

  // 1. Verified Legacy Laravel Accounts ($2y$12$ bcrypt hashes)
  // admin@example.com -> password: '123456'
  const legacyAdminHash = '$2y$12$.22NRrjN3xK0uqY58YrMdOy98ya62uF6FtyslgbzLGhhDa6JbOj/2';
  // banuna@mail.com -> password: '12345678'
  const legacyDoctorHash = '$2y$12$cYLfdC8GlXUIicK.b0SraOfVFsqbiGHZz9mXYqWxh8mwyRGs5R2Lu';

  await prisma.user.upsert({
    where: { login: 'admin' },
    update: {
      password: legacyAdminHash,
      email: 'admin@example.com',
      group: 'Admin',
    },
    create: {
      login: 'admin',
      email: 'admin@example.com',
      firstName: 'Hospital',
      lastName: 'Administrator',
      group: 'Admin',
      description: 'Default administrator created by the installer',
      password: legacyAdminHash,
    },
  });
  console.log('Seeded legacy administrator: admin@example.com (legacy bcrypt hash, pass: 123456)');

  await prisma.user.upsert({
    where: { login: 'doctor' },
    update: {
      password: legacyDoctorHash,
      email: 'banuna@mail.com',
      group: 'Doctor',
    },
    create: {
      login: 'doctor',
      email: 'banuna@mail.com',
      firstName: 'Banuna',
      lastName: 'Doctor',
      group: 'Doctor',
      description: 'Legacy doctor account',
      password: legacyDoctorHash,
    },
  });
  console.log('Seeded legacy doctor: banuna@mail.com (legacy bcrypt hash, pass: 12345678)');

  // 2. Staff Test Users with Argon2id hashes for ValidPassword123!
  const defaultPassword = 'ValidPassword123!';
  const argonHash = await argon2.hash(defaultPassword, { type: argon2.argon2id });

  const staffUsers = [
    {
      login: 'admin_test',
      email: 'admin.test@medora.hospital',
      firstName: 'Admin',
      lastName: 'Test',
      group: 'Admin',
      description: 'Test Administrator',
    },
    {
      login: 'doctor_test',
      email: 'doctor.test@medora.hospital',
      firstName: 'Doctor',
      lastName: 'Test',
      group: 'Doctor',
      description: 'Test Doctor',
    },
    {
      login: 'receptionist_test',
      email: 'receptionist.test@medora.hospital',
      firstName: 'Receptionist',
      lastName: 'Test',
      group: 'Receptionist',
      description: 'Test Receptionist',
    },
    {
      login: 'accountant_test',
      email: 'accountant.test@medora.hospital',
      firstName: 'Accountant',
      lastName: 'Test',
      group: 'Accountant',
      description: 'Test Accountant',
    },
    {
      login: 'nurse_test',
      email: 'nurse.test@medora.hospital',
      firstName: 'Nurse',
      lastName: 'Test',
      group: 'Nurse',
      description: 'Test Nurse',
    },
    {
      login: 'pharmacist_test',
      email: 'pharmacist.test@medora.hospital',
      firstName: 'Pharmacist',
      lastName: 'Test',
      group: 'Pharmacist',
      description: 'Test Pharmacist',
    },
    {
      login: 'laboratorist_test',
      email: 'laboratorist.test@medora.hospital',
      firstName: 'Laboratorist',
      lastName: 'Test',
      group: 'Laboratorist',
      description: 'Test Laboratorist',
    },
  ];

  for (const staff of staffUsers) {
    await prisma.user.upsert({
      where: { login: staff.login },
      update: {
        password: argonHash,
        email: staff.email,
        group: staff.group,
      },
      create: {
        login: staff.login,
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
        group: staff.group,
        description: staff.description,
        password: argonHash,
      },
    });
    console.log(`Seeded staff user: ${staff.email} (${staff.group})`);
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
