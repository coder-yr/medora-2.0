import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InpatientService } from './inpatient.service';
import { PrismaService } from '../prisma/prisma.service';

describe('InpatientService (Unit Tests)', () => {
  let service: InpatientService;
  let prisma: any;

  const mockPrismaService: any = {
    bedCategory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    bed: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    admission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    bedAllocationHistory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    inpatientFolio: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    inpatientFolioItem: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
    },
    doctor: {
      findUnique: jest.fn(),
    },
    allotedBed: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    payment: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InpatientService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<InpatientService>(InpatientService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('1. Sequential Number Generators', () => {
    it('should generate properly formatted admission number', async () => {
      prisma.admission.count.mockResolvedValue(4);
      const num = await service.generateAdmissionNumber();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      expect(num).toBe(`ADM-${dateStr}-0005`);
    });

    it('should generate properly formatted folio number', async () => {
      prisma.inpatientFolio.count.mockResolvedValue(12);
      const num = await service.generateFolioNumber();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      expect(num).toBe(`FOL-${dateStr}-0013`);
    });
  });

  describe('2. Ward Management', () => {
    it('should create a ward with base rate and billing unit', async () => {
      prisma.bedCategory.findFirst.mockResolvedValue(null);
      prisma.bedCategory.create.mockResolvedValue({
        id: BigInt(1),
        category: 'Intensive Care Unit',
        code: 'ICU-01',
        description: 'Third floor ICU',
        baseRate: new Prisma.Decimal(6500.0),
        billingUnit: 'DAILY',
        isActive: true,
      });

      const ward = await service.createWard({
        category: 'Intensive Care Unit',
        code: 'ICU-01',
        baseRate: 6500.0,
      });

      expect(ward.category).toBe('Intensive Care Unit');
      expect(Number(ward.baseRate)).toBe(6500.0);
    });

    it('should reject creating ward with duplicate name', async () => {
      prisma.bedCategory.findFirst.mockResolvedValue({ id: BigInt(1), category: 'General Ward' });
      await expect(
        service.createWard({ category: 'General Ward' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject deleting ward that still has beds', async () => {
      prisma.bedCategory.findUnique.mockResolvedValue({ id: BigInt(1), category: 'General Ward' });
      prisma.bed.count.mockResolvedValue(5);

      await expect(service.deleteWard(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Bed Management', () => {
    it('should create bed with unique number within ward', async () => {
      prisma.bedCategory.findUnique.mockResolvedValue({ id: BigInt(1), category: 'Ward A' });
      prisma.bed.findFirst.mockResolvedValue(null);
      prisma.bed.create.mockResolvedValue({
        id: BigInt(10),
        categoryId: BigInt(1),
        number: 'B-101',
        status: 'AVAILABLE',
        isActive: true,
      });

      const bed = await service.createBed({
        categoryId: 1,
        number: 'B-101',
      });

      expect(bed.number).toBe('B-101');
      expect(bed.status).toBe('AVAILABLE');
    });

    it('should reject duplicate bed number in same ward', async () => {
      prisma.bedCategory.findUnique.mockResolvedValue({ id: BigInt(1) });
      prisma.bed.findFirst.mockResolvedValue({ id: BigInt(10), number: 'B-101' });

      await expect(
        service.createBed({ categoryId: 1, number: 'B-101' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject deleting an occupied bed', async () => {
      prisma.bed.findUnique.mockResolvedValue({ id: BigInt(10), number: 'B-101' });
      prisma.admission.findFirst.mockResolvedValue({ id: BigInt(1), admissionNumber: 'ADM-001' });

      await expect(service.deleteBed(10)).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. Admission & Concurrency Protection', () => {
    it('should reject admission when target patient is not found', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);

      await expect(
        service.createAdmission({ patientId: 999, bedId: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject admission when bed is occupied', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: BigInt(1), name: 'John Doe' });
      prisma.$queryRaw.mockResolvedValueOnce([
        { id: BigInt(5), category: BigInt(1), number: 'B-105', status: 'OCCUPIED', is_active: true },
      ]);

      await expect(
        service.createAdmission({ patientId: 1, bedId: 5 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject admission when patient is already admitted', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: BigInt(1), name: 'John Doe' });
      // Locked bed row
      prisma.$queryRaw.mockResolvedValueOnce([
        { id: BigInt(5), category: BigInt(1), number: 'B-105', status: 'AVAILABLE', is_active: true },
      ]);
      // Active patient stay check
      prisma.$queryRaw.mockResolvedValueOnce([
        { id: BigInt(2), admission_number: 'ADM-20261102-0001' },
      ]);

      await expect(
        service.createAdmission({ patientId: 1, bedId: 5 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully admit patient, allocate bed, and initialize folio', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: BigInt(1), name: 'John Doe' });
      prisma.bedCategory.findUnique.mockResolvedValue({ id: BigInt(1), category: 'General Ward', baseRate: new Prisma.Decimal(2500) });
      prisma.bedAllocationHistory.findFirst.mockResolvedValue(null);

      // 1. Bed lock
      prisma.$queryRaw.mockResolvedValueOnce([
        { id: BigInt(5), category: BigInt(1), number: 'B-105', status: 'AVAILABLE', is_active: true },
      ]);
      // 2. Patient active stay lock
      prisma.$queryRaw.mockResolvedValueOnce([]);

      prisma.admission.count.mockResolvedValue(0);
      prisma.inpatientFolio.count.mockResolvedValue(0);

      prisma.admission.create.mockResolvedValue({
        id: BigInt(100),
        admissionNumber: 'ADM-20261102-0001',
        patientId: BigInt(1),
        bedId: BigInt(5),
        wardId: BigInt(1),
        status: 'ADMITTED',
      });
      prisma.bedAllocationHistory.create.mockResolvedValue({ id: BigInt(50) });
      prisma.inpatientFolio.create.mockResolvedValue({ id: BigInt(70) });
      prisma.bed.update.mockResolvedValue({ id: BigInt(5), status: 'OCCUPIED' });
      prisma.allotedBed.create.mockResolvedValue({ id: BigInt(1) });

      const res = await service.createAdmission({
        patientId: 1,
        bedId: 5,
        diagnosis: 'Dengue Fever',
      });

      expect(res.admissionNumber).toBe('ADM-20261102-0001');
      expect(prisma.bedAllocationHistory.create).toHaveBeenCalled();
      expect(prisma.inpatientFolio.create).toHaveBeenCalled();
      expect(prisma.bed.update).toHaveBeenCalledWith({
        where: { id: BigInt(5) },
        data: { status: 'OCCUPIED' },
      });
    });
  });

  describe('5. Bed Transfer Workflow', () => {
    it('should reject transfer when source and target bed are identical', async () => {
      prisma.admission.findUnique.mockResolvedValue({
        id: BigInt(100),
        bedId: BigInt(5),
        status: 'ADMITTED',
      });

      await expect(
        service.transferBed(100, { targetBedId: 5, reason: 'Patient requested' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should execute deterministic dual-bed locking and transfer patient', async () => {
      prisma.admission.findUnique.mockResolvedValue({
        id: BigInt(100),
        admissionNumber: 'ADM-001',
        wardId: BigInt(1),
        bedId: BigInt(5),
        status: 'ADMITTED',
      });

      prisma.bed.findUnique.mockResolvedValue({
        id: BigInt(8),
        number: 'B-108',
        categoryId: BigInt(2),
        isActive: true,
        status: 'AVAILABLE',
        category: { id: BigInt(2), category: 'ICU', baseRate: new Prisma.Decimal(6000) },
      });

      prisma.bedAllocationHistory.findFirst
        .mockResolvedValueOnce(null) // no conflict on target bed
        .mockResolvedValueOnce({
          id: BigInt(50),
          allocatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          rateSnapshot: new Prisma.Decimal(2500),
        });

      prisma.bedAllocationHistory.create.mockResolvedValue({ id: BigInt(51) });
      prisma.bedAllocationHistory.update.mockResolvedValue({});
      prisma.bed.update.mockResolvedValue({});
      prisma.admission.update.mockResolvedValue({
        id: BigInt(100),
        bedId: BigInt(8),
        wardId: BigInt(2),
        status: 'TRANSFERRED',
      });

      const res = await service.transferBed(100, {
        targetBedId: 8,
        reason: 'Condition worsened, move to ICU',
      });

      expect(res.status).toBe('TRANSFERRED');
      expect(prisma.bed.update).toHaveBeenCalledWith({
        where: { id: BigInt(5) },
        data: { status: 'CLEANING' },
      });
      expect(prisma.bed.update).toHaveBeenCalledWith({
        where: { id: BigInt(8) },
        data: { status: 'OCCUPIED' },
      });
    });
  });

  describe('6. Discharge Workflow', () => {
    it('should complete discharge, release bed to CLEANING, and finalize folio', async () => {
      const admissionDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      prisma.admission.findUnique.mockResolvedValue({
        id: BigInt(100),
        admissionNumber: 'ADM-001',
        patientId: BigInt(1),
        wardId: BigInt(1),
        bedId: BigInt(5),
        status: 'ADMITTED',
        admissionDate,
      });

      prisma.bedAllocationHistory.findFirst.mockResolvedValue({
        id: BigInt(50),
        allocatedAt: admissionDate,
        rateSnapshot: new Prisma.Decimal(2000),
      });

      prisma.inpatientFolio.findUnique.mockResolvedValue({
        id: BigInt(70),
        totalCharges: new Prisma.Decimal(6000),
        totalPaid: new Prisma.Decimal(6000),
        balance: new Prisma.Decimal(0),
      });

      prisma.bed.update.mockResolvedValue({ id: BigInt(5), status: 'CLEANING' });
      prisma.admission.update.mockResolvedValue({
        id: BigInt(100),
        status: 'DISCHARGED',
        dischargeSummary: 'Patient stable, discharged',
        dischargeCondition: 'RECOVERED',
      });

      const res = await service.completeDischarge(100, {
        dischargeSummary: 'Patient stable, discharged',
        dischargeCondition: 'RECOVERED',
      });

      expect(res.status).toBe('DISCHARGED');
      expect(prisma.bed.update).toHaveBeenCalledWith({
        where: { id: BigInt(5) },
        data: { status: 'CLEANING' },
      });
      expect(prisma.inpatientFolio.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SETTLED' }),
        }),
      );
    });
  });

  describe('7. Inpatient Folio & Charges', () => {
    it('should reject posting new charge to a discharged admission', async () => {
      prisma.admission.findUnique.mockResolvedValue({
        id: BigInt(100),
        admissionNumber: 'ADM-001',
        status: 'DISCHARGED',
        folio: { id: BigInt(70) },
      });

      await expect(
        service.postCharge(100, {
          sourceModule: 'SERVICE',
          chargeCategory: 'Nursing',
          description: 'Special nursing care',
          unitPrice: 500,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should post charge and update folio balances with idempotency', async () => {
      prisma.admission.findUnique.mockResolvedValue({
        id: BigInt(100),
        admissionNumber: 'ADM-001',
        status: 'ADMITTED',
        folio: { id: BigInt(70) },
      });

      prisma.inpatientFolioItem.findUnique.mockResolvedValue(null);
      prisma.inpatientFolioItem.create.mockResolvedValue({
        id: BigInt(1),
        folioId: BigInt(70),
        description: 'Physical therapy',
        totalAmount: new Prisma.Decimal(1500),
      });

      const item = await service.postCharge(100, {
        sourceModule: 'SERVICE',
        chargeCategory: 'Therapy',
        description: 'Physical therapy',
        unitPrice: 1500,
        idempotencyKey: 'TH-001',
      });

      expect((item as any).item.description).toBe('Physical therapy');
      expect(prisma.inpatientFolio.update).toHaveBeenCalledWith({
        where: { id: BigInt(70) },
        data: {
          totalCharges: { increment: 1500 },
          balance: { increment: 1500 },
        },
      });
    });

    it('should reverse folio charge with audit justification and adjust balance', async () => {
      prisma.inpatientFolioItem.findUnique.mockResolvedValue({
        id: BigInt(1),
        folioId: BigInt(70),
        totalAmount: new Prisma.Decimal(1500),
        isReversed: false,
      });

      prisma.inpatientFolioItem.update.mockResolvedValue({
        id: BigInt(1),
        isReversed: true,
        reversalReason: 'Duplicate entry',
      });

      prisma.inpatientFolio.update.mockResolvedValue({
        id: BigInt(70),
        totalCharges: new Prisma.Decimal(0),
        balance: new Prisma.Decimal(0),
      });

      const result = await service.reverseCharge(1, {
        reversalReason: 'Duplicate entry',
      });

      expect(result.item.isReversed).toBe(true);
      expect(prisma.inpatientFolio.update).toHaveBeenCalledWith({
        where: { id: BigInt(70) },
        data: {
          totalCharges: { decrement: 1500 },
          balance: { decrement: 1500 },
        },
      });
    });
  });
});
