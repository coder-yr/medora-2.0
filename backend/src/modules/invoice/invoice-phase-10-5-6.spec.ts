import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceService } from './invoice.service';

describe('InvoiceService - Phase 10.5.6 (Billing, Invoicing, Refunds & Clinical Integrations)', () => {
  let service: InvoiceService;

  const mockPatient = {
    id: '101',
    patientId: 'MRN-101',
    name: 'Ramesh Kumar',
    phone: '+919876543210',
    address: 'Mumbai, India',
    organizationId: BigInt(1),
    branchId: BigInt(5),
  };

  const mockDoctor = {
    id: '201',
    name: 'Dr. Priya Sharma',
    department: 'Cardiology',
  };

  let invoiceStore: any[] = [];
  let itemStore: any[] = [];
  let paymentStore: any[] = [];
  let refundStore: any[] = [];
  let serviceCatalogueStore: any[] = [];
  let nextInvId = 1;
  let nextPayId = 1;
  let nextRefId = 1;

  const mockPrisma: any = {
    payment: {
      create: jest.fn(async ({ data }: any) => {
        const id = BigInt(nextInvId++);
        const row = {
          id,
          invoiceNumber: data.invoiceNumber || `INV-TEST-${id}`,
          organizationId: data.organizationId ?? null,
          branchId: data.branchId ?? null,
          patientId: data.patientId,
          doctor: data.doctor ?? null,
          referringDoctor: data.referringDoctor ?? null,
          consultationId: data.consultationId ?? null,
          labOrderId: data.labOrderId ?? null,
          date: data.date,
          dateString: data.dateString || data.date,
          dueDate: data.dueDate ?? null,
          amount: new Prisma.Decimal(data.amount || 0),
          discount: new Prisma.Decimal(data.discount || 0),
          vat: new Prisma.Decimal(data.vat || 0),
          grossTotal: new Prisma.Decimal(data.grossTotal || 0),
          amountReceived: new Prisma.Decimal(data.amountReceived || 0),
          status: data.status || 'unpaid',
          remarks: data.remarks ?? null,
          careSetting: data.careSetting || 'opd',
          patientName: mockPatient.name,
          patientPhone: mockPatient.phone,
          patientAddress: mockPatient.address,
          doctorName: mockDoctor.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        invoiceStore.push(row);
        return {
          ...row,
          items: itemStore.filter((i) => i.paymentId === id),
          payments: paymentStore.filter((p) => p.paymentId === id),
          refunds: refundStore.filter((r) => r.paymentId === id),
          patient: mockPatient,
          doctor: mockDoctor,
        };
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const row = invoiceStore.find((inv) => inv.id === BigInt(where.id));
        if (!row) return null;
        return {
          ...row,
          items: itemStore.filter((i) => i.paymentId === row.id),
          payments: paymentStore.filter((p) => p.paymentId === row.id),
          refunds: refundStore.filter((r) => r.paymentId === row.id),
          patient: mockPatient,
          doctor: mockDoctor,
        };
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const row = invoiceStore.find((inv) => {
          if (where.consultationId && inv.consultationId === BigInt(where.consultationId)) return true;
          if (where.labOrderId && inv.labOrderId === BigInt(where.labOrderId)) return true;
          if (where.invoiceNumber && inv.invoiceNumber === where.invoiceNumber) return true;
          return false;
        });
        if (!row) return null;
        return {
          ...row,
          items: itemStore.filter((i) => i.paymentId === row.id),
          payments: paymentStore.filter((p) => p.paymentId === row.id),
          refunds: refundStore.filter((r) => r.paymentId === row.id),
          patient: mockPatient,
          doctor: mockDoctor,
        };
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => {
        const row = invoiceStore.find((inv) => inv.id === BigInt(where.id));
        if (!row) throw new NotFoundException();
        return {
          ...row,
          items: itemStore.filter((i) => i.paymentId === row.id),
          payments: paymentStore.filter((p) => p.paymentId === row.id),
          refunds: refundStore.filter((r) => r.paymentId === row.id),
          patient: mockPatient,
          doctor: mockDoctor,
        };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = invoiceStore.findIndex((inv) => inv.id === BigInt(where.id));
        if (idx === -1) throw new NotFoundException();
        invoiceStore[idx] = {
          ...invoiceStore[idx],
          ...data,
          updatedAt: new Date(),
        };
        const row = invoiceStore[idx];
        return {
          ...row,
          items: itemStore.filter((i) => i.paymentId === row.id),
          payments: paymentStore.filter((p) => p.paymentId === row.id),
          refunds: refundStore.filter((r) => r.paymentId === row.id),
          patient: mockPatient,
          doctor: mockDoctor,
        };
      }),
      count: jest.fn(async () => invoiceStore.length),
      findMany: jest.fn(async () =>
        invoiceStore.map((r) => ({
          ...r,
          items: itemStore.filter((i) => i.paymentId === r.id),
          payments: paymentStore.filter((p) => p.paymentId === r.id),
          refunds: refundStore.filter((ref) => ref.paymentId === r.id),
          patient: mockPatient,
          doctor: mockDoctor,
        })),
      ),
    },

    invoiceItem: {
      create: jest.fn(async ({ data }: any) => {
        const item = { id: BigInt(itemStore.length + 1), ...data };
        itemStore.push(item);
        return item;
      }),
    },

    invoicePayment: {
      create: jest.fn(async ({ data }: any) => {
        const pay = {
          id: BigInt(nextPayId++),
          receiptNumber: data.receiptNumber || `RCP-TEST-${nextPayId}`,
          ...data,
          createdAt: new Date(),
        };
        paymentStore.push(pay);
        return pay;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        paymentStore.filter((p) => p.paymentId === BigInt(where.paymentId)),
      ),
      findUnique: jest.fn(async ({ where }: any) =>
        paymentStore.find((p) => p.id === BigInt(where.id)),
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = paymentStore.findIndex((p) => p.id === BigInt(where.id));
        if (idx >= 0) paymentStore[idx] = { ...paymentStore[idx], ...data };
        return paymentStore[idx];
      }),
      count: jest.fn(async () => paymentStore.length),
    },

    invoiceRefund: {
      create: jest.fn(async ({ data }: any) => {
        const ref = {
          id: BigInt(nextRefId++),
          refundNumber: data.refundNumber || `RFD-TEST-${nextRefId}`,
          ...data,
          createdAt: new Date(),
        };
        refundStore.push(ref);
        return ref;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        refundStore.filter((r) => (where.paymentId ? r.paymentId === BigInt(where.paymentId) : true)),
      ),
      count: jest.fn(async () => refundStore.length),
    },

    paymentCategory: {
      findFirst: jest.fn(async () => ({
        id: BigInt(1),
        category: 'Consultation - OPD',
        cPrice: new Prisma.Decimal(500),
        kind: 'consultation',
        active: true,
      })),
      findMany: jest.fn(async () => serviceCatalogueStore),
      create: jest.fn(async ({ data }: any) => {
        const item = { id: BigInt(serviceCatalogueStore.length + 1), ...data };
        serviceCatalogueStore.push(item);
        return item;
      }),
      findUnique: jest.fn(async ({ where }: any) =>
        serviceCatalogueStore.find((i) => i.id === BigInt(where.id)),
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = serviceCatalogueStore.findIndex((i) => i.id === BigInt(where.id));
        if (idx >= 0) serviceCatalogueStore[idx] = { ...serviceCatalogueStore[idx], ...data };
        return serviceCatalogueStore[idx];
      }),
    },

    consultation: {
      findUnique: jest.fn(async ({ where }: any) => ({
        id: BigInt(where.id),
        patientId: BigInt(mockPatient.id),
        doctorId: BigInt(mockDoctor.id),
        date: new Date('2026-11-24'),
        branchId: BigInt(5),
        patient: mockPatient,
        doctor: mockDoctor,
      })),
    },

    lab: {
      findUnique: jest.fn(async ({ where }: any) => ({
        id: BigInt(where.id),
        orderNumber: 'LAB-ORD-991',
        patientId: BigInt(mockPatient.id),
        doctorId: BigInt(mockDoctor.id),
        branchId: BigInt(5),
        tests: [
          { name: 'Complete Blood Count (CBC)', priceSnapshot: new Prisma.Decimal(350) },
          { name: 'Serum Creatinine', priceSnapshot: new Prisma.Decimal(250) },
        ],
      })),
    },

    appointment: {
      update: jest.fn(async () => ({})),
    },

    $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
    $queryRaw: jest.fn(async (query: any) => {
      // Return locked invoice mock
      const inv = invoiceStore[invoiceStore.length - 1];
      if (!inv) return [];
      return [
        {
          id: inv.id,
          gross_total: inv.grossTotal,
          amount_received: inv.amountReceived,
          branch_id: inv.branchId,
          organization_id: inv.organizationId,
          status: inv.status,
        },
      ];
    }),
  };

  const mockPatientService: any = {
    findById: jest.fn(async () => mockPatient),
  };

  const mockDoctorService: any = {
    findById: jest.fn(async () => mockDoctor),
  };

  beforeEach(async () => {
    invoiceStore = [];
    itemStore = [];
    paymentStore = [];
    refundStore = [];
    serviceCatalogueStore = [];
    nextInvId = 1;
    nextPayId = 1;
    nextRefId = 1;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PatientService, useValue: mockPatientService },
        { provide: DoctorService, useValue: mockDoctorService },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  describe('1. Sequential Number Generation & Idempotency', () => {
    it('generates sequential invoice numbers with INV- prefix', async () => {
      const inv = await service.create({
        patient: mockPatient.id,
        date: '2026-11-24',
        items: [{ name: 'ECG Procedure', quantity: 1, unit_price: 600 }],
      });
      expect(inv.invoiceNumber).toMatch(/^INV-\d{8}-\d{4}$/);
    });

    it('generates sequential receipt numbers with RCP- prefix upon payment', async () => {
      const inv = await service.create({
        patient: mockPatient.id,
        date: '2026-11-24',
        items: [{ name: 'Consultation', quantity: 1, unit_price: 500 }],
      });

      const updated = await service.recordPayment(inv.id, {
        amount: 500,
        method: 'UPI',
        reference: 'UPI-984210',
      });

      expect(updated.payments[0].receiptNumber).toMatch(/^RCP-\d{8}-\d{4}$/);
      expect(updated.status).toBe('paid');
    });
  });

  describe('2. Refunds & Adjustments Lifecycle', () => {
    it('processes partial and full refunds, updating invoice balance and status', async () => {
      const inv = await service.create({
        patient: mockPatient.id,
        date: '2026-11-24',
        items: [{ name: 'Full Health Package', quantity: 1, unit_price: 2000 }],
      });

      // Collect full payment
      await service.recordPayment(inv.id, { amount: 2000, method: 'Card' });

      // Partial refund of 500
      const afterPartial = await service.processRefund(
        inv.id,
        { amount: 500, reason: 'Patient skipped ultrasound' },
        '99',
      );

      expect(afterPartial.paid).toBe('1500.00');
      expect(afterPartial.balance).toBe('500.00');
      expect(afterPartial.status).toBe('part paid');
      expect(afterPartial.refunds).toHaveLength(1);
      expect(afterPartial.refunds![0].refundNumber).toMatch(/^RFD-\d{8}-\d{4}$/);

      // Settle remaining refund of 1500
      const afterFull = await service.processRefund(
        inv.id,
        { amount: 1500, reason: 'Complete treatment cancelled' },
        '99',
      );

      expect(afterFull.paid).toBe('0.00');
      expect(afterFull.status).toBe('REFUNDED');
      expect(afterFull.refunds).toHaveLength(2);
    });

    it('rejects refund when amount exceeds total collected payments', async () => {
      const inv = await service.create({
        patient: mockPatient.id,
        date: '2026-11-24',
        items: [{ name: 'Lab Test', quantity: 1, unit_price: 400 }],
      });

      await service.recordPayment(inv.id, { amount: 400 });

      await expect(
        service.processRefund(inv.id, { amount: 500, reason: 'Too much' }, '99'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Invoice Cancellation & Voiding', () => {
    it('cancels an unpaid invoice with recorded reason and timestamp', async () => {
      const inv = await service.create({
        patient: mockPatient.id,
        date: '2026-11-24',
        items: [{ name: 'Erroneous Charge', quantity: 1, unit_price: 800 }],
      });

      const cancelled = await service.cancelInvoice(
        inv.id,
        { reason: 'Duplicate billing registered by reception' },
        '99',
      );

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancellationReason).toBe('Duplicate billing registered by reception');
      expect(cancelled.cancelledAt).toBeDefined();
    });

    it('refuses to cancel an invoice with active un-refunded payments', async () => {
      const inv = await service.create({
        patient: mockPatient.id,
        date: '2026-11-24',
        items: [{ name: 'Consultation', quantity: 1, unit_price: 500 }],
      });

      await service.recordPayment(inv.id, { amount: 300 });

      await expect(
        service.cancelInvoice(inv.id, { reason: 'Try cancel' }, '99'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. Clinical Integrations (Consultation & Laboratory)', () => {
    it('idempotently creates an invoice from a clinical consultation', async () => {
      const user = { id: '99', organizationId: '1', branchId: '5' };
      const inv1 = await service.createFromConsultation('55', {}, user);

      expect(inv1.consultationId).toBe('55');
      expect(inv1.grossTotal).toBe('500.00');

      // Duplicate call should return existing invoice without raising duplicate charges
      const inv2 = await service.createFromConsultation('55', {}, user);
      expect(inv2.id).toBe(inv1.id);
      expect(inv2.invoiceNumber).toBe(inv1.invoiceNumber);
    });

    it('idempotently creates an invoice from a laboratory diagnostic order', async () => {
      const user = { id: '99', organizationId: '1', branchId: '5' };
      const inv1 = await service.createFromLabOrder('991', user);

      expect(inv1.grossTotal).toBe('600.00'); // CBC (350) + Creatinine (250)
      expect(inv1.items).toHaveLength(2);

      // Duplicate call should return existing invoice
      const inv2 = await service.createFromLabOrder('991', user);
      expect(inv2.id).toBe(inv1.id);
    });
  });

  describe('5. Service Catalogue & Finance Metrics', () => {
    it('creates and lists service catalogue items with organization scoping', async () => {
      const user = { id: '99', organizationId: '1', branchId: '5' };
      const item = await service.createServiceItem(
        {
          name: 'Physiotherapy Session',
          code: 'PHY-001',
          price: 800,
          kind: 'procedure',
          taxRate: 5,
        },
        user,
      );

      expect(item.name).toBe('Physiotherapy Session');
      expect(item.price).toBe(800);
      expect(item.taxRate).toBe(5);
    });

    it('calculates finance summary metrics correctly', async () => {
      const user = { id: '99', organizationId: '1' };
      const metrics = await service.getFinanceSummary(user, '5', '2026-11-24');

      expect(metrics.date).toBe('2026-11-24');
      expect(metrics.totalInvoicedToday).toBeDefined();
      expect(metrics.totalCollectedToday).toBeDefined();
      expect(metrics.netCollectionsToday).toBeDefined();
    });
  });
});
