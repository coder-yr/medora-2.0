import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as dotenv from 'dotenv';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { AppointmentService } from '../src/modules/appointment/appointment.service';
import { ConsultationService } from '../src/modules/consultation/consultation.service';
import { DoctorService } from '../src/modules/doctor/doctor.service';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { PatientService } from '../src/modules/patient/patient.service';

dotenv.config();
jest.setTimeout(45000);

describe('PostgreSQL Concurrency & Data Integrity Integration Tests', () => {
  let app: INestApplication;
  let invoiceService: InvoiceService;
  let appointmentService: AppointmentService;
  let patientService: PatientService;
  let doctorService: DoctorService;
  let consultationService: ConsultationService;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    await app.init();

    invoiceService = app.get<InvoiceService>(InvoiceService);
    appointmentService = app.get<AppointmentService>(AppointmentService);
    patientService = app.get<PatientService>(PatientService);
    doctorService = app.get<DoctorService>(DoctorService);
    consultationService = app.get<ConsultationService>(ConsultationService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('6.1 Invoice Concurrency & Pessimistic Row Locking', () => {
    it('prevents double-spending and overpayment race conditions with SELECT FOR UPDATE', async () => {
      // 1. Create a test patient and doctor
      const patient = await patientService.create({
        name: 'Concurrent Test Patient ' + Date.now(),
        phone: '+923001234567',
      });
      const doctor = await doctorService.create({
        name: 'Dr Concurrency ' + Date.now(),
      });

      // 2. Create invoice for 1000.00
      const invoice = await invoiceService.create({
        patient: Number(patient.id),
        doctor: Number(doctor.id),
        date: '2026-10-30',
        items: [{ name: 'Surgical Consultation', quantity: 1, unit_price: 1000 }],
      });

      expect(invoice.grossTotal).toBe('1000.00');
      expect(invoice.balance).toBe('1000.00');

      // 3. Fire two simultaneous payments of 600 each using Promise.allSettled
      // Total invoice is 1000. If concurrency fails, both would record and paid would be 1200 (overpayment).
      // With pessimistic lock, exactly one must succeed and one must be rejected.
      const [res1, res2] = await Promise.allSettled([
        invoiceService.recordPayment(invoice.id, {
          amount: 600,
          method: 'Cash',
          reference: 'THREAD-A',
        }),
        invoiceService.recordPayment(invoice.id, {
          amount: 600,
          method: 'Card',
          reference: 'THREAD-B',
        }),
      ]);

      const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      // Verify rejection error was exact business error
      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectionReason).toBeInstanceOf(BadRequestException);
      expect(rejectionReason.message).toContain('is outstanding on this invoice');

      // 4. Inspect final invoice balance in PostgreSQL: exactly 600 paid, 400 balance
      const finalInvoice = await invoiceService.findOne(invoice.id);
      expect(finalInvoice.paid).toBe('600.00');
      expect(finalInvoice.balance).toBe('400.00');
      expect(finalInvoice.status).toBe('part paid');
      expect(finalInvoice.payments).toHaveLength(1);
    });
  });

  describe('6.2 Appointment Concurrency & Doctor Row Lock', () => {
    it('prevents overlapping double-booking race conditions using doctor row lock', async () => {
      // 1. Create a test patient and doctor
      const patientA = await patientService.create({ name: 'Patient A ' + Date.now() });
      const patientB = await patientService.create({ name: 'Patient B ' + Date.now() });
      const doctor = await doctorService.create({ name: 'Dr Slot Lock ' + Date.now() });

      // 2. Fire two simultaneous bookings for the exact same doctor and timeslot
      const testDate = '2026-11-15';
      const testStart = '10:00';
      const testMinutes = 30;

      const [book1, book2] = await Promise.allSettled([
        appointmentService.create({
          patient: patientA.id,
          doctor: doctor.id,
          date: testDate,
          start: testStart,
          minutes: testMinutes,
        }),
        appointmentService.create({
          patient: patientB.id,
          doctor: doctor.id,
          date: testDate,
          start: testStart,
          minutes: testMinutes,
        }),
      ]);

      const fulfilled = [book1, book2].filter((r) => r.status === 'fulfilled');
      const rejected = [book1, book2].filter((r) => r.status === 'rejected');

      // Exactly one succeeds, the other is strictly rejected by the pessimistic doctor row lock check
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectionReason).toBeInstanceOf(BadRequestException);
      expect(rejectionReason.message).toContain('already booked');
    });
  });

  describe('6.3 Patient MRN Sequence Durability & Monotonicity', () => {
    it('ensures patient_mrn_seq persists across transactions and never reuses deleted IDs', async () => {
      // 1. Create patient P1
      const p1 = await patientService.create({ name: 'MRN Test 1 ' + Date.now() });
      expect(p1.patientId).toMatch(/^\d{6}$/);

      const num1 = parseInt(p1.patientId, 10);

      // 2. Create patient P2
      const p2 = await patientService.create({ name: 'MRN Test 2 ' + Date.now() });
      const num2 = parseInt(p2.patientId, 10);
      expect(num2).toBe(num1 + 1);

      // 3. Delete patient P2
      await patientService.remove(p2.id);

      // 4. Create patient P3
      const p3 = await patientService.create({ name: 'MRN Test 3 ' + Date.now() });
      const num3 = parseInt(p3.patientId, 10);

      // Monotonic sequence guarantee: num3 MUST be num2 + 1, never recycled back to num2
      expect(num3).toBe(num2 + 1);

      // Clean up
      await patientService.remove(p1.id).catch(() => null);
      await patientService.remove(p3.id).catch(() => null);
    });
  });

  describe('6.4 Consultation 1:1 Constraint & Completed Immutability', () => {
    it('enforces 1:1 constraint between consultation and appointment, and guarantees record immutability once completed', async () => {
      // 1. Create patient, doctor, and appointment
      const patient = await patientService.create({ name: 'Consult Patient ' + Date.now() });
      const doctor = await doctorService.create({ name: 'Dr Consult ' + Date.now() });
      const appt = await appointmentService.create({
        patient: patient.id,
        doctor: doctor.id,
        date: '2026-11-20',
        start: '14:00',
        minutes: 30,
      });

      // 2. Save initial draft consultation
      const draft = await consultationService.saveVisitConsultation(appt.id, {
        presenting_complaint: 'Fever and body aches',
        history: 'Symptoms started 2 days ago',
        provisional_diagnosis: 'Viral syndrome',
        action: 'save',
      });

      expect(draft.id).toBeDefined();
      expect(draft.status).toBe('draft');
      expect(draft.appointmentId).toBe(String(appt.id));

      // 3. Complete the consultation
      const completed = await consultationService.saveVisitConsultation(appt.id, {
        presenting_complaint: 'Fever and body aches',
        diagnosis: 'Dengue Fever confirmed',
        treatment: 'Paracetamol 500mg TDS, oral rehydration',
        action: 'complete',
      });

      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();

      // 4. Verify completed consultation is IMMUTABLE: subsequent save must be rejected
      await expect(
        consultationService.saveVisitConsultation(appt.id, {
          presenting_complaint: 'Attempting illegal alteration',
          action: 'save',
        }),
      ).rejects.toThrow(new BadRequestException('Cannot modify a completed consultation record.'));
    });
  });
});
