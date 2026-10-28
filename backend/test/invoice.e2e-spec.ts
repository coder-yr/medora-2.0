import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { DoctorService } from '../src/modules/doctor/doctor.service';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { PatientService } from '../src/modules/patient/patient.service';

describe('InvoiceModule (e2e)', () => {
  let app: INestApplication;
  let invoiceService: InvoiceService;
  let patientService: PatientService;
  let doctorService: DoctorService;

  let adminToken: string;
  let accountantToken: string;
  let receptionistToken: string;
  let doctorToken: string;

  let testPatientId: string;
  let testDoctorId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/medora_test?schema=public';
    process.env.DIRECT_URL =
      process.env.DIRECT_URL ||
      'postgresql://postgres:postgres@localhost:5432/medora_test?schema=public';
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'local-test-jwt-secret-minimum-32-characters-required';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    await app.init();

    invoiceService = app.get<InvoiceService>(InvoiceService);
    patientService = app.get<PatientService>(PatientService);
    doctorService = app.get<DoctorService>(DoctorService);

    invoiceService.clearMemory();
    patientService.clearMemoryStore();
    doctorService.clearMemoryStore();

    // Authenticate Admin
    const adminRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'admin.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // Authenticate Accountant
    const accRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'accountant.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    accountantToken = accRes.body.data.accessToken;

    // Authenticate Receptionist
    const recepRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'receptionist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    receptionistToken = recepRes.body.data.accessToken;

    // Authenticate Doctor
    const docRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'doctor.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    doctorToken = docRes.body.data.accessToken;

    // Seed test patient and doctor
    const p = await patientService.create({
      name: 'Bashir Ahmed',
      sex: 'male',
      phone: '+923005557788',
      address: 'Rawalpindi Cantt',
    });
    testPatientId = String(p.id);

    const d = await doctorService.create({
      name: 'Dr. Tariq Jamil',
      email: 'tariq.doc@hospital.test',
      phone: '+923009998877',
      department: 'Orthopedics',
    });
    testDoctorId = String(d.id);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication and RBAC Guards', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/invoices')
        .expect(401);
    });

    it('returns 403 Forbidden for Doctor role lacking invoice permissions', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(403);
    });

    it('returns 403 Forbidden for Receptionist attempting to delete invoice', async () => {
      // Receptionist has invoice_view and invoice_add, but NOT invoice_delete
      await request(app.getHttpServer())
        .delete('/api/v1/invoices/1')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .expect(403);
    });

    it('allows Admin full access to view invoices', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Invoice Creation & Server Total Recalculation', () => {
    it('creates an invoice with items, computing server totals (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patient: Number(testPatientId),
          doctor: Number(testDoctorId),
          date: '2026-10-28',
          items: [
            { name: 'OPD Specialist Consultation', quantity: 1, unit_price: 2000 },
            { name: 'X-Ray Knee AP/Lateral', quantity: 1, unit_price: 1200 },
          ],
          discount: 200,
          vat: 0,
          remarks: 'Initial orthopedic consult',
        })
        .expect(201);

      const invoice = res.body.data;
      expect(invoice.id).toBeDefined();
      expect(invoice.patientId).toBe(testPatientId);
      expect(invoice.subtotal).toBe('3200.00');
      expect(invoice.discount).toBe('200.00');
      expect(invoice.grossTotal).toBe('3000.00');
      expect(invoice.paid).toBe('0.00');
      expect(invoice.balance).toBe('3000.00');
      expect(invoice.status).toBe('unpaid');
      expect(invoice.items).toHaveLength(2);
    });

    it('rejects invoice without charge items with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patient: Number(testPatientId),
          date: '2026-10-28',
          items: [],
        })
        .expect(400);
    });

    it('rejects invoice where discount exceeds subtotal with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patient: Number(testPatientId),
          date: '2026-10-28',
          items: [{ name: 'Bandage', quantity: 1, unit_price: 100 }],
          discount: 150,
        })
        .expect(400);
    });
  });

  describe('Installment Payments, Balance Settlement & Overpayment Rejection', () => {
    let activeInvoiceId: string;

    beforeEach(async () => {
      const created = await invoiceService.create({
        patient: Number(testPatientId),
        date: '2026-10-28',
        items: [{ name: 'Surgical Consultation', quantity: 1, unit_price: 5000 }],
      });
      activeInvoiceId = created.id;
    });

    it('records a partial payment, reduces outstanding balance, and updates status to part paid', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${activeInvoiceId}/pay`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          amount: 2000,
          method: 'Cash',
          reference: 'RCPT-001',
        })
        .expect(200);

      const invoice = res.body.data;
      expect(invoice.paid).toBe('2000.00');
      expect(invoice.balance).toBe('3000.00');
      expect(invoice.status).toBe('part paid');
      expect(invoice.payments).toHaveLength(1);
    });

    it('strictly rejects overpayment beyond outstanding balance (400) and preserves state', async () => {
      // Outstanding balance is 5000. Attempting to pay 5500 must fail.
      const overpayRes = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${activeInvoiceId}/pay`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          amount: 5500,
          method: 'Cash',
        })
        .expect(400);

      expect(overpayRes.body.error.message).toContain('Only 5000.00 is outstanding on this invoice.');

      // Verify that after refusal, balance is completely unchanged
      const fetchRes = await request(app.getHttpServer())
        .get(`/api/v1/invoices/${activeInvoiceId}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      expect(fetchRes.body.data.paid).toBe('0.00');
      expect(fetchRes.body.data.balance).toBe('5000.00');
      expect(fetchRes.body.data.payments).toHaveLength(0);
    });

    it('settles remaining balance with second payment and transitions status to paid', async () => {
      // 1st partial payment: 2000
      await request(app.getHttpServer())
        .post(`/api/v1/invoices/${activeInvoiceId}/pay`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({ amount: 2000, method: 'Cash' })
        .expect(200);

      // 2nd settling payment: 3000
      const settleRes = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${activeInvoiceId}/pay`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({ amount: 3000, method: 'Card', reference: 'CARD-TXN-9988' })
        .expect(200);

      expect(settleRes.body.data.paid).toBe('5000.00');
      expect(settleRes.body.data.balance).toBe('0.00');
      expect(settleRes.body.data.status).toBe('paid');
      expect(settleRes.body.data.payments).toHaveLength(2);
    });
  });

  describe('Deletion Guard & Financial Auditing', () => {
    it('prevents deletion of an invoice with recorded payments (400)', async () => {
      const inv = await invoiceService.create({
        patient: Number(testPatientId),
        date: '2026-10-28',
        items: [{ name: 'Lab Test', quantity: 1, unit_price: 1500 }],
      });

      await invoiceService.recordPayment(inv.id, { amount: 500 });

      const delRes = await request(app.getHttpServer())
        .delete(`/api/v1/invoices/${inv.id}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(400);

      expect(delRes.body.error.message).toContain(
        'Money has been taken against this invoice, so it cannot be deleted.',
      );
    });

    it('allows deletion of unpaid invoice by Accountant (200)', async () => {
      const inv = await invoiceService.create({
        patient: Number(testPatientId),
        date: '2026-10-28',
        items: [{ name: 'Dressing Fee', quantity: 1, unit_price: 300 }],
      });

      await request(app.getHttpServer())
        .delete(`/api/v1/invoices/${inv.id}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      // Should return 404 when looking for deleted invoice
      await request(app.getHttpServer())
        .get(`/api/v1/invoices/${inv.id}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(404);
    });
  });

  describe('Invoice Listing & Filtered Views', () => {
    beforeEach(async () => {
      invoiceService.clearMemory();

      // Create 1 settled invoice: 1000 paid 1000
      const inv1 = await invoiceService.create({
        patient: Number(testPatientId),
        date: '2026-10-28',
        items: [{ name: 'Settled Item', quantity: 1, unit_price: 1000 }],
      });
      await invoiceService.recordPayment(inv1.id, { amount: 1000 });

      // Create 1 partially paid invoice: 2000 paid 500 (balance 1500)
      const inv2 = await invoiceService.create({
        patient: Number(testPatientId),
        date: '2026-10-28',
        items: [{ name: 'Partial Item', quantity: 1, unit_price: 2000 }],
      });
      await invoiceService.recordPayment(inv2.id, { amount: 500 });

      // Create 1 unpaid invoice: 800 paid 0 (balance 800)
      await invoiceService.create({
        patient: Number(testPatientId),
        date: '2026-10-28',
        items: [{ name: 'Unpaid Item', quantity: 1, unit_price: 800 }],
      });
    });

    it('filters by show=outstanding and returns totalOwed', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/invoices?show=outstanding')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const body = res.body.data;
      expect(body.total).toBe(2);
      expect(body.totalOwed).toBe('2300.00'); // 1500 + 800
    });

    it('filters by show=settled', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/invoices?show=settled')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const body = res.body.data;
      expect(body.total).toBe(1);
      expect(body.data[0].status).toBe('paid');
      expect(body.totalOwed).toBe('0.00');
    });

    it('lists all invoices with show=all', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/invoices?show=all')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const body = res.body.data;
      expect(body.total).toBe(3);
      expect(body.totalOwed).toBe('2300.00');
    });
  });
});
