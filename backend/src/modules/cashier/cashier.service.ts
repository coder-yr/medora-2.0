import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BranchAuthorizationService } from '../../common/services/branch-authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApproveShiftDto,
  CashAdjustmentDto,
  CashDrawerDto,
  CashPayoutDto,
  CashierQueryDto,
  DayBookQueryDto,
  OpenShiftDto,
  PatientSettlementDto,
  RejectShiftDto,
  SubmitCloseDto,
} from './dto/cashier.dto';

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
export class CashierService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly branchAuth?: BranchAuthorizationService,
  ) {}

  private static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  private static bucket(method?: string | null): string {
    const m = (method || '').toLowerCase().trim();
    if (m === '' || m === 'cash') return 'cash';
    if (m.includes('bank') || m.includes('transfer')) return 'bank_transfer';
    if (m.includes('card') || m.includes('pos')) return 'card';
    if (m.includes('cheque') || m.includes('check')) return 'cheque';
    if (m.includes('write-off') || m.includes('write_off')) return 'write_off';
    return 'other';
  }

  private static isCash(method?: string | null): boolean {
    return CashierService.bucket(method) === 'cash';
  }

  /**
   * Generates sequential atomic shift number: SHF-YYYYMMDD-XXXX
   */
  private async generateShiftNumber(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SHF-${dateStr}-`;

    const count = await tx.cashierShift.count({
      where: { shiftNumber: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Generates sequential atomic cash transaction number: CTX-YYYYMMDD-XXXX
   */
  private async generateTransactionNumber(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `CTX-${dateStr}-`;

    const count = await tx.cashTransaction.count({
      where: { transactionNumber: { startsWith: prefix } },
    });
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${String(count + 1).padStart(4, '0')}-${rand}`;
  }

  // ===========================================================================
  // 1. SHIFT LIFECYCLE MANAGEMENT
  // ===========================================================================

  /**
   * Opens a new cashier shift with optional opening float.
   * Guarantees at most one active shift per cashier.
   */
  async openShift(cashierId: bigint | number | string, dto: OpenShiftDto, user?: any) {
    const cId = BigInt(cashierId);

    // Verify cashier exists
    const dbUser = await this.prisma.user.findUnique({ where: { id: cId } });
    if (!dbUser) {
      throw new NotFoundException(`User #${cashierId} not found.`);
    }

    let resolvedBranchId: bigint | null = null;
    if (dto.branchId) {
      if (this.branchAuth && user) {
        await this.branchAuth.assertResourceAccess(user, dto.branchId, 'cashier shift');
      }
      resolvedBranchId = BigInt(dto.branchId);
    } else if (user?.branchId) {
      resolvedBranchId = BigInt(user.branchId);
    } else if (dbUser.branchId) {
      resolvedBranchId = dbUser.branchId;
    }

    // Check for existing active shift
    const existing = await this.prisma.cashierShift.findFirst({
      where: {
        cashierId: cId,
        status: { in: ['OPEN', 'CLOSING', 'PENDING_APPROVAL'] },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Cashier #${cashierId} already has an active shift (${existing.shiftNumber}) in ${existing.status} status. Please complete or close it first.`,
      );
    }

    const openingCash = dto.openingCash ? CashierService.round2(dto.openingCash) : 0;

    return await this.prisma.$transaction(async (tx: any) => {
      const shiftNumber = await this.generateShiftNumber(tx);

      const shift = await tx.cashierShift.create({
        data: {
          shiftNumber,
          cashierId: cId,
          branchId: resolvedBranchId,
          cashDrawerId: dto.cashDrawerId ? BigInt(dto.cashDrawerId) : null,
          openingCash: new Prisma.Decimal(openingCash),
          expectedCash: new Prisma.Decimal(openingCash),
          status: 'OPEN',
          closingNotes: dto.notes,
        },
        include: {
          cashier: { select: { id: true, firstName: true, lastName: true, login: true } },
          branch: true,
          cashDrawer: true,
        },
      });

      // If opening float > 0, record opening float transaction
      if (openingCash > 0) {
        const txNumber = await this.generateTransactionNumber(tx);
        await tx.cashTransaction.create({
          data: {
            shiftId: shift.id,
            transactionNumber: txNumber,
            transactionType: 'OPENING_FLOAT',
            sourceModule: 'DIRECT',
            sourceReference: `FLOAT-${shift.id}`,
            idempotencyKey: `FLOAT-${shift.id}`,
            paymentMethod: 'Cash',
            amount: new Prisma.Decimal(openingCash),
            isCash: true,
            direction: 'INFLOW',
            recordedBy: cId,
            notes: dto.notes || 'Opening cash float',
          },
        });
      }

      return serializeBigInt(shift);
    });
  }

  /**
   * Retrieves active shift for cashier with real-time tally.
   */
  async getActiveShift(cashierId: bigint | number | string) {
    const cId = BigInt(cashierId);

    const shift = await this.prisma.cashierShift.findFirst({
      where: {
        cashierId: cId,
        status: { in: ['OPEN', 'CLOSING', 'PENDING_APPROVAL'] },
      },
      include: {
        cashier: { select: { id: true, firstName: true, lastName: true, login: true } },
        branch: true,
        cashDrawer: true,
        transactions: { orderBy: { occurredAt: 'desc' } },
        denominations: true,
      },
    });

    if (!shift) {
      return null;
    }

    const liveTotals = await this.calculateShiftTotals(shift.id);

    return serializeBigInt({
      ...shift,
      liveTotals,
    });
  }

  /**
   * Computes expected cash and non-cash totals from transactions.
   */
  async calculateShiftTotals(shiftId: bigint | number | string) {
    const transactions = await this.prisma.cashTransaction.findMany({
      where: { shiftId: BigInt(shiftId) },
    });

    let openingFloat = 0;
    let cashInflow = 0;
    let cashOutflow = 0;
    let cardTotal = 0;
    let bankTransferTotal = 0;
    let chequeTotal = 0;
    let otherTotal = 0;
    let writeOffTotal = 0;

    for (const t of transactions) {
      const amt = Number(t.amount);
      if (t.transactionType === 'OPENING_FLOAT') {
        openingFloat += amt;
        continue;
      }

      if (t.isCash) {
        if (t.direction === 'INFLOW') {
          cashInflow += amt;
        } else {
          cashOutflow += amt;
        }
      } else {
        const bucket = CashierService.bucket(t.paymentMethod);
        if (bucket === 'card') cardTotal += amt;
        else if (bucket === 'bank_transfer') bankTransferTotal += amt;
        else if (bucket === 'cheque') chequeTotal += amt;
        else if (bucket === 'write_off') writeOffTotal += amt;
        else otherTotal += amt;
      }
    }

    const expectedCash = CashierService.round2(openingFloat + cashInflow - cashOutflow);
    const nonCashTotal = CashierService.round2(cardTotal + bankTransferTotal + chequeTotal + otherTotal);
    const totalCollected = CashierService.round2(openingFloat + cashInflow + nonCashTotal - cashOutflow);

    return {
      openingFloat: CashierService.round2(openingFloat),
      cashInflow: CashierService.round2(cashInflow),
      cashOutflow: CashierService.round2(cashOutflow),
      expectedCash,
      cardTotal: CashierService.round2(cardTotal),
      bankTransferTotal: CashierService.round2(bankTransferTotal),
      chequeTotal: CashierService.round2(chequeTotal),
      otherTotal: CashierService.round2(otherTotal),
      writeOffTotal: CashierService.round2(writeOffTotal),
      totalCollected,
      transactionCount: transactions.length,
    };
  }

  /**
   * Retrieves detailed shift information with ownership check.
   */
  async getShiftDetails(
    shiftId: bigint | number | string,
    requesterId: bigint | number | string,
    hasCrossUserPerm: boolean,
    user?: any,
  ) {
    const shift = await this.prisma.cashierShift.findUnique({
      where: { id: BigInt(shiftId) },
      include: {
        cashier: { select: { id: true, firstName: true, lastName: true, login: true } },
        approver: { select: { id: true, firstName: true, lastName: true, login: true } },
        branch: true,
        cashDrawer: true,
        transactions: { orderBy: { occurredAt: 'desc' } },
        denominations: { orderBy: { denomination: 'desc' } },
      },
    });

    if (!shift) {
      throw new NotFoundException(`Shift #${shiftId} not found.`);
    }

    if (shift.cashierId !== BigInt(requesterId) && !hasCrossUserPerm) {
      throw new ForbiddenException('You can only view your own cashier shifts.');
    }

    if (this.branchAuth && user && shift.branchId) {
      await this.branchAuth.assertResourceAccess(user, shift.branchId, 'cashier shift');
    }

    const liveTotals = await this.calculateShiftTotals(shift.id);

    return serializeBigInt({
      ...shift,
      liveTotals,
    });
  }

  /**
   * Lists shifts with filters and RBAC isolation.
   */
  async listShifts(
    query: CashierQueryDto,
    requesterId: bigint | number | string,
    hasCrossUserPerm: boolean,
    user?: any,
  ) {
    const where: Prisma.CashierShiftWhereInput = {};

    // Cashier ownership filter
    if (!hasCrossUserPerm) {
      where.cashierId = BigInt(requesterId);
    } else if (query.cashierId) {
      where.cashierId = BigInt(query.cashierId);
    }

    if (query.status) {
      where.status = query.status.toUpperCase();
    }

    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      const accessibleBranches = await this.branchAuth.resolveAccessibleBranchIds(user);
      if (query.branchId) {
        await this.branchAuth.assertResourceAccess(user, query.branchId, 'cashier shifts');
        where.branchId = BigInt(query.branchId);
      } else if (accessibleBranches) {
        where.branchId = { in: accessibleBranches };
      }
    } else if (query.branchId) {
      where.branchId = BigInt(query.branchId);
    }

    if (query.from || query.to) {
      where.openedAt = {};
      if (query.from) {
        where.openedAt.gte = new Date(`${query.from}T00:00:00.000Z`);
      }
      if (query.to) {
        where.openedAt.lte = new Date(`${query.to}T23:59:59.999Z`);
      }
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.cashierShift.count({ where }),
      this.prisma.cashierShift.findMany({
        where,
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: {
          cashier: { select: { id: true, firstName: true, lastName: true, login: true } },
          approver: { select: { id: true, firstName: true, lastName: true, login: true } },
          branch: true,
          cashDrawer: true,
          _count: { select: { transactions: true } },
        },
      }),
    ]);

    return serializeBigInt({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  /**
   * Submits shift count and initiates shift close. Transitions to PENDING_APPROVAL.
   */
  async submitClose(
    shiftId: bigint | number | string,
    dto: SubmitCloseDto,
    cashierId: bigint | number | string,
    hasCrossUserPerm: boolean,
    user?: any,
  ) {
    const sId = BigInt(shiftId);

    return await this.prisma.$transaction(async (tx: any) => {
      const locked = await tx.$queryRaw<{ id: bigint; cashier_id: bigint; status: string; branch_id: bigint | null }[]>`
        SELECT id, cashier_id, status, branch_id FROM "cashier_shift" WHERE id = ${sId} FOR UPDATE
      `;

      if (!locked || locked.length === 0) {
        throw new NotFoundException(`Shift #${shiftId} not found.`);
      }

      const shiftRow = locked[0];

      if (this.branchAuth && user && shiftRow.branch_id) {
        await this.branchAuth.assertResourceAccess(user, shiftRow.branch_id, 'cashier shift');
      }

      if (shiftRow.cashier_id !== BigInt(cashierId) && !hasCrossUserPerm) {
        throw new ForbiddenException('You can only close your own cashier shift.');
      }

      if (!['OPEN', 'CLOSING', 'REJECTED'].includes(shiftRow.status)) {
        throw new BadRequestException(
          `Shift is in ${shiftRow.status} status and cannot be submitted for closing.`,
        );
      }

      // Compute live totals inside transaction
      const totals = await this.calculateShiftTotals(sId);
      const counted = CashierService.round2(dto.countedCash);
      const variance = CashierService.round2(counted - totals.expectedCash);

      // Save denominations if provided
      if (dto.denominations && dto.denominations.length > 0) {
        await tx.shiftCloseDenomination.deleteMany({ where: { shiftId: sId } });
        for (const d of dto.denominations) {
          const count = Number(d.count) || 0;
          const denom = Number(d.denomination);
          const totalAmt = CashierService.round2(count * denom);
          if (count > 0) {
            await tx.shiftCloseDenomination.create({
              data: {
                shiftId: sId,
                denomination: new Prisma.Decimal(denom),
                count,
                totalAmount: new Prisma.Decimal(totalAmt),
              },
            });
          }
        }
      }

      // Associate any unlinked payments taken by this cashier
      await tx.invoicePayment.updateMany({
        where: {
          receivedBy: shiftRow.cashier_id,
          shiftId: null,
        },
        data: { shiftId: sId },
      });

      const updated = await tx.cashierShift.update({
        where: { id: sId },
        data: {
          status: 'PENDING_APPROVAL',
          countedCash: new Prisma.Decimal(counted),
          expectedCash: new Prisma.Decimal(totals.expectedCash),
          cashVariance: new Prisma.Decimal(variance),
          closingNotes: dto.closingNotes,
        },
        include: {
          cashier: { select: { id: true, firstName: true, lastName: true, login: true } },
          branch: true,
          cashDrawer: true,
          denominations: true,
        },
      });

      return serializeBigInt({
        ...updated,
        totals,
      });
    });
  }

  /**
   * Dual-control supervisor approval: transitions shift from PENDING_APPROVAL to CLOSED.
   * Enforces separation of duties: cashier cannot approve their own shift unless supervisor override.
   */
  async approveShift(
    shiftId: bigint | number | string,
    approverId: bigint | number | string,
    hasCrossUserPerm: boolean,
    dto?: ApproveShiftDto,
    user?: any,
  ) {
    const sId = BigInt(shiftId);
    const aId = BigInt(approverId);

    return await this.prisma.$transaction(async (tx: any) => {
      const locked = await tx.$queryRaw<
        {
          id: bigint;
          shift_number: string;
          cashier_id: bigint;
          status: string;
          counted_cash: Prisma.Decimal | null;
          expected_cash: Prisma.Decimal;
          cash_variance: Prisma.Decimal | null;
          branch_id: bigint | null;
          opened_at: Date;
        }[]
      >`
        SELECT id, shift_number, cashier_id, status, counted_cash, expected_cash, cash_variance, branch_id, opened_at
        FROM "cashier_shift"
        WHERE id = ${sId}
        FOR UPDATE
      `;

      if (!locked || locked.length === 0) {
        throw new NotFoundException(`Shift #${shiftId} not found.`);
      }

      const shiftRow = locked[0];

      if (this.branchAuth && user && shiftRow.branch_id) {
        await this.branchAuth.assertResourceAccess(user, shiftRow.branch_id, 'cashier shift');
      }

      if (shiftRow.status !== 'PENDING_APPROVAL') {
        throw new BadRequestException(
          `Shift is in ${shiftRow.status} status; only PENDING_APPROVAL shifts can be approved.`,
        );
      }

      // Separation of duties check
      if (shiftRow.cashier_id === aId && !hasCrossUserPerm) {
        throw new ForbiddenException(
          'Separation of duties required: A cashier cannot approve their own shift close.',
        );
      }

      const closedAt = new Date();
      const updated = await tx.cashierShift.update({
        where: { id: sId },
        data: {
          status: 'CLOSED',
          approvedBy: aId,
          approvedAt: closedAt,
          closedAt,
          closingNotes: dto?.notes ? dto.notes : undefined,
        },
        include: {
          cashier: { select: { id: true, firstName: true, lastName: true, login: true } },
          approver: { select: { id: true, firstName: true, lastName: true, login: true } },
          branch: true,
          cashDrawer: true,
          transactions: true,
        },
      });

      // Synchronize to legacy shift_close table for 100% backwards compatibility
      const totals = await this.calculateShiftTotals(sId);
      await tx.shiftClose.create({
        data: {
          userId: shiftRow.cashier_id,
          closedAt,
          expectedCash: new Prisma.Decimal(totals.expectedCash),
          countedCash: shiftRow.counted_cash ?? new Prisma.Decimal(totals.expectedCash),
          discrepancy: shiftRow.cash_variance ?? new Prisma.Decimal(0),
          bankTransferTotal: new Prisma.Decimal(totals.bankTransferTotal),
          cardTotal: new Prisma.Decimal(totals.cardTotal),
          chequeTotal: new Prisma.Decimal(totals.chequeTotal),
          otherTotal: new Prisma.Decimal(totals.otherTotal),
          writeOffTotal: new Prisma.Decimal(totals.writeOffTotal),
          notes: dto?.notes || updated.closingNotes || null,
          status: 'verified',
        },
      });

      return serializeBigInt({
        ...updated,
        totals,
      });
    });
  }

  /**
   * Rejects a pending shift close with mandatory reason, returning it to REJECTED.
   */
  async rejectShift(
    shiftId: bigint | number | string,
    approverId: bigint | number | string,
    dto: RejectShiftDto,
  ) {
    const sId = BigInt(shiftId);

    return await this.prisma.$transaction(async (tx: any) => {
      const locked = await tx.$queryRaw<{ id: bigint; status: string }[]>`
        SELECT id, status FROM "cashier_shift" WHERE id = ${sId} FOR UPDATE
      `;

      if (!locked || locked.length === 0) {
        throw new NotFoundException(`Shift #${shiftId} not found.`);
      }

      if (locked[0].status !== 'PENDING_APPROVAL') {
        throw new BadRequestException(
          `Shift is in ${locked[0].status} status; only PENDING_APPROVAL shifts can be rejected.`,
        );
      }

      const updated = await tx.cashierShift.update({
        where: { id: sId },
        data: {
          status: 'REJECTED',
          rejectionReason: dto.rejectionReason.trim(),
        },
        include: {
          cashier: { select: { id: true, firstName: true, lastName: true, login: true } },
          branch: true,
          cashDrawer: true,
        },
      });

      return serializeBigInt(updated);
    });
  }

  // ===========================================================================
  // 2. CASH PAYOUTS, ADJUSTMENTS & TRANSACTIONS
  // ===========================================================================

  /**
   * Records an authorized petty cash payout from drawer (OUTFLOW).
   */
  async recordPayout(
    shiftId: bigint | number | string,
    dto: CashPayoutDto,
    userId: bigint | number | string,
  ) {
    const sId = BigInt(shiftId);
    const uId = BigInt(userId);

    return await this.prisma.$transaction(async (tx: any) => {
      const shift = await tx.cashierShift.findUnique({ where: { id: sId } });
      if (!shift) {
        throw new NotFoundException(`Shift #${shiftId} not found.`);
      }

      if (shift.status !== 'OPEN') {
        throw new BadRequestException(`Cannot record payout; shift is in ${shift.status} status.`);
      }

      const txNumber = await this.generateTransactionNumber(tx);
      const transaction = await tx.cashTransaction.create({
        data: {
          shiftId: sId,
          transactionNumber: txNumber,
          transactionType: 'CASH_PAYOUT',
          sourceModule: 'DIRECT',
          sourceReference: dto.reference ?? null,
          idempotencyKey: `PAYOUT-${sId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          paymentMethod: 'Cash',
          amount: new Prisma.Decimal(CashierService.round2(dto.amount)),
          isCash: true,
          direction: 'OUTFLOW',
          recordedBy: uId,
          notes: `${dto.reason}${dto.recipient ? ' (Recipient: ' + dto.recipient + ')' : ''}`,
        },
      });

      return serializeBigInt(transaction);
    });
  }

  /**
   * Records an approved cash float adjustment (INFLOW or OUTFLOW).
   */
  async recordAdjustment(
    shiftId: bigint | number | string,
    dto: CashAdjustmentDto,
    userId: bigint | number | string,
  ) {
    const sId = BigInt(shiftId);
    const uId = BigInt(userId);

    return await this.prisma.$transaction(async (tx: any) => {
      const shift = await tx.cashierShift.findUnique({ where: { id: sId } });
      if (!shift) {
        throw new NotFoundException(`Shift #${shiftId} not found.`);
      }

      if (shift.status !== 'OPEN') {
        throw new BadRequestException(`Cannot record adjustment; shift is in ${shift.status} status.`);
      }

      const amount = Math.abs(dto.amount);
      const direction = dto.direction || (dto.amount >= 0 ? 'INFLOW' : 'OUTFLOW');
      const txNumber = await this.generateTransactionNumber(tx);

      const transaction = await tx.cashTransaction.create({
        data: {
          shiftId: sId,
          transactionNumber: txNumber,
          transactionType: 'CASH_ADJUSTMENT',
          sourceModule: 'DIRECT',
          idempotencyKey: `ADJ-${sId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          paymentMethod: 'Cash',
          amount: new Prisma.Decimal(CashierService.round2(amount)),
          isCash: true,
          direction,
          recordedBy: uId,
          notes: dto.reason,
        },
      });

      return serializeBigInt(transaction);
    });
  }

  /**
   * Internal hook called when an invoice or module payment is collected.
   * If the cashier has an active OPEN shift, records a CashTransaction idempotently.
   */
  async recordPaymentTransaction(params: {
    cashierId?: bigint | number | string | null;
    paymentId?: bigint | number | string | null;
    invoicePaymentId?: bigint | number | string | null;
    amount: number;
    paymentMethod: string;
    reference?: string | null;
    sourceModule?: string;
    idempotencyKey?: string;
    notes?: string | null;
  }) {
    if (!params.cashierId) return null;

    const cId = BigInt(params.cashierId);
    const activeShift = await this.prisma.cashierShift.findFirst({
      where: {
        cashierId: cId,
        status: 'OPEN',
      },
    });

    if (!activeShift) {
      return null;
    }

    const isCash = CashierService.isCash(params.paymentMethod);
    const amount = CashierService.round2(params.amount);
    const idKey = params.idempotencyKey || `INV-PAY-${params.invoicePaymentId || Date.now()}`;

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        // Check for idempotency
        const existing = await tx.cashTransaction.findUnique({
          where: { idempotencyKey: idKey },
        });

        if (existing) {
          return existing;
        }

        const txNumber = await this.generateTransactionNumber(tx);
        const transaction = await tx.cashTransaction.create({
          data: {
            shiftId: activeShift.id,
            transactionNumber: txNumber,
            transactionType: 'PAYMENT_RECEIVED',
            paymentId: params.paymentId ? BigInt(params.paymentId) : null,
            invoicePaymentId: params.invoicePaymentId ? BigInt(params.invoicePaymentId) : null,
            sourceModule: params.sourceModule || 'INVOICE',
            sourceReference: params.reference ?? null,
            idempotencyKey: idKey,
            paymentMethod: params.paymentMethod || 'Cash',
            amount: new Prisma.Decimal(amount),
            isCash,
            direction: 'INFLOW',
            recordedBy: cId,
            notes: params.notes,
          },
        });

        if (params.invoicePaymentId) {
          await tx.invoicePayment.update({
            where: { id: BigInt(params.invoicePaymentId) },
            data: { shiftId: activeShift.id },
          });
        }

        return transaction;
      });
    } catch (err: any) {
      // If unique constraint collision on idempotency key, ignore safely
      if (err.code === 'P2002') {
        return null;
      }
      throw err;
    }
  }

  // ===========================================================================
  // 3. PATIENT MULTI-INVOICE SETTLEMENT
  // ===========================================================================

  /**
   * Settle patient balance across multiple open invoices, oldest first.
   * Matches legacy CashController@settle behavior with row-level locks.
   */
  async settlePatientInvoices(
    patientId: bigint | number | string,
    dto: PatientSettlementDto,
    cashierId?: bigint | number | string,
  ) {
    const pId = BigInt(patientId);
    const amount = CashierService.round2(dto.amount || 0);
    const writeOff = CashierService.round2(dto.writeOff || 0);

    if (amount <= 0 && writeOff <= 0) {
      throw new BadRequestException('Enter the amount received or a write-off.');
    }

    if (writeOff > 0 && (!dto.writeOffReason || dto.writeOffReason.trim() === '')) {
      throw new BadRequestException('Say why the balance is being written off.');
    }

    return await this.prisma.$transaction(async (tx: any) => {
      // Lock open patient invoices ordered by date ASC, id ASC
      const lockedInvoices = await tx.$queryRaw<
        {
          id: bigint;
          gross_total: Prisma.Decimal;
          amount_received: Prisma.Decimal;
        }[]
      >`
        SELECT id, gross_total, amount_received
        FROM "payment"
        WHERE patient = ${pId} AND status != 'paid'
        ORDER BY date ASC, id ASC
        FOR UPDATE
      `;

      if (!lockedInvoices || lockedInvoices.length === 0) {
        throw new BadRequestException('Patient has no open or outstanding invoices to settle.');
      }

      let totalOutstanding = 0;
      for (const inv of lockedInvoices) {
        const bal = Math.max(0, Number(inv.gross_total) - Number(inv.amount_received));
        totalOutstanding += bal;
      }
      totalOutstanding = CashierService.round2(totalOutstanding);

      if (amount + writeOff > totalOutstanding + 0.004) {
        throw new BadRequestException(
          `Only ${totalOutstanding.toFixed(2)} is outstanding for this patient.`,
        );
      }

      const activeShift = cashierId
        ? await tx.cashierShift.findFirst({
            where: { cashierId: BigInt(cashierId), status: 'OPEN' },
          })
        : null;

      let remainingAmount = amount;
      let remainingWriteOff = writeOff;
      const createdPayments: bigint[] = [];

      // 1. Apply payment amount to oldest open invoices
      if (remainingAmount > 0.004) {
        for (const inv of lockedInvoices) {
          if (remainingAmount <= 0.004) break;

          const fresh = await tx.payment.findUnique({
            where: { id: inv.id },
            include: { payments: true },
          });
          if (!fresh) continue;

          const currentPaid = fresh.payments.reduce(
            (acc: number, p: any) => acc + Number(p.amount),
            0,
          );
          const balance = CashierService.round2(Number(fresh.grossTotal) - currentPaid);
          if (balance <= 0.004) continue;

          const take = CashierService.round2(Math.min(balance, remainingAmount));
          const paidAt = new Date().toISOString();

          const invPayment = await tx.invoicePayment.create({
            data: {
              paymentId: inv.id,
              amount: new Prisma.Decimal(take),
              method: dto.method,
              reference: dto.reference ?? null,
              paidAt,
              receivedBy: cashierId ? BigInt(cashierId) : null,
              shiftId: activeShift ? activeShift.id : null,
            },
          });

          createdPayments.push(invPayment.id);

          // If cashier has an active shift, record CashTransaction
          if (activeShift) {
            const txNumber = await this.generateTransactionNumber(tx);
            await tx.cashTransaction.create({
              data: {
                shiftId: activeShift.id,
                transactionNumber: txNumber,
                transactionType: 'PAYMENT_RECEIVED',
                paymentId: inv.id,
                invoicePaymentId: invPayment.id,
                sourceModule: 'INVOICE',
                sourceReference: dto.reference ?? `SETTLE-${pId}`,
                idempotencyKey: `SETTLE-PAY-${invPayment.id}`,
                paymentMethod: dto.method,
                amount: new Prisma.Decimal(take),
                isCash: CashierService.isCash(dto.method),
                direction: 'INFLOW',
                recordedBy: cashierId ? BigInt(cashierId) : activeShift.cashierId,
                notes: `Settlement payment for invoice #${inv.id}`,
              },
            });
          }

          remainingAmount = CashierService.round2(remainingAmount - take);
          const newPaid = CashierService.round2(currentPaid + take);
          const newBal = CashierService.round2(Number(fresh.grossTotal) - newPaid);
          const newStatus = newBal <= 0.004 ? 'paid' : 'part paid';

          await tx.payment.update({
            where: { id: inv.id },
            data: {
              amountReceived: new Prisma.Decimal(newPaid),
              status: newStatus,
            },
          });
        }
      }

      // 2. Apply write-off to remaining balances
      if (remainingWriteOff > 0.004) {
        for (const inv of lockedInvoices) {
          if (remainingWriteOff <= 0.004) break;

          const fresh = await tx.payment.findUnique({
            where: { id: inv.id },
            include: { payments: true },
          });
          if (!fresh) continue;

          const currentPaid = fresh.payments.reduce(
            (acc: number, p: any) => acc + Number(p.amount),
            0,
          );
          const balance = CashierService.round2(Number(fresh.grossTotal) - currentPaid);
          if (balance <= 0.004) continue;

          const take = CashierService.round2(Math.min(balance, remainingWriteOff));
          const paidAt = new Date().toISOString();

          const invPayment = await tx.invoicePayment.create({
            data: {
              paymentId: inv.id,
              amount: new Prisma.Decimal(take),
              method: 'Write-off',
              reference: dto.writeOffReason ?? 'Approved write-off',
              paidAt,
              receivedBy: cashierId ? BigInt(cashierId) : null,
              shiftId: activeShift ? activeShift.id : null,
            },
          });

          createdPayments.push(invPayment.id);

          // Write-offs do NOT affect physical cash, but are tracked in the ledger
          if (activeShift) {
            const txNumber = await this.generateTransactionNumber(tx);
            await tx.cashTransaction.create({
              data: {
                shiftId: activeShift.id,
                transactionNumber: txNumber,
                transactionType: 'PAYMENT_RECEIVED',
                paymentId: inv.id,
                invoicePaymentId: invPayment.id,
                sourceModule: 'INVOICE',
                sourceReference: dto.writeOffReason,
                idempotencyKey: `SETTLE-WO-${invPayment.id}`,
                paymentMethod: 'Write-off',
                amount: new Prisma.Decimal(take),
                isCash: false,
                direction: 'INFLOW',
                recordedBy: cashierId ? BigInt(cashierId) : activeShift.cashierId,
                notes: `Balance write-off: ${dto.writeOffReason}`,
              },
            });
          }

          remainingWriteOff = CashierService.round2(remainingWriteOff - take);
          const newPaid = CashierService.round2(currentPaid + take);
          const newBal = CashierService.round2(Number(fresh.grossTotal) - newPaid);
          const newStatus = newBal <= 0.004 ? 'paid' : 'part paid';

          await tx.payment.update({
            where: { id: inv.id },
            data: {
              amountReceived: new Prisma.Decimal(newPaid),
              status: newStatus,
            },
          });
        }
      }

      return serializeBigInt({
        success: true,
        patientId: pId.toString(),
        amountSettled: amount,
        amountWrittenOff: writeOff,
        paymentRecordsCreated: createdPayments.length,
      });
    });
  }

  // ===========================================================================
  // 4. DAY BOOK REPORTING & ANALYTICS
  // ===========================================================================

  /**
   * Generates the financial Day Book report matching legacy CashController@dayBook.
   */
  async getDayBook(query: DayBookQueryDto, user?: any) {
    const today = new Date().toISOString().slice(0, 10);
    const from = query.from || today;
    const to = query.to || from;
    const kindFilter = (query.kind || '').toLowerCase().trim();

    const invoiceWhere: Prisma.PaymentWhereInput = {
      date: { gte: from, lte: to },
    };

    if (query.userId) {
      invoiceWhere.user = String(query.userId);
    }

    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      const accessibleBranches = await this.branchAuth.resolveAccessibleBranchIds(user);
      if (query.branchId) {
        await this.branchAuth.assertResourceAccess(user, query.branchId, 'day book');
        invoiceWhere.branchId = BigInt(query.branchId);
      } else if (accessibleBranches) {
        invoiceWhere.branchId = { in: accessibleBranches };
      }
    } else if (query.branchId) {
      invoiceWhere.branchId = BigInt(query.branchId);
    }

    const [invoices, patientTypes, paymentCategories, doctorShares, invoicePayments] =
      await Promise.all([
        this.prisma.payment.findMany({
          where: invoiceWhere,
          include: {
            items: true,
            patient: true,
            patientType: true,
          },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
        }),
        this.prisma.patientType.findMany(),
        this.prisma.paymentCategory.findMany(),
        this.prisma.doctorShare.findMany(),
        this.prisma.invoicePayment.findMany({
          where: {
            date: { gte: from, lte: to },
            ...(query.userId ? { receivedBy: BigInt(query.userId) } : {}),
          },
        }),
      ]);

    const typeMap = new Map<string, any>(
      patientTypes.map((pt: any) => [pt.id.toString(), pt]),
    );
    const categoryMap = new Map<string, any>(
      paymentCategories.map((c: any) => [c.id.toString(), c]),
    );
    const shareMap = new Map<string, number>();

    for (const ds of doctorShares) {
      if (ds.invoiceItemId) {
        const key = ds.invoiceItemId.toString();
        shareMap.set(key, (shareMap.get(key) || 0) + Number(ds.amount));
      }
    }

    const lines: Array<{
      date: string;
      invoice: string;
      patient: string;
      patientType: string;
      bucket: string;
      service: string;
      department: string;
      gross: number;
      discount: number;
      net: number;
      doctorShare: number;
      hospitalShare: number;
    }> = [];

    const byDept: Record<string, Record<string, number>> = {};
    const byKind: Record<string, number> = {};

    for (const inv of invoices) {
      const pt: any = inv.patientTypeId ? typeMap.get(inv.patientTypeId.toString()) : null;
      let bucket = 'Private';
      if (pt) {
        const k = (pt.kind || '').toLowerCase();
        if (k.includes('panel')) bucket = 'Panel';
        else if (k.includes('charity')) bucket = 'Charity';
      }

      if (kindFilter && bucket.toLowerCase() !== kindFilter) {
        continue;
      }

      const subtotal = inv.items.reduce(
        (acc: number, it: any) => acc + Number(it.lineTotal),
        0,
      );
      const discount = Math.min(Number(inv.discount || 0), subtotal);

      for (const item of inv.items) {
        const gross = Number(item.lineTotal);
        const lineDiscount =
          subtotal > 0 ? CashierService.round2((discount * gross) / subtotal) : 0;
        const net = CashierService.round2(gross - lineDiscount);
        const docShare = CashierService.round2(shareMap.get(item.id.toString()) || 0);
        const hospShare = CashierService.round2(net - docShare);

        const cat: any = item.paymentCategoryId
          ? categoryMap.get(item.paymentCategoryId.toString())
          : null;
        const dept = cat?.department || 'General OPD';
        const serviceKind = cat?.serviceKind || 'other';

        lines.push({
          date: inv.date,
          invoice: inv.id.toString(),
          patient: inv.patientName || inv.patient?.name || 'Walk-in Patient',
          patientType: pt?.name || 'General',
          bucket,
          service: item.name,
          department: dept,
          gross,
          discount: lineDiscount,
          net,
          doctorShare: docShare,
          hospitalShare: hospShare,
        });

        if (!byDept[dept]) {
          byDept[dept] = { Private: 0, Panel: 0, Charity: 0, Total: 0 };
        }
        byDept[dept][bucket] = CashierService.round2((byDept[dept][bucket] || 0) + net);
        byDept[dept].Total = CashierService.round2(byDept[dept].Total + net);

        byKind[serviceKind] = CashierService.round2((byKind[serviceKind] || 0) + net);
      }
    }

    // Collections by mode
    const collections = {
      cash: 0,
      bank_transfer: 0,
      card: 0,
      cheque: 0,
      other: 0,
      write_off: 0,
      total: 0,
      count: 0,
    };

    for (const p of invoicePayments) {
      const amt = Number(p.amount);
      const b = CashierService.bucket(p.method);
      if (b === 'write_off') {
        collections.write_off = CashierService.round2(collections.write_off + amt);
      } else {
        collections[b as 'cash' | 'bank_transfer' | 'card' | 'cheque' | 'other'] =
          CashierService.round2(
            collections[b as 'cash' | 'bank_transfer' | 'card' | 'cheque' | 'other'] + amt,
          );
        collections.total = CashierService.round2(collections.total + amt);
        collections.count++;
      }
    }

    if (query.export === 'csv') {
      let csv =
        'Date,Invoice,Patient,Patient Type,Group,Service,Department,Gross,Discount,Net,Doctor Share,Hospital Share\n';
      for (const l of lines) {
        csv += `"${l.date}","${l.invoice}","${l.patient.replace(/"/g, '""')}","${l.patientType}","${l.bucket}","${l.service.replace(/"/g, '""')}","${l.department}",${l.gross.toFixed(2)},${l.discount.toFixed(2)},${l.net.toFixed(2)},${l.doctorShare.toFixed(2)},${l.hospitalShare.toFixed(2)}\n`;
      }
      return { csv, filename: `day-book-${from}-to-${to}.csv` };
    }

    return serializeBigInt({
      lines,
      byDepartment: byDept,
      byServiceKind: byKind,
      collections,
      filters: { from, to, kind: kindFilter, userId: query.userId, branchId: query.branchId },
      totalBilledNet: lines.reduce((acc, l) => acc + l.net, 0),
    });
  }

  // ===========================================================================
  // 5. CASH DRAWERS MANAGEMENT
  // ===========================================================================

  async createDrawer(dto: CashDrawerDto) {
    const existing = await this.prisma.cashDrawer.findUnique({
      where: { code: dto.code.trim() },
    });
    if (existing) {
      throw new ConflictException(`Drawer with code "${dto.code}" already exists.`);
    }

    const drawer = await this.prisma.cashDrawer.create({
      data: {
        name: dto.name.trim(),
        code: dto.code.trim(),
        branchId: dto.branchId ? BigInt(dto.branchId) : null,
        assignedCashierId: dto.assignedCashierId ? BigInt(dto.assignedCashierId) : null,
        isActive: dto.isActive !== false,
      },
    });

    return serializeBigInt(drawer);
  }

  async listDrawers(branchId?: number | string) {
    const where: Prisma.CashDrawerWhereInput = {};
    if (branchId) {
      where.branchId = BigInt(branchId);
    }

    const drawers = await this.prisma.cashDrawer.findMany({
      where,
      include: {
        assignedCashier: {
          select: { id: true, firstName: true, lastName: true, login: true },
        },
        branch: true,
      },
      orderBy: { code: 'asc' },
    });

    return serializeBigInt(drawers);
  }
}
