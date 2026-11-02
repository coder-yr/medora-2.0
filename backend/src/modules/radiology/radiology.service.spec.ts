import { Test, TestingModule } from '@nestjs/testing';
import { RadiologyService } from './radiology.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('RadiologyService', () => {
  let service: RadiologyService;
  let prisma: any;

  const mockPrisma: any = {
    radiologyCategory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    radiologyExam: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    radiologyOrder: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    radiologyReportAmendment: {
      create: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
    },
    doctor: {
      findUnique: jest.fn(),
    },
    payment: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RadiologyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RadiologyService>(RadiologyService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Catalogue Management', () => {
    it('should create a new category', async () => {
      prisma.radiologyCategory.findUnique.mockResolvedValue(null);
      prisma.radiologyCategory.create.mockResolvedValue({
        id: BigInt(1),
        name: 'Computed Tomography',
        modality: 'ct',
        displayOrder: 1,
        isActive: true,
      });

      const result = await service.createCategory({
        name: 'Computed Tomography',
        modality: 'ct',
      });

      expect(result.id).toBe(1);
      expect(result.name).toBe('Computed Tomography');
    });

    it('should prevent duplicate category names', async () => {
      prisma.radiologyCategory.findUnique.mockResolvedValue({ id: BigInt(1), name: 'Computed Tomography' });

      await expect(
        service.createCategory({ name: 'Computed Tomography', modality: 'ct' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create exam with auto-generated code', async () => {
      prisma.radiologyExam.count.mockResolvedValue(2);
      prisma.radiologyExam.findUnique.mockResolvedValue(null);
      prisma.radiologyExam.create.mockResolvedValue({
        id: BigInt(3),
        code: 'RAD-XRA-003',
        name: 'Chest X-Ray PA',
        modality: 'xray',
        price: new Prisma.Decimal(1500),
        active: true,
      });

      const exam = await service.createExam({
        name: 'Chest X-Ray PA',
        modality: 'xray',
        price: 1500,
      });

      expect(exam.id).toBe(3);
      expect(exam.price).toBe(1500);
    });

    it('should soft-deactivate exam instead of hard deleting if linked orders exist', async () => {
      prisma.radiologyExam.findUnique.mockResolvedValue({ id: BigInt(1), name: 'Chest X-Ray' });
      prisma.radiologyOrder.count.mockResolvedValue(5);
      prisma.radiologyExam.update.mockResolvedValue({ id: BigInt(1), active: false });

      const result = await service.deleteExam(1);
      expect(result.deactivated).toBe(true);
      expect(prisma.radiologyExam.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: { active: false },
      });
    });
  });

  describe('Order Creation & Duplicate Prevention', () => {
    it('should throw NotFoundException if patient does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrders({ patientId: 999, examIds: [1] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent duplicate active orders for the same patient and exam on the same day', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: BigInt(10), name: 'Asia Abbas' });
      prisma.radiologyExam.findMany.mockResolvedValue([
        { id: BigInt(1), name: 'Ultrasound Abdomen', modality: 'ultrasound', active: true },
      ]);
      prisma.radiologyOrder.findMany.mockResolvedValue([
        { id: BigInt(101), radiologyExamId: BigInt(1), status: 'ordered' },
      ]);

      await expect(
        service.createOrders({ patientId: 10, examIds: [1] }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create orders and raise invoice when bill=true', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: BigInt(10), name: 'Asia Abbas' });
      prisma.radiologyExam.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          name: 'Ultrasound Abdomen',
          modality: 'ultrasound',
          reportTemplate: 'Liver normal',
          price: new Prisma.Decimal(2500),
          active: true,
          paymentCategoryId: BigInt(5),
        },
      ]);
      prisma.radiologyOrder.findMany.mockResolvedValue([]);
      prisma.radiologyOrder.create.mockResolvedValue({
        id: BigInt(501),
        orderNumber: 'RAD-20261102-1234',
        patientId: BigInt(10),
        radiologyExamId: BigInt(1),
        examName: 'Ultrasound Abdomen',
        modality: 'ultrasound',
        urgent: true,
        urgency: 'urgent',
        status: 'ordered',
        findings: 'Liver normal',
      });
      prisma.payment.create.mockResolvedValue({ id: BigInt(901), grossTotal: new Prisma.Decimal(2500) });
      prisma.radiologyOrder.update.mockResolvedValue({});

      const result = await service.createOrders(
        { patientId: 10, examIds: [1], urgent: true, bill: true },
        1,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(501);
      expect(prisma.payment.create).toHaveBeenCalled();
    });
  });

  describe('Scheduling & Conflict Engine', () => {
    it('should schedule order when no room conflict exists', async () => {
      prisma.radiologyOrder.findUnique.mockResolvedValue({
        id: BigInt(501),
        status: 'ordered',
        equipmentRoom: null,
      });
      prisma.radiologyOrder.findFirst.mockResolvedValue(null);
      prisma.radiologyOrder.update.mockResolvedValue({
        id: BigInt(501),
        status: 'scheduled',
        scheduledAt: new Date('2026-11-02T10:00:00Z'),
        equipmentRoom: 'CT Suite 1',
      });

      const scheduled = await service.scheduleOrder(501, {
        scheduledAt: '2026-11-02T10:00:00Z',
        equipmentRoom: 'CT Suite 1',
      });

      expect(scheduled.status).toBe('scheduled');
      expect(scheduled.equipmentRoom).toBe('CT Suite 1');
    });

    it('should reject booking if equipment room is already booked within 30 minutes', async () => {
      prisma.radiologyOrder.findUnique.mockResolvedValue({
        id: BigInt(501),
        status: 'ordered',
        equipmentRoom: null,
      });
      prisma.radiologyOrder.findFirst.mockResolvedValue({
        id: BigInt(500),
        orderNumber: 'RAD-20261102-9999',
        equipmentRoom: 'CT Suite 1',
        scheduledAt: new Date('2026-11-02T10:15:00Z'),
      });

      await expect(
        service.scheduleOrder(501, {
          scheduledAt: '2026-11-02T10:00:00Z',
          equipmentRoom: 'CT Suite 1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow room collision if forceConflict=true (emergency STAT override)', async () => {
      prisma.radiologyOrder.findUnique.mockResolvedValue({
        id: BigInt(501),
        status: 'ordered',
        equipmentRoom: null,
      });
      prisma.radiologyOrder.update.mockResolvedValue({
        id: BigInt(501),
        status: 'scheduled',
        scheduledAt: new Date('2026-11-02T10:00:00Z'),
        equipmentRoom: 'CT Suite 1',
      });

      const res = await service.scheduleOrder(501, {
        scheduledAt: '2026-11-02T10:00:00Z',
        equipmentRoom: 'CT Suite 1',
        forceConflict: true,
      });

      expect(res.status).toBe('scheduled');
    });
  });

  describe('Examination Workflow & Clinical Reporting', () => {
    it('should transition through arrived and in_progress to done', async () => {
      prisma.radiologyOrder.findUnique.mockResolvedValue({ id: BigInt(501), status: 'scheduled' });
      prisma.radiologyOrder.update.mockResolvedValueOnce({ id: BigInt(501), status: 'arrived' });
      const arrived = await service.recordArrival(501, {});
      expect(arrived.status).toBe('arrived');

      prisma.radiologyOrder.findUnique.mockResolvedValue({ id: BigInt(501), status: 'arrived' });
      prisma.radiologyOrder.update.mockResolvedValueOnce({ id: BigInt(501), status: 'in_progress' });
      const inProgress = await service.startExamination(501, {});
      expect(inProgress.status).toBe('in_progress');

      prisma.radiologyOrder.findUnique.mockResolvedValue({ id: BigInt(501), status: 'in_progress' });
      prisma.radiologyOrder.update.mockResolvedValueOnce({ id: BigInt(501), status: 'done' });
      const done = await service.completeExamination(501, {});
      expect(done.status).toBe('done');
    });

    it('should require impression when submitting a formal report', async () => {
      prisma.radiologyOrder.findUnique.mockResolvedValue({ id: BigInt(501), status: 'done' });

      await expect(
        service.submitReport(501, { findings: 'Clear lung fields', impression: '' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should submit formal report and stamp reportedAt and reportedById', async () => {
      prisma.radiologyOrder.findUnique.mockResolvedValue({ id: BigInt(501), status: 'done', findings: '' });
      prisma.radiologyOrder.update.mockResolvedValue({
        id: BigInt(501),
        status: 'reported',
        findings: 'Normal cardiac shadow',
        impression: 'Normal Chest Radiograph',
        reportedById: BigInt(2),
      });

      const reported = await service.submitReport(
        501,
        { findings: 'Normal cardiac shadow', impression: 'Normal Chest Radiograph' },
        2,
      );

      expect(reported.status).toBe('reported');
      expect(reported.reportedById).toBe(2);
    });

    it('should reject direct editing of already reported/completed study', async () => {
      prisma.radiologyOrder.findUnique.mockResolvedValue({
        id: BigInt(501),
        status: 'reported',
        findings: 'Original findings',
      });

      await expect(
        service.submitReport(501, { findings: 'Altered text', impression: 'Altered' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create an audited amendment for a finalized report', async () => {
      prisma.radiologyOrder.findUnique.mockResolvedValue({
        id: BigInt(501),
        status: 'reported',
        findings: 'Initial findings',
        impression: 'Initial impression',
      });
      prisma.radiologyReportAmendment.create.mockResolvedValue({
        id: BigInt(1),
        radiologyOrderId: BigInt(501),
        amendedBy: BigInt(2),
        reason: 'Clinician requested clarification on right lung apex',
        previousFindings: 'Initial findings',
        newFindings: 'Updated findings with apical view note',
      });
      prisma.radiologyOrder.update.mockResolvedValue({
        id: BigInt(501),
        findings: 'Updated findings with apical view note',
        impression: 'Initial impression',
      });

      const res = await service.createAmendment(
        501,
        {
          reason: 'Clinician requested clarification on right lung apex',
          findings: 'Updated findings with apical view note',
        },
        2,
      );

      expect(res.amendment.id).toBe(1);
      expect(prisma.radiologyReportAmendment.create).toHaveBeenCalled();
    });
  });

  describe('Cancellation Protections & Double-Billing Guards', () => {
    it('should block cancellation of reported or completed exam', async () => {
      prisma.radiologyOrder.findUnique.mockResolvedValue({ id: BigInt(501), status: 'reported' });

      await expect(
        service.cancelOrder(501, { reason: 'Patient changed mind' }),
      ).rejects.toThrow('A reported exam cannot be cancelled.');
    });

    it('should cancel active order when not reported', async () => {
      prisma.radiologyOrder.findUnique.mockResolvedValue({ id: BigInt(501), status: 'ordered' });
      prisma.radiologyOrder.update.mockResolvedValue({
        id: BigInt(501),
        status: 'cancelled',
        cancelReason: 'Patient discharged',
      });

      const res = await service.cancelOrder(501, { reason: 'Patient discharged' });
      expect(res.status).toBe('cancelled');
    });

    it('should prevent double-billing of already invoiced orders', async () => {
      prisma.radiologyOrder.findUnique.mockResolvedValue({
        id: BigInt(501),
        invoiceId: BigInt(888),
        radiologyExam: { price: new Prisma.Decimal(2000) },
      });

      await expect(service.billOrder(501)).rejects.toThrow(ConflictException);
    });
  });
});
