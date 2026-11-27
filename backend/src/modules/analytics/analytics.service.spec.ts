import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { AuthUser } from '../../common/types/auth-user.interface';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService — Phase 10.5.9', () => {
  const makeMockPrisma = () => ({
    organization: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1n,
        status: 'ACTIVE',
        deletedAt: null,
        settings: { defaultTimezone: 'Asia/Kolkata', defaultCurrency: 'INR' },
      }),
    },
    hospitalBranch: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1n, name: 'Main Clinic', code: 'MAIN' },
        { id: 2n, name: 'North Branch', code: 'NORTH' },
      ]),
    },
    userBranchMembership: {
      findMany: jest.fn().mockResolvedValue([{ branchId: 1n }]),
    },
    doctor: {
      findFirst: jest.fn().mockResolvedValue({ id: 10n }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(2),
    },
    patient: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    appointment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    consultation: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    followUp: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    notificationDelivery: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    invoicePayment: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    invoiceRefund: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    invoiceItem: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    lab: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    medicine: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    medicineBatch: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    pharmacyDispensation: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    goodsReceipt: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    purchaseOrder: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    platformAuditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  });

  const adminUser: AuthUser = {
    id: '1',
    email: 'admin@clinic.in',
    name: 'Clinic Admin',
    group: 'Admin',
    permissions: [
      HospitalPermission.DASHBOARD_VIEW,
      HospitalPermission.DASHBOARD_FINANCIAL_VIEW,
      HospitalPermission.DASHBOARD_BRANCH_COMPARE,
    ],
    organizationId: 1n,
    branchId: 1n,
  };

  describe('Date Handling & Timezone Boundaries', () => {
    it('computes today, yesterday, last7Days, last30Days, and custom ranges in Asia/Kolkata timezone', () => {
      const prisma = makeMockPrisma();
      const service = new AnalyticsService(prisma as never);
      // 2026-11-27T01:00:00+05:30 is 2026-11-26T19:30:00.000Z in UTC
      const nowUtc = new Date('2026-11-26T19:30:00.000Z');

      const today = service.parseOrgDateRange({ period: 'today' }, 'Asia/Kolkata', nowUtc);
      expect(today.startStr).toBe('2026-11-27');
      expect(today.endStr).toBe('2026-11-27');
      // 2026-11-27 00:00:00+05:30 == 2026-11-26T18:30:00.000Z
      expect(today.start.toISOString()).toBe('2026-11-26T18:30:00.000Z');

      const yesterday = service.parseOrgDateRange({ period: 'yesterday' }, 'Asia/Kolkata', nowUtc);
      expect(yesterday.startStr).toBe('2026-11-26');
      expect(yesterday.endStr).toBe('2026-11-26');

      const last7 = service.parseOrgDateRange({ period: 'last7Days' }, 'Asia/Kolkata', nowUtc);
      expect(last7.startStr).toBe('2026-11-21');
      expect(last7.endStr).toBe('2026-11-27');

      const last30 = service.parseOrgDateRange({ period: 'last30Days' }, 'Asia/Kolkata', nowUtc);
      expect(last30.startStr).toBe('2026-10-29');
      expect(last30.endStr).toBe('2026-11-27');

      const custom = service.parseOrgDateRange(
        { period: 'custom', startDate: '2026-11-01', endDate: '2026-11-15' },
        'Asia/Kolkata',
        nowUtc,
      );
      expect(custom.startStr).toBe('2026-11-01');
      expect(custom.endStr).toBe('2026-11-15');
    });
  });

  describe('Security & Tenant / Branch / Role Isolation', () => {
    it('rejects suspended organizations', async () => {
      const prisma = makeMockPrisma();
      prisma.organization.findUnique.mockResolvedValue({
        id: 1n,
        status: 'SUSPENDED',
        deletedAt: null,
        settings: null,
      });
      const service = new AnalyticsService(prisma as never);
      await expect(service.getOverview(adminUser, {})).rejects.toThrow(ForbiddenException);
    });

    it('rejects cross-organization branch access', async () => {
      const prisma = makeMockPrisma();
      const service = new AnalyticsService(prisma as never);
      await expect(
        service.getOverview(adminUser, { branchId: '999' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects unauthorized branch access for non-admin branch user', async () => {
      const prisma = makeMockPrisma();
      const branchStaff: AuthUser = {
        ...adminUser,
        group: 'Receptionist',
        permissions: [HospitalPermission.DASHBOARD_VIEW],
        branchId: 1n,
      };
      const service = new AnalyticsService(prisma as never);
      await expect(
        service.getOverview(branchStaff, { branchId: '2' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('restricts Doctor role to their own operational metrics', async () => {
      const prisma = makeMockPrisma();
      const docUser: AuthUser = {
        ...adminUser,
        group: 'Doctor',
        permissions: [HospitalPermission.DASHBOARD_VIEW],
      };
      const service = new AnalyticsService(prisma as never);
      await expect(
        service.getDoctorAnalytics(docUser, { doctorId: '99' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies financial analytics to non-financial roles', async () => {
      const prisma = makeMockPrisma();
      const nurseUser: AuthUser = {
        ...adminUser,
        group: 'Nurse',
        permissions: [HospitalPermission.DASHBOARD_VIEW],
      };
      const service = new AnalyticsService(prisma as never);
      await expect(
        service.getFinanceAnalytics(nurseUser, {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Financial, Clinical & Inventory Accuracy', () => {
    it('reconciles gross finalized invoices, partial payments, refunds, and outstanding balances accurately', async () => {
      const prisma = makeMockPrisma();
      prisma.payment.findMany
        // First call: invoicesInPeriod (already filtered by status NOT IN CANCELLED/DRAFT)
        .mockResolvedValueOnce([
          { id: 1n, grossTotal: new Prisma.Decimal('1000.00'), date: '2026-11-27', branchId: 1n, status: 'PARTIALLY_PAID' },
          { id: 2n, grossTotal: new Prisma.Decimal('500.50'), date: '2026-11-27', branchId: 1n, status: 'PAID' },
        ])
        // Second call: unsettled invoices
        .mockResolvedValueOnce([
          {
            id: 1n,
            grossTotal: new Prisma.Decimal('1000.00'),
            payments: [{ amount: new Prisma.Decimal('600.00') }],
            refunds: [{ amount: new Prisma.Decimal('100.00') }],
          },
        ]);
      prisma.invoicePayment.findMany.mockResolvedValueOnce([
        { id: 10n, amount: new Prisma.Decimal('600.00'), method: 'UPI', branchId: 1n, createdAt: new Date() },
        { id: 11n, amount: new Prisma.Decimal('500.50'), method: 'Cash', branchId: 1n, createdAt: new Date() },
      ]);
      prisma.invoiceRefund.findMany.mockResolvedValueOnce([
        { id: 20n, amount: new Prisma.Decimal('100.00'), refundedAt: new Date(), branchId: 1n },
      ]);

      const service = new AnalyticsService(prisma as never);
      const fin = await service.getFinanceAnalytics(adminUser, { period: 'today' });

      expect(fin.summary.grossFinalizedInvoiceAmount).toBe(1500.5);
      expect(fin.summary.totalCollectedPayments).toBe(1100.5);
      expect(fin.summary.refundTotals).toBe(100);
      expect(fin.summary.netCollectedRevenue).toBe(1000.5);
      // Unsettled invoice #1: 1000 - (600 - 100) = 500
      expect(fin.summary.outstandingBalance).toBe(500);
    });

    it('excludes cancelled and future appointments from the no-show denominator', async () => {
      const prisma = makeMockPrisma();
      const todayStr = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const futureStr = tomorrow.toISOString().slice(0, 10);

      prisma.appointment.findMany.mockResolvedValueOnce([
        { id: 1n, date: todayStr, sTime: '09:00', status: 'Completed', visitType: 'first_visit', mode: 'in_person', doctorId: 1n, branchId: 1n, doctor: { id: 1n, name: 'Dr. A', department: 'OPD' } },
        { id: 2n, date: todayStr, sTime: '10:00', status: 'No-Show', visitType: 'first_visit', mode: 'in_person', doctorId: 1n, branchId: 1n, doctor: { id: 1n, name: 'Dr. A', department: 'OPD' } },
        { id: 3n, date: todayStr, sTime: '11:00', status: 'Cancelled', visitType: 'first_visit', mode: 'in_person', doctorId: 1n, branchId: 1n, doctor: { id: 1n, name: 'Dr. A', department: 'OPD' } },
        // Future scheduled & even erroneous future no-show must not count as no-show
        { id: 4n, date: futureStr, sTime: '12:00', status: 'Scheduled', visitType: 'first_visit', mode: 'in_person', doctorId: 1n, branchId: 1n, doctor: { id: 1n, name: 'Dr. A', department: 'OPD' } },
      ]);

      const service = new AnalyticsService(prisma as never);
      const res = await service.getAppointmentAnalytics(adminUser, {
        period: 'custom',
        startDate: todayStr,
        endDate: futureStr,
      });

      expect(res.summary.totalAppointments).toBe(4);
      expect(res.summary.cancelledAppointments).toBe(1);
      expect(res.summary.noShowAppointments).toBe(1);
      // Denominator: 4 total - 1 cancelled - 1 future = 2
      expect(res.summary.noShowDenominator).toBe(2);
      expect(res.summary.noShowRatePercent).toBe(50);
    });

    it('handles missing demographic fields without inference and computes pharmacy valuation from active batches', async () => {
      const prisma = makeMockPrisma();
      prisma.patient.findMany.mockResolvedValueOnce([
        { id: 1n, branchId: 1n, age: null, birthdate: null, sex: null, createdAt: new Date() },
        { id: 2n, branchId: 1n, age: '28', birthdate: null, sex: 'Female', createdAt: new Date() },
      ]);

      const service = new AnalyticsService(prisma as never);
      const patRes = await service.getPatientAnalytics(adminUser, { period: 'today' });
      const unknownAge = patRes.ageGroupDistribution.find((a) => a.group === 'Unknown');
      const unknownGender = patRes.genderDistribution.find((g) => g.gender === 'Unknown');
      expect(unknownAge?.count).toBe(1);
      expect(unknownGender?.count).toBe(1);

      // Pharmacy valuation: excludes EXPIRED batch, computes from ACTIVE batch qty * cost/selling
      const futureExp = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
      const pastExp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      prisma.medicine.findMany.mockResolvedValueOnce([
        { id: 1n, name: 'Paracetamol', reorderLevel: 20 },
      ]);
      prisma.medicineBatch.findMany.mockResolvedValueOnce([
        { id: 1n, medicineId: 1n, branchId: 1n, currentQuantity: 10, costPrice: new Prisma.Decimal('5.00'), sellingPrice: new Prisma.Decimal('8.00'), expiryDate: futureExp, status: 'ACTIVE' },
        { id: 2n, medicineId: 1n, branchId: 1n, currentQuantity: 50, costPrice: new Prisma.Decimal('5.00'), sellingPrice: new Prisma.Decimal('8.00'), expiryDate: pastExp, status: 'EXPIRED' },
      ]);

      const pharmRes = await service.getPharmacyAnalytics(adminUser, { period: 'today' });
      expect(pharmRes.summary.stockCostValuation).toBe(50);
      expect(pharmRes.summary.stockRetailValuation).toBe(80);
      expect(pharmRes.summary.expiredBatchCount).toBe(1);
      expect(pharmRes.summary.lowStockMedicineCount).toBe(1);
    });

    it('sanitizes CSV formula injection characters on export', async () => {
      const prisma = makeMockPrisma();
      prisma.doctor.findMany.mockResolvedValueOnce([
        { id: 1n, name: '=cmd|"/C calc"!A0', department: '+SUM(1,2)', branchId: 1n },
      ]);
      const service = new AnalyticsService(prisma as never);
      const { csv } = await service.exportAnalyticsCsv(adminUser, 'doctors', { period: 'today' });
      expect(csv).toContain(`"'=cmd|""/C calc""!A0"`);
      expect(csv).toContain(`"'+SUM(1,2)"`);
    });
  });
});
