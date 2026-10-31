import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PharmacyService (Unit)', () => {
  let service: PharmacyService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      medicine: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      medicineBatch: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      supplier: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      purchaseOrder: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      purchaseOrderItem: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      goodsReceipt: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      prescription: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      prescriptionMedicine: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      pharmacyDispensation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      pharmacyDispensationItem: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      stockAdjustment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      pharmacyReturn: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      payment: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacyService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PharmacyService>(PharmacyService);
  });

  describe('createBatch', () => {
    it('throws NotFoundException if medicine does not exist', async () => {
      prismaMock.medicine.findUnique.mockResolvedValue(null);

      await expect(
        service.createBatch({
          medicineId: 999,
          batchNumber: 'B001',
          expiryDate: '2028-12-31',
          costPrice: 5.0,
          quantity: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if batch already exists for medicine', async () => {
      prismaMock.medicine.findUnique.mockResolvedValue({ id: BigInt(1), name: 'Paracetamol' });
      prismaMock.medicineBatch.findUnique.mockResolvedValue({ id: BigInt(10), batchNumber: 'B001' });

      await expect(
        service.createBatch({
          medicineId: 1,
          batchNumber: 'B001',
          expiryDate: '2028-12-31',
          costPrice: 5.0,
          quantity: 100,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates batch, updates medicine summary quantity and writes StockMovement', async () => {
      prismaMock.medicine.findUnique.mockResolvedValue({
        id: BigInt(1),
        name: 'Paracetamol',
        sPrice: 8.0,
      });
      prismaMock.medicineBatch.findUnique.mockResolvedValue(null);
      prismaMock.medicineBatch.create.mockResolvedValue({
        id: BigInt(101),
        medicineId: BigInt(1),
        batchNumber: 'B001',
        currentQuantity: 100,
        costPrice: 5.0,
        sellingPrice: 8.0,
        status: 'ACTIVE',
      });
      prismaMock.medicine.update.mockResolvedValue({});
      prismaMock.stockMovement.create.mockResolvedValue({});

      const result = await service.createBatch({
        medicineId: 1,
        batchNumber: 'B001',
        expiryDate: '2028-12-31',
        costPrice: 5.0,
        quantity: 100,
      });

      expect(result.id).toBe('101');
      expect(result.batchNumber).toBe('B001');
      expect(prismaMock.medicine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: { increment: 100 },
          }),
        }),
      );
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'PURCHASE_RECEIPT',
            quantity: 100,
          }),
        }),
      );
    });
  });

  describe('getFefoBatches', () => {
    it('orders batches by earliest expiry date and computes allocations', async () => {
      const today = new Date();
      const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const nextYear = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);

      prismaMock.medicineBatch.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          batchNumber: 'EARLY-BATCH',
          currentQuantity: 10,
          expiryDate: nextMonth,
        },
        {
          id: BigInt(2),
          batchNumber: 'LATER-BATCH',
          currentQuantity: 25,
          expiryDate: nextYear,
        },
      ]);

      const plan: any = await service.getFefoBatches(1, 15);

      expect(plan.isFullyFulfillable).toBe(true);
      expect(plan.availableTotal).toBe(35);
      expect(plan.allocations).toHaveLength(2);
      expect(plan.allocations[0].batch.batchNumber).toBe('EARLY-BATCH');
      expect(plan.allocations[0].allocatedQty).toBe(10);
      expect(plan.allocations[1].batch.batchNumber).toBe('LATER-BATCH');
      expect(plan.allocations[1].allocatedQty).toBe(5);
    });

    it('detects stock shortfall when available stock is insufficient', async () => {
      prismaMock.medicineBatch.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          batchNumber: 'B1',
          currentQuantity: 4,
          expiryDate: new Date('2028-01-01'),
        },
      ]);

      const plan: any = await service.getFefoBatches(1, 10);
      expect(plan.isFullyFulfillable).toBe(false);
      expect(plan.shortfall).toBe(6);
    });
  });

  describe('dispense validation', () => {
    it('rejects dispensing against an already fully dispensed prescription', async () => {
      prismaMock.prescription.findUnique.mockResolvedValue({
        id: BigInt(10),
        state: 'dispensed',
        medicines: [],
      });

      await expect(
        service.dispense({
          prescriptionId: 10,
          dispenseDate: '2026-10-31',
          items: [{ medicineId: 1, quantity: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects expired batches during explicit batch dispensing', async () => {
      prismaMock.medicine.findUnique.mockResolvedValue({ id: BigInt(1), name: 'Amoxil' });
      prismaMock.$queryRaw.mockResolvedValue([
        {
          id: BigInt(5),
          batch_number: 'EXPIRED-BATCH',
          current_quantity: 50,
          expiry_date: new Date('2020-01-01'), // In past
          status: 'ACTIVE',
          selling_price: 10.0,
        },
      ]);

      await expect(
        service.dispense({
          dispenseDate: '2026-10-31',
          items: [{ medicineId: 1, batchId: 5, quantity: 2 }],
        }),
      ).rejects.toThrow(/expired/i);
    });

    it('rejects requested quantity exceeding batch balance', async () => {
      prismaMock.medicine.findUnique.mockResolvedValue({ id: BigInt(1), name: 'Amoxil' });
      prismaMock.$queryRaw.mockResolvedValue([
        {
          id: BigInt(5),
          batch_number: 'LOT-1',
          current_quantity: 3,
          expiry_date: new Date('2028-01-01'),
          status: 'ACTIVE',
          selling_price: 10.0,
        },
      ]);

      await expect(
        service.dispense({
          dispenseDate: '2026-10-31',
          items: [{ medicineId: 1, batchId: 5, quantity: 10 }],
        }),
      ).rejects.toThrow(/insufficient stock/i);
    });
  });

  describe('processReturn', () => {
    it('rejects patient return if requested quantity exceeds dispensed quantity', async () => {
      prismaMock.pharmacyDispensationItem.findUnique.mockResolvedValue({
        id: BigInt(1),
        medicineName: 'Paracetamol',
        quantity: 10,
        returnedQuantity: 8, // 2 left to return
        unitPrice: 5.0,
      });

      await expect(
        service.processReturn({
          returnType: 'PATIENT_RETURN',
          returnDate: '2026-10-31',
          reason: 'Excess medication',
          restockToInventory: true,
          items: [
            {
              dispensationItemId: 1,
              medicineId: 1,
              batchId: 2,
              quantity: 5, // Exceeds 2
              condition: 'SALEABLE',
            },
          ],
        }),
      ).rejects.toThrow(/only 2 eligible/i);
    });
  });

  describe('inventory valuation', () => {
    it('calculates total cost and retail valuation correctly', async () => {
      prismaMock.medicineBatch.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          batchNumber: 'B1',
          currentQuantity: 10,
          costPrice: 5.0,
          sellingPrice: 10.0,
          medicine: { name: 'Med A' },
        },
        {
          id: BigInt(2),
          batchNumber: 'B2',
          currentQuantity: 20,
          costPrice: 2.0,
          sellingPrice: 4.0,
          medicine: { name: 'Med B' },
        },
      ]);

      const valuation = await service.getValuationReport();

      expect(valuation.totalUnits).toBe(30);
      expect(valuation.totalCostValuation).toBe(90); // 10*5 + 20*2 = 50 + 40 = 90
      expect(valuation.totalRetailValuation).toBe(180); // 10*10 + 20*4 = 100 + 80 = 180
      expect(valuation.potentialProfit).toBe(90);
    });
  });
});
