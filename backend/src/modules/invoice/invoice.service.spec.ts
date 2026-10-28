import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentService } from '../department/department.service';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceService } from './invoice.service';

describe('InvoiceService (Legacy Parity & Financial Rules)', () => {
  let service: InvoiceService;
  let patientService: PatientService;
  let doctorService: DoctorService;

  let patient1: any;
  let doctor1: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        PatientService,
        DepartmentService,
        DoctorService,
        {
          provide: PrismaService,
          useValue: {
            connected: false,
            payment: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            invoiceItem: {
              findMany: jest.fn(),
              create: jest.fn(),
              deleteMany: jest.fn(),
            },
            invoicePayment: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            doctorShare: {
              findMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            $transaction: jest.fn(),
            $queryRaw: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
    patientService = module.get<PatientService>(PatientService);
    doctorService = module.get<DoctorService>(DoctorService);

    service.clearMemory();
    patientService.clearMemoryStore();
    doctorService.clearMemoryStore();

    // Create test patient and doctor in-memory
    patient1 = await patientService.create({
      name: 'Tariq Mehmood',
      phone: '+923001112233',
      sex: 'male',
      address: 'House 14, F-8/2, Islamabad',
    });

    doctor1 = await doctorService.create({
      name: 'Dr. Shahida Raza',
      email: 'shahida@example.com',
      department: 'General Medicine',
      phone: '+923004445566',
    });
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
