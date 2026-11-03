import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;

  const mockPrisma: any = {
    patient: {
      count: jest.fn(),
    },
    appointment: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    consultation: {
      count: jest.fn(),
    },
    admission: {
      count: jest.fn(),
    },
    bed: {
      count: jest.fn(),
    },
    medicine: {
      count: jest.fn(),
    },
    medicineBatch: {
      count: jest.fn(),
    },
    lab: {
      count: jest.fn(),
    },
    radiologyOrder: {
      count: jest.fn(),
    },
    payment: {
      aggregate: jest.fn(),
    },
    cashTransaction: {
      aggregate: jest.fn(),
    },
    cashierShift: {
      count: jest.fn(),
    },
    notificationOutbox: {
      count: jest.fn(),
    },
    hospitalBranch: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseDateRange', () => {
    it('should generate valid inclusive bounds for today', () => {
      const range = service.parseDateRange({ period: 'today' });
      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
      expect(range.startStr).toBeDefined();
    });

    it('should validate and parse custom date range', () => {
      const range = service.parseDateRange({
        period: 'custom',
        startDate: '2026-10-01',
        endDate: '2026-10-15',
      });
      expect(range.startStr).toBe('2026-10-01');
      expect(range.endStr).toBe('2026-10-15');
    });

    it('should throw BadRequestException if custom range is inverted', () => {
      expect(() =>
        service.parseDateRange({
          period: 'custom',
          startDate: '2026-10-20',
          endDate: '2026-10-10',
        }),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException if custom range exceeds 366 days', () => {
      expect(() =>
        service.parseDateRange({
          period: 'custom',
          startDate: '2024-01-01',
          endDate: '2026-01-01',
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('resolveBranchFilter', () => {
    it('should permit global admin to view all branches', () => {
      const branchId = service.resolveBranchFilter(undefined, BigInt(1), true);
      expect(branchId).toBeNull();
    });

    it('should restrict branch-bound user to their own branchId', () => {
      const branchId = service.resolveBranchFilter(undefined, BigInt(2), false);
      expect(branchId).toBe(BigInt(2));
    });

    it('should forbid branch-bound user from inspecting other branches', () => {
      expect(() =>
        service.resolveBranchFilter('3', BigInt(2), false),
      ).toThrow(ForbiddenException);
    });
  });

  describe('getExecutiveOverview', () => {
    it('should return aggregated metrics without financial summary when canViewFinancials is false', async () => {
      mockPrisma.patient.count.mockResolvedValueOnce(150).mockResolvedValueOnce(12);
      mockPrisma.appointment.count
        .mockResolvedValueOnce(45) // total
        .mockResolvedValueOnce(38) // completed
        .mockResolvedValueOnce(2); // cancelled
      mockPrisma.consultation.count.mockResolvedValueOnce(36);
      mockPrisma.admission.count.mockResolvedValueOnce(18);
      mockPrisma.bed.count.mockResolvedValueOnce(50).mockResolvedValueOnce(18);
      mockPrisma.medicine.count.mockResolvedValueOnce(4);
      mockPrisma.medicineBatch.count.mockResolvedValueOnce(2);
      mockPrisma.lab.count.mockResolvedValueOnce(7);
      mockPrisma.radiologyOrder.count.mockResolvedValueOnce(3);
      mockPrisma.notificationOutbox.count.mockResolvedValueOnce(0);

      const overview = await service.getExecutiveOverview(
        { period: 'today' },
        BigInt(1),
        true,
        false, // canViewFinancials = false
      );

      expect(overview.patients.totalRegistered).toBe(150);
      expect(overview.patients.newInPeriod).toBe(12);
      expect(overview.appointments.completionRatePercent).toBe(88.4);
      expect(overview.inpatient.occupancyRatePercent).toBe(36);
      expect(overview.financial).toBeNull();
      expect(overview.notifications.queueStatus).toBe('HEALTHY');
    });

    it('should calculate revenue and collection metrics when canViewFinancials is true', async () => {
      mockPrisma.patient.count.mockResolvedValue(100);
      mockPrisma.appointment.count.mockResolvedValue(10);
      mockPrisma.consultation.count.mockResolvedValue(10);
      mockPrisma.admission.count.mockResolvedValue(5);
      mockPrisma.bed.count.mockResolvedValue(20);
      mockPrisma.medicine.count.mockResolvedValue(1);
      mockPrisma.medicineBatch.count.mockResolvedValue(1);
      mockPrisma.lab.count.mockResolvedValue(1);
      mockPrisma.radiologyOrder.count.mockResolvedValue(1);
      mockPrisma.notificationOutbox.count.mockResolvedValue(0);

      mockPrisma.payment.aggregate.mockResolvedValueOnce({
        _sum: {
          grossTotal: 50000,
          amountReceived: 35000,
          discount: 2000,
        },
      });
      mockPrisma.cashTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 25000 } }) // cash in
        .mockResolvedValueOnce({ _sum: { amount: 10000 } }); // non-cash in
      mockPrisma.cashierShift.count.mockResolvedValueOnce(1);

      const overview = await service.getExecutiveOverview(
        { period: 'today' },
        BigInt(1),
        true,
        true, // canViewFinancials = true
      );

      expect(overview.financial).toBeDefined();
      expect(overview.financial.recognizedRevenue).toBe(48000); // 50000 - 2000
      expect(overview.financial.cashCollections).toBe(25000);
      expect(overview.financial.nonCashCollections).toBe(10000);
      expect(overview.financial.accountsReceivable).toBe(13000); // 48000 - 35000
    });
  });

  describe('getDoctorWorkload', () => {
    it('should retrieve doctor appointments and consultation statistics', async () => {
      mockPrisma.appointment.findMany.mockResolvedValueOnce([
        {
          id: BigInt(10),
          patientId: BigInt(100),
          status: 'Scheduled',
          date: '2026-11-03',
          sTime: '09:00',
          eTime: '09:30',
          remarks: 'Followup',
        },
      ]);
      mockPrisma.appointment.count.mockResolvedValueOnce(1);
      mockPrisma.consultation.count
        .mockResolvedValueOnce(2) // draft
        .mockResolvedValueOnce(8); // completed

      const workload = await service.getDoctorWorkload(BigInt(5), { period: 'today' });
      expect(workload.doctorId).toBe('5');
      expect(workload.appointments.total).toBe(1);
      expect(workload.appointments.items[0].id).toBe('10');
      expect(workload.consultations.pendingDrafts).toBe(2);
      expect(workload.consultations.completed).toBe(8);
    });
  });

  describe('getBranchComparison', () => {
    it('should aggregate comparative statistics across active branches with caching', async () => {
      mockPrisma.hospitalBranch.findMany.mockResolvedValueOnce([
        { id: BigInt(1), name: 'Main Campus', code: 'MAIN', address: 'City Center' },
        { id: BigInt(2), name: 'North Clinic', code: 'NORTH', address: 'North Zone' },
      ]);
      mockPrisma.appointment.count.mockResolvedValue(25);
      mockPrisma.admission.count.mockResolvedValue(10);
      mockPrisma.payment.aggregate.mockResolvedValue({
        _sum: { grossTotal: 100000, discount: 5000 },
      });

      const res = await service.getBranchComparison({ period: 'today' });
      expect(res.branches).toHaveLength(2);
      expect(res.branches[0].branchCode).toBe('MAIN');
      expect(res.branches[0].netRevenue).toBe(95000);
    });
  });

  describe('getOperationalAlerts', () => {
    it('should identify actionable alerts across hospital modules', async () => {
      mockPrisma.cashierShift.count.mockResolvedValueOnce(2); // 2 shifts pending approval
      mockPrisma.lab.count.mockResolvedValueOnce(5); // 5 lab samples pending analysis
      mockPrisma.notificationOutbox.count.mockResolvedValueOnce(1); // 1 dead letter
      mockPrisma.medicineBatch.count.mockResolvedValueOnce(3); // 3 low stock batches

      const report = await service.getOperationalAlerts(BigInt(1), true);
      expect(report.totalAlerts).toBe(4);
      expect(report.alerts.some((a) => a.id === 'CASHIER_APPROVAL_PENDING')).toBe(true);
      expect(report.alerts.some((a) => a.id === 'NOTIF_DEAD_LETTER')).toBe(true);
    });
  });
});

