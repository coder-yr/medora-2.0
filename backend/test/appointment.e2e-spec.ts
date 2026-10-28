import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { AppointmentService } from '../src/modules/appointment/appointment.service';
import { DoctorService } from '../src/modules/doctor/doctor.service';
import { PatientService } from '../src/modules/patient/patient.service';

describe('AppointmentModule (e2e)', () => {
  let app: INestApplication;
  let appointmentService: AppointmentService;
  let patientService: PatientService;
  let doctorService: DoctorService;

  let adminToken: string;
  let receptionistToken: string;
  let doctorToken: string;

  let testPatientId: string;
  let testDoctorId: string;
  let createdAppointmentId: string;

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
    patientService = app.get<PatientService>(PatientService);
    doctorService = app.get<DoctorService>(DoctorService);

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

    // Seed test patient and doctor
    const p = await patientService.create({ name: 'Amina Yousaf' });
    testPatientId = p.id;

    const d = await doctorService.create({ name: 'Dr Nadia Aslam', department: 'Cardiology' });
    testDoctorId = d.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. GET /api/v1/appointments without auth returns 401 Unauthorized', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .expect(401);
  });

  it('2. POST /api/v1/appointments with doctor token (lacks appointment_add) returns 403 Forbidden', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patient: testPatientId,
        doctor: testDoctorId,
        date: '2026-10-01',
        start: '09:00',
      })
      .expect(403);
  });

  it('3. POST /api/v1/appointments by Receptionist books appointment (201 Created)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        patient: testPatientId,
        doctor: testDoctorId,
        date: '2026-10-01',
        start: '09:00',
        minutes: 30,
        remarks: 'Cardiology checkup',
        video: true,
      })
      .expect(201);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.sTime).toBe('2026-10-01 09:00:00');
    expect(res.body.data.eTime).toBe('2026-10-01 09:30:00');
    expect(res.body.data.timeSlot).toBe('09:00 - 09:30');
    expect(res.body.data.mode).toBe('video');
    expect(res.body.data.videoRoom).toMatch(/^icthospital-/);
    expect(res.body.data.patient.name).toBe('Amina Yousaf');
    expect(res.body.data.doctor.name).toBe('Dr Nadia Aslam');

    createdAppointmentId = res.body.data.id;
  });

  it('4. POST /api/v1/appointments refuses double-booking overlapping slot (400 Bad Request)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        patient: testPatientId,
        doctor: testDoctorId,
        date: '2026-10-01',
        start: '09:15',
        minutes: 30,
      })
      .expect(400);

    expect(res.body.error.message).toContain('already booked');
  });

  it('5. POST /api/v1/appointments allows back-to-back appointment (201 Created)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        patient: testPatientId,
        doctor: testDoctorId,
        date: '2026-10-01',
        start: '09:30',
        minutes: 30,
      })
      .expect(201);

    expect(res.body.data.sTime).toBe('2026-10-01 09:30:00');
  });

  it('6. GET /api/v1/appointments lists day-view appointments filterable by date', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/appointments?date=2026-10-01')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(200);

    expect(res.body.data.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.data[0].date).toBe('2026-10-01');
  });

  it('7. GET /api/v1/appointments/:id returns single appointment with details', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/appointments/${createdAppointmentId}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    expect(res.body.data.id).toBe(createdAppointmentId);
    expect(res.body.data.patient.name).toBe('Amina Yousaf');
    expect(res.body.data.doctor.name).toBe('Dr Nadia Aslam');
  });

  it('8. PATCH /api/v1/appointments/:id updates appointment status and vitals', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${createdAppointmentId}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        status: 'arrived',
        b_p: '120/80',
        pulse: '72',
      })
      .expect(200);

    expect(res.body.data.status).toBe('arrived');
    expect(res.body.data.bp).toBe('120/80');
    expect(res.body.data.pulse).toBe('72');
  });

  it('9. GET /api/v1/appointments/free-slots returns free consultation slots', async () => {
    // Add slot from 11:00 to 12:00
    appointmentService.addTestSlot({
      doctorId: testDoctorId,
      weekday: 4, // 2026-10-01 is Thursday
      startTime: '11:00',
      endTime: '12:00',
      slotMinutes: 15,
      active: true,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/appointments/free-slots?doctor=${testDoctorId}&date=2026-10-01`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((s: any) => s.start === '11:00')).toBe(true);
  });

  it('10. DELETE /api/v1/appointments/:id deletes appointment record (tested with Admin)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/appointments/${createdAppointmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/appointments/${createdAppointmentId}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(404);
  });
});
