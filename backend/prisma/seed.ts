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

  // 3. Phase 19 Standard Staff Designations
  const defaultDesignations = [
    { code: 'NURSE-STAFF', title: 'Staff Nurse', category: 'NURSING', description: 'General inpatient/outpatient registered nurse' },
    { code: 'NURSE-HEAD', title: 'Head Nurse / Matron', category: 'NURSING', description: 'Supervising ward and clinical nursing operations' },
    { code: 'REC-FRONT', title: 'Front Desk Receptionist', category: 'RECEPTION', description: 'Patient registration, appointments and check-in' },
    { code: 'REC-CHIEF', title: 'Chief Receptionist', category: 'RECEPTION', description: 'Front desk supervisor and patient coordination' },
    { code: 'PHARM-TECH', title: 'Pharmacy Technician', category: 'PHARMACY', description: 'Dispensing and medication inventory maintenance' },
    { code: 'PHARM-CHIEF', title: 'Chief Pharmacist', category: 'PHARMACY', description: 'Licensed pharmacist in charge of pharmacy operations' },
    { code: 'LAB-TECH', title: 'Laboratory Technician', category: 'LABORATORY', description: 'Sample collection and diagnostic test execution' },
    { code: 'LAB-SCIENTIST', title: 'Senior Medical Laboratory Scientist', category: 'LABORATORY', description: 'Validation and quality assurance of pathology/lab reports' },
    { code: 'ACC-STAFF', title: 'Hospital Accountant', category: 'FINANCE', description: 'General accounting, billing audit and financial books' },
    { code: 'CASHIER-SENIOR', title: 'Senior Cashier & Treasury Officer', category: 'FINANCE', description: 'Shift settlement, drawer oversight and bank reconciliations' },
    { code: 'RAD-TECH', title: 'Radiologic Technologist', category: 'RADIOLOGY', description: 'X-Ray, CT, Ultrasound imaging specialist' },
    { code: 'HR-OFFICER', title: 'HR & Administrative Officer', category: 'ADMINISTRATION', description: 'Staff records, department allocations and HR administration' },
  ];

  for (const desig of defaultDesignations) {
    await prisma.staffDesignation.upsert({
      where: { code: desig.code },
      update: {
        title: desig.title,
        category: desig.category,
        description: desig.description,
        isActive: true,
      },
      create: {
        code: desig.code,
        title: desig.title,
        category: desig.category,
        description: desig.description,
        isActive: true,
      },
    });
    console.log(`Seeded staff designation: ${desig.code} - ${desig.title}`);
  }

  // 4. Phase 20 Standard Chart of Accounts (COA)
  const defaultAccounts = [
    { accountCode: '1010', accountName: 'Cash on Hand', accountType: 'ASSET', normalBalance: 'DEBIT', isSystemAccount: true, description: 'Hospital Vault and Cashier Drawers' },
    { accountCode: '1020', accountName: 'Bank Account - Operating', accountType: 'ASSET', normalBalance: 'DEBIT', isSystemAccount: true, description: 'Primary hospital operational bank account' },
    { accountCode: '1030', accountName: 'Bank Account - Treasury', accountType: 'ASSET', normalBalance: 'DEBIT', isSystemAccount: false, description: 'Treasury reserve and capital expenditure account' },
    { accountCode: '1200', accountName: 'Accounts Receivable', accountType: 'ASSET', normalBalance: 'DEBIT', isSystemAccount: true, description: 'Outstanding patient and corporate insurance receivables' },
    { accountCode: '1300', accountName: 'Medical & Pharmacy Inventory', accountType: 'ASSET', normalBalance: 'DEBIT', isSystemAccount: true, description: 'Valuation of on-hand pharmaceuticals and medical consumables' },
    { accountCode: '1400', accountName: 'Prepaid Expenses', accountType: 'ASSET', normalBalance: 'DEBIT', isSystemAccount: false, description: 'Prepaid rent, insurance, and vendor advances' },
    { accountCode: '1500', accountName: 'Medical Equipment & Machinery', accountType: 'ASSET', normalBalance: 'DEBIT', isSystemAccount: false, description: 'Diagnostic and clinical fixed assets' },
    { accountCode: '2010', accountName: 'Accounts Payable', accountType: 'LIABILITY', normalBalance: 'CREDIT', isSystemAccount: true, description: 'Pending vendor and supplier invoices' },
    { accountCode: '2020', accountName: 'Accrued Payroll & Salaries', accountType: 'LIABILITY', normalBalance: 'CREDIT', isSystemAccount: true, description: 'Unpaid staff salaries and benefits' },
    { accountCode: '2030', accountName: 'Patient Deposits & Advances', accountType: 'LIABILITY', normalBalance: 'CREDIT', isSystemAccount: true, description: 'Unearned inpatient deposits and pre-payments' },
    { accountCode: '3010', accountName: 'Hospital Retained Earnings', accountType: 'EQUITY', normalBalance: 'CREDIT', isSystemAccount: true, description: 'Accumulated hospital net surplus or deficit' },
    { accountCode: '3020', accountName: 'Hospital Capital & Endowment', accountType: 'EQUITY', normalBalance: 'CREDIT', isSystemAccount: false, description: 'Owner capital and institutional endowment' },
    { accountCode: '4100', accountName: 'Patient Service Revenue - Outpatient', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystemAccount: true, description: 'Consultation and outpatient clinical fees' },
    { accountCode: '4110', accountName: 'Inpatient Care & Bed Revenue', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystemAccount: true, description: 'Admission, accommodation and inpatient nursing' },
    { accountCode: '4120', accountName: 'Pharmacy Sales Revenue', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystemAccount: true, description: 'Pharmaceutical dispensing revenue' },
    { accountCode: '4130', accountName: 'Laboratory Diagnostic Revenue', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystemAccount: true, description: 'Pathology and lab diagnostic test billings' },
    { accountCode: '4140', accountName: 'Radiology & Imaging Revenue', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystemAccount: true, description: 'X-Ray, Ultrasound, CT and MRI procedure revenue' },
    { accountCode: '4200', accountName: 'Other Operating Revenue', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystemAccount: false, description: 'Canteen, parking, and administrative fees' },
    { accountCode: '5100', accountName: 'Medical & Surgical Consumables', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystemAccount: true, description: 'Direct clinical supplies, gloves, syringes, and reagents' },
    { accountCode: '5200', accountName: 'Utilities & Telecommunications', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystemAccount: true, description: 'Electricity, water, gas, telephone, and internet' },
    { accountCode: '5300', accountName: 'Hospital Maintenance & Repairs', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystemAccount: true, description: 'Biomedical maintenance, plumbing, electrical, and HVAC repairs' },
    { accountCode: '5400', accountName: 'Staff Training & Admin Expenses', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystemAccount: false, description: 'Professional development, licenses, and office supplies' },
    { accountCode: '5500', accountName: 'Facility Rent & Building Leases', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystemAccount: false, description: 'Hospital building and clinic rent' },
    { accountCode: '5600', accountName: 'Housekeeping & Waste Disposal', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystemAccount: false, description: 'Cleaning, janitorial, and hazardous waste disposal' },
    { accountCode: '5900', accountName: 'Concessions & Bad Debt Expense', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystemAccount: true, description: 'Authorized patient fee waivers, discounts and write-offs' },
  ];

  const accountMap = new Map<string, bigint>();
  for (const acc of defaultAccounts) {
    const record = await prisma.account.upsert({
      where: { accountCode: acc.accountCode },
      update: {
        accountName: acc.accountName,
        accountType: acc.accountType as any,
        normalBalance: acc.normalBalance as any,
        isSystemAccount: acc.isSystemAccount,
        description: acc.description,
        isActive: true,
      },
      create: {
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType as any,
        normalBalance: acc.normalBalance as any,
        isSystemAccount: acc.isSystemAccount,
        description: acc.description,
        isActive: true,
        currency: 'PKR',
      },
    });
    accountMap.set(acc.accountCode, record.id);
    console.log(`Seeded account: ${acc.accountCode} - ${acc.accountName}`);
  }

  // 5. Phase 20 Standard Expense Categories
  const defaultExpenseCategories = [
    { code: 'UTIL', name: 'Utilities & Telecom', accountCode: '5200', description: 'Electricity, water, gas, broadband' },
    { code: 'MAINT', name: 'Maintenance & Repairs', accountCode: '5300', description: 'Equipment servicing, biomedical maintenance' },
    { code: 'SUPPLIES', name: 'Clinical & Office Supplies', accountCode: '5100', description: 'Disposables, office stationery, patient care items' },
    { code: 'ADMIN', name: 'Administrative & Licensing', accountCode: '5400', description: 'Regulatory permits, legal, professional fees' },
    { code: 'CLEAN', name: 'Housekeeping & Bio-Waste', accountCode: '5600', description: 'Sanitation, laundry, and biohazard waste disposal' },
  ];

  for (const cat of defaultExpenseCategories) {
    const accId = accountMap.get(cat.accountCode);
    await prisma.expenseCategory.upsert({
      where: { code: cat.code },
      update: {
        name: cat.name,
        description: cat.description,
        accountId: accId,
        isActive: true,
      },
      create: {
        code: cat.code,
        name: cat.name,
        description: cat.description,
        accountId: accId,
        isActive: true,
      },
    });
    console.log(`Seeded expense category: ${cat.code} - ${cat.name}`);
  }

  // 6. Phase 20 Initial Open Accounting Period
  await prisma.accountingPeriod.upsert({
    where: { periodCode: 'FY2026-M11' },
    update: {
      name: 'November 2026',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      endDate: new Date('2026-11-30T23:59:59.999Z'),
      status: 'OPEN',
    },
    create: {
      periodCode: 'FY2026-M11',
      name: 'November 2026',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      endDate: new Date('2026-11-30T23:59:59.999Z'),
      status: 'OPEN',
    },
  });
  console.log('Seeded initial open accounting period: FY2026-M11 (November 2026)');

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
