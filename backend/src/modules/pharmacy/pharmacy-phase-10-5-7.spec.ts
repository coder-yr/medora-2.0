import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { PrismaService } from '../prisma/prisma.service';
import { BranchAuthorizationService } from '../../common/services/branch-authorization.service';

describe('PharmacyService - Phase 10.5.7 Operations & Inventory', () => {
  let service: PharmacyService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      purchaseOrder: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      goodsReceipt: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      supplier: {
        findUnique: jest.fn().mockResolvedValue({ id: 1n, name: 'Cipla Ltd' }),
      },
      medicine: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(5),
      },
      medicineBatch: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      prescription: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      prescriptionMedicine: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      pharmacyDispensation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      stockTransfer: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      stockMovement: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      pharmacyReturn: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      pharmacyDispensationItem: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      hospitalBranch: {
        findUnique: jest.fn().mockResolvedValue({ id: 1n, organizationId: 1n }),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacyService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: BranchAuthorizationService,
          useValue: {
            assertBranchAccess: jest.fn().mockResolvedValue(1n),
            assertResourceAccess: jest.fn().mockResolvedValue(undefined),
            resolveAccessibleBranchIds: jest.fn().mockResolvedValue([1n, 2n]),
            isGlobalAdmin: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<PharmacyService>(PharmacyService);
  });

  describe('Purchase Order Approval & Cancellation', () => {
    it('approves a draft purchase order successfully', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 10n,
        status: 'DRAFT',
        branchId: 1n,
        poNumber: 'PO-20261125-0001',
      });
      prisma.purchaseOrder.update.mockResolvedValue({
        id: 10n,
        status: 'APPROVED',
        approvedById: 1n,
      });

      const res = await service.approvePurchaseOrder(10, 'Approved for procurement', {
        id: '1',
        email: 'admin@clinic.com',
        group: 'Admin',
      } as any);

      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10n },
          data: expect.objectContaining({
            status: 'APPROVED',
            approvedById: 1n,
          }),
        }),
      );
      expect(res.status).toBe('APPROVED');
    });

    it('rejects cancelling an already received purchase order', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 10n,
        status: 'RECEIVED',
        branchId: 1n,
      });

      await expect(
        service.cancelPurchaseOrder(10, 'Supplier out of business'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Goods Receipt & Expiry Validation', () => {
    it('rejects goods receipt if any batch is already expired', async () => {
      prisma.medicine.findUnique.mockResolvedValue({
        id: 1n,
        name: 'Amoxicillin',
      });
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 10n,
        status: 'APPROVED',
        items: [{ medicineId: 1n, quantityOrdered: 50, quantityReceived: 0, unitCost: 10 }],
      });

      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 5);

      await expect(
        service.createGoodsReceipt({
          purchaseOrderId: 10,
          supplierId: 1,
          receiptDate: '2026-11-25',
          items: [
            {
              medicineId: 1,
              batchNumber: 'EXP-BATCH-001',
              expiryDate: expiredDate.toISOString().slice(0, 10),
              quantityReceived: 50,
              unitCost: 10,
              sellingPrice: 15,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Prescription Dispensing & Substitution', () => {
    it('enforces mandatory substitution reason when alternative medicine is dispensed', async () => {
      prisma.prescription.findUnique.mockResolvedValue({
        id: 100n,
        status: 'SIGNED',
        patient: { id: 1n, branchId: 1n },
        medicines: [],
      });

      await expect(
        service.dispense({
          prescriptionId: 100,
          dispenseDate: '2026-11-25',
          items: [
            {
              medicineId: 2,
              quantity: 10,
              isSubstituted: true,
              substitutionReason: '', // missing
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents dispensing more than remaining prescribed quantity', async () => {
      prisma.prescription.findUnique.mockResolvedValue({
        id: 100n,
        status: 'SIGNED',
        patient: { id: 1n, branchId: 1n },
        medicines: [],
      });

      prisma.prescriptionMedicine.findUnique.mockResolvedValue({
        id: 50n,
        name: 'Amoxicillin 500mg',
        quantityPrescribed: 10,
        dispensedQuantity: 8,
      });

      await expect(
        service.dispense({
          prescriptionId: 100,
          dispenseDate: '2026-11-25',
          items: [
            {
              prescriptionMedicineId: 50,
              medicineId: 1,
              quantity: 5, // 8 + 5 = 13 > 10
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Over-the-Counter (OTC) Direct Sales & Regulation', () => {
    it('strictly forbids OTC sale of prescription-required medications', async () => {
      prisma.medicine.findUnique.mockResolvedValue({
        id: 99n,
        name: 'Ciprofloxacin 500mg',
        prescriptionRequired: true,
        brandName: 'Cipro',
      });

      await expect(
        service.sellOtc({
          saleDate: '2026-11-25',
          items: [{ medicineId: 99, quantity: 10 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows OTC sale of non-prescription medication and generates Phase 10.5.6 invoice', async () => {
      prisma.medicine.findUnique.mockResolvedValue({
        id: 88n,
        name: 'Paracetamol 500mg',
        prescriptionRequired: false,
        sPrice: 2.5,
      });

      const today = new Date();
      const futureDate = new Date();
      futureDate.setFullYear(today.getFullYear() + 1);

      prisma.$queryRaw.mockResolvedValue([
        {
          id: 501n,
          batch_number: 'PARA-B01',
          current_quantity: 100,
          expiry_date: futureDate,
          status: 'ACTIVE',
          selling_price: 2.5,
          branch_id: 1n,
        },
      ]);

      prisma.payment.create.mockResolvedValue({ id: 999n });
      prisma.pharmacyDispensation.create.mockResolvedValue({
        id: 300n,
        dispensationNumber: 'DSP-20261125-0001',
        totalAmount: 25.0,
        items: [],
      });

      const res = await service.sellOtc({
        saleDate: '2026-11-25',
        patientId: 1,
        patientName: 'Walk-in John',
        items: [{ medicineId: 88, quantity: 10, unitPrice: 2.5 }],
      });

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'PHARMACY',
            status: 'paid',
          }),
        }),
      );
      expect(prisma.stockMovement.create).toHaveBeenCalled();
      expect(res.dispensationNumber).toBe('DSP-20261125-0001');
    });
  });

  describe('Inter-Branch Stock Transfers', () => {
    it('rejects transfer when source and destination branches are identical', async () => {
      await expect(
        service.transferStock({
          fromBranchId: 1,
          toBranchId: 1,
          medicineId: 10,
          batchId: 20,
          quantity: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects transfer when source batch has insufficient stock', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 20n,
          batch_number: 'TRF-B01',
          current_quantity: 4, // only 4 available
          expiry_date: new Date(),
          status: 'ACTIVE',
          cost_price: 10,
          selling_price: 15,
        },
      ]);

      await expect(
        service.transferStock({
          fromBranchId: 1,
          toBranchId: 2,
          medicineId: 10,
          batchId: 20,
          quantity: 10, // requests 10
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully transfers stock, updates batches and creates TRANSFER_OUT and TRANSFER_IN ledger movements', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      prisma.$queryRaw.mockResolvedValue([
        {
          id: 20n,
          batch_number: 'TRF-B01',
          current_quantity: 50,
          expiry_date: futureDate,
          manufacturing_date: null,
          status: 'ACTIVE',
          cost_price: 10,
          selling_price: 15,
          branch_id: 1n,
        },
      ]);

      prisma.medicineBatch.findFirst.mockResolvedValue(null); // destination batch doesn't exist yet
      prisma.medicineBatch.create.mockResolvedValue({ id: 70n, currentQuantity: 20 });
      prisma.stockTransfer.create.mockResolvedValue({
        id: 1n,
        transferNumber: 'TRF-20261125-0001',
        quantity: 20,
        status: 'COMPLETED',
      });

      const res = await service.transferStock({
        fromBranchId: 1,
        toBranchId: 2,
        medicineId: 10,
        batchId: 20,
        quantity: 20,
        reason: 'OPD replenishment',
      });

      // Verify source deduction
      expect(prisma.$executeRaw).toHaveBeenCalled();

      // Verify destination creation
      expect(prisma.medicineBatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            branchId: 2n,
            currentQuantity: 20,
            status: 'ACTIVE',
          }),
        }),
      );

      // Verify TRANSFER_OUT and TRANSFER_IN ledger records
      expect(prisma.stockMovement.create).toHaveBeenCalledTimes(2);
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'TRANSFER_OUT',
            quantity: -20,
            branchId: 1n,
          }),
        }),
      );
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'TRANSFER_IN',
            quantity: 20,
            branchId: 2n,
          }),
        }),
      );

      expect(res.status).toBe('COMPLETED');
    });
  });

  describe('Returns & Condition-Based Quarantine', () => {
    it('quarantines damaged or expired returns from saleable inventory', async () => {
      prisma.pharmacyDispensationItem.findUnique.mockResolvedValue({
        id: 50n,
        quantity: 10,
        returnedQuantity: 0,
        unitPrice: 15,
      });

      prisma.pharmacyReturn.create.mockResolvedValue({
        id: 1n,
        returnNumber: 'RTN-20261125-0001',
        totalRefund: 45,
      });

      await service.processReturn({
        returnType: 'PATIENT_RETURN',
        returnDate: '2026-11-25',
        reason: 'Broken blister packs',
        restockToInventory: true, // requested restock
        items: [
          {
            dispensationItemId: 50,
            medicineId: 5,
            batchId: 12,
            quantity: 3,
            condition: 'DAMAGED', // but DAMAGED condition!
          },
        ],
      });

      // Crucial Safety Rule: Even if restockToInventory is true, DAMAGED items must NOT increment batch stock
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(prisma.medicine.update).not.toHaveBeenCalled();

      // Should log write-off movement instead
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'DAMAGED_WRITE_OFF',
            quantity: 0,
          }),
        }),
      );
    });
  });
});
