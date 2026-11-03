import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountingPostingService,
  serializeBigInt,
} from './accounting-posting.service';
import {
  AccountQueryDto,
  CloseAccountingPeriodDto,
  CreateAccountingPeriodDto,
  CreateAccountDto,
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  CreateJournalEntryDto,
  CreateLegacyAccountingDto,
  CreateLegacySectorDto,
  ExpenseQueryDto,
  JournalQueryDto,
  PayExpenseDto,
  PeriodQueryDto,
  RejectExpenseDto,
  ReopenAccountingPeriodDto,
  ReportQueryDto,
  ReverseJournalEntryDto,
  UpdateAccountDto,
  UpdateExpenseCategoryDto,
  UpdateExpenseDto,
} from './dto/accounting.dto';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly postingService: AccountingPostingService,
  ) {}

  // ==========================================
  // 1. CHART OF ACCOUNTS (COA)
  // ==========================================

  async listAccounts(query: AccountQueryDto) {
    const { accountType, isActive, search, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AccountWhereInput = {
      ...(accountType ? { accountType } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { accountCode: { contains: search, mode: 'insensitive' } },
              { accountName: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ accountCode: 'asc' }],
        include: {
          parentAccount: {
            select: { id: true, accountCode: true, accountName: true },
          },
        },
      }),
      this.prisma.account.count({ where }),
    ]);

    return serializeBigInt({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  async getAccountTree() {
    const accounts = await this.prisma.account.findMany({
      where: { isActive: true },
      orderBy: [{ accountCode: 'asc' }],
    });

    const accountMap = new Map<string, any>();
    const roots: any[] = [];

    for (const acc of accounts) {
      accountMap.set(acc.id.toString(), {
        ...acc,
        id: acc.id.toString(),
        parentAccountId: acc.parentAccountId?.toString() || null,
        branchId: acc.branchId?.toString() || null,
        children: [],
      });
    }

    for (const acc of accounts) {
      const node = accountMap.get(acc.id.toString());
      if (acc.parentAccountId && accountMap.has(acc.parentAccountId.toString())) {
        accountMap.get(acc.parentAccountId.toString()).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async getAccountById(id: bigint) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        parentAccount: true,
        childAccounts: true,
        journalLines: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            journalEntry: {
              select: {
                journalNumber: true,
                accountingDate: true,
                description: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found.`);
    }

    return serializeBigInt(account);
  }

  async createAccount(dto: CreateAccountDto, _userId: bigint) {
    const existing = await this.prisma.account.findUnique({
      where: { accountCode: dto.accountCode },
    });

    if (existing) {
      throw new ConflictException(
        `Account with code '${dto.accountCode}' already exists (${existing.accountName}).`,
      );
    }

    const created = await this.prisma.account.create({
      data: {
        accountCode: dto.accountCode,
        accountName: dto.accountName,
        accountType: dto.accountType,
        normalBalance: dto.normalBalance,
        description: dto.description,
        accountSubType: dto.accountSubType,
        parentAccountId: dto.parentAccountId ? BigInt(dto.parentAccountId) : null,
        allowManualPosting: dto.allowManualPosting ?? true,
        currency: dto.currency || 'PKR',
        branchId: dto.branchId ? BigInt(dto.branchId) : null,
        isSystemAccount: false,
      },
      include: {
        parentAccount: true,
      },
    });

    return serializeBigInt(created);
  }

  async updateAccount(id: bigint, dto: UpdateAccountDto) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found.`);
    }

    const updated = await this.prisma.account.update({
      where: { id },
      data: {
        ...(dto.accountName ? { accountName: dto.accountName } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.parentAccountId !== undefined
          ? {
              parentAccountId: dto.parentAccountId
                ? BigInt(dto.parentAccountId)
                : null,
            }
          : {}),
        ...(dto.allowManualPosting !== undefined
          ? { allowManualPosting: dto.allowManualPosting }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { parentAccount: true },
    });

    return serializeBigInt(updated);
  }

  async deleteAccount(id: bigint) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: { journalLines: { take: 1 } },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found.`);
    }

    if (account.isSystemAccount) {
      throw new BadRequestException(
        `System account '${account.accountCode} - ${account.accountName}' cannot be deleted.`,
      );
    }

    if (account.journalLines.length > 0) {
      // If journal lines exist, soft-deactivate rather than deleting
      const deactivated = await this.prisma.account.update({
        where: { id },
        data: { isActive: false },
      });
      return serializeBigInt({
        message: 'Account has historical journal lines. Deactivated successfully.',
        account: deactivated,
      });
    }

    await this.prisma.account.delete({ where: { id } });
    return { message: 'Account deleted successfully.' };
  }

  // ==========================================
  // 2. ACCOUNTING PERIODS
  // ==========================================

  async listPeriods(query: PeriodQueryDto) {
    const { status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AccountingPeriodWhereInput = {
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.accountingPeriod.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ startDate: 'desc' }],
        include: {
          closer: {
            select: { id: true, firstName: true, lastName: true, login: true },
          },
        },
      }),
      this.prisma.accountingPeriod.count({ where }),
    ]);

    return serializeBigInt({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  async getCurrentOpenPeriod(branchId?: bigint) {
    const now = new Date();
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
        status: 'OPEN',
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return serializeBigInt(period);
  }

  async createPeriod(dto: CreateAccountingPeriodDto) {
    const existing = await this.prisma.accountingPeriod.findUnique({
      where: { periodCode: dto.periodCode },
    });

    if (existing) {
      throw new ConflictException(
        `Accounting period code '${dto.periodCode}' already exists.`,
      );
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (start >= end) {
      throw new BadRequestException('Start date must be before end date.');
    }

    const created = await this.prisma.accountingPeriod.create({
      data: {
        periodCode: dto.periodCode,
        name: dto.name,
        startDate: start,
        endDate: end,
        status: 'OPEN',
        branchId: dto.branchId ? BigInt(dto.branchId) : null,
      },
    });

    return serializeBigInt(created);
  }

  async closePeriod(
    id: bigint,
    dto: CloseAccountingPeriodDto,
    userId: bigint,
  ) {
    const period = await this.prisma.accountingPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      throw new NotFoundException(`Accounting period with ID ${id} not found.`);
    }

    if (period.status === 'CLOSED') {
      throw new ConflictException(
        `Accounting period '${period.name}' is already closed.`,
      );
    }

    // Check for unposted drafts in this period
    const pendingDraftsCount = await this.prisma.journalEntry.count({
      where: {
        periodId: id,
        status: 'DRAFT',
      },
    });

    if (pendingDraftsCount > 0) {
      throw new BadRequestException(
        `Cannot close period '${period.name}'. There are ${pendingDraftsCount} unposted draft journal entries that must be posted or deleted first.`,
      );
    }

    const closed = await this.prisma.accountingPeriod.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy: userId,
        closingNotes: dto.closingNotes,
      },
      include: {
        closer: {
          select: { id: true, firstName: true, lastName: true, login: true },
        },
      },
    });

    return serializeBigInt(closed);
  }

  async reopenPeriod(
    id: bigint,
    dto: ReopenAccountingPeriodDto,
    userId: bigint,
  ) {
    const period = await this.prisma.accountingPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      throw new NotFoundException(`Accounting period with ID ${id} not found.`);
    }

    if (period.status === 'OPEN') {
      throw new ConflictException(
        `Accounting period '${period.name}' is already open.`,
      );
    }

    const reopened = await this.prisma.accountingPeriod.update({
      where: { id },
      data: {
        status: 'OPEN',
        closedAt: null,
        closedBy: null,
        closingNotes: `Reopened by user #${userId}: ${dto.reason}`,
      },
    });

    return serializeBigInt(reopened);
  }

  // ==========================================
  // 3. JOURNAL ENTRIES
  // ==========================================

  async listJournals(query: JournalQueryDto) {
    const {
      status,
      startDate,
      endDate,
      sourceModule,
      accountId,
      search,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.JournalEntryWhereInput = {
      ...(status ? { status } : {}),
      ...(sourceModule ? { sourceModule } : {}),
      ...(startDate || endDate
        ? {
            accountingDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(accountId
        ? {
            lines: {
              some: {
                accountId: BigInt(accountId),
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { journalNumber: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { sourceReference: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ accountingDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          lines: {
            include: {
              account: {
                select: {
                  id: true,
                  accountCode: true,
                  accountName: true,
                  accountType: true,
                },
              },
            },
          },
          creator: {
            select: { id: true, firstName: true, lastName: true, login: true },
          },
          poster: {
            select: { id: true, firstName: true, lastName: true, login: true },
          },
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return serializeBigInt({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  async getJournalById(id: bigint) {
    const journal = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
        period: true,
        creator: {
          select: { id: true, firstName: true, lastName: true, login: true },
        },
        poster: {
          select: { id: true, firstName: true, lastName: true, login: true },
        },
        reversedEntry: {
          select: { id: true, journalNumber: true, description: true },
        },
        reversalBy: {
          select: { id: true, journalNumber: true, description: true },
        },
      },
    });

    if (!journal) {
      throw new NotFoundException(`Journal entry with ID ${id} not found.`);
    }

    return serializeBigInt(journal);
  }

  async createJournal(dto: CreateJournalEntryDto, userId: bigint) {
    return this.postingService.createJournal(dto, userId);
  }

  async postJournal(id: bigint, userId: bigint) {
    return this.postingService.postExistingDraft(id, userId);
  }

  async reverseJournal(
    id: bigint,
    dto: ReverseJournalEntryDto,
    userId: bigint,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.journalEntry.findUnique({
        where: { id },
        include: { lines: true },
      });

      if (!original) {
        throw new NotFoundException(`Journal entry with ID ${id} not found.`);
      }

      if (original.status !== 'POSTED') {
        throw new BadRequestException(
          `Only POSTED journal entries can be reversed. Current status is ${original.status}.`,
        );
      }

      const reversalDate = dto.reversalDate
        ? new Date(dto.reversalDate)
        : new Date();

      // Check period is open
      const period = await this.postingService.assertPeriodIsOpen(
        tx,
        reversalDate,
        original.branchId,
      );

      // Generate reversal journal number
      const reversalJournalNumber =
        await this.postingService.generateJournalNumber(tx, reversalDate);

      // Create mirror-image reversal: swap debits and credits
      const reversalJournal = await tx.journalEntry.create({
        data: {
          journalNumber: reversalJournalNumber,
          accountingDate: reversalDate,
          description: `REVERSAL of ${original.journalNumber}: ${dto.reason}`,
          referenceType: 'REVERSAL',
          referenceId: original.id.toString(),
          sourceModule: original.sourceModule,
          sourceReference: original.journalNumber,
          status: 'POSTED',
          totalDebit: original.totalCredit,
          totalCredit: original.totalDebit,
          branchId: original.branchId,
          periodId: period ? period.id : null,
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
          reversedEntryId: original.id,
          reversalReason: dto.reason,
          lines: {
            create: original.lines.map((line, idx) => ({
              accountId: line.accountId,
              lineNumber: idx + 1,
              debit: line.credit, // Debit becomes Credit
              credit: line.debit, // Credit becomes Debit
              description: `Reversal of line ${line.lineNumber}: ${line.description || ''}`,
              branchId: line.branchId,
            })),
          },
        },
        include: {
          lines: {
            include: { account: true },
          },
        },
      });

      // Mark original as REVERSED
      await tx.journalEntry.update({
        where: { id: original.id },
        data: {
          status: 'REVERSED',
          reversalReason: dto.reason,
        },
      });

      return serializeBigInt(reversalJournal);
    });
  }

  async deleteDraftJournal(id: bigint, _userId: bigint) {
    const journal = await this.prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!journal) {
      throw new NotFoundException(`Journal entry with ID ${id} not found.`);
    }

    if (journal.status !== 'DRAFT') {
      throw new ForbiddenException(
        `Immutable Ledger Invariant: Cannot delete a ${journal.status} journal entry (${journal.journalNumber}). Corrections must be made via signed reversal entries.`,
      );
    }

    await this.prisma.journalEntry.delete({ where: { id } });
    return { message: `Draft journal ${journal.journalNumber} deleted successfully.` };
  }

  // ==========================================
  // 4. EXPENSE CATEGORIES
  // ==========================================

  async listExpenseCategories() {
    const categories = await this.prisma.expenseCategory.findMany({
      orderBy: [{ code: 'asc' }],
      include: {
        account: {
          select: { id: true, accountCode: true, accountName: true },
        },
      },
    });

    return serializeBigInt(categories);
  }

  async createExpenseCategory(dto: CreateExpenseCategoryDto) {
    const existing = await this.prisma.expenseCategory.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(
        `Expense category code '${dto.code}' already exists.`,
      );
    }

    const created = await this.prisma.expenseCategory.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        accountId: dto.accountId ? BigInt(dto.accountId) : null,
        isActive: true,
      },
      include: { account: true },
    });

    return serializeBigInt(created);
  }

  async updateExpenseCategory(id: bigint, dto: UpdateExpenseCategoryDto) {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Expense category with ID ${id} not found.`);
    }

    const updated = await this.prisma.expenseCategory.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.accountId !== undefined
          ? { accountId: dto.accountId ? BigInt(dto.accountId) : null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { account: true },
    });

    return serializeBigInt(updated);
  }

  // ==========================================
  // 5. EXPENSE MANAGEMENT WORKFLOW
  // ==========================================

  async listExpenses(query: ExpenseQueryDto) {
    const {
      status,
      categoryId,
      startDate,
      endDate,
      vendorName,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {
      ...(status ? { status } : {}),
      ...(categoryId ? { categoryId: BigInt(categoryId) } : {}),
      ...(vendorName
        ? { vendorName: { contains: vendorName, mode: 'insensitive' } }
        : {}),
      ...(startDate || endDate
        ? {
            expenseDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          category: {
            include: { account: true },
          },
          creator: {
            select: { id: true, firstName: true, lastName: true, login: true },
          },
          approver: {
            select: { id: true, firstName: true, lastName: true, login: true },
          },
          payer: {
            select: { id: true, firstName: true, lastName: true, login: true },
          },
          postedJournalEntry: {
            select: { id: true, journalNumber: true, status: true },
          },
        },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return serializeBigInt({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  async getExpenseById(id: bigint) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        category: {
          include: { account: true },
        },
        creator: {
          select: { id: true, firstName: true, lastName: true, login: true },
        },
        approver: {
          select: { id: true, firstName: true, lastName: true, login: true },
        },
        payer: {
          select: { id: true, firstName: true, lastName: true, login: true },
        },
        postedJournalEntry: {
          include: {
            lines: {
              include: { account: true },
            },
          },
        },
      },
    });

    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found.`);
    }

    return serializeBigInt(expense);
  }

  async createExpense(dto: CreateExpenseDto, userId: bigint) {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: BigInt(dto.categoryId) },
    });

    if (!category || !category.isActive) {
      throw new BadRequestException('Selected expense category is invalid or inactive.');
    }

    const year = new Date(dto.expenseDate).getFullYear();
    const month = String(new Date(dto.expenseDate).getMonth() + 1).padStart(2, '0');
    const prefix = `EXP-${year}${month}`;

    const count = await this.prisma.expense.count({
      where: { expenseNumber: { startsWith: prefix } },
    });
    const expenseNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    const created = await this.prisma.expense.create({
      data: {
        expenseNumber,
        categoryId: BigInt(dto.categoryId),
        description: dto.description,
        amount: new Prisma.Decimal(AccountingPostingService.round2(dto.amount)),
        expenseDate: new Date(dto.expenseDate),
        vendorName: dto.vendorName,
        invoiceNumber: dto.invoiceNumber,
        paymentMethod: dto.paymentMethod || 'CASH',
        status: 'DRAFT',
        branchId: dto.branchId ? BigInt(dto.branchId) : null,
        createdById: userId,
        notes: dto.notes,
      },
      include: {
        category: true,
        creator: {
          select: { id: true, firstName: true, lastName: true, login: true },
        },
      },
    });

    return serializeBigInt(created);
  }

  async updateExpense(id: bigint, dto: UpdateExpenseDto, _userId: bigint) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found.`);
    }

    if (expense.status !== 'DRAFT' && expense.status !== 'REJECTED') {
      throw new BadRequestException(
        `Cannot edit expense in status '${expense.status}'. Only DRAFT or REJECTED expenses can be edited.`,
      );
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.categoryId ? { categoryId: BigInt(dto.categoryId) } : {}),
        ...(dto.description ? { description: dto.description } : {}),
        ...(dto.amount
          ? { amount: new Prisma.Decimal(AccountingPostingService.round2(dto.amount)) }
          : {}),
        ...(dto.expenseDate ? { expenseDate: new Date(dto.expenseDate) } : {}),
        ...(dto.vendorName !== undefined ? { vendorName: dto.vendorName } : {}),
        ...(dto.invoiceNumber !== undefined
          ? { invoiceNumber: dto.invoiceNumber }
          : {}),
        ...(dto.paymentMethod ? { paymentMethod: dto.paymentMethod } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: { category: true },
    });

    return serializeBigInt(updated);
  }

  async submitExpense(id: bigint, _userId: bigint) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found.`);
    }

    if (expense.status !== 'DRAFT' && expense.status !== 'REJECTED') {
      throw new BadRequestException(
        `Only DRAFT or REJECTED expenses can be submitted for approval. Current status: ${expense.status}`,
      );
    }

    const submitted = await this.prisma.expense.update({
      where: { id },
      data: { status: 'SUBMITTED' },
      include: { category: true, creator: true },
    });

    return serializeBigInt(submitted);
  }

  async approveExpense(
    id: bigint,
    notes: string | undefined,
    approverUserId: bigint,
  ) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found.`);
    }

    if (expense.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Only SUBMITTED expenses can be approved. Current status: ${expense.status}`,
      );
    }

    // Separation of Duties check: submitter cannot approve own expense
    if (expense.createdById === approverUserId) {
      throw new ForbiddenException(
        'Separation of Duties Violation: You cannot approve an expense that you created yourself.',
      );
    }

    const approved = await this.prisma.expense.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: approverUserId,
        approvedAt: new Date(),
        ...(notes ? { notes: `${expense.notes || ''}\nApproval Note: ${notes}` } : {}),
      },
      include: { category: true, creator: true, approver: true },
    });

    return serializeBigInt(approved);
  }

  async rejectExpense(
    id: bigint,
    dto: RejectExpenseDto,
    approverUserId: bigint,
  ) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found.`);
    }

    if (expense.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Only SUBMITTED expenses can be rejected. Current status: ${expense.status}`,
      );
    }

    if (expense.createdById === approverUserId) {
      throw new ForbiddenException(
        'Separation of Duties Violation: You cannot reject/review an expense that you created yourself.',
      );
    }

    const rejected = await this.prisma.expense.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: dto.reason,
        approvedById: approverUserId,
        approvedAt: new Date(),
      },
      include: { category: true, creator: true },
    });

    return serializeBigInt(rejected);
  }

  async payExpense(
    id: bigint,
    dto: PayExpenseDto,
    payerUserId: bigint,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findUnique({
        where: { id },
        include: {
          category: {
            include: { account: true },
          },
        },
      });

      if (!expense) {
        throw new NotFoundException(`Expense with ID ${id} not found.`);
      }

      if (expense.status !== 'APPROVED') {
        throw new BadRequestException(
          `Only APPROVED expenses can be paid. Current status: ${expense.status}`,
        );
      }

      const method = dto.paymentMethod || expense.paymentMethod || 'CASH';
      const isCash =
        method.toUpperCase() === 'CASH' || method.toLowerCase().includes('cash');

      // Resolve disbursement cash/bank account (1010 or 1020)
      const cashOrBankAccountId = dto.disbursementAccountId
        ? BigInt(dto.disbursementAccountId)
        : await this.postingService.getAccountIdByCode(
            tx,
            isCash ? '1010' : '1020',
          );

      // Resolve expense account from category (or fallback to 5400 Administrative)
      let expenseAccountId = expense.category.accountId;
      if (!expenseAccountId) {
        expenseAccountId = await this.postingService.getAccountIdByCode(
          tx,
          '5400',
        );
      }

      const paidDate = dto.paidAt ? new Date(dto.paidAt) : new Date();
      const period = await this.postingService.assertPeriodIsOpen(
        tx,
        paidDate,
        expense.branchId,
      );

      const journalNumber = await this.postingService.generateJournalNumber(
        tx,
        paidDate,
      );

      // Post Balanced Double-Entry Journal:
      // Debit: Expense Account (5xxx)
      // Credit: Cash on Hand (1010) or Bank (1020)
      const journal = await tx.journalEntry.create({
        data: {
          journalNumber,
          accountingDate: paidDate,
          description: `Disbursement for ${expense.expenseNumber}: ${expense.description} (${expense.vendorName || 'Vendor'})`,
          referenceType: 'EXPENSE',
          referenceId: expense.id.toString(),
          sourceModule: 'EXPENSE',
          sourceReference: expense.expenseNumber,
          status: 'POSTED',
          totalDebit: expense.amount,
          totalCredit: expense.amount,
          branchId: expense.branchId,
          periodId: period ? period.id : null,
          createdById: payerUserId,
          postedById: payerUserId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: expenseAccountId,
                lineNumber: 1,
                debit: expense.amount,
                credit: new Prisma.Decimal(0),
                description: `${expense.category.name}: ${expense.description}`,
                branchId: expense.branchId,
              },
              {
                accountId: cashOrBankAccountId,
                lineNumber: 2,
                debit: new Prisma.Decimal(0),
                credit: expense.amount,
                description: `Payment via ${method} for ${expense.expenseNumber}`,
                branchId: expense.branchId,
              },
            ],
          },
        },
      });

      // Update expense status to PAID
      const paid = await tx.expense.update({
        where: { id },
        data: {
          status: 'PAID',
          paymentMethod: method,
          paidAt: paidDate,
          paidById: payerUserId,
          postedJournalEntryId: journal.id,
        },
        include: {
          category: true,
          postedJournalEntry: true,
          payer: {
            select: { id: true, firstName: true, lastName: true, login: true },
          },
        },
      });

      return serializeBigInt(paid);
    });
  }

  async cancelExpense(id: bigint, _userId: bigint) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found.`);
    }

    if (expense.status === 'PAID') {
      throw new BadRequestException(
        'Cannot cancel a PAID expense. A financial reversal entry is required.',
      );
    }

    const cancelled = await this.prisma.expense.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return serializeBigInt(cancelled);
  }

  // ==========================================
  // 6. FINANCIAL REPORTING ENGINE
  // ==========================================

  async getDashboardMetrics() {
    const now = new Date();
    const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      revenueLines,
      expenseLines,
      cashAccounts,
      arAccounts,
      pendingExpensesCount,
      recentJournals,
    ] = await Promise.all([
      // Current Month Revenue
      this.prisma.journalEntryLine.aggregate({
        where: {
          journalEntry: {
            status: 'POSTED',
            accountingDate: { gte: firstDayMonth, lte: lastDayMonth },
          },
          account: { accountType: 'REVENUE' },
        },
        _sum: { credit: true, debit: true },
      }),

      // Current Month Expenses
      this.prisma.journalEntryLine.aggregate({
        where: {
          journalEntry: {
            status: 'POSTED',
            accountingDate: { gte: firstDayMonth, lte: lastDayMonth },
          },
          account: { accountType: 'EXPENSE' },
        },
        _sum: { debit: true, credit: true },
      }),

      // Cash & Bank balances (1010, 1020, 1030)
      this.prisma.journalEntryLine.findMany({
        where: {
          journalEntry: { status: 'POSTED' },
          account: {
            accountCode: { in: ['1010', '1020', '1030'] },
          },
        },
        select: {
          debit: true,
          credit: true,
          account: { select: { accountCode: true, accountName: true } },
        },
      }),

      // Accounts Receivable (1200)
      this.prisma.journalEntryLine.findMany({
        where: {
          journalEntry: { status: 'POSTED' },
          account: { accountCode: '1200' },
        },
        select: { debit: true, credit: true },
      }),

      // Pending expense count
      this.prisma.expense.count({
        where: { status: 'SUBMITTED' },
      }),

      // Recent 5 journals
      this.prisma.journalEntry.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
    ]);

    const totalRevenueMonth = AccountingPostingService.round2(
      Number(revenueLines._sum.credit || 0) - Number(revenueLines._sum.debit || 0),
    );

    const totalExpenseMonth = AccountingPostingService.round2(
      Number(expenseLines._sum.debit || 0) - Number(expenseLines._sum.credit || 0),
    );

    const netSurplusMonth = AccountingPostingService.round2(
      totalRevenueMonth - totalExpenseMonth,
    );

    let totalLiquidity = 0;
    for (const line of cashAccounts) {
      totalLiquidity += Number(line.debit) - Number(line.credit);
    }
    totalLiquidity = AccountingPostingService.round2(totalLiquidity);

    let totalReceivables = 0;
    for (const line of arAccounts) {
      totalReceivables += Number(line.debit) - Number(line.credit);
    }
    totalReceivables = AccountingPostingService.round2(totalReceivables);

    return serializeBigInt({
      totalRevenueMonth,
      totalExpenseMonth,
      netSurplusMonth,
      totalLiquidity,
      totalReceivables,
      pendingExpensesCount,
      recentJournals,
    });
  }

  async getTrialBalance(query: ReportQueryDto) {
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();

    const accounts = await this.prisma.account.findMany({
      where: { isActive: true },
      orderBy: { accountCode: 'asc' },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: 'POSTED',
              accountingDate: { lte: asOfDate },
              ...(query.branchId ? { branchId: BigInt(query.branchId) } : {}),
            },
          },
          select: { debit: true, credit: true },
        },
      },
    });

    let totalDebitSum = 0;
    let totalCreditSum = 0;

    const rows = accounts.map((acc) => {
      let debitTotal = 0;
      let creditTotal = 0;
      for (const line of acc.journalLines) {
        debitTotal += Number(line.debit);
        creditTotal += Number(line.credit);
      }
      debitTotal = AccountingPostingService.round2(debitTotal);
      creditTotal = AccountingPostingService.round2(creditTotal);

      let netDebit = 0;
      let netCredit = 0;

      if (acc.normalBalance === 'DEBIT') {
        const net = debitTotal - creditTotal;
        if (net >= 0) {
          netDebit = net;
        } else {
          netCredit = Math.abs(net);
        }
      } else {
        const net = creditTotal - debitTotal;
        if (net >= 0) {
          netCredit = net;
        } else {
          netDebit = Math.abs(net);
        }
      }

      totalDebitSum = AccountingPostingService.round2(totalDebitSum + netDebit);
      totalCreditSum = AccountingPostingService.round2(totalCreditSum + netCredit);

      return {
        id: acc.id.toString(),
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        normalBalance: acc.normalBalance,
        debitTotal,
        creditTotal,
        netDebit,
        netCredit,
      };
    });

    const isBalanced = Math.abs(totalDebitSum - totalCreditSum) < 0.01;

    return {
      asOfDate: asOfDate.toISOString().split('T')[0],
      isBalanced,
      totalDebitSum,
      totalCreditSum,
      accounts: rows,
    };
  }

  async getProfitAndLoss(query: ReportQueryDto) {
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    const accounts = await this.prisma.account.findMany({
      where: {
        accountType: { in: ['REVENUE', 'EXPENSE'] },
        isActive: true,
      },
      orderBy: { accountCode: 'asc' },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: 'POSTED',
              accountingDate: { gte: startDate, lte: endDate },
              ...(query.branchId ? { branchId: BigInt(query.branchId) } : {}),
            },
          },
          select: { debit: true, credit: true },
        },
      },
    });

    let totalRevenue = 0;
    let totalExpense = 0;

    const revenues: any[] = [];
    const expenses: any[] = [];

    for (const acc of accounts) {
      let debit = 0;
      let credit = 0;
      for (const line of acc.journalLines) {
        debit += Number(line.debit);
        credit += Number(line.credit);
      }

      if (acc.accountType === 'REVENUE') {
        const amount = AccountingPostingService.round2(credit - debit);
        totalRevenue = AccountingPostingService.round2(totalRevenue + amount);
        revenues.push({
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          amount,
        });
      } else {
        const amount = AccountingPostingService.round2(debit - credit);
        totalExpense = AccountingPostingService.round2(totalExpense + amount);
        expenses.push({
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          amount,
        });
      }
    }

    const netOperatingIncome = AccountingPostingService.round2(
      totalRevenue - totalExpense,
    );

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      revenues,
      expenses,
      totalRevenue,
      totalExpense,
      netOperatingIncome,
    };
  }

  async getBalanceSheet(query: ReportQueryDto) {
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();

    const accounts = await this.prisma.account.findMany({
      where: { isActive: true },
      orderBy: { accountCode: 'asc' },
      include: {
        journalLines: {
          where: {
            journalEntry: {
              status: 'POSTED',
              accountingDate: { lte: asOfDate },
              ...(query.branchId ? { branchId: BigInt(query.branchId) } : {}),
            },
          },
          select: { debit: true, credit: true },
        },
      },
    });

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenueCumulative = 0;
    let totalExpenseCumulative = 0;

    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];

    for (const acc of accounts) {
      let debit = 0;
      let credit = 0;
      for (const line of acc.journalLines) {
        debit += Number(line.debit);
        credit += Number(line.credit);
      }

      if (acc.accountType === 'ASSET') {
        const amount = AccountingPostingService.round2(debit - credit);
        totalAssets = AccountingPostingService.round2(totalAssets + amount);
        assets.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount });
      } else if (acc.accountType === 'LIABILITY') {
        const amount = AccountingPostingService.round2(credit - debit);
        totalLiabilities = AccountingPostingService.round2(totalLiabilities + amount);
        liabilities.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount });
      } else if (acc.accountType === 'EQUITY') {
        const amount = AccountingPostingService.round2(credit - debit);
        totalEquity = AccountingPostingService.round2(totalEquity + amount);
        equity.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount });
      } else if (acc.accountType === 'REVENUE') {
        totalRevenueCumulative = AccountingPostingService.round2(
          totalRevenueCumulative + (credit - debit),
        );
      } else if (acc.accountType === 'EXPENSE') {
        totalExpenseCumulative = AccountingPostingService.round2(
          totalExpenseCumulative + (debit - credit),
        );
      }
    }

    const currentPeriodNetSurplus = AccountingPostingService.round2(
      totalRevenueCumulative - totalExpenseCumulative,
    );

    const totalLiabilitiesAndEquity = AccountingPostingService.round2(
      totalLiabilities + totalEquity + currentPeriodNetSurplus,
    );

    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

    return {
      asOfDate: asOfDate.toISOString().split('T')[0],
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      currentPeriodNetSurplus,
      totalLiabilitiesAndEquity,
      isBalanced,
    };
  }

  async getGeneralLedger(
    accountId: bigint,
    startDate?: string,
    endDate?: string,
    branchId?: number,
  ) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found.`);
    }

    const start = startDate ? new Date(startDate) : new Date('2020-01-01');
    const end = endDate ? new Date(endDate) : new Date();

    // 1. Calculate opening balance before startDate
    const priorLines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId,
        journalEntry: {
          status: 'POSTED',
          accountingDate: { lt: start },
          ...(branchId ? { branchId: BigInt(branchId) } : {}),
        },
      },
      select: { debit: true, credit: true },
    });

    let openingBalance = 0;
    for (const l of priorLines) {
      if (account.normalBalance === 'DEBIT') {
        openingBalance += Number(l.debit) - Number(l.credit);
      } else {
        openingBalance += Number(l.credit) - Number(l.debit);
      }
    }
    openingBalance = AccountingPostingService.round2(openingBalance);

    // 2. Lines within the date range
    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId,
        journalEntry: {
          status: 'POSTED',
          accountingDate: { gte: start, lte: end },
          ...(branchId ? { branchId: BigInt(branchId) } : {}),
        },
      },
      include: {
        journalEntry: {
          select: {
            journalNumber: true,
            accountingDate: true,
            description: true,
            referenceType: true,
            referenceId: true,
          },
        },
      },
      orderBy: [
        { journalEntry: { accountingDate: 'asc' } },
        { createdAt: 'asc' },
      ],
    });

    let runningBalance = openingBalance;
    const ledgerEntries = lines.map((line) => {
      const d = Number(line.debit);
      const c = Number(line.credit);
      if (account.normalBalance === 'DEBIT') {
        runningBalance = AccountingPostingService.round2(runningBalance + d - c);
      } else {
        runningBalance = AccountingPostingService.round2(runningBalance + c - d);
      }

      return {
        id: line.id.toString(),
        journalNumber: line.journalEntry.journalNumber,
        accountingDate: line.journalEntry.accountingDate.toISOString().split('T')[0],
        narration: line.description || line.journalEntry.description,
        referenceType: line.journalEntry.referenceType,
        referenceId: line.journalEntry.referenceId,
        debit: d,
        credit: c,
        runningBalance,
      };
    });

    return {
      account: {
        id: account.id.toString(),
        code: account.accountCode,
        name: account.accountName,
        type: account.accountType,
        normalBalance: account.normalBalance,
      },
      openingBalance,
      closingBalance: runningBalance,
      entries: ledgerEntries,
    };
  }

  async getExpenseSummary(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date('2020-01-01');
    const end = endDate ? new Date(endDate) : new Date();

    const expenses = await this.prisma.expense.findMany({
      where: {
        status: 'PAID',
        expenseDate: { gte: start, lte: end },
      },
      include: { category: true },
    });

    const categoryMap = new Map<string, { name: string; amount: number; count: number }>();
    let totalExpense = 0;

    for (const exp of expenses) {
      const amt = Number(exp.amount);
      totalExpense = AccountingPostingService.round2(totalExpense + amt);
      const catCode = exp.category.code;
      if (!categoryMap.has(catCode)) {
        categoryMap.set(catCode, {
          name: exp.category.name,
          amount: 0,
          count: 0,
        });
      }
      const existing = categoryMap.get(catCode)!;
      existing.amount = AccountingPostingService.round2(existing.amount + amt);
      existing.count += 1;
    }

    const categories = Array.from(categoryMap.entries()).map(([code, data]) => ({
      code,
      name: data.name,
      amount: data.amount,
      count: data.count,
      percentage:
        totalExpense > 0
          ? AccountingPostingService.round2((data.amount / totalExpense) * 100)
          : 0,
    }));

    return {
      totalExpense,
      categories,
    };
  }

  async getCashAndBankSummary() {
    const cashAccounts = await this.prisma.account.findMany({
      where: {
        accountCode: { in: ['1010', '1020', '1030'] },
        isActive: true,
      },
      include: {
        journalLines: {
          where: {
            journalEntry: { status: 'POSTED' },
          },
          select: { debit: true, credit: true },
        },
      },
    });

    let totalLiquidity = 0;
    const accounts = cashAccounts.map((acc) => {
      let debit = 0;
      let credit = 0;
      for (const line of acc.journalLines) {
        debit += Number(line.debit);
        credit += Number(line.credit);
      }
      const balance = AccountingPostingService.round2(debit - credit);
      totalLiquidity = AccountingPostingService.round2(totalLiquidity + balance);

      return {
        id: acc.id.toString(),
        code: acc.accountCode,
        name: acc.accountName,
        balance,
      };
    });

    return {
      totalLiquidity,
      accounts,
    };
  }

  // ==========================================
  // 7. LEGACY SINGLE-ENTRY COMPATIBILITY
  // ==========================================

  async createLegacyAccounting(
    dto: CreateLegacyAccountingDto,
    userId: bigint,
  ) {
    const created = await this.prisma.accountingLegacy.create({
      data: {
        name: dto.name,
        sector: dto.sector,
        category: dto.category,
        amount: new Prisma.Decimal(dto.amount),
        date: dto.date || new Date().toISOString().split('T')[0],
        description: dto.description,
        receiptNo: dto.receiptNo,
        userId,
      },
    });

    return serializeBigInt(created);
  }

  async listLegacyAccounting(
    category?: string,
    sector?: string,
    _startDate?: string,
    _endDate?: string,
  ) {
    const items = await this.prisma.accountingLegacy.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(sector ? { sector } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return serializeBigInt(items);
  }

  async listLegacySectors() {
    const sectors = await this.prisma.accountSectorLegacy.findMany({
      orderBy: { name: 'asc' },
    });
    return serializeBigInt(sectors);
  }

  async createLegacySector(dto: CreateLegacySectorDto) {
    const created = await this.prisma.accountSectorLegacy.create({
      data: {
        name: dto.name,
        type: dto.type,
        status: 'active',
      },
    });
    return serializeBigInt(created);
  }
}

