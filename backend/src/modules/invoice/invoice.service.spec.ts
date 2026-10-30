import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceService } from './invoice.service';

describe('InvoiceService (Legacy Parity & Financial Rules)', () => {
  let service: InvoiceService;

  let patient1: any;
  let doctor1: any;

  // In-test simulated DB storage
  let paymentsStore: any[] = [];
  let itemsStore: any[] = [];
  let receiptsStore: any[] = [];
  let nextPaymentId = 1;
  let nextItemId = 1;
  let nextReceiptId = 1;

  const mockPrisma: any = {
    payment: {
      create: jest.fn(async ({ data }: any) => {
        const id = BigInt(nextPaymentId++);
        const rec = {
          id,
          uuid: `inv-${id}`,
          patientId: data.patientId,
          doctor: data.doctor ?? null,
          referringDoctor: data.referringDoctor ?? null,
          hospitalBranchId: data.hospitalBranchId ?? null,
          date: data.date,
          dateString: data.dateString || data.date,
          amount: new Prisma.Decimal(data.amount || 0),
          discount: new Prisma.Decimal(data.discount || 0),
          vat: new Prisma.Decimal(data.vat || 0),
          grossTotal: new Prisma.Decimal(data.grossTotal || 0),
          amountReceived: new Prisma.Decimal(0),
          status: data.status || 'unpaid',
          remarks: data.remarks ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        if (data.items?.create) {
          for (const it of data.items.create) {
            const itemId = BigInt(nextItemId++);
            itemsStore.push({
              id: itemId,
              paymentId: id,
              paymentCategoryId: it.paymentCategoryId ? BigInt(it.paymentCategoryId) : null,
              doctorId: it.doctorId ? BigInt(it.doctorId) : null,
              name: it.name,
              quantity: it.quantity,
              unitPrice: new Prisma.Decimal(it.unitPrice),
              lineTotal: new Prisma.Decimal(it.lineTotal),
            });
          }
        }

        paymentsStore.push(rec);

        return {
          ...rec,
          patient: {
            id: rec.patientId,
            patientId: 'MRN-001',
            name: 'Tariq Mehmood',
            phone: '+923001112233',
          },
          doctor: rec.doctor
            ? {
                id: rec.doctor,
                name: 'Dr. Shahida Raza',
                department: 'General Medicine',
              }
            : null,
          items: itemsStore.filter((i) => i.paymentId === id),
          payments: receiptsStore.filter((r) => r.paymentId === id),
          doctorShares: [],
        };
      }),

      findUnique: jest.fn(async ({ where }: any) => {
        const id = BigInt(where.id);
        const rec = paymentsStore.find((p) => p.id === id);
        if (!rec) return null;
        return {
          ...rec,
          patient: {
            id: rec.patientId,
            patientId: 'MRN-001',
            name: 'Tariq Mehmood',
            phone: '+923001112233',
          },
          doctor: rec.doctor
            ? {
                id: rec.doctor,
                name: 'Dr. Shahida Raza',
                department: 'General Medicine',
              }
            : null,
          items: itemsStore.filter((i) => i.paymentId === id),
          payments: receiptsStore.filter((r) => r.paymentId === id),
          doctorShares: [],
        };
      }),

      findMany: jest.fn(async ({ where, skip = 0, take = 50 }: any) => {
        let list = [...paymentsStore];
        if (where?.status?.in) {
          list = list.filter((p) => where.status.in.includes(p.status));
        } else if (where?.status) {
          list = list.filter((p) => p.status === where.status);
        }
        const slice = list.slice(skip, skip + take);
        return slice.map((rec) => ({
          ...rec,
          patient: {
            id: rec.patientId,
            patientId: 'MRN-001',
            name: 'Tariq Mehmood',
            phone: '+923001112233',
          },
          doctor: rec.doctor
            ? {
                id: rec.doctor,
                name: 'Dr. Shahida Raza',
                department: 'General Medicine',
              }
            : null,
          items: itemsStore.filter((i) => i.paymentId === rec.id),
          payments: receiptsStore.filter((r) => r.paymentId === rec.id),
          doctorShares: [],
        }));
      }),

      count: jest.fn(async ({ where }: any) => {
        let list = [...paymentsStore];
        if (where?.status?.in) {
          list = list.filter((p) => where.status.in.includes(p.status));
        } else if (where?.status) {
          list = list.filter((p) => p.status === where.status);
        }
        return list.length;
      }),

      aggregate: jest.fn(async ({ where }: any) => {
        let list = [...paymentsStore];
        if (where?.status?.in) {
          list = list.filter((p) => where.status.in.includes(p.status));
        } else if (where?.status) {
          list = list.filter((p) => p.status === where.status);
        }

        const totalGross = list.reduce(
          (sum, p) => sum + Number(p.grossTotal),
          0,
        );
        const totalReceived = list.reduce(
          (sum, p) => sum + Number(p.amountReceived),
          0,
        );

        return {
          _sum: {
            grossTotal: new Prisma.Decimal(totalGross),
            amountReceived: new Prisma.Decimal(totalReceived),
          },
        };
      }),

      update: jest.fn(async ({ where, data }: any) => {
        const id = BigInt(where.id);
        const idx = paymentsStore.findIndex((p) => p.id === id);
        if (idx === -1) throw new NotFoundException('Not found');

        const cur = paymentsStore[idx];
        const updated = {
          ...cur,
          ...data,
          updatedAt: new Date(),
        };
        paymentsStore[idx] = updated;

        return {
          ...updated,
          patient: {
            id: updated.patientId,
            patientId: 'MRN-001',
            name: 'Tariq Mehmood',
            phone: '+923001112233',
          },
          doctor: updated.doctor
            ? {
                id: updated.doctor,
                name: 'Dr. Shahida Raza',
                department: 'General Medicine',
              }
            : null,
          items: itemsStore.filter((i) => i.paymentId === id),
          payments: receiptsStore.filter((r) => r.paymentId === id),
          doctorShares: [],
        };
      }),

      delete: jest.fn(async ({ where }: any) => {
        const id = BigInt(where.id);
        paymentsStore = paymentsStore.filter((p) => p.id !== id);
        return {};
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => {
        const id = BigInt(where.id);
        const rec = paymentsStore.find((p) => p.id === id);
        if (!rec) throw new NotFoundException('Not found');
        return {
          ...rec,
          patient: {
            id: rec.patientId,
            patientId: 'MRN-001',
            name: 'Tariq Mehmood',
            phone: '+923001112233',
          },
          doctor: rec.doctor
            ? {
                id: rec.doctor,
                name: 'Dr. Shahida Raza',
                department: 'General Medicine',
              }
            : null,
          items: itemsStore.filter((i) => i.paymentId === id),
          payments: receiptsStore.filter((r) => r.paymentId === id),
          doctorShares: [],
        };
      }),
    },

    invoiceItem: {
      create: jest.fn(async ({ data }: any) => {
        const id = BigInt(nextItemId++);
        const it = {
          id,
          paymentId: BigInt(data.paymentId),
          paymentCategoryId: data.paymentCategoryId ? BigInt(data.paymentCategoryId) : null,
          doctorId: data.doctorId ? BigInt(data.doctorId) : null,
          name: data.name,
          quantity: data.quantity,
          unitPrice: new Prisma.Decimal(data.unitPrice),
          lineTotal: new Prisma.Decimal(data.lineTotal),
        };
        itemsStore.push(it);
        return it;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const id = BigInt(where.paymentId);
        itemsStore = itemsStore.filter((i) => i.paymentId !== id);
        return { count: 1 };
      }),
    },

    invoicePayment: {
      create: jest.fn(async ({ data }: any) => {
        const id = BigInt(nextReceiptId++);
        const receipt = {
          id,
          paymentId: BigInt(data.paymentId),
          amount: new Prisma.Decimal(data.amount),
          method: data.method || 'Cash',
          reference: data.reference ?? null,
          paidAt: data.paidAt || new Date().toISOString().split('T')[0],
          receivedBy: data.receivedBy ? BigInt(data.receivedBy) : null,
          createdAt: new Date(),
        };
        receiptsStore.push(receipt);
        return receipt;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const pid = BigInt(where.paymentId);
        return receiptsStore.filter((r) => r.paymentId === pid);
      }),
    },

    doctorShare: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },

    $queryRaw: jest.fn(async (sqlObj: any) => {
      const idArg = sqlObj?.values?.[0];
      const id = idArg !== undefined ? BigInt(idArg) : paymentsStore[0]?.id;
      const target = paymentsStore.find((p) => p.id === id);
      if (target) {
        return [{ id: target.id, gross_total: target.grossTotal.toString() }];
      }
      return [];
    }),

    $transaction: jest.fn(async (cb: any) => {
      return cb(mockPrisma);
    }),
  };

  const mockPatientService = {
    findById: jest.fn(async (id: any) => {
      if (String(id) === String(patient1.id)) {
        return patient1;
      }
      return null;
    }),
  };

  const mockDoctorService = {
    findById: jest.fn(async (id: any) => {
      if (String(id) === String(doctor1.id)) {
        return doctor1;
      }
      return null;
    }),
  };

  beforeEach(async () => {
    paymentsStore = [];
    itemsStore = [];
    receiptsStore = [];
    nextPaymentId = 1;
    nextItemId = 1;
    nextReceiptId = 1;

    patient1 = {
      id: '1',
      name: 'Tariq Mehmood',
      patientId: 'MRN-001',
      phone: '+923001112233',
      sex: 'male',
      address: 'House 14, F-8/2, Islamabad',
    };

    doctor1 = {
      id: '1',
      name: 'Dr. Shahida Raza',
      email: 'shahida@example.com',
      department: 'General Medicine',
      phone: '+923004445566',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: PatientService,
          useValue: mockPatientService,
        },
        {
          provide: DoctorService,
          useValue: mockDoctorService,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  describe('Invoice Creation & Server Calculations', () => {
    it('creates an invoice with multiple items, calculating subtotal and gross total', async () => {
      const invoice = await service.create({
        patient: Number(patient1.id),
        doctor: Number(doctor1.id),
        date: '2026-10-28',
        items: [
          { name: 'Consultation Fee', quantity: 1, unit_price: 1500 },
          { name: 'ECG Procedure', quantity: 2, unit_price: 600 },
        ],
        discount: 200,
        vat: 50,
      });

      expect(invoice.id).toBeDefined();
      expect(invoice.patientId).toBe(String(patient1.id));
      expect(invoice.doctorId).toBe(String(doctor1.id));
      expect(invoice.subtotal).toBe('2700.00'); // 1500 + 1200
      expect(invoice.discount).toBe('200.00');
      expect(invoice.vat).toBe('50.00');
      expect(invoice.grossTotal).toBe('2550.00'); // 2700 - 200 + 50
      expect(invoice.paid).toBe('0.00');
      expect(invoice.balance).toBe('2550.00');
      expect(invoice.status).toBe('unpaid');
      expect(invoice.items).toHaveLength(2);
      expect(invoice.items[0].lineTotal).toBe('1500.00');
      expect(invoice.items[1].lineTotal).toBe('1200.00');
    });

    it('rejects invoice without charge items', async () => {
      await expect(
        service.create({
          patient: Number(patient1.id),
          date: '2026-10-28',
          items: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects discount exceeding subtotal', async () => {
      await expect(
        service.create({
          patient: Number(patient1.id),
          date: '2026-10-28',
          items: [{ name: 'Lab Test', quantity: 1, unit_price: 500 }],
          discount: 600, // greater than 500
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects negative discount or VAT', async () => {
      await expect(
        service.create({
          patient: Number(patient1.id),
          date: '2026-10-28',
          items: [{ name: 'Consultation', quantity: 1, unit_price: 1000 }],
          discount: -50,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({
          patient: Number(patient1.id),
          date: '2026-10-28',
          items: [{ name: 'Consultation', quantity: 1, unit_price: 1000 }],
          vat: -20,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects negative unit price', async () => {
      await expect(
        service.create({
          patient: Number(patient1.id),
          date: '2026-10-28',
          items: [{ name: 'Discount item', quantity: 1, unit_price: -100 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-existent patient or doctor', async () => {
      await expect(
        service.create({
          patient: 99999,
          date: '2026-10-28',
          items: [{ name: 'Fee', quantity: 1, unit_price: 100 }],
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.create({
          patient: Number(patient1.id),
          doctor: 88888,
          date: '2026-10-28',
          items: [{ name: 'Fee', quantity: 1, unit_price: 100 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('preserves decimal financial precision without JavaScript float drift', async () => {
      // 0.10 + 0.20 float drift check
      const invoice = await service.create({
        patient: Number(patient1.id),
        date: '2026-10-28',
        items: [
          { name: 'Item 1', quantity: 1, unit_price: 0.1 },
          { name: 'Item 2', quantity: 1, unit_price: 0.2 },
        ],
      });

      expect(invoice.subtotal).toBe('0.30');
      expect(invoice.grossTotal).toBe('0.30');
      expect(invoice.balance).toBe('0.30');
    });
  });

  describe('Installment Payments & Settlement Lifecycle', () => {
    it('handles partial payment, transitions status to "part paid", and tracks remaining balance', async () => {
      const invoice = await service.create({
        patient: Number(patient1.id),
        date: '2026-10-28',
        items: [{ name: 'Procedure', quantity: 1, unit_price: 1000 }],
      });

      const updated = await service.recordPayment(invoice.id, {
        amount: 400,
        method: 'Cash',
        reference: 'REC-001',
      });

      expect(updated.grossTotal).toBe('1000.00');
      expect(updated.paid).toBe('400.00');
      expect(updated.balance).toBe('600.00');
      expect(updated.status).toBe('part paid');
      expect(updated.payments).toHaveLength(1);
      expect(updated.payments[0].amount).toBe('400.00');
      expect(updated.payments[0].method).toBe('Cash');
    });

    it('settles invoice upon full balance payment and marks status as "paid"', async () => {
      const invoice = await service.create({
        patient: Number(patient1.id),
        date: '2026-10-28',
        items: [{ name: 'Consultation', quantity: 1, unit_price: 1500 }],
      });

      // 1st partial payment
      await service.recordPayment(invoice.id, { amount: 500 });
      // 2nd settling payment
      const settled = await service.recordPayment(invoice.id, { amount: 1000 });

      expect(settled.paid).toBe('1500.00');
      expect(settled.balance).toBe('0.00');
      expect(settled.status).toBe('paid');
      expect(settled.payments).toHaveLength(2);
    });

    it('strictly refuses overpayment with exact legacy error message format', async () => {
      const invoice = await service.create({
        patient: Number(patient1.id),
        date: '2026-10-28',
        items: [{ name: 'Consultation', quantity: 1, unit_price: 1000 }],
      });

      await service.recordPayment(invoice.id, { amount: 600 });

      // Outstanding is 400.00. Trying to pay 500 should be rejected.
      await expect(
        service.recordPayment(invoice.id, { amount: 500 }),
      ).rejects.toThrow(BadRequestException);

      // Verify that after refused payment, balance remains unchanged at 400.00
      const current = await service.findOne(invoice.id);
      expect(current.paid).toBe('600.00');
      expect(current.balance).toBe('400.00');
      expect(current.payments).toHaveLength(1);
    });

    it('rejects zero or negative payment amounts', async () => {
      const invoice = await service.create({
        patient: Number(patient1.id),
        date: '2026-10-28',
        items: [{ name: 'Consultation', quantity: 1, unit_price: 500 }],
      });

      await expect(service.recordPayment(invoice.id, { amount: 0 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.recordPayment(invoice.id, { amount: -50 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Deletion Guard & Financial Auditing', () => {
    it('prevents deletion if any money has been taken against the invoice', async () => {
      const invoice = await service.create({
        patient: Number(patient1.id),
        date: '2026-10-28',
        items: [{ name: 'Consultation', quantity: 1, unit_price: 1000 }],
      });

      await service.recordPayment(invoice.id, { amount: 200 });

      await expect(service.remove(invoice.id)).rejects.toThrow(
        'Money has been taken against this invoice, so it cannot be deleted.',
      );

      // Verify invoice is still present
      const invoiceStillExists = await service.findOne(invoice.id);
      expect(invoiceStillExists).toBeDefined();
    });

    it('allows deletion of unpaid invoice with no payments taken', async () => {
      const invoice = await service.create({
        patient: Number(patient1.id),
        date: '2026-10-28',
        items: [{ name: 'Test item', quantity: 1, unit_price: 500 }],
      });

      const res = await service.remove(invoice.id);
      expect(res.success).toBe(true);

      await expect(service.findOne(invoice.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Listing & Filtered Views', () => {
    it('filters outstanding vs settled invoices and accurately sums totalOwed', async () => {
      // Invoice 1: 1000, paid 1000 (settled)
      const inv1 = await service.create({
        patient: Number(patient1.id),
        date: '2026-10-28',
        items: [{ name: 'Service 1', quantity: 1, unit_price: 1000 }],
      });
      await service.recordPayment(inv1.id, { amount: 1000 });

      // Invoice 2: 2000, paid 500 (outstanding: 1500)
      const inv2 = await service.create({
        patient: Number(patient1.id),
        date: '2026-10-28',
        items: [{ name: 'Service 2', quantity: 1, unit_price: 2000 }],
      });
      await service.recordPayment(inv2.id, { amount: 500 });

      // Invoice 3: 500, paid 0 (outstanding: 500)
      await service.create({
        patient: Number(patient1.id),
        date: '2026-10-28',
        items: [{ name: 'Service 3', quantity: 1, unit_price: 500 }],
      });

      // 1. Outstanding view
      const outstandingRes = await service.findAll({ show: 'outstanding' });
      expect(outstandingRes.total).toBe(2);
      expect(outstandingRes.totalOwed).toBe('2000.00'); // 1500 + 500

      // 2. Settled view
      const settledRes = await service.findAll({ show: 'settled' });
      expect(settledRes.total).toBe(1);
      expect(settledRes.data[0].id).toBe(inv1.id);
      expect(settledRes.totalOwed).toBe('0.00');

      // 3. All view
      const allRes = await service.findAll({ show: 'all' });
      expect(allRes.total).toBe(3);
      expect(allRes.totalOwed).toBe('2000.00');
    });
  });
});
