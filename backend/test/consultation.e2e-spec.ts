import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { AppointmentService } from '../src/modules/appointment/appointment.service';
import { ConsultationService } from '../src/modules/consultation/consultation.service';
import { DoctorService } from '../src/modules/doctor/doctor.service';
import { PatientService } from '../src/modules/patient/patient.service';

describe('ConsultationModule (e2e)', () => {
  let app: INestApplication;
  let appointmentService: AppointmentService;
  let consultationService: ConsultationService;
  let patientService: PatientService;
  let doctorService: DoctorService;

  let adminToken: string;
  let receptionistToken: string;
  let doctorToken: string;

  let testPatientId: string;
  let testDoctorId: string;
  let testAppointmentId: string;

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

    appointmentService = app.get<AppointmentService>(AppointmentService);
    consultationService = app.get<ConsultationService>(ConsultationService);
    patientService = app.get<PatientService>(PatientService);
    doctorService = app.get<DoctorService>(DoctorService);

    consultationService.clearMemory();
    appointmentService.clearMemory();
    patientService.clearMemoryStore();
    doctorService.clearMemoryStore();

    // Authenticate Admin
    const adminRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'admin.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    adminToken = adminRes.body.data.accessToken;

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

    // Seed test patient, doctor, and appointment
    const p = await patientService.create({
      name: 'Farhan Ali',
      sex: 'male',
      phone: '08012345678',
    });
    testPatientId = p.id;

    const d = await doctorService.create({
      name: 'Dr Sarah Khan',
      department: 'General Medicine',
    });
    testDoctorId = d.id;

    const apt = await appointmentService.create({
      patient: testPatientId,
      doctor: testDoctorId,
      date: '2026-10-28',
      start: '10:00',
    });
    testAppointmentId = apt.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. GET /api/v1/consultations without auth returns 401 Unauthorized', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/consultations')
      .expect(401);
  });

  it('2. GET /api/v1/consultations with Receptionist token (lacks consultation_view) returns 403 Forbidden', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/consultations')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(403);
  });

  it('3. GET /api/v1/consultations/visit/:appointmentId by Doctor returns visit clinical context', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/consultations/visit/${testAppointmentId}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.visit.id).toBe(testAppointmentId);
    expect(res.body.data.consultation.presentingComplaint).toBeNull();
  });

  it('4. POST /api/v1/consultations/visit/:appointmentId with Receptionist token returns 403 Forbidden', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/consultations/visit/${testAppointmentId}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        presenting_complaint: 'Headache',
        action: 'save',
      })
      .expect(403);
  });

  it('5. POST /api/v1/consultations/visit/:appointmentId by Doctor saves draft consultation and updates appointment vitals', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/consultations/visit/${testAppointmentId}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        presenting_complaint: 'Fever and chills for 2 days',
        history: 'High grade, accompanied by body aches',
        examination: { general: ['abnormal', 'Febrile to touch, throat congested'] },
        b_p: '120/80',
        pulse: '88',
        temprature: '38.5',
        weight: '70',
        provisional_diagnosis: 'Acute Viral Pharyngitis',
        plan: 'Paracetamol, oral fluids, rest',
        allergies: 'None reported',
        action: 'save',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.visit.bp).toBe('120/80');
    expect(res.body.data.visit.temperature).toBe('38.5');

    // Verify appointment status updated to 'in consultation' and vitals saved
    const appt = await appointmentService.findOne(testAppointmentId);
    expect(appt.status).toBe('in consultation');
    expect(appt.bp).toBe('120/80');
    expect(appt.pulse).toBe('88');
    expect(appt.temperature).toBe('38.5');
  });

  it('6. POST /api/v1/consultations/visit/:appointmentId by Doctor completes consultation and marks appointment completed', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/consultations/visit/${testAppointmentId}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        presenting_complaint: 'Fever and chills for 2 days',
        diagnosis: 'Acute Viral Pharyngitis',
        treatment: 'Paracetamol 500mg TDS, warm saline gargles',
        action: 'complete',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.completedAt).toBeDefined();

    // Verify appointment status transitioned to completed
    const appt = await appointmentService.findOne(testAppointmentId);
    expect(appt.status).toBe('completed');
  });

  it('7. POST /api/v1/consultations/visit/:appointmentId attempting to overwrite completed note returns 400 Bad Request', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/consultations/visit/${testAppointmentId}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        presenting_complaint: 'Overwriting completed record',
        action: 'save',
      })
      .expect(400);
  });

  it('8. POST /api/v1/consultations/templates creates a clinical note template', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/consultations/templates')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        name: 'ENT Quick Note',
        fields: {
          presenting_complaint: 'Sore throat, difficulty swallowing',
          provisional_diagnosis: 'Streptococcal pharyngitis',
          plan: 'Throat swab, oral penicillin',
        },
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('ENT Quick Note');
    expect(res.body.data.fields.presenting_complaint).toBe('Sore throat, difficulty swallowing');
  });

  it('9. GET /api/v1/consultations/templates lists templates for the doctor', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/consultations/templates')
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('10. GET /api/v1/consultations returns paginated consultations list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/consultations')
      .set('Authorization', `Bearer ${doctorToken}`)
      .query({ date: '2026-10-28', page: 1, limit: 10 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.data)).toBe(true);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
  });

  it('11. GET /api/v1/consultations/:id/print returns printable consultation view', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/consultations')
      .set('Authorization', `Bearer ${doctorToken}`)
      .query({ date: '2026-10-28' });

    const consultationId = listRes.body.data.data[0].id;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/consultations/${consultationId}/print`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(consultationId);
    expect(res.body.data.patient.name).toBe('Farhan Ali');
    expect(res.body.data.doctor.name).toBe('Dr Sarah Khan');
  });

  it('12. GET /api/v1/consultations with Admin token returns 200 OK (all permissions granted)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/consultations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});

