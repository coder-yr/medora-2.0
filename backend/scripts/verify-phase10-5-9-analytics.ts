import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Prisma } from '@prisma/client';
import { HospitalPermission } from '../src/common/constants/permissions.enum';
import { AuthUser } from '../src/common/types/auth-user.interface';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

const prisma = new PrismaService();

async function run() {
  console.log('========================================================================');
  console.log('  MEDORA 2.0 — PHASE 10.5.9 ANALYTICS & BI LIVE DB VERIFICATION         ');
  console.log('========================================================================\n');

  const service = new AnalyticsService(prisma as never);
  const org = await prisma.organization.findFirst({ where: { status: 'ACTIVE', deletedAt: null } });
  if (!org) throw new Error('No active organization found.');

  const userRecord = await prisma.user.findFirst({ where: { organizationId: org.id } });
  if (!userRecord) throw new Error('No user found for organization.');

  const adminUser: AuthUser = {
    id: userRecord.id.toString(),
    email: userRecord.email,
    name: `${userRecord.firstName} ${userRecord.lastName}`,
    group: 'Admin',
    permissions: [
      HospitalPermission.DASHBOARD_VIEW,
      HospitalPermission.DASHBOARD_FINANCIAL_VIEW,
      HospitalPermission.DASHBOARD_BRANCH_COMPARE,
      HospitalPermission.LAB_REPORTS,
      HospitalPermission.PHARMACY_REPORTS,
    ],
    organizationId: org.id,
    branchId: userRecord.branchId,
  };

  // 1. Run all 9 endpoints + CSV export
  const filter = { period: 'last30Days' as const, granularity: 'day' as const };

  const [ov, pat, apt, doc, fin, lab, pharm, fu, br, exp] = await Promise.all([
    service.getOverview(adminUser, filter),
    service.getPatientAnalytics(adminUser, filter),
    service.getAppointmentAnalytics(adminUser, filter),
    service.getDoctorAnalytics(adminUser, filter),
    service.getFinanceAnalytics(adminUser, filter),
    service.getLaboratoryAnalytics(adminUser, filter),
    service.getPharmacyAnalytics(adminUser, filter),
    service.getFollowUpAnalytics(adminUser, filter),
    service.getBranchAnalytics(adminUser, filter),
    service.exportAnalyticsCsv(adminUser, 'overview', filter),
  ]);

  console.log('[PASS] 1. Overview KPIs:', JSON.stringify(ov.cumulativeKpis), JSON.stringify(ov.periodKpis));
  console.log('[PASS] 2. Patient Analytics:', JSON.stringify(pat.summary));
  console.log('[PASS] 3. Appointment Analytics:', JSON.stringify(apt.summary));
  console.log('[PASS] 4. Doctor Analytics:', doc.doctors.length, 'doctor(s)');
  console.log('[PASS] 5. Finance Analytics:', JSON.stringify(fin.summary));
  console.log('[PASS] 6. Laboratory Analytics:', JSON.stringify(lab.summary));
  console.log('[PASS] 7. Pharmacy Analytics:', JSON.stringify(pharm.summary));
  console.log('[PASS] 8. Follow-up Analytics:', JSON.stringify(fu.clinicalFollowUps));
  console.log('[PASS] 9. Branch Comparison:', br.branches.length, 'branch(es)');
  console.log('[PASS] 10. CSV Export:', exp.filename, `(${exp.csv.length} bytes)`);

  // 2. Reconcile Financial Analytics against raw PostgreSQL tables
  const rawInvoices = await prisma.payment.findMany({
    where: {
      organizationId: org.id,
      branchId: { not: null },
      status: { notIn: ['CANCELLED', 'DRAFT', 'cancelled', 'draft'] },
      date: { gte: ov.meta.startDate, lte: ov.meta.endDate },
    },
    select: { grossTotal: true },
  });
  let expectedGross = new Prisma.Decimal(0);
  for (const r of rawInvoices) expectedGross = expectedGross.plus(r.grossTotal);
  const expectedGrossNum = Math.round(Number(expectedGross) * 100) / 100;

  if (Math.abs(fin.summary.grossFinalizedInvoiceAmount - expectedGrossNum) > 0.01) {
    throw new Error(
      `Financial reconciliation mismatch! Analytics=${fin.summary.grossFinalizedInvoiceAmount}, Raw=${expectedGrossNum}`,
    );
  }
  console.log(`[PASS] Financial Reconciliation Verified: ${fin.summary.grossFinalizedInvoiceAmount} == ${expectedGrossNum}`);

  // 3. Query Plan Inspection (EXPLAIN ANALYZE)
  console.log('\n--- Query Plan Inspection (EXPLAIN ANALYZE) ---');
  const plans = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
    `EXPLAIN ANALYZE SELECT id, gross_total, status FROM payment WHERE organization_id = ${org.id} AND status NOT IN ('CANCELLED','DRAFT') LIMIT 50;`,
  );
  for (const row of plans) {
    console.log('  ', row['QUERY PLAN']);
  }

  console.log('\n========================================================================');
  console.log('  ALL PHASE 10.5.9 LIVE VERIFICATION & RECONCILIATION CHECKS PASSED!     ');
  console.log('========================================================================');
}

run()
  .catch((e) => {
    console.error('[FAIL] Verification error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
