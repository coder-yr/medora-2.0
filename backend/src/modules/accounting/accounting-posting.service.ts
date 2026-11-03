import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJournalEntryDto } from './dto/accounting.dto';

export function serializeBigInt<T>(data: T): T {
  if (data === undefined || data === null) {
    return data;
  }
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );
}

@Injectable()
export class AccountingPostingService {
  private readonly logger = new Logger(AccountingPostingService.name);

  constructor(private readonly prisma: PrismaService) {}

  public static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Generates a sequential, thread-safe Journal Entry Number: JRN-YYYYMM-XXXX
   */
  async generateJournalNumber(
    tx: Prisma.TransactionClient,
    accountingDate: Date,
  ): Promise<string> {
    const year = accountingDate.getFullYear();
    const month = String(accountingDate.getMonth() + 1).padStart(2, '0');
    const prefix = `JRN-${year}${month}`;

    // Acquire transaction-level advisory lock based on prefix hash for concurrency safety
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;

    const count = await tx.journalEntry.count({
      where: {
        journalNumber: {
          startsWith: prefix,
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}-${sequence}`;
  }

  /**
   * Asserts that the accounting period covering the given date is OPEN.
   */
  async assertPeriodIsOpen(
    tx: Prisma.TransactionClient,
    accountingDate: Date,
    branchId?: bigint | null,
  ): Promise<any> {
    const period = await tx.accountingPeriod.findFirst({
      where: {
        startDate: { lte: accountingDate },
        endDate: { gte: accountingDate },
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (period && period.status === 'CLOSED') {
      throw new ConflictException(
        `Accounting Period '${period.name}' (${period.periodCode}) is CLOSED. Cannot post transactions into a locked period.`,
      );
    }

    return period;
  }

  /**
   * Validates double-entry mathematical balance: Sum(Debit) == Sum(Credit).
   */
  validateDoubleEntryBalance(lines: { debit: number; credit: number }[]): {
    totalDebit: number;
    totalCredit: number;
  } {
    if (!lines || lines.length < 2) {
      throw new BadRequestException(
        'A valid double-entry journal must contain at least 2 line items (debit and credit).',
      );
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      const d = AccountingPostingService.round2(Number(line.debit || 0));
      const c = AccountingPostingService.round2(Number(line.credit || 0));

      if (d < 0 || c < 0) {
        throw new BadRequestException('Journal line amounts cannot be negative.');
      }
      if (d > 0 && c > 0) {
        throw new BadRequestException(
          'A single journal line cannot contain both a debit and a credit amount.',
        );
      }
      if (d === 0 && c === 0) {
        throw new BadRequestException(
          'Journal line item amount must be greater than zero.',
        );
      }

      totalDebit = AccountingPostingService.round2(totalDebit + d);
      totalCredit = AccountingPostingService.round2(totalCredit + c);
    }

    const variance = AccountingPostingService.round2(
      Math.abs(totalDebit - totalCredit),
    );
    if (variance > 0.009) {
      throw new BadRequestException(
        `Unbalanced Journal Entry: Total Debits (${totalDebit.toFixed(2)}) must equal Total Credits (${totalCredit.toFixed(2)}). Difference is ${variance.toFixed(2)}.`,
      );
    }

    return { totalDebit, totalCredit };
  }

  /**
   * Creates and optionally immediately posts a double-entry journal entry.
   */
  async createJournal(
    dto: CreateJournalEntryDto,
    userId: bigint,
  ): Promise<any> {
    const accDate = new Date(dto.accountingDate);
    const balance = this.validateDoubleEntryBalance(dto.lines);

    return this.prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      if (dto.idempotencyKey) {
        const existing = await tx.journalEntry.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: {
            lines: {
              include: {
                account: true,
              },
            },
          },
        });
        if (existing) {
          this.logger.log(
            `Idempotency hit for key '${dto.idempotencyKey}'. Returning existing journal ${existing.journalNumber}`,
          );
          return serializeBigInt(existing);
        }
      }

      // 2. Validate period
      const period = await this.assertPeriodIsOpen(
        tx,
        accDate,
        dto.branchId ? BigInt(dto.branchId) : null,
      );

      // 3. Verify accounts exist and are active
      const accountIds = dto.lines.map((l) => BigInt(l.accountId));
      const accounts = await tx.account.findMany({
        where: { id: { in: accountIds } },
      });

      if (accounts.length !== new Set(accountIds.map((id) => id.toString())).size) {
        throw new NotFoundException(
          'One or more accounts in the journal entry do not exist.',
        );
      }

      for (const acc of accounts) {
        if (!acc.isActive) {
          throw new BadRequestException(
            `Account '${acc.accountCode} - ${acc.accountName}' is deactivated and cannot accept new journal postings.`,
          );
        }
        if (
          dto.sourceModule === 'MANUAL' &&
          !acc.allowManualPosting &&
          dto.postImmediately
        ) {
          throw new BadRequestException(
            `Account '${acc.accountCode} - ${acc.accountName}' does not permit manual journal postings.`,
          );
        }
      }

      // 4. Generate Journal Number
      const journalNumber = await this.generateJournalNumber(tx, accDate);
      const isPosted = dto.postImmediately === true;

      // 5. Create Journal Entry & Lines
      const created = await tx.journalEntry.create({
        data: {
          journalNumber,
          accountingDate: accDate,
          description: dto.description,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          sourceModule: dto.sourceModule || 'MANUAL',
          sourceReference: dto.sourceReference,
          idempotencyKey: dto.idempotencyKey,
          status: isPosted ? 'POSTED' : 'DRAFT',
          totalDebit: new Prisma.Decimal(balance.totalDebit),
          totalCredit: new Prisma.Decimal(balance.totalCredit),
          branchId: dto.branchId ? BigInt(dto.branchId) : null,
          periodId: period ? period.id : null,
          createdById: userId,
          postedById: isPosted ? userId : null,
          postedAt: isPosted ? new Date() : null,
          lines: {
            create: dto.lines.map((line, idx) => ({
              accountId: BigInt(line.accountId),
              lineNumber: idx + 1,
              debit: new Prisma.Decimal(AccountingPostingService.round2(line.debit || 0)),
              credit: new Prisma.Decimal(AccountingPostingService.round2(line.credit || 0)),
              description: line.description || dto.description,
              branchId: dto.branchId ? BigInt(dto.branchId) : null,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: true,
            },
          },
          period: true,
          creator: {
            select: { id: true, firstName: true, lastName: true, login: true },
          },
          poster: {
            select: { id: true, firstName: true, lastName: true, login: true },
          },
        },
      });

      return serializeBigInt(created);
    });
  }

  /**
   * Posts an existing DRAFT journal entry.
   */
  async postExistingDraft(journalId: bigint, userId: bigint): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const journal = await tx.journalEntry.findUnique({
        where: { id: journalId },
        include: { lines: true },
      });

      if (!journal) {
        throw new NotFoundException(`Journal entry with ID ${journalId} not found.`);
      }

      if (journal.status === 'POSTED') {
        throw new ConflictException(
          `Journal entry ${journal.journalNumber} has already been posted.`,
        );
      }

      if (journal.status === 'REVERSED') {
        throw new ConflictException(
          `Journal entry ${journal.journalNumber} is REVERSED and cannot be posted.`,
        );
      }

      // Assert period is open
      const period = await this.assertPeriodIsOpen(
        tx,
        journal.accountingDate,
        journal.branchId,
      );

      // Validate lines
      const lineItems = journal.lines.map((l) => ({
        debit: Number(l.debit),
        credit: Number(l.credit),
      }));
      const balance = this.validateDoubleEntryBalance(lineItems);

      const posted = await tx.journalEntry.update({
        where: { id: journalId },
        data: {
          status: 'POSTED',
          postedById: userId,
          postedAt: new Date(),
          periodId: period ? period.id : journal.periodId,
          totalDebit: new Prisma.Decimal(balance.totalDebit),
          totalCredit: new Prisma.Decimal(balance.totalCredit),
        },
        include: {
          lines: {
            include: { account: true },
          },
          period: true,
          poster: {
            select: { id: true, firstName: true, lastName: true, login: true },
          },
        },
      });

      return serializeBigInt(posted);
    });
  }

  /**
   * Helper: Resolves Account ID by Account Code.
   */
  async getAccountIdByCode(
    tx: Prisma.TransactionClient,
    accountCode: string,
  ): Promise<bigint> {
    const acc = await tx.account.findUnique({
      where: { accountCode },
    });
    if (!acc) {
      throw new NotFoundException(
        `Required system account with code '${accountCode}' not found. Please run database seeds.`,
      );
    }
    return acc.id;
  }

  /**
   * Operational Integration 1: Invoice Issued
   * Debit: 1200 (Accounts Receivable)
   * Credit: 4100 (Patient Service Revenue - Outpatient)
   */
  async postInvoiceIssued(
    invoiceId: bigint,
    amount: number,
    branchId: bigint | null,
    userId: bigint,
    invoiceNumber?: string,
  ): Promise<any> {
    const rounded = AccountingPostingService.round2(amount);
    if (rounded <= 0) return null;

    const idempotencyKey = `INV-POST-${invoiceId}`;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.journalEntry.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return serializeBigInt(existing);

      const arAccountId = await this.getAccountIdByCode(tx, '1200');
      const revAccountId = await this.getAccountIdByCode(tx, '4100');

      const desc = `Patient invoice issued ${invoiceNumber || '#' + invoiceId}`;
      const accDate = new Date();
      const period = await this.assertPeriodIsOpen(tx, accDate, branchId);
      const journalNumber = await this.generateJournalNumber(tx, accDate);

      const created = await tx.journalEntry.create({
        data: {
          journalNumber,
          accountingDate: accDate,
          description: desc,
          referenceType: 'INVOICE',
          referenceId: invoiceId.toString(),
          sourceModule: 'BILLING',
          sourceReference: invoiceNumber,
          idempotencyKey,
          status: 'POSTED',
          totalDebit: new Prisma.Decimal(rounded),
          totalCredit: new Prisma.Decimal(rounded),
          branchId,
          periodId: period ? period.id : null,
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: arAccountId,
                lineNumber: 1,
                debit: new Prisma.Decimal(rounded),
                credit: new Prisma.Decimal(0),
                description: `Accounts receivable for invoice ${invoiceNumber || invoiceId}`,
                branchId,
              },
              {
                accountId: revAccountId,
                lineNumber: 2,
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(rounded),
                description: `Outpatient revenue for invoice ${invoiceNumber || invoiceId}`,
                branchId,
              },
            ],
          },
        },
      });

      return serializeBigInt(created);
    });
  }

  /**
   * Operational Integration 2: Invoice Payment Received
   * Debit: 1010 (Cash on Hand) or 1020 (Bank Account)
   * Credit: 1200 (Accounts Receivable)
   */
  async postInvoicePayment(
    paymentId: bigint,
    amount: number,
    paymentMethod: string,
    branchId: bigint | null,
    userId: bigint,
    receiptNo?: string,
  ): Promise<any> {
    const rounded = AccountingPostingService.round2(amount);
    if (rounded <= 0) return null;

    const idempotencyKey = `PAY-POST-${paymentId}`;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.journalEntry.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return serializeBigInt(existing);

      const isCash =
        !paymentMethod ||
        paymentMethod.toUpperCase() === 'CASH' ||
        paymentMethod.toLowerCase().includes('cash');

      const cashOrBankAccountId = await this.getAccountIdByCode(
        tx,
        isCash ? '1010' : '1020',
      );
      const arAccountId = await this.getAccountIdByCode(tx, '1200');

      const desc = `Payment received via ${paymentMethod} (Receipt: ${receiptNo || '#' + paymentId})`;
      const accDate = new Date();
      const period = await this.assertPeriodIsOpen(tx, accDate, branchId);
      const journalNumber = await this.generateJournalNumber(tx, accDate);

      const created = await tx.journalEntry.create({
        data: {
          journalNumber,
          accountingDate: accDate,
          description: desc,
          referenceType: 'PAYMENT',
          referenceId: paymentId.toString(),
          sourceModule: 'BILLING',
          sourceReference: receiptNo,
          idempotencyKey,
          status: 'POSTED',
          totalDebit: new Prisma.Decimal(rounded),
          totalCredit: new Prisma.Decimal(rounded),
          branchId,
          periodId: period ? period.id : null,
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: cashOrBankAccountId,
                lineNumber: 1,
                debit: new Prisma.Decimal(rounded),
                credit: new Prisma.Decimal(0),
                description: `Collections via ${paymentMethod}`,
                branchId,
              },
              {
                accountId: arAccountId,
                lineNumber: 2,
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(rounded),
                description: `Clearing patient receivable`,
                branchId,
              },
            ],
          },
        },
      });

      return serializeBigInt(created);
    });
  }

  /**
   * Operational Integration 3: Cashier Cash Payout
   * Debit: 5300 (Maintenance) or specified Expense Account
   * Credit: 1010 (Cash on Hand)
   */
  async postCashierPayout(
    transactionId: bigint,
    amount: number,
    expenseAccountId: bigint | null,
    description: string,
    branchId: bigint | null,
    userId: bigint,
  ): Promise<any> {
    const rounded = AccountingPostingService.round2(amount);
    if (rounded <= 0) return null;

    const idempotencyKey = `PAYOUT-POST-${transactionId}`;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.journalEntry.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return serializeBigInt(existing);

      const cashAccountId = await this.getAccountIdByCode(tx, '1010');
      const targetExpenseAccountId =
        expenseAccountId || (await this.getAccountIdByCode(tx, '5300'));

      const accDate = new Date();
      const period = await this.assertPeriodIsOpen(tx, accDate, branchId);
      const journalNumber = await this.generateJournalNumber(tx, accDate);

      const created = await tx.journalEntry.create({
        data: {
          journalNumber,
          accountingDate: accDate,
          description: `Cashier payout: ${description}`,
          referenceType: 'CASH_PAYOUT',
          referenceId: transactionId.toString(),
          sourceModule: 'CASHIER',
          idempotencyKey,
          status: 'POSTED',
          totalDebit: new Prisma.Decimal(rounded),
          totalCredit: new Prisma.Decimal(rounded),
          branchId,
          periodId: period ? period.id : null,
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: targetExpenseAccountId,
                lineNumber: 1,
                debit: new Prisma.Decimal(rounded),
                credit: new Prisma.Decimal(0),
                description: `Cash payout expense: ${description}`,
                branchId,
              },
              {
                accountId: cashAccountId,
                lineNumber: 2,
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(rounded),
                description: `Cash drawer disbursement`,
                branchId,
              },
            ],
          },
        },
      });

      return serializeBigInt(created);
    });
  }

  /**
   * Operational Integration 4: Inpatient Folio Discharge Settlement
   * Debit: 1010/1020 Cash/Bank
   * Credit: 4110 Inpatient Revenue
   */
  async postDischargeSettlement(
    admissionId: bigint,
    amount: number,
    paymentMethod: string,
    branchId: bigint | null,
    userId: bigint,
  ): Promise<any> {
    const rounded = AccountingPostingService.round2(amount);
    if (rounded <= 0) return null;

    const idempotencyKey = `DISCHARGE-POST-${admissionId}`;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.journalEntry.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return serializeBigInt(existing);

      const isCash =
        !paymentMethod ||
        paymentMethod.toUpperCase() === 'CASH' ||
        paymentMethod.toLowerCase().includes('cash');

      const cashOrBankAccountId = await this.getAccountIdByCode(
        tx,
        isCash ? '1010' : '1020',
      );
      const inpatientRevAccountId = await this.getAccountIdByCode(tx, '4110');

      const accDate = new Date();
      const period = await this.assertPeriodIsOpen(tx, accDate, branchId);
      const journalNumber = await this.generateJournalNumber(tx, accDate);

      const created = await tx.journalEntry.create({
        data: {
          journalNumber,
          accountingDate: accDate,
          description: `Inpatient discharge settlement for Admission #${admissionId}`,
          referenceType: 'INPATIENT_FOLIO',
          referenceId: admissionId.toString(),
          sourceModule: 'INPATIENT',
          idempotencyKey,
          status: 'POSTED',
          totalDebit: new Prisma.Decimal(rounded),
          totalCredit: new Prisma.Decimal(rounded),
          branchId,
          periodId: period ? period.id : null,
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: cashOrBankAccountId,
                lineNumber: 1,
                debit: new Prisma.Decimal(rounded),
                credit: new Prisma.Decimal(0),
                description: `Discharge settlement payment via ${paymentMethod}`,
                branchId,
              },
              {
                accountId: inpatientRevAccountId,
                lineNumber: 2,
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(rounded),
                description: `Inpatient room, nursing and clinical services revenue`,
                branchId,
              },
            ],
          },
        },
      });

      return serializeBigInt(created);
    });
  }

  /**
   * Operational Integration 5: Debt Write-Off / Concession
   * Debit: 5900 (Concessions, Discounts & Bad Debt)
   * Credit: 1200 (Accounts Receivable)
   */
  async postDebtWriteOff(
    invoiceId: bigint,
    amount: number,
    reason: string,
    branchId: bigint | null,
    userId: bigint,
  ): Promise<any> {
    const rounded = AccountingPostingService.round2(amount);
    if (rounded <= 0) return null;

    const idempotencyKey = `WRITEOFF-POST-${invoiceId}`;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.journalEntry.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return serializeBigInt(existing);

      const badDebtAccountId = await this.getAccountIdByCode(tx, '5900');
      const arAccountId = await this.getAccountIdByCode(tx, '1200');

      const accDate = new Date();
      const period = await this.assertPeriodIsOpen(tx, accDate, branchId);
      const journalNumber = await this.generateJournalNumber(tx, accDate);

      const created = await tx.journalEntry.create({
        data: {
          journalNumber,
          accountingDate: accDate,
          description: `Patient balance write-off: ${reason}`,
          referenceType: 'WRITE_OFF',
          referenceId: invoiceId.toString(),
          sourceModule: 'BILLING',
          idempotencyKey,
          status: 'POSTED',
          totalDebit: new Prisma.Decimal(rounded),
          totalCredit: new Prisma.Decimal(rounded),
          branchId,
          periodId: period ? period.id : null,
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: badDebtAccountId,
                lineNumber: 1,
                debit: new Prisma.Decimal(rounded),
                credit: new Prisma.Decimal(0),
                description: `Bad debt concession: ${reason}`,
                branchId,
              },
              {
                accountId: arAccountId,
                lineNumber: 2,
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(rounded),
                description: `Writing off uncollectible receivable`,
                branchId,
              },
            ],
          },
        },
      });

      return serializeBigInt(created);
    });
  }
}

