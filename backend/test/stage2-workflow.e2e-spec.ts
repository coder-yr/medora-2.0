import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';

jest.setTimeout(60000);

describe('Stage 2 — End-to-End Hospital Workflow Integration (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let doctorToken: string;
  let accountantToken: string;

  let patientId: string;
  let doctorId: string;
  let appointmentId: string;
  let invoiceId: string;

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

    // Authenticate Admin
    const adminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'admin.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.accessToken;

    // Authenticate Doctor
    const docLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'doctor.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    expect(docLogin.status).toBe(200);
    doctorToken = docLogin.body.data.accessToken;

    // Authenticate Accountant
    const accLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'accountant.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    expect(accLogin.status).toBe(200);
    accountantToken = accLogin.body.data.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('Step 1: Patient Central Registry — Register a new patient without hardcoded IDs', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Fatima Noor',
        fatherName: 'Noor Muhammad',
        sex: 'female',
        birthdate: '1995-04-12',
        phone: '03112233445',
        cnic: '37405-1234567-2',
        bloodGroup: 'B+',
        city: 'Islamabad',
        address: 'House 55, Street 9, Sector F-8',
        mlc: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe('Fatima Noor');
    expect(res.body.data.patientId).toBeDefined();
    patientId = res.body.data.id;
  });

  it('Step 2: Doctor Directory — Create consulting doctor', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/doctors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Dr. Tariq Jamil ${Date.now()}`,
        department: 'Cardiology',
        phone: '+92 321 9876543',
        profile: 'MBBS, FCPS Cardiology, Senior Consultant',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    doctorId = res.body.data.id;
  });

  it('Step 3: Appointments — Query available slots and book consultation', async () => {
    const bookingDate = '2026-11-20';

    const slotRes = await request(app.getHttpServer())
      .get(`/api/v1/appointments/free-slots?doctor=${doctorId}&date=${bookingDate}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(slotRes.status).toBe(200);

    const bookRes = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: patientId,
        doctor: doctorId,
        date: bookingDate,
        start: '10:00',
        minutes: 15,
        status: 'scheduled',
        remarks: 'Cardiology OPD initial checkup',
        b_p: '120/80',
        pulse: '74',
        temprature: '98.6 F',
        weight: '65 kg',
      });

    expect(bookRes.status).toBe(201);
    expect(bookRes.body.success).toBe(true);
    expect(bookRes.body.data.id).toBeDefined();
    expect(bookRes.body.data.patientId).toBe(String(patientId));
    appointmentId = bookRes.body.data.id;
  });

  it('Step 4: Clinical Consultation — Load encounter context and save complete note', async () => {
    // Check-in and transition appointment
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ status: 'in consultation' });

    // Load visit encounter context
    const ctxRes = await request(app.getHttpServer())
      .get(`/api/v1/consultations/visit/${appointmentId}`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(ctxRes.status).toBe(200);
    expect(ctxRes.body.success).toBe(true);
    expect(ctxRes.body.data.patient).toBeDefined();
    expect(ctxRes.body.data.patient.name).toBe('Fatima Noor');

    // Save and complete clinical note
    const saveRes = await request(app.getHttpServer())
      .post(`/api/v1/consultations/visit/${appointmentId}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        action: 'complete',
        presenting_complaint: 'Chest discomfort on exertion for 1 week',
        history: 'Occasional palpitations, no radiating pain or diaphoresis',
        provisional_diagnosis: 'Exertional angina rule out',
        diagnosis: 'Atypical chest discomfort',
        plan: 'Advised ECG, lipid profile, avoid heavy exertion',
        treatment: 'Tab Atenolol 25mg daily, sublingual SOS if needed',
        b_p: '125/82',
        pulse: '76',
        temprature: '98.4 F',
        weight: '65 kg',
        follow_up_date: '2026-11-27',
      });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.success).toBe(true);
  });

  it('Step 5: Prescriptions — Issue outpatient prescription with medicines', async () => {
    const rxRes = await request(app.getHttpServer())
      .post('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: Number(patientId),
        doctorId: Number(doctorId),
        date: '2026-11-20',
        symptom: 'Chest discomfort',
        advice: 'Take medications after meals',
        items: [
          {
            name: 'Atenolol 25mg',
            dosage: '1+0+0',
            duration: '14 days',
            instructions: 'Morning after breakfast',
          },
          {
            name: 'Aspirin 75mg',
            dosage: '0+1+0',
            duration: '14 days',
            instructions: 'After lunch',
          },
        ],
      });

    expect(rxRes.status).toBe(201);
    expect(rxRes.body.success).toBe(true);
    expect(rxRes.body.data.id).toBeDefined();
    expect(rxRes.body.data.items.length).toBe(2);
  });

  it('Step 6: Invoices & Billing — Raise itemized invoice and record installment payment', async () => {
    // Raise Invoice
    const invRes = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: Number(patientId),
        doctor: Number(doctorId),
        date: '2026-11-20',
        discount: 100,
        vat: 0,
        remarks: 'Cardiology consultation and ECG',
        items: [
          {
            name: 'Specialist Cardiology Consultation',
            quantity: 1,
            unit_price: 1500,
          },
          {
            name: '12-Lead Electrocardiogram (ECG)',
            quantity: 1,
            unit_price: 600,
          },
        ],
      });

    expect(invRes.status).toBe(201);
    expect(invRes.body.success).toBe(true);
    expect(invRes.body.data.id).toBeDefined();
    expect(Number(invRes.body.data.grossTotal)).toBe(2000);
    expect(Number(invRes.body.data.balance)).toBe(2000);
    expect(invRes.body.data.status).toBe('unpaid');
    invoiceId = invRes.body.data.id;

    // Record installment payment of Rs. 1200
    const payRes = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({
        amount: 1200,
        method: 'Cash',
        reference: 'RCP-STAGE2-001',
      });

    expect(payRes.status).toBe(200);
    expect(payRes.body.success).toBe(true);
    expect(payRes.body.data.paid).toBe('1200.00');
    expect(payRes.body.data.balance).toBe('800.00');
    expect(payRes.body.data.status).toBe('part paid');

    // Settle remaining balance of Rs. 800
    const payFinalRes = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({
        amount: 800,
        method: 'Card',
        reference: 'POS-TXN-FINAL',
      });

    expect(payFinalRes.status).toBe(200);
    expect(payFinalRes.body.success).toBe(true);
    expect(payFinalRes.body.data.paid).toBe('2000.00');
    expect(payFinalRes.body.data.balance).toBe('0.00');
    expect(payFinalRes.body.data.status).toBe('paid');
  });
});
