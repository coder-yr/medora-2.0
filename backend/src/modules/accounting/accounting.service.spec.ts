import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingPostingService } from './accounting-posting.service';
import { AccountingService } from './accounting.service';
import {
  AccountTypeDto,
  CreateAccountDto,
  CreateAccountingPeriodDto,
  CreateExpenseDto,
  CreateJournalEntryDto,
  NormalBalanceDto,
} from './dto/accounting.dto';

describe('AccountingService & AccountingPostingService Unit Tests', () => {
  let accountingService: AccountingService;
  let postingService: AccountingPostingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      account: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      accountingPeriod: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      journalEntry: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      journalEntryLine: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      expenseCategory: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      expense: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      accountingLegacy: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      accountSectorLegacy: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingService,
        AccountingPostingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    accountingService = module.get<AccountingService>(AccountingService);
    postingService = module.get<AccountingPostingService>(AccountingPostingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // 1. DOUBLE-ENTRY BALANCE INVARIANT
  // ==========================================
  describe('Double-Entry Balance Invariant', () => {
    it('should validate and accept balanced debit and credit entries', () => {
      const lines = [
        { debit: 5000, credit: 0 },
        { debit: 0, credit: 5000 },
      ];
      const result = postingService.validateDoubleEntryBalance(lines);
      expect(result.totalDebit).toBe(5000);
      expect(result.totalCredit).toBe(5000);
    });

    it('should throw BadRequestException if debits and credits do not balance', () => {
      const unbalancedLines = [
        { debit: 5000, credit: 0 },
        { debit: 0, credit: 4500 },
      ];
      expect(() =>
        postingService.validateDoubleEntryBalance(unbalancedLines),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException if fewer than 2 lines are provided', () => {
      const singleLine = [{ debit: 5000, credit: 0 }];
      expect(() =>
        postingService.validateDoubleEntryBalance(singleLine),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException if a line has both debit and credit', () => {
      const invalidLine = [
        { debit: 100, credit: 100 },
        { debit: 0, credit: 0 },
      ];
      expect(() =>
        postingService.validateDoubleEntryBalance(invalidLine),
      ).toThrow(BadRequestException);
    });
  });

  // ==========================================
  // 2. CHART OF ACCOUNTS (COA)
  // ==========================================
  describe('Chart of Accounts CRUD', () => {
    it('should create an account successfully', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      prisma.account.create.mockResolvedValue({
        id: BigInt(10),
        accountCode: '1015',
        accountName: 'Petty Cash - Emergency',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        isSystemAccount: false,
      });

      const dto: CreateAccountDto = {
        accountCode: '1015',
        accountName: 'Petty Cash - Emergency',
        accountType: AccountTypeDto.ASSET,
        normalBalance: NormalBalanceDto.DEBIT,
      };

      const result = await accountingService.createAccount(dto, BigInt(1));
      expect(result.accountCode).toBe('1015');
      expect(prisma.account.create).toHaveBeenCalled();
    });

    it('should throw ConflictException on duplicate account code', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: BigInt(1),
        accountCode: '1010',
        accountName: 'Cash on Hand',
      });

      const dto: CreateAccountDto = {
        accountCode: '1010',
        accountName: 'Duplicate Cash',
        accountType: AccountTypeDto.ASSET,
        normalBalance: NormalBalanceDto.DEBIT,
      };

      await expect(
        accountingService.createAccount(dto, BigInt(1)),
      ).rejects.toThrow(ConflictException);
    });

    it('should prevent deletion of system accounts', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: BigInt(1),
        accountCode: '1010',
        accountName: 'Cash on Hand',
        isSystemAccount: true,
        journalLines: [],
      });

      await expect(accountingService.deleteAccount(BigInt(1))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should soft-deactivate account if historical journal lines exist', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: BigInt(5),
        accountCode: '5999',
        accountName: 'Temporary Holding',
        isSystemAccount: false,
        journalLines: [{ id: BigInt(100) }],
      });
      prisma.account.update.mockResolvedValue({
        id: BigInt(5),
        accountCode: '5999',
        isActive: false,
      });

      const result = await accountingService.deleteAccount(BigInt(5));
      expect(result.message).toContain('Deactivated successfully');
      expect(prisma.account.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });
  });

  // ==========================================
  // 3. ACCOUNTING PERIODS
  // ==========================================
  describe('Accounting Period Operations', () => {
    it('should create an open accounting period', async () => {
      prisma.accountingPeriod.findUnique.mockResolvedValue(null);
      prisma.accountingPeriod.create.mockResolvedValue({
        id: BigInt(1),
        periodCode: 'FY2026-M12',
        name: 'December 2026',
        status: 'OPEN',
      });

      const dto: CreateAccountingPeriodDto = {
        periodCode: 'FY2026-M12',
        name: 'December 2026',
        startDate: '2026-12-01',
        endDate: '2026-12-31',
      };

      const result = await accountingService.createPeriod(dto);
      expect(result.periodCode).toBe('FY2026-M12');
      expect(result.status).toBe('OPEN');
    });

    it('should prevent closing a period if unposted drafts exist', async () => {
      prisma.accountingPeriod.findUnique.mockResolvedValue({
        id: BigInt(1),
        periodCode: 'FY2026-M11',
        name: 'November 2026',
        status: 'OPEN',
      });
      prisma.journalEntry.count.mockResolvedValue(3); // 3 draft entries exist

      await expect(
        accountingService.closePeriod(BigInt(1), {}, BigInt(1)),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully close a clean period', async () => {
      prisma.accountingPeriod.findUnique.mockResolvedValue({
        id: BigInt(1),
        periodCode: 'FY2026-M11',
        name: 'November 2026',
        status: 'OPEN',
      });
      prisma.journalEntry.count.mockResolvedValue(0);
      prisma.accountingPeriod.update.mockResolvedValue({
        id: BigInt(1),
        status: 'CLOSED',
        closedBy: BigInt(1),
      });

      const result = await accountingService.closePeriod(
        BigInt(1),
        { closingNotes: 'Month end books reconciled' },
        BigInt(1),
      );
      expect(result.status).toBe('CLOSED');
    });

    it('should throw ConflictException when posting into a CLOSED period', async () => {
      prisma.accountingPeriod.findFirst.mockResolvedValue({
        id: BigInt(1),
        periodCode: 'FY2026-M10',
        name: 'October 2026',
        status: 'CLOSED',
      });

      await expect(
        postingService.assertPeriodIsOpen(prisma, new Date('2026-10-15')),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ==========================================
  // 4. JOURNAL POSTING, IDEMPOTENCY & REVERSAL
  // ==========================================
  describe('Journal Operations & Reversals', () => {
    it('should return existing journal when idempotencyKey matches', async () => {
      const existing = {
        id: BigInt(42),
        journalNumber: 'JRN-202611-0001',
        idempotencyKey: 'IDEMP-TEST-001',
        lines: [],
      };
      prisma.journalEntry.findUnique.mockResolvedValue(existing);

      const dto: CreateJournalEntryDto = {
        accountingDate: '2026-11-03',
        description: 'Test entry',
        idempotencyKey: 'IDEMP-TEST-001',
        lines: [
          { accountId: 1, debit: 100, credit: 0 },
          { accountId: 2, debit: 0, credit: 100 },
        ],
      };

      const result = await postingService.createJournal(dto, BigInt(1));
      expect(result.journalNumber).toBe('JRN-202611-0001');
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('should prevent deleting a POSTED journal entry (immutability)', async () => {
      prisma.journalEntry.findUnique.mockResolvedValue({
        id: BigInt(1),
        journalNumber: 'JRN-202611-0001',
        status: 'POSTED',
      });

      await expect(
        accountingService.deleteDraftJournal(BigInt(1), BigInt(1)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reverse a POSTED journal with mirror-image debit/credit swap', async () => {
      const original = {
        id: BigInt(50),
        journalNumber: 'JRN-202611-0005',
        status: 'POSTED',
        sourceModule: 'MANUAL',
        totalDebit: new Prisma.Decimal(2500),
        totalCredit: new Prisma.Decimal(2500),
        branchId: null,
        lines: [
          { accountId: BigInt(1), debit: new Prisma.Decimal(2500), credit: new Prisma.Decimal(0), lineNumber: 1 },
          { accountId: BigInt(2), debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(2500), lineNumber: 2 },
        ],
      };
      prisma.journalEntry.findUnique.mockResolvedValue(original);
      prisma.accountingPeriod.findFirst.mockResolvedValue({ status: 'OPEN', id: BigInt(1) });
      prisma.journalEntry.count.mockResolvedValue(5);
      prisma.journalEntry.create.mockResolvedValue({
        id: BigInt(51),
        journalNumber: 'JRN-202611-0006',
        status: 'POSTED',
        reversedEntryId: BigInt(50),
        lines: [],
      });
      prisma.journalEntry.update.mockResolvedValue({
        ...original,
        status: 'REVERSED',
      });

      const result = await accountingService.reverseJournal(
        BigInt(50),
        { reason: 'Duplicate payment correction' },
        BigInt(1),
      );

      expect(result.journalNumber).toBe('JRN-202611-0006');
      expect(prisma.journalEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(50) },
          data: expect.objectContaining({ status: 'REVERSED' }),
        }),
      );
    });
  });

  // ==========================================
  // 5. EXPENSE WORKFLOW & SEPARATION OF DUTIES
  // ==========================================
  describe('Expense Workflow & Separation of Duties', () => {
    it('should create an expense in DRAFT status', async () => {
      prisma.expenseCategory.findUnique.mockResolvedValue({
        id: BigInt(1),
        isActive: true,
        code: 'UTIL',
      });
      prisma.expense.count.mockResolvedValue(0);
      prisma.expense.create.mockResolvedValue({
        id: BigInt(1),
        expenseNumber: 'EXP-202611-0001',
        amount: new Prisma.Decimal(12000),
        status: 'DRAFT',
      });

      const dto: CreateExpenseDto = {
        categoryId: 1,
        description: 'Monthly electricity bill',
        amount: 12000,
        expenseDate: '2026-11-03',
      };

      const result = await accountingService.createExpense(dto, BigInt(10));
      expect(result.expenseNumber).toBe('EXP-202611-0001');
      expect(result.status).toBe('DRAFT');
    });

    it('should enforce Separation of Duties: Submitter cannot approve their own expense', async () => {
      prisma.expense.findUnique.mockResolvedValue({
        id: BigInt(1),
        createdById: BigInt(10), // User 10 created it
        status: 'SUBMITTED',
      });

      // User 10 tries to approve their own expense
      await expect(
        accountingService.approveExpense(BigInt(1), 'Self-approved', BigInt(10)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow another user to approve submitted expense', async () => {
      prisma.expense.findUnique.mockResolvedValue({
        id: BigInt(1),
        createdById: BigInt(10), // User 10 created it
        status: 'SUBMITTED',
      });
      prisma.expense.update.mockResolvedValue({
        id: BigInt(1),
        status: 'APPROVED',
        approvedById: BigInt(20), // User 20 approves
      });

      const result = await accountingService.approveExpense(
        BigInt(1),
        'Approved by Finance Lead',
        BigInt(20),
      );
      expect(result.status).toBe('APPROVED');
    });

    it('should automatically post double-entry journal upon paying an approved expense', async () => {
      const expense = {
        id: BigInt(1),
        expenseNumber: 'EXP-202611-0001',
        description: 'Office stationery',
        amount: new Prisma.Decimal(4500),
        status: 'APPROVED',
        paymentMethod: 'CASH',
        category: {
          id: BigInt(1),
          name: 'Clinical & Office Supplies',
          accountId: BigInt(5100),
        },
      };
      prisma.expense.findUnique.mockResolvedValue(expense);
      prisma.account.findUnique.mockImplementation(({ where }: any) => {
        if (where.accountCode === '1010') {
          return Promise.resolve({ id: BigInt(1010), accountCode: '1010' });
        }
        return Promise.resolve(null);
      });
      prisma.accountingPeriod.findFirst.mockResolvedValue({ status: 'OPEN', id: BigInt(1) });
      prisma.journalEntry.count.mockResolvedValue(10);
      prisma.journalEntry.create.mockResolvedValue({
        id: BigInt(99),
        journalNumber: 'JRN-202611-0011',
        status: 'POSTED',
      });
      prisma.expense.update.mockResolvedValue({
        ...expense,
        status: 'PAID',
        postedJournalEntryId: BigInt(99),
      });

      const result = await accountingService.payExpense(
        BigInt(1),
        { paymentMethod: 'CASH' },
        BigInt(25),
      );

      expect(result.status).toBe('PAID');
      expect(prisma.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceModule: 'EXPENSE',
            status: 'POSTED',
          }),
        }),
      );
    });
  });

  // ==========================================
  // 6. FINANCIAL REPORTING
  // ==========================================
  describe('Financial Reports', () => {
    it('should generate balanced Trial Balance', async () => {
      prisma.account.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          accountCode: '1010',
          accountName: 'Cash on Hand',
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
          journalLines: [{ debit: new Prisma.Decimal(10000), credit: new Prisma.Decimal(0) }],
        },
        {
          id: BigInt(2),
          accountCode: '4100',
          accountName: 'Patient Revenue',
          accountType: 'REVENUE',
          normalBalance: 'CREDIT',
          journalLines: [{ debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(10000) }],
        },
      ]);

      const tb = await accountingService.getTrialBalance({});
      expect(tb.isBalanced).toBe(true);
      expect(tb.totalDebitSum).toBe(10000);
      expect(tb.totalCreditSum).toBe(10000);
    });

    it('should generate Profit & Loss computing Net Operating Income', async () => {
      prisma.account.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          accountCode: '4100',
          accountName: 'Outpatient Revenue',
          accountType: 'REVENUE',
          journalLines: [{ debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(50000) }],
        },
        {
          id: BigInt(2),
          accountCode: '5200',
          accountName: 'Utilities Expense',
          accountType: 'EXPENSE',
          journalLines: [{ debit: new Prisma.Decimal(15000), credit: new Prisma.Decimal(0) }],
        },
      ]);

      const pl = await accountingService.getProfitAndLoss({});
      expect(pl.totalRevenue).toBe(50000);
      expect(pl.totalExpense).toBe(15000);
      expect(pl.netOperatingIncome).toBe(35000);
    });
  });
});
