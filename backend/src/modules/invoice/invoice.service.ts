import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BranchAuthorizationService } from '../../common/services/branch-authorization.service';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';
import { PrismaService } from '../prisma/prisma.service';
import { CancelInvoiceDto } from './dto/cancel-invoice.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import {
  InvoiceResponseDto,
  PaginatedInvoicesDto,
} from './dto/invoice-response.dto';
import {
  CreateServiceItemDto,
  UpdateServiceItemDto,
} from './dto/service-catalogue.dto';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patientService: PatientService,
    private readonly doctorService: DoctorService,
    @Optional() private readonly branchAuth?: BranchAuthorizationService,
  ) {}

  /**
   * Decimal-safe rounding to exactly 2 decimal places.
   */
  static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Generates a sequential, thread-safe invoice number: INV-YYYYMMDD-XXXX
   */
  async generateInvoiceNumber(
    tx: Prisma.TransactionClient,
    dateStr?: string,
  ): Promise<string> {
    const today = dateStr ? new Date(dateStr) : new Date();
    const dStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INV-${dStr}`;

    if (typeof (tx as any).$executeRaw === 'function') {
      await (tx as any).$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
    }

    const count =
      typeof tx.payment?.count === 'function'
        ? await tx.payment.count({
            where: {
              invoiceNumber: {
                startsWith: prefix,
              },
            },
          })
        : 0;

    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}-${sequence}`;
  }

  /**
   * Generates a sequential, thread-safe receipt number: RCP-YYYYMMDD-XXXX
   */
  async generateReceiptNumber(
    tx: Prisma.TransactionClient,
    dateStr?: string,
  ): Promise<string> {
    const today = dateStr ? new Date(dateStr) : new Date();
    const dStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RCP-${dStr}`;

    if (typeof (tx as any).$executeRaw === 'function') {
      await (tx as any).$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
    }

    const count =
      typeof tx.invoicePayment?.count === 'function'
        ? await tx.invoicePayment.count({
            where: {
              receiptNumber: {
                startsWith: prefix,
              },
            },
          })
        : 0;

    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}-${sequence}`;
  }

  /**
   * Generates a sequential, thread-safe refund number: RFD-YYYYMMDD-XXXX
   */
  async generateRefundNumber(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const today = new Date();
    const dStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RFD-${dStr}`;

    if (typeof (tx as any).$executeRaw === 'function') {
      await (tx as any).$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
    }

    const count =
      typeof (tx as any).invoiceRefund?.count === 'function'
        ? await (tx as any).invoiceRefund.count({
            where: {
              refundNumber: {
                startsWith: prefix,
              },
            },
          })
        : 0;

    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}-${sequence}`;
  }

  /**
   * Generates a new patient invoice with itemized line entries, discounts,
   * tax calculations, and sequential invoice numbers. Purely transactional against PostgreSQL.
   */
  async create(dto: CreateInvoiceDto, userId?: string, user?: any): Promise<InvoiceResponseDto> {
    const patient = await this.patientService.findById(dto.patient);
    if (!patient) {
      throw new NotFoundException(`Patient #${dto.patient} not found.`);
    }

    let resolvedBranchId: string | number | bigint | null = null;
    const branchCandidate = (dto as any).branchId ?? (dto as any).branch_id;
    if (branchCandidate) {
      if (this.branchAuth && user) {
        await this.branchAuth.assertResourceAccess(user, branchCandidate, 'invoice');
      }
      resolvedBranchId = branchCandidate;
    } else if (user?.branchId) {
      resolvedBranchId = user.branchId;
    } else if (patient.branchId) {
      resolvedBranchId = patient.branchId;
    }

    const organizationId = user?.organizationId
      ? BigInt(user.organizationId)
      : (patient as any).organizationId
      ? BigInt((patient as any).organizationId)
      : null;

    let doctor: { id: string; name: string } | null = null;
    if (dto.doctor) {
      doctor = await this.doctorService.findById(dto.doctor);
      if (!doctor) {
        throw new NotFoundException(`Doctor #${dto.doctor} not found.`);
      }
    }

    let referringDoctor: { id: string } | null = null;
    if (dto.referring_doctor) {
      referringDoctor = await this.doctorService.findById(dto.referring_doctor).catch(() => null);
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Add at least one charge, or the invoice is for nothing.');
    }

    // Build and validate line items
    const processedItems: Array<{
      paymentCategoryId: string | null;
      name: string;
      quantity: number;
      unitPrice: number;
      taxRate: number;
      taxAmount: number;
      discount: number;
      lineTotal: number;
      doctorId: string | null;
    }> = [];

    for (const raw of dto.items) {
      const qty = Math.max(1, Math.floor(raw.quantity || 1));
      const name = (raw.name || '').trim();
      if (!name && !raw.payment_category_id) {
        continue;
      }

      const unitPrice = InvoiceService.round2(raw.unit_price ?? 0);
      if (unitPrice < 0) {
        throw new BadRequestException('Unit price cannot be negative.');
      }

      const itemDiscount = InvoiceService.round2((raw as any).discount ?? 0);
      const taxRate = InvoiceService.round2((raw as any).tax_rate ?? 0);
      const grossBase = InvoiceService.round2(unitPrice * qty);
      const discountedBase = Math.max(0, InvoiceService.round2(grossBase - itemDiscount));
      const taxAmount = InvoiceService.round2((discountedBase * taxRate) / 100);
      const lineTotal = InvoiceService.round2(discountedBase + taxAmount);

      processedItems.push({
        paymentCategoryId: raw.payment_category_id ? String(raw.payment_category_id) : null,
        name: name || `Service #${raw.payment_category_id}`,
        quantity: qty,
        unitPrice,
        taxRate,
        taxAmount,
        discount: itemDiscount,
        lineTotal,
        doctorId: raw.doctor_id ? String(raw.doctor_id) : (doctor ? doctor.id : null),
      });
    }

    if (processedItems.length === 0) {
      throw new BadRequestException('Add at least one charge, or the invoice is for nothing.');
    }

    const subtotal = InvoiceService.round2(
      processedItems.reduce((acc, curr) => acc + curr.lineTotal, 0),
    );
    const overallDiscount = InvoiceService.round2(dto.discount ?? 0);
    const overallVat = InvoiceService.round2(dto.vat ?? 0);

    if (overallDiscount < 0) {
      throw new BadRequestException('Discount cannot be negative.');
    }
    if (overallVat < 0) {
      throw new BadRequestException('VAT cannot be negative.');
    }
    if (overallDiscount > subtotal) {
      throw new BadRequestException('The discount is larger than the invoice.');
    }

    const grossTotal = InvoiceService.round2(subtotal - overallDiscount + overallVat);
    const careSetting = dto.care_setting || 'opd';
    const patientTypeId = dto.patient_type_id ? String(dto.patient_type_id) : null;
    const dueDate = dto.due_date ? new Date(dto.due_date) : null;

    return await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.generateInvoiceNumber(tx, dto.date);

      const categoryName = processedItems
        .map((i) => (i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name))
        .join(', ')
        .substring(0, 1000);
      const categoryAmount = processedItems
        .map((i) => i.lineTotal.toFixed(2))
        .join(', ')
        .substring(0, 1000);
      const category = processedItems
        .map((i) => i.paymentCategoryId)
        .filter(Boolean)
        .join(',');

      const createdPayment = await tx.payment.create({
        data: {
          invoiceNumber,
          organizationId,
          patientId: BigInt(patient.id),
          doctor: doctor ? doctor.id : null,
          referringDoctor: referringDoctor ? String(referringDoctor.id) : null,
          date: dto.date,
          dateString: dto.date,
          dueDate,
          consultationId: dto.consultation_id ? BigInt(dto.consultation_id) : null,
          labOrderId: dto.lab_order_id ? BigInt(dto.lab_order_id) : null,
          amount: subtotal,
          discount: overallDiscount,
          vat: overallVat,
          grossTotal,
          amountReceived: 0.0,
          status: 'unpaid',
          remarks: dto.remarks ?? null,
          careSetting,
          patientTypeId: patientTypeId ? BigInt(patientTypeId) : null,
          patientName: patient.name,
          patientPhone: patient.phone ?? null,
          patientAddress: patient.address ?? null,
          doctorName: doctor ? doctor.name : null,
          branchId: resolvedBranchId ? BigInt(resolvedBranchId) : null,
          user: userId || '',
          category: category || null,
          categoryName: categoryName || null,
          categoryAmount: categoryAmount || null,
        },
      });

      // Link appointment if provided
      if (dto.appointment_id) {
        await tx.appointment.update({
          where: { id: BigInt(dto.appointment_id) },
          data: { paymentId: createdPayment.id },
        });
      }

      for (const item of processedItems) {
        await tx.invoiceItem.create({
          data: {
            paymentId: createdPayment.id,
            paymentCategoryId: item.paymentCategoryId ? BigInt(item.paymentCategoryId) : null,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            discount: item.discount,
            lineTotal: item.lineTotal,
            doctorId: item.doctorId ? BigInt(item.doctorId) : null,
          },
        });
      }

      const fresh = await tx.payment.findUniqueOrThrow({
        where: { id: createdPayment.id },
        include: {
          items: true,
          payments: true,
          refunds: true,
          patient: true,
        },
      });

      return this.formatPayment(fresh, patient, doctor);
    });
  }

  /**
   * Records an installment or full payment against an invoice under atomic row locking.
   * Strictly refuses overpayments exceeding outstanding balance.
   */
  async recordPayment(
    invoiceId: string | number,
    dto: CreatePaymentDto,
    userId?: string,
    user?: any,
  ): Promise<InvoiceResponseDto> {
    const idStr = String(invoiceId);
    const amount = InvoiceService.round2(dto.amount);
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be at least 0.01.');
    }

    const now = new Date();
    const paidAt = dto.date ? `${dto.date} ${now.toTimeString().split(' ')[0]}` : now.toISOString();

    return await this.prisma.$transaction(
      async (tx) => {
        // Pessimistic lock on invoice row in PostgreSQL
        const locked = await tx.$queryRaw<Array<{
          id: bigint;
          gross_total: number | string | bigint;
          amount_received: number | string | bigint;
          branch_id: bigint | null;
          organization_id: bigint | null;
          status: string;
        }>>`
          SELECT id, gross_total, amount_received, branch_id, organization_id, status
          FROM payment WHERE id = ${BigInt(idStr)} FOR UPDATE
        `;

        if (!locked || locked.length === 0) {
          throw new NotFoundException(`Invoice #${idStr} not found.`);
        }

        const invoiceRow = locked[0];

        if (invoiceRow.status === 'CANCELLED') {
          throw new BadRequestException('Cannot record payments against a cancelled invoice.');
        }
        if (invoiceRow.status === 'REFUNDED') {
          throw new BadRequestException('Cannot record payments against a fully refunded invoice.');
        }

        if (this.branchAuth && user && invoiceRow.branch_id) {
          await this.branchAuth.assertResourceAccess(user, String(invoiceRow.branch_id), 'invoice');
        }

        const existingPayments = await tx.invoicePayment.findMany({
          where: { paymentId: BigInt(idStr) },
        });

        const totalPaidBefore = existingPayments.reduce(
          (acc, curr) => acc + Number(curr.amount) - Number(curr.refundedAmount || 0),
          0,
        );
        const grossTotal = Number(invoiceRow.gross_total);
        const outstanding = InvoiceService.round2(grossTotal - totalPaidBefore);

        if (amount > outstanding + 0.004) {
          throw new BadRequestException(
            `Only ${outstanding.toFixed(2)} is outstanding on this invoice.`,
          );
        }

        let activeShiftId: bigint | null = null;
        if (userId && (tx as any).cashierShift) {
          const activeShift = await (tx as any).cashierShift.findFirst({
            where: { cashierId: BigInt(userId), status: 'OPEN' },
          });
          if (activeShift) {
            activeShiftId = activeShift.id;
          }
        }

        const receiptNumber = await this.generateReceiptNumber(tx, dto.date);

        const createdInvPayment = await tx.invoicePayment.create({
          data: {
            receiptNumber,
            organizationId: invoiceRow.organization_id,
            branchId: invoiceRow.branch_id,
            paymentId: BigInt(idStr),
            amount,
            method: dto.method || 'Cash',
            reference: dto.reference ?? null,
            paidAt,
            receivedBy: userId ? BigInt(userId) : null,
            shiftId: activeShiftId,
            status: 'COMPLETED',
          },
        });

        if (activeShiftId && (tx as any).cashTransaction) {
          const methodStr = (dto.method || 'Cash').toLowerCase().trim();
          const isCash = methodStr === '' || methodStr === 'cash';
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const count = await (tx as any).cashTransaction.count({
            where: { transactionNumber: { startsWith: `CTX-${dateStr}-` } },
          });
          const txNumber = `CTX-${dateStr}-${String(count + 1).padStart(4, '0')}`;
          await (tx as any).cashTransaction.create({
            data: {
              shiftId: activeShiftId,
              transactionNumber: txNumber,
              transactionType: 'PAYMENT_RECEIVED',
              paymentId: BigInt(idStr),
              invoicePaymentId: createdInvPayment.id,
              sourceModule: 'INVOICE',
              sourceReference: receiptNumber,
              idempotencyKey: `INV-PAY-${createdInvPayment.id}`,
              paymentMethod: dto.method || 'Cash',
              amount,
              isCash,
              direction: 'INFLOW',
              recordedBy: BigInt(userId!),
              notes: `Payment receipt #${receiptNumber} on invoice #${idStr}`,
            },
          });
        }

        const newTotalPaid = InvoiceService.round2(totalPaidBefore + amount);
        const newBalance = InvoiceService.round2(grossTotal - newTotalPaid);
        const newStatus =
          newBalance <= 0.004 ? 'paid' : newTotalPaid > 0 ? 'part paid' : 'unpaid';

        const updated = await tx.payment.update({
          where: { id: BigInt(idStr) },
          data: {
            amountReceived: newTotalPaid,
            status: newStatus,
          },
          include: {
            items: true,
            payments: true,
            refunds: true,
            patient: true,
          },
        });

        const doctor = updated.doctor ? await this.doctorService.findById(updated.doctor).catch(() => null) : null;
        return this.formatPayment(updated, updated.patient, doctor);
      },
      { maxWait: 15000, timeout: 30000 },
    );
  }

  /**
   * Processes a full or partial refund against an invoice with row-level lock and audit trail.
   */
  async processRefund(
    invoiceId: string | number,
    dto: CreateRefundDto,
    userId: string,
    user?: any,
  ): Promise<InvoiceResponseDto> {
    const idStr = String(invoiceId);
    const refundAmount = InvoiceService.round2(dto.amount);
    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero.');
    }
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('Refund reason is required.');
    }

    return await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{
          id: bigint;
          gross_total: number | string | bigint;
          amount_received: number | string | bigint;
          branch_id: bigint | null;
          organization_id: bigint | null;
          status: string;
        }>>`
          SELECT id, gross_total, amount_received, branch_id, organization_id, status
          FROM payment WHERE id = ${BigInt(idStr)} FOR UPDATE
        `;

        if (!locked || locked.length === 0) {
          throw new NotFoundException(`Invoice #${idStr} not found.`);
        }

        const invoiceRow = locked[0];

        if (invoiceRow.status === 'CANCELLED') {
          throw new BadRequestException('Cannot refund a cancelled invoice.');
        }

        if (this.branchAuth && user && invoiceRow.branch_id) {
          await this.branchAuth.assertResourceAccess(user, String(invoiceRow.branch_id), 'invoice');
        }

        // Determine refundable amount
        let targetPayment: any = null;
        if (dto.invoice_payment_id) {
          targetPayment = await tx.invoicePayment.findUnique({
            where: { id: BigInt(dto.invoice_payment_id) },
          });
          if (!targetPayment || targetPayment.paymentId !== BigInt(idStr)) {
            throw new NotFoundException(`Payment receipt #${dto.invoice_payment_id} not found on this invoice.`);
          }
          const availableToRefund = InvoiceService.round2(
            Number(targetPayment.amount) - Number(targetPayment.refundedAmount || 0),
          );
          if (refundAmount > availableToRefund + 0.004) {
            throw new BadRequestException(
              `Requested refund (${refundAmount.toFixed(2)}) exceeds available payment amount (${availableToRefund.toFixed(2)}).`,
            );
          }
        } else {
          // Check cumulative payments vs refunds
          const allPayments = await tx.invoicePayment.findMany({
            where: { paymentId: BigInt(idStr) },
          });
          const totalPaid = allPayments.reduce((acc, p) => acc + Number(p.amount), 0);
          const totalRefunded = allPayments.reduce((acc, p) => acc + Number(p.refundedAmount || 0), 0);
          const totalAvailable = InvoiceService.round2(totalPaid - totalRefunded);

          if (refundAmount > totalAvailable + 0.004) {
            throw new BadRequestException(
              `Requested refund (${refundAmount.toFixed(2)}) exceeds net received amount (${totalAvailable.toFixed(2)}).`,
            );
          }
        }

        const refundNumber = await this.generateRefundNumber(tx);

        const createdRefund = await tx.invoiceRefund.create({
          data: {
            refundNumber,
            paymentId: BigInt(idStr),
            invoicePaymentId: targetPayment ? targetPayment.id : null,
            organizationId: invoiceRow.organization_id,
            branchId: invoiceRow.branch_id,
            amount: refundAmount,
            reason: dto.reason.trim(),
            method: dto.method || 'Cash',
            approvedById: BigInt(userId),
            processedById: BigInt(userId),
          },
        });

        // Update payment receipts with allocated refunded amounts
        if (targetPayment) {
          const newRefunded = InvoiceService.round2(Number(targetPayment.refundedAmount || 0) + refundAmount);
          const newStatus =
            newRefunded >= Number(targetPayment.amount) - 0.004 ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
          await tx.invoicePayment.update({
            where: { id: targetPayment.id },
            data: {
              refundedAmount: newRefunded,
              status: newStatus,
            },
          });
        } else {
          // Allocate refund across open payments on this invoice
          const openPayments = await tx.invoicePayment.findMany({
            where: { paymentId: BigInt(idStr) },
            orderBy: { id: 'asc' },
          });
          let remainingToAllocate = refundAmount;
          for (const pay of openPayments) {
            if (remainingToAllocate <= 0) break;
            const currentRefunded = Number(pay.refundedAmount || 0);
            const payAmt = Number(pay.amount);
            const canRefund = Math.max(0, payAmt - currentRefunded);
            if (canRefund > 0) {
              const alloc = Math.min(canRefund, remainingToAllocate);
              const nextRefunded = InvoiceService.round2(currentRefunded + alloc);
              const payStatus = nextRefunded >= payAmt - 0.004 ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
              await tx.invoicePayment.update({
                where: { id: pay.id },
                data: {
                  refundedAmount: nextRefunded,
                  status: payStatus,
                },
              });
              remainingToAllocate = InvoiceService.round2(remainingToAllocate - alloc);
            }
          }
        }

        // Active shift cashier tracking
        let activeShiftId: bigint | null = null;
        if (userId && (tx as any).cashierShift) {
          const activeShift = await (tx as any).cashierShift.findFirst({
            where: { cashierId: BigInt(userId), status: 'OPEN' },
          });
          if (activeShift) {
            activeShiftId = activeShift.id;
          }
        }

        if (activeShiftId && (tx as any).cashTransaction) {
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const count = await (tx as any).cashTransaction.count({
            where: { transactionNumber: { startsWith: `CTX-${dateStr}-` } },
          });
          const txNumber = `CTX-${dateStr}-${String(count + 1).padStart(4, '0')}`;
          await (tx as any).cashTransaction.create({
            data: {
              shiftId: activeShiftId,
              transactionNumber: txNumber,
              transactionType: 'REFUND',
              paymentId: BigInt(idStr),
              refundId: createdRefund.id,
              sourceModule: 'INVOICE',
              sourceReference: refundNumber,
              idempotencyKey: `RFD-${createdRefund.id}`,
              paymentMethod: dto.method || 'Cash',
              amount: refundAmount,
              isCash: (dto.method || 'Cash').toLowerCase() === 'cash',
              direction: 'OUTFLOW',
              recordedBy: BigInt(userId),
              notes: `Refund #${refundNumber}: ${dto.reason.trim()}`,
            },
          });
        }

        // Recompute invoice totals and status
        const allPaymentsAfter = await tx.invoicePayment.findMany({
          where: { paymentId: BigInt(idStr) },
        });
        const totalNetPaid = InvoiceService.round2(
          allPaymentsAfter.reduce(
            (acc, p) => acc + Number(p.amount) - Number(p.refundedAmount || 0),
            0,
          ),
        );
        const grossTotal = Number(invoiceRow.gross_total);
        const newBalance = InvoiceService.round2(grossTotal - totalNetPaid);

        let newStatus = 'ISSUED';
        if (totalNetPaid <= 0.004) {
          newStatus = 'REFUNDED';
        } else if (newBalance <= 0.004) {
          newStatus = 'PAID';
        } else {
          newStatus = 'PARTIALLY_PAID';
        }

        const updated = await tx.payment.update({
          where: { id: BigInt(idStr) },
          data: {
            amountReceived: totalNetPaid,
            status: newStatus,
          },
          include: {
            items: true,
            payments: true,
            refunds: true,
            patient: true,
          },
        });

        this.logger.log(`Issued refund #${refundNumber} of INR ${refundAmount} for invoice #${idStr}.`);
        const doctor = updated.doctor ? await this.doctorService.findById(updated.doctor).catch(() => null) : null;
        return this.formatPayment(updated, updated.patient, doctor);
      },
      { maxWait: 15000, timeout: 30000 },
    );
  }

  /**
   * Voids / cancels an unpaid invoice with mandatory justification.
   * Invoices with payments must be refunded first.
   */
  async cancelInvoice(
    invoiceId: string | number,
    dto: CancelInvoiceDto,
    userId: string,
    user?: any,
  ): Promise<InvoiceResponseDto> {
    const idStr = String(invoiceId);

    return await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{
        id: bigint;
        amount_received: number | string | bigint;
        branch_id: bigint | null;
        status: string;
      }>>`
        SELECT id, amount_received, branch_id, status
        FROM payment WHERE id = ${BigInt(idStr)} FOR UPDATE
      `;

      if (!locked || locked.length === 0) {
        throw new NotFoundException(`Invoice #${idStr} not found.`);
      }

      const invoiceRow = locked[0];

      if (this.branchAuth && user && invoiceRow.branch_id) {
        await this.branchAuth.assertResourceAccess(user, String(invoiceRow.branch_id), 'invoice');
      }

      if (Number(invoiceRow.amount_received) > 0.004) {
        throw new BadRequestException(
          'Cannot cancel an invoice with active payments. Please refund or reverse the received payments first.',
        );
      }

      const updated = await tx.payment.update({
        where: { id: BigInt(idStr) },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledById: BigInt(userId),
          cancellationReason: dto.reason.trim(),
        },
        include: {
          items: true,
          payments: true,
          refunds: true,
          patient: true,
        },
      });

      this.logger.log(`Cancelled invoice #${idStr}. Reason: ${dto.reason.trim()}`);
      const doctor = updated.doctor ? await this.doctorService.findById(updated.doctor).catch(() => null) : null;
      return this.formatPayment(updated, updated.patient, doctor);
    });
  }

  /**
   * Idempotent consultation invoice creation.
   * If an invoice already exists for this consultation, returns it.
   */
  async createFromConsultation(
    consultationId: string | number,
    dto: Partial<CreateInvoiceDto>,
    user?: any,
  ): Promise<InvoiceResponseDto> {
    const cId = BigInt(consultationId);
    const existing = await this.prisma.payment.findFirst({
      where: { consultationId: cId },
      include: {
        items: true,
        payments: true,
        refunds: true,
        patient: true,
      },
    });

    if (existing) {
      this.logger.log(`Invoice already exists for consultation #${consultationId}: #${existing.invoiceNumber || existing.id}`);
      const doctor = existing.doctor ? await this.doctorService.findById(existing.doctor).catch(() => null) : null;
      return this.formatPayment(existing, existing.patient, doctor);
    }

    const consultation = await this.prisma.consultation.findUnique({
      where: { id: cId },
      include: { patient: true, doctor: true },
    });

    if (!consultation) {
      throw new NotFoundException(`Consultation #${consultationId} not found.`);
    }

    // Default consultation fee lookup
    let fee = 500;
    const cat = await this.prisma.paymentCategory.findFirst({
      where: { kind: 'consultation', active: true },
    });
    if (cat && cat.cPrice) {
      fee = Number(cat.cPrice);
    }

    const invoiceDto: CreateInvoiceDto = {
      patient: consultation.patientId.toString(),
      doctor: consultation.doctorId ? consultation.doctorId.toString() : undefined,
      date: new Date().toISOString().slice(0, 10),
      consultation_id: consultation.id.toString(),
      appointment_id: consultation.appointmentId ? consultation.appointmentId.toString() : undefined,
      branchId: consultation.branchId ? consultation.branchId.toString() : (user?.branchId || undefined),
      items: [
        {
          name: `Consultation - ${consultation.doctor ? consultation.doctor.name : 'OPD'}`,
          quantity: 1,
          unit_price: dto.items?.[0]?.unit_price ?? fee,
          payment_category_id: cat ? cat.id.toString() : undefined,
          doctor_id: consultation.doctorId ? consultation.doctorId.toString() : undefined,
        },
      ],
      remarks: dto.remarks || `Consultation charge for visit on ${consultation.date}`,
    };

    return this.create(invoiceDto, user?.id ? String(user.id) : undefined, user);
  }

  /**
   * Idempotent laboratory order invoice creation.
   */
  async createFromLabOrder(
    labOrderId: string | number,
    user?: any,
  ): Promise<InvoiceResponseDto> {
    const lId = BigInt(labOrderId);
    const existing = await this.prisma.payment.findFirst({
      where: { labOrderId: lId },
      include: {
        items: true,
        payments: true,
        refunds: true,
        patient: true,
      },
    });

    if (existing) {
      this.logger.log(`Invoice already exists for lab order #${labOrderId}: #${existing.invoiceNumber || existing.id}`);
      const doctor = existing.doctor ? await this.doctorService.findById(existing.doctor).catch(() => null) : null;
      return this.formatPayment(existing, existing.patient, doctor);
    }

    const labOrder = await this.prisma.lab.findUnique({
      where: { id: lId },
      include: {
        patient: true,
        tests: {
          include: { labCategory: true },
        },
      },
    });

    if (!labOrder) {
      throw new NotFoundException(`Laboratory Order #${labOrderId} not found.`);
    }

    const items = (labOrder as any).tests?.map((t: any) => ({
      name: `[Lab] ${t.name || t.labCategory?.category || 'Diagnostic Investigation'}`,
      quantity: 1,
      unit_price: t.priceSnapshot ? Number(t.priceSnapshot) : (t.labCategory?.price ? Number(t.labCategory.price) : 0),
    })) || [];

    const invoiceDto: CreateInvoiceDto = {
      patient: labOrder.patientId.toString(),
      doctor: labOrder.doctorId ? labOrder.doctorId.toString() : undefined,
      date: new Date().toISOString().slice(0, 10),
      lab_order_id: labOrder.id.toString(),
      branchId: labOrder.branchId ? labOrder.branchId.toString() : (user?.branchId || undefined),
      items: items.length > 0 ? items : [{ name: 'Laboratory Investigations', quantity: 1, unit_price: 0 }],
      remarks: `Diagnostic order #${labOrder.orderNumber}`,
    };

    return this.create(invoiceDto, user?.id ? String(user.id) : undefined, user);
  }

  /**
   * Find single invoice by numeric primary key or invoice number.
   */
  async findById(idOrKey: string | number, user?: any): Promise<InvoiceResponseDto> {
    const idStr = String(idOrKey);

    const invoice = !isNaN(Number(idStr))
      ? await this.prisma.payment.findUnique({
          where: { id: BigInt(idStr) },
          include: {
            items: true,
            payments: true,
            refunds: true,
            patient: true,
          },
        })
      : await this.prisma.payment.findFirst({
          where: { invoiceNumber: idStr },
          include: {
            items: true,
            payments: true,
            refunds: true,
            patient: true,
          },
        });

    if (!invoice) {
      throw new NotFoundException(`Invoice "${idStr}" not found.`);
    }

    if (this.branchAuth && user && invoice.branchId) {
      await this.branchAuth.assertResourceAccess(user, String(invoice.branchId), 'invoice');
    }

    const doctor = invoice.doctor ? await this.doctorService.findById(invoice.doctor).catch(() => null) : null;
    return this.formatPayment(invoice, invoice.patient, doctor);
  }

  /**
   * Alias for findById.
   */
  async findOne(idOrKey: string | number, user?: any): Promise<InvoiceResponseDto> {
    return this.findById(idOrKey, user);
  }

  /**
   * List invoices with multi-tenant filtering, search by patient, status tabs, and pagination.
   */
  async findAll(query: InvoiceQueryDto, user?: any): Promise<PaginatedInvoicesDto> {
    const show = query.show || 'all';
    const patientFilter = query.patient ? String(query.patient).trim() : undefined;
    const dateFilter = query.date ? query.date.trim() : undefined;
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {};

    if (user?.organizationId) {
      where.organizationId = BigInt(user.organizationId);
    }

    if (patientFilter) {
      where.OR = [
        { patientName: { contains: patientFilter, mode: 'insensitive' } },
        { patientPhone: { contains: patientFilter } },
        { invoiceNumber: { contains: patientFilter, mode: 'insensitive' } },
      ];
      if (!isNaN(Number(patientFilter))) {
        where.OR.push({ patientId: BigInt(patientFilter) });
      }
    }

    if (dateFilter) {
      where.date = dateFilter;
    }

    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      const accessibleBranches = await this.branchAuth.resolveAccessibleBranchIds(user);
      const queryBranch = (query as any).branchId ?? (query as any).branch_id;
      if (queryBranch) {
        await this.branchAuth.assertResourceAccess(user, queryBranch, 'invoice');
        where.branchId = BigInt(queryBranch);
      } else if (accessibleBranches) {
        where.branchId = { in: accessibleBranches };
      }
    }

    const allRecords = await this.prisma.payment.findMany({
      where,
      include: {
        items: true,
        payments: true,
        refunds: true,
        patient: true,
      },
      orderBy: { id: 'desc' },
    });

    // Derive settlement balance for each invoice
    const mapped = allRecords.map((r) => {
      const paid = r.payments.reduce(
        (acc, curr) => acc + Number(curr.amount) - Number(curr.refundedAmount || 0),
        0,
      );
      const balance = InvoiceService.round2(Number(r.grossTotal) - paid);
      return {
        record: r,
        paid,
        balance,
      };
    });

    let filtered = mapped;
    if (show === 'outstanding') {
      filtered = mapped.filter((i) => i.balance > 0.004 && i.record.status !== 'CANCELLED');
    } else if (show === 'settled') {
      filtered = mapped.filter((i) => i.balance <= 0.004 && i.record.status !== 'CANCELLED');
    }

    const totalOwed = filtered
      .reduce((acc, curr) => acc + (curr.record.status === 'CANCELLED' ? 0 : Math.max(0, curr.balance)), 0)
      .toFixed(2);
    const paginated = filtered.slice(skip, skip + limit);

    const data: InvoiceResponseDto[] = [];
    for (const item of paginated) {
      const doctor = item.record.doctor
        ? await this.doctorService.findById(item.record.doctor).catch(() => null)
        : null;
      data.push(this.formatPayment(item.record, item.record.patient, doctor));
    }

    return {
      data,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit) || 1,
      totalOwed,
    };
  }

  /**
   * Deletion guard: An invoice cannot be deleted if money has been recorded against it,
   * or if doctor shares have been paid.
   */
  async remove(idOrKey: string | number, user?: any): Promise<{ success: boolean; message: string }> {
    const idStr = String(idOrKey);

    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { id: BigInt(idStr) },
        include: { payments: true },
      });

      if (!existing) {
        throw new NotFoundException(`Invoice #${idStr} not found.`);
      }

      if (this.branchAuth && user && existing.branchId) {
        await this.branchAuth.assertResourceAccess(user, String(existing.branchId), 'invoice');
      }

      if (existing.payments && existing.payments.length > 0) {
        throw new BadRequestException('Money has been taken against this invoice, so it cannot be deleted.');
      }

      await tx.payment.delete({
        where: { id: BigInt(idStr) },
      });

      return { success: true, message: `Invoice #${idStr} successfully removed.` };
    });
  }

  // ===========================================================================
  // SERVICE CATALOGUE MANAGEMENT
  // ===========================================================================

  async listServiceCatalogue(user?: any, kind?: string, search?: string) {
    const where: Prisma.PaymentCategoryWhereInput = {
      active: true,
    };

    if (user?.organizationId) {
      where.OR = [
        { organizationId: BigInt(user.organizationId) },
        { organizationId: null },
      ];
    }

    if (kind) {
      where.kind = kind;
    }

    if (search) {
      where.OR = [
        { category: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.paymentCategory.findMany({
      where,
      orderBy: { category: 'asc' },
    });

    return items.map((i) => ({
      id: i.id.toString(),
      name: i.category,
      code: i.code || null,
      description: i.description || null,
      price: Number(i.cPrice),
      kind: i.kind,
      taxRate: Number(i.taxRate || 0),
      active: i.active,
      organizationId: i.organizationId ? i.organizationId.toString() : null,
      branchId: i.branchId ? i.branchId.toString() : null,
    }));
  }

  async createServiceItem(dto: CreateServiceItemDto, user?: any) {
    const name = dto.name.trim();
    const organizationId = user?.organizationId ? BigInt(user.organizationId) : null;
    const branchId = dto.branchId ? BigInt(dto.branchId) : (user?.branchId ? BigInt(user.branchId) : null);

    const created = await this.prisma.paymentCategory.create({
      data: {
        category: name,
        code: dto.code?.trim() || null,
        description: dto.description?.trim() || null,
        cPrice: new Prisma.Decimal(dto.price),
        kind: dto.kind?.trim() || 'misc',
        taxRate: dto.taxRate ? new Prisma.Decimal(dto.taxRate) : new Prisma.Decimal(0),
        dCommission: dto.commission ? new Prisma.Decimal(dto.commission) : null,
        active: dto.active ?? true,
        organizationId,
        branchId,
      },
    });

    return {
      id: created.id.toString(),
      name: created.category,
      code: created.code,
      description: created.description,
      price: Number(created.cPrice),
      kind: created.kind,
      taxRate: Number(created.taxRate || 0),
      active: created.active,
    };
  }

  async updateServiceItem(id: string | number, dto: UpdateServiceItemDto, user?: any) {
    const existing = await this.prisma.paymentCategory.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existing) {
      throw new NotFoundException(`Service #${id} not found.`);
    }

    const updated = await this.prisma.paymentCategory.update({
      where: { id: BigInt(id) },
      data: {
        category: dto.name ? dto.name.trim() : undefined,
        code: dto.code !== undefined ? dto.code?.trim() || null : undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        cPrice: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        kind: dto.kind !== undefined ? dto.kind.trim() : undefined,
        taxRate: dto.taxRate !== undefined ? new Prisma.Decimal(dto.taxRate) : undefined,
        dCommission: dto.commission !== undefined ? new Prisma.Decimal(dto.commission) : undefined,
        active: dto.active !== undefined ? dto.active : undefined,
      },
    });

    return {
      id: updated.id.toString(),
      name: updated.category,
      code: updated.code,
      description: updated.description,
      price: Number(updated.cPrice),
      kind: updated.kind,
      taxRate: Number(updated.taxRate || 0),
      active: updated.active,
    };
  }

  // ===========================================================================
  // FINANCE & BILLING SUMMARY METRICS
  // ===========================================================================

  async getFinanceSummary(user?: any, branchId?: string | number, dateStr?: string) {
    const targetDate = dateStr || new Date().toISOString().slice(0, 10);
    const whereInvoice: Prisma.PaymentWhereInput = {};
    const wherePayment: Prisma.InvoicePaymentWhereInput = {};
    const whereRefund: Prisma.InvoiceRefundWhereInput = {};

    if (user?.organizationId) {
      whereInvoice.organizationId = BigInt(user.organizationId);
      wherePayment.organizationId = BigInt(user.organizationId);
      whereRefund.organizationId = BigInt(user.organizationId);
    }

    if (branchId) {
      whereInvoice.branchId = BigInt(branchId);
      wherePayment.branchId = BigInt(branchId);
      whereRefund.branchId = BigInt(branchId);
    }

    // Invoices today
    const invoicesToday = await this.prisma.payment.findMany({
      where: { ...whereInvoice, date: targetDate, status: { not: 'CANCELLED' } },
      select: { grossTotal: true, status: true },
    });
    const totalInvoicedToday = InvoiceService.round2(
      invoicesToday.reduce((sum, inv) => sum + Number(inv.grossTotal), 0),
    );

    // Payments collected today
    const paymentsToday = await this.prisma.invoicePayment.findMany({
      where: { ...wherePayment, date: targetDate },
      select: { amount: true, method: true },
    });
    const totalCollectedToday = InvoiceService.round2(
      paymentsToday.reduce((sum, p) => sum + Number(p.amount), 0),
    );

    // Refunds today
    const refundsToday = await this.prisma.invoiceRefund.findMany({
      where: { ...whereRefund, createdAt: { gte: new Date(`${targetDate}T00:00:00.000Z`) } },
      select: { amount: true },
    });
    const totalRefundsToday = InvoiceService.round2(
      refundsToday.reduce((sum, r) => sum + Number(r.amount), 0),
    );

    // Outstanding balances overall
    const openInvoices = await this.prisma.payment.findMany({
      where: { ...whereInvoice, status: { in: ['ISSUED', 'PARTIALLY_PAID', 'unpaid', 'part paid'] } },
      include: { payments: true },
    });

    let totalOutstanding = 0;
    let overdueCount = 0;
    const now = new Date();

    for (const inv of openInvoices) {
      const paid = inv.payments.reduce(
        (sum, p) => sum + Number(p.amount) - Number(p.refundedAmount || 0),
        0,
      );
      const bal = InvoiceService.round2(Number(inv.grossTotal) - paid);
      if (bal > 0.004) {
        totalOutstanding = InvoiceService.round2(totalOutstanding + bal);
        if (inv.dueDate && inv.dueDate < now) {
          overdueCount++;
        }
      }
    }

    // Payment method breakdown today
    const methodBreakdown: Record<string, number> = {};
    for (const p of paymentsToday) {
      const m = p.method || 'Cash';
      methodBreakdown[m] = InvoiceService.round2((methodBreakdown[m] || 0) + Number(p.amount));
    }

    return {
      date: targetDate,
      totalInvoicedToday,
      totalCollectedToday,
      totalRefundsToday,
      netCollectionsToday: InvoiceService.round2(totalCollectedToday - totalRefundsToday),
      totalOutstandingReceivables: totalOutstanding,
      openInvoicesCount: openInvoices.length,
      overdueInvoicesCount: overdueCount,
      paymentMethodBreakdown: methodBreakdown,
    };
  }

  /**
   * Transforms raw Prisma payment row into an InvoiceResponseDto.
   */
  private formatPayment(p: any, patient: any, doctor: any): InvoiceResponseDto {
    const subtotal = Number(p.amount);
    const discount = Number(p.discount || 0);
    const vat = Number(p.vat || 0);
    const grossTotal = Number(p.grossTotal);

    const totalPayments = (p.payments || []).reduce(
      (acc: number, curr: any) => acc + Number(curr.amount),
      0,
    );
    const totalRefunds = (p.refunds || []).reduce(
      (acc: number, curr: any) => acc + Number(curr.amount),
      0,
    );
    const paid = InvoiceService.round2(Math.max(0, totalPayments - totalRefunds));
    const balance = InvoiceService.round2(grossTotal - paid);

    let status = p.status;
    if (p.status === 'CANCELLED') {
      status = 'CANCELLED';
    } else if (p.status === 'REFUNDED' || ((p.refunds || []).length > 0 && paid <= 0.004)) {
      status = 'REFUNDED';
    } else if (balance <= 0.004) {
      status = 'paid';
    } else if (paid > 0.004) {
      status = 'part paid';
    } else {
      status = 'unpaid';
    }

    return {
      id: p.id.toString(),
      invoiceNumber: p.invoiceNumber || `INV-${p.id}`,
      organizationId: p.organizationId ? p.organizationId.toString() : null,
      branchId: p.branchId ? p.branchId.toString() : null,
      patientId: p.patientId ? p.patientId.toString() : '',
      doctorId: p.doctor
        ? typeof p.doctor === 'object' && p.doctor !== null
          ? p.doctor.id
            ? p.doctor.id.toString()
            : null
          : p.doctor.toString()
        : null,
      referringDoctorId: p.referringDoctor ? p.referringDoctor.toString() : null,
      consultationId: p.consultationId ? p.consultationId.toString() : null,
      date: p.date,
      dueDate: p.dueDate ? p.dueDate.toISOString().slice(0, 10) : null,
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      vat: vat.toFixed(2),
      grossTotal: grossTotal.toFixed(2),
      paid: paid.toFixed(2),
      balance: Math.max(0, balance).toFixed(2),
      status,
      cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString() : null,
      cancellationReason: p.cancellationReason || null,
      remarks: p.remarks || null,
      careSetting: p.careSetting || 'opd',
      patient: patient
        ? {
            id: patient.id.toString(),
            patientId: patient.patientId || '',
            name: patient.name,
            phone: patient.phone || null,
            address: patient.address || null,
          }
        : undefined,
      doctor: doctor
        ? {
            id: doctor.id.toString(),
            name: doctor.name,
            department: doctor.department || null,
          }
        : null,
      items: (p.items || []).map((i: any) => ({
        id: i.id.toString(),
        paymentId: i.paymentId.toString(),
        paymentCategoryId: i.paymentCategoryId ? i.paymentCategoryId.toString() : null,
        name: i.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice).toFixed(2),
        taxRate: i.taxRate ? Number(i.taxRate).toFixed(2) : '0.00',
        discount: i.discount ? Number(i.discount).toFixed(2) : '0.00',
        lineTotal: Number(i.lineTotal).toFixed(2),
        doctorId: i.doctorId ? i.doctorId.toString() : null,
      })),
      payments: (p.payments || []).map((pay: any) => ({
        id: pay.id.toString(),
        paymentId: pay.paymentId.toString(),
        receiptNumber: pay.receiptNumber || `RCP-${pay.id}`,
        amount: Number(pay.amount).toFixed(2),
        refundedAmount: pay.refundedAmount ? Number(pay.refundedAmount).toFixed(2) : '0.00',
        status: pay.status || 'COMPLETED',
        method: pay.method || 'Cash',
        reference: pay.reference || null,
        paidAt: pay.paidAt || null,
        receivedBy: pay.receivedBy ? pay.receivedBy.toString() : null,
        createdAt: pay.createdAt ? pay.createdAt.toISOString() : null,
      })),
      refunds: (p.refunds || []).map((r: any) => ({
        id: r.id.toString(),
        refundNumber: r.refundNumber,
        paymentId: r.paymentId.toString(),
        invoicePaymentId: r.invoicePaymentId ? r.invoicePaymentId.toString() : null,
        amount: Number(r.amount).toFixed(2),
        reason: r.reason,
        method: r.method,
        approvedById: r.approvedById ? r.approvedById.toString() : null,
        processedById: r.processedById.toString(),
        refundedAt: r.refundedAt ? r.refundedAt.toISOString() : r.createdAt?.toISOString(),
      })),
      createdAt: p.createdAt ? p.createdAt.toISOString() : null,
      updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
    };
  }
}
