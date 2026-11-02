import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CashierService } from './cashier.service';

describe('CashierService', () => {
  let service: CashierService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      cashierShift: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cashTransaction: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      shiftCloseDenomination: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      shiftClose: {
        create: jest.fn(),
      },
      invoicePayment: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      patientType: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      paymentCategory: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      doctorShare: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashierService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CashierService>(CashierService);
  });

  describe('openShift', () => {
    it('should open a new shift and record opening float when float > 0', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: BigInt(1), branchId: BigInt(10) });
      prisma.cashierShift.findFirst.mockResolvedValue(null);
      prisma.cashierShift.count.mockResolvedValue(0);
      prisma.cashTransaction.count.mockResolvedValue(0);

      const createdShift = {
        id: BigInt(101),
        shiftNumber: 'SHF-20261102-0001',
        cashierId: BigInt(1),
        branchId: BigInt(10),
        openingCash: new Prisma.Decimal(500),
        expectedCash: new Prisma.Decimal(500),
        status: 'OPEN',
      };
      prisma.cashierShift.create.mockResolvedValue(createdShift);

      const result = await service.openShift(1, { openingCash: 500, notes: 'Morning float' });

      expect(prisma.cashierShift.create).toHaveBeenCalled();
      expect(prisma.cashTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shiftId: BigInt(101),
            transactionType: 'OPENING_FLOAT',
            amount: new Prisma.Decimal(500),
            isCash: true,
            direction: 'INFLOW',
          }),
        }),
      );
      expect(result.shiftNumber).toBe('SHF-20261102-0001');
    });

    it('should throw ConflictException if cashier already has an active shift', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: BigInt(1) });
      prisma.cashierShift.findFirst.mockResolvedValue({
        id: BigInt(99),
        shiftNumber: 'SHF-20261102-0099',
        status: 'OPEN',
      });

      await expect(service.openShift(1, { openingCash: 100 })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.openShift(999, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('calculateShiftTotals', () => {
    it('should correctly sum physical cash and exclude non-cash modes from expected cash', async () => {
      prisma.cashTransaction.findMany.mockResolvedValue([
        {
          transactionType: 'OPENING_FLOAT',
          amount: new Prisma.Decimal(500),
          isCash: true,
          direction: 'INFLOW',
          paymentMethod: 'Cash',
        },
        {
          transactionType: 'PAYMENT_RECEIVED',
          amount: new Prisma.Decimal(1000),
          isCash: true,
          direction: 'INFLOW',
          paymentMethod: 'Cash',
        },
        {
          transactionType: 'PAYMENT_RECEIVED',
          amount: new Prisma.Decimal(1500),
          isCash: false,
          direction: 'INFLOW',
          paymentMethod: 'Card',
        },
        {
          transactionType: 'PAYMENT_RECEIVED',
          amount: new Prisma.Decimal(2000),
          isCash: false,
          direction: 'INFLOW',
          paymentMethod: 'Bank transfer',
        },
        {
          transactionType: 'CASH_PAYOUT',
          amount: new Prisma.Decimal(200),
          isCash: true,
          direction: 'OUTFLOW',
          paymentMethod: 'Cash',
        },
        {
          transactionType: 'PAYMENT_RECEIVED',
          amount: new Prisma.Decimal(300),
          isCash: false,
          direction: 'INFLOW',
          paymentMethod: 'Write-off',
        },
      ]);

      const totals = await service.calculateShiftTotals(101);

      // Expected physical cash = opening float (500) + cash payments (1000) - cash payout (200) = 1300
      expect(totals.openingFloat).toBe(500);
      expect(totals.cashInflow).toBe(1000);
      expect(totals.cashOutflow).toBe(200);
      expect(totals.expectedCash).toBe(1300);

      // Non-cash breakdown
      expect(totals.cardTotal).toBe(1500);
      expect(totals.bankTransferTotal).toBe(2000);
      expect(totals.writeOffTotal).toBe(300);

      // Total money collected = 500 + 1000 + 1500 + 2000 - 200 = 4800 (excludes write-off)
      expect(totals.totalCollected).toBe(4800);
    });
  });

  describe('submitClose', () => {
    it('should calculate variance and transition shift to PENDING_APPROVAL', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: BigInt(101), cashier_id: BigInt(1), status: 'OPEN' },
      ]);

      // Mock transactions for calculation: expected cash = 1000
      prisma.cashTransaction.findMany.mockResolvedValue([
        {
          transactionType: 'OPENING_FLOAT',
          amount: new Prisma.Decimal(500),
          isCash: true,
          direction: 'INFLOW',
          paymentMethod: 'Cash',
        },
        {
          transactionType: 'PAYMENT_RECEIVED',
          amount: new Prisma.Decimal(500),
          isCash: true,
          direction: 'INFLOW',
          paymentMethod: 'Cash',
        },
      ]);

      prisma.cashierShift.update.mockResolvedValue({
        id: BigInt(101),
        status: 'PENDING_APPROVAL',
        countedCash: new Prisma.Decimal(950),
        expectedCash: new Prisma.Decimal(1000),
        cashVariance: new Prisma.Decimal(-50),
      });

      const result = await service.submitClose(
        101,
        {
          countedCash: 950,
          closingNotes: 'Short 50',
          denominations: [{ denomination: 500, count: 1 }, { denomination: 100, count: 4 }, { denomination: 50, count: 1 }],
        },
        1,
        false,
      );

      expect(prisma.shiftCloseDenomination.deleteMany).toHaveBeenCalled();
      expect(prisma.shiftCloseDenomination.create).toHaveBeenCalled();
      expect(result.status).toBe('PENDING_APPROVAL');
      expect(Number(result.cashVariance)).toBe(-50);
    });

    it('should throw ForbiddenException if another cashier attempts to close without permission', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: BigInt(101), cashier_id: BigInt(1), status: 'OPEN' },
      ]);

      await expect(
        service.submitClose(101, { countedCash: 1000 }, 2, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if shift is not in OPEN/CLOSING/REJECTED status', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: BigInt(101), cashier_id: BigInt(1), status: 'CLOSED' },
      ]);

      await expect(
        service.submitClose(101, { countedCash: 1000 }, 1, false),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveShift', () => {
    it('should approve shift and enforce separation of duties', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: BigInt(101),
          shift_number: 'SHF-20261102-0001',
          cashier_id: BigInt(1),
          status: 'PENDING_APPROVAL',
          counted_cash: new Prisma.Decimal(1000),
          expected_cash: new Prisma.Decimal(1000),
          cash_variance: new Prisma.Decimal(0),
          branch_id: BigInt(1),
          opened_at: new Date(),
        },
      ]);

      prisma.cashTransaction.findMany.mockResolvedValue([]);
      prisma.cashierShift.update.mockResolvedValue({
        id: BigInt(101),
        status: 'CLOSED',
        approvedBy: BigInt(2),
      });

      const result = await service.approveShift(101, 2, false, { notes: 'Approved by supervisor' });

      expect(result.status).toBe('CLOSED');
      expect(prisma.shiftClose.create).toHaveBeenCalled(); // Backwards compatibility legacy record
    });

    it('should throw ForbiddenException if cashier attempts to approve their own shift without override', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: BigInt(101),
          shift_number: 'SHF-20261102-0001',
          cashier_id: BigInt(1),
          status: 'PENDING_APPROVAL',
          counted_cash: new Prisma.Decimal(1000),
          expected_cash: new Prisma.Decimal(1000),
          cash_variance: new Prisma.Decimal(0),
          branch_id: BigInt(1),
          opened_at: new Date(),
        },
      ]);

      await expect(service.approveShift(101, 1, false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow supervisor override if hasCrossUserPerm is true', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: BigInt(101),
          shift_number: 'SHF-20261102-0001',
          cashier_id: BigInt(1),
          status: 'PENDING_APPROVAL',
          counted_cash: new Prisma.Decimal(1000),
          expected_cash: new Prisma.Decimal(1000),
          cash_variance: new Prisma.Decimal(0),
          branch_id: BigInt(1),
          opened_at: new Date(),
        },
      ]);

      prisma.cashTransaction.findMany.mockResolvedValue([]);
      prisma.cashierShift.update.mockResolvedValue({
        id: BigInt(101),
        status: 'CLOSED',
        approvedBy: BigInt(1),
      });

      const result = await service.approveShift(101, 1, true);
      expect(result.status).toBe('CLOSED');
    });
  });

  describe('rejectShift', () => {
    it('should transition shift to REJECTED with mandatory reason', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: BigInt(101), status: 'PENDING_APPROVAL' },
      ]);

      prisma.cashierShift.update.mockResolvedValue({
        id: BigInt(101),
        status: 'REJECTED',
        rejectionReason: 'Cash shortage needs investigation',
      });

      const result = await service.rejectShift(101, 2, {
        rejectionReason: 'Cash shortage needs investigation',
      });

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionReason).toBe('Cash shortage needs investigation');
    });
  });

  describe('payout & adjustment', () => {
    it('should record an authorized cash payout (outflow)', async () => {
      prisma.cashierShift.findUnique.mockResolvedValue({ id: BigInt(101), status: 'OPEN' });
      prisma.cashTransaction.count.mockResolvedValue(0);

      const created = {
        id: BigInt(1),
        transactionType: 'CASH_PAYOUT',
        amount: new Prisma.Decimal(250),
        direction: 'OUTFLOW',
        isCash: true,
      };
      prisma.cashTransaction.create.mockResolvedValue(created);

      const result = await service.recordPayout(
        101,
        { amount: 250, reason: 'Emergency courier charges', recipient: 'Courier Boy' },
        1,
      );

      expect(result.transactionType).toBe('CASH_PAYOUT');
      expect(result.direction).toBe('OUTFLOW');
    });
  });

  describe('settlePatientInvoices', () => {
    it('should apply payment oldest first across open invoices', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: BigInt(1), gross_total: new Prisma.Decimal(1000), amount_received: new Prisma.Decimal(0) },
        { id: BigInt(2), gross_total: new Prisma.Decimal(2000), amount_received: new Prisma.Decimal(0) },
      ]);

      // Invoice 1: 1000, Invoice 2: 2000
      prisma.payment.findUnique
        .mockResolvedValueOnce({
          id: BigInt(1),
          grossTotal: new Prisma.Decimal(1000),
          payments: [],
        })
        .mockResolvedValueOnce({
          id: BigInt(2),
          grossTotal: new Prisma.Decimal(2000),
          payments: [],
        });

      prisma.cashierShift.findFirst.mockResolvedValue(null);
      prisma.invoicePayment.create.mockResolvedValue({ id: BigInt(1) });
      prisma.payment.update.mockResolvedValue({});

      const result = await service.settlePatientInvoices(10, {
        amount: 1500,
        method: 'Cash',
      });

      expect(result.success).toBe(true);
      expect(result.amountSettled).toBe(1500);
      expect(prisma.invoicePayment.create).toHaveBeenCalledTimes(2);
    });

    it('should reject payment if amount exceeds total patient outstanding', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: BigInt(1), gross_total: new Prisma.Decimal(1000), amount_received: new Prisma.Decimal(0) },
      ]);

      await expect(
        service.settlePatientInvoices(10, { amount: 5000, method: 'Cash' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require a reason when write-off is specified', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: BigInt(1), gross_total: new Prisma.Decimal(1000), amount_received: new Prisma.Decimal(0) },
      ]);

      await expect(
        service.settlePatientInvoices(10, {
          amount: 800,
          writeOff: 200,
          method: 'Cash',
          writeOffReason: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
