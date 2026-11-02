import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import {
  InvoiceResponseDto,
  PaginatedInvoicesDto,
} from './dto/invoice-response.dto';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patientService: PatientService,
    private readonly doctorService: DoctorService,
  ) {}

  /**
   * Helper to round monetary amounts to exactly 2 decimal places.
   */
  static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Generates a new patient invoice with itemized line entries, discounts,
   * and tax calculations. Purely transactional against PostgreSQL.
   */
  async create(dto: CreateInvoiceDto, userId?: string): Promise<InvoiceResponseDto> {
    const patient = await this.patientService.findById(dto.patient);
    if (!patient) {
      throw new NotFoundException(`Patient #${dto.patient} not found.`);
    }

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
      const lineTotal = InvoiceService.round2(unitPrice * qty);

      processedItems.push({
        paymentCategoryId: raw.payment_category_id ? String(raw.payment_category_id) : null,
        name: name || `Service #${raw.payment_category_id}`,
        quantity: qty,
        unitPrice,
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
    const discount = InvoiceService.round2(dto.discount ?? 0);
    const vat = InvoiceService.round2(dto.vat ?? 0);

    if (discount < 0) {
      throw new BadRequestException('Discount cannot be negative.');
    }
    if (vat < 0) {
      throw new BadRequestException('VAT cannot be negative.');
    }
    if (discount > subtotal) {
      throw new BadRequestException('The discount is larger than the invoice.');
    }

    const grossTotal = InvoiceService.round2(subtotal - discount + vat);
    const careSetting = dto.care_setting || 'opd';
    const patientTypeId = dto.patient_type_id ? String(dto.patient_type_id) : null;

    return await this.prisma.$transaction(async (tx) => {
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
          patientId: BigInt(patient.id),
          doctor: doctor ? doctor.id : null,
          referringDoctor: referringDoctor ? String(referringDoctor.id) : null,
          date: dto.date,
          dateString: dto.date,
          amount: subtotal,
          discount,
          vat,
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
          user: userId || '',
          category: category || null,
          categoryName: categoryName || null,
          categoryAmount: categoryAmount || null,
        },
      });

      for (const item of processedItems) {
        await tx.invoiceItem.create({
          data: {
            paymentId: createdPayment.id,
            paymentCategoryId: item.paymentCategoryId ? BigInt(item.paymentCategoryId) : null,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
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
          patient: true,
        },
      });

      return this.formatPayment(fresh, patient, doctor);
    });
  }

  /**
   * Takes a payment installment against an invoice under atomic row locking.
   * Strictly refuses overpayments exceeding outstanding balance.
   */
  async recordPayment(
    invoiceId: string | number,
    dto: CreatePaymentDto,
    userId?: string,
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
      const locked = await tx.$queryRaw<Array<{ id: bigint; gross_total: number | string | bigint }>>`
        SELECT id, gross_total FROM payment WHERE id = ${BigInt(idStr)} FOR UPDATE
      `;
      if (!locked || locked.length === 0) {
        throw new NotFoundException(`Invoice #${idStr} not found.`);
      }

      const existingPayments = await tx.invoicePayment.findMany({
        where: { paymentId: BigInt(idStr) },
      });

      const totalPaidBefore = existingPayments.reduce(
        (acc, curr) => acc + Number(curr.amount),
        0,
      );
      const grossTotal = Number(locked[0].gross_total);
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

      const createdInvPayment = await tx.invoicePayment.create({
        data: {
          paymentId: BigInt(idStr),
          amount,
          method: dto.method || 'Cash',
          reference: dto.reference ?? null,
          paidAt,
          receivedBy: userId ? BigInt(userId) : null,
          shiftId: activeShiftId,
        },
      });

      if (activeShiftId && (tx as any).cashTransaction) {
        const methodStr = (dto.method || 'Cash').toLowerCase().trim();
        const isCash = methodStr === '' || methodStr === 'cash';
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
            transactionType: 'PAYMENT_RECEIVED',
            paymentId: BigInt(idStr),
            invoicePaymentId: createdInvPayment.id,
            sourceModule: 'INVOICE',
            sourceReference: dto.reference ?? `INV-${idStr}`,
            idempotencyKey: `INV-PAY-${createdInvPayment.id}`,
            paymentMethod: dto.method || 'Cash',
            amount,
            isCash,
            direction: 'INFLOW',
            recordedBy: BigInt(userId!),
            notes: `Payment recorded on invoice #${idStr}`,
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
          patient: true,
        },
      });

      const doctor = updated.doctor ? await this.doctorService.findById(updated.doctor).catch(() => null) : null;
      return this.formatPayment(updated, updated.patient, doctor);
    }, { maxWait: 15000, timeout: 30000 });
  }

  /**
   * Find single invoice by numeric ID.
   */
  async findById(idOrKey: string | number): Promise<InvoiceResponseDto> {
    const idStr = String(idOrKey);

    const invoice = await this.prisma.payment.findUnique({
      where: { id: BigInt(idStr) },
      include: {
        items: true,
        payments: true,
        patient: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice #${idStr} not found.`);
    }

    const doctor = invoice.doctor ? await this.doctorService.findById(invoice.doctor).catch(() => null) : null;
    return this.formatPayment(invoice, invoice.patient, doctor);
  }

  /**
   * Alias for findById.
   */
  async findOne(idOrKey: string | number): Promise<InvoiceResponseDto> {
    return this.findById(idOrKey);
  }

  /**
   * List invoices with filtering, tabs ('outstanding', 'settled', 'all'), and pagination.
   */
  async findAll(query: InvoiceQueryDto): Promise<PaginatedInvoicesDto> {
    const show = query.show || 'outstanding';
    const patientFilter = query.patient ? String(query.patient).trim() : undefined;
    const dateFilter = query.date ? query.date.trim() : undefined;
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (patientFilter) {
      where.patientId = BigInt(patientFilter);
    }
    if (dateFilter) {
      where.date = dateFilter;
    }

    const allRecords = await this.prisma.payment.findMany({
      where,
      include: {
        items: true,
        payments: true,
        patient: true,
      },
      orderBy: { id: 'desc' },
    });

    // Derive settlement balance for each invoice
    const mapped = allRecords.map((r) => {
      const paid = r.payments.reduce((acc, curr) => acc + Number(curr.amount), 0);
      const balance = InvoiceService.round2(Number(r.grossTotal) - paid);
      return {
        record: r,
        paid,
        balance,
      };
    });

    let filtered = mapped;
    if (show === 'outstanding') {
      filtered = mapped.filter((i) => i.balance > 0.004);
    } else if (show === 'settled') {
      filtered = mapped.filter((i) => i.balance <= 0.004);
    }

    const totalOwed = filtered
      .reduce((acc, curr) => acc + Math.max(0, curr.balance), 0)
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
   * or if a doctor share on this invoice is approved or paid.
   */
  async remove(idOrKey: string | number): Promise<{ success: boolean; message: string }> {
    const idStr = String(idOrKey);

    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { id: BigInt(idStr) },
        include: {
          payments: true,
          doctorShares: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(`Invoice #${idStr} not found.`);
      }

      const paid = existing.payments.reduce((acc, curr) => acc + Number(curr.amount), 0);
      if (paid > 0) {
        throw new BadRequestException(
          'Money has been taken against this invoice, so it cannot be deleted.',
        );
      }

      const hasApprovedShare = existing.doctorShares.some(
        (share) => share.status !== 'pending',
      );
      if (hasApprovedShare) {
        throw new BadRequestException(
          'A doctor share on this invoice is already approved or paid, so it cannot be deleted.',
        );
      }

      await tx.doctorShare.deleteMany({ where: { paymentId: BigInt(idStr) } });
      await tx.invoiceItem.deleteMany({ where: { paymentId: BigInt(idStr) } });
      await tx.payment.delete({ where: { id: BigInt(idStr) } });

      return { success: true, message: `Invoice #${idStr} removed.` };
    });
  }

  // --- Formatting Helpers ---

  private formatPayment(p: any, patient?: any, doctor?: any): InvoiceResponseDto {
    const paid = (p.payments || []).reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
    const subtotal = Number(p.amount);
    const discount = Number(p.discount || 0);
    const vat = Number(p.vat || 0);
    const grossTotal = Number(p.grossTotal);
    const balance = InvoiceService.round2(grossTotal - paid);
    const status = balance <= 0.004 ? 'paid' : paid > 0 ? 'part paid' : 'unpaid';

    return {
      id: p.id.toString(),
      patientId: p.patientId ? p.patientId.toString() : '',
      doctorId: p.doctor
        ? typeof p.doctor === 'object' && p.doctor !== null
          ? p.doctor.id
            ? p.doctor.id.toString()
            : null
          : p.doctor.toString()
        : null,
      referringDoctorId: p.referringDoctor ? p.referringDoctor.toString() : null,
      date: p.date,
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      vat: vat.toFixed(2),
      grossTotal: grossTotal.toFixed(2),
      paid: paid.toFixed(2),
      balance: Math.max(0, balance).toFixed(2),
      status,
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
        lineTotal: Number(i.lineTotal).toFixed(2),
        doctorId: i.doctorId ? i.doctorId.toString() : null,
      })),
      payments: (p.payments || []).map((pay: any) => ({
        id: pay.id.toString(),
        paymentId: pay.paymentId.toString(),
        amount: Number(pay.amount).toFixed(2),
        method: pay.method || 'Cash',
        reference: pay.reference || null,
        paidAt: pay.paidAt || null,
        receivedBy: pay.receivedBy ? pay.receivedBy.toString() : null,
        createdAt: pay.createdAt ? pay.createdAt.toISOString() : null,
      })),
      createdAt: p.createdAt ? p.createdAt.toISOString() : null,
      updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
    };
  }
}
