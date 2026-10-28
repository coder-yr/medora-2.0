import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';

describe('PatientModule (e2e)', () => {
  let app: INestApplication;
  let receptionistToken: string;
  let doctorToken: string;
  let adminToken: string;
  let createdPatientId: string;

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

    // Authenticate Receptionist (Has patient_view, patient_add, patient_update, but NOT patient_delete)
    const recepRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'receptionist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    receptionistToken = recepRes.body.data.accessToken;

    // Authenticate Doctor (Has patient_view, but NOT patient_add or patient_delete)
    const docRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'doctor.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    doctorToken = docRes.body.data.accessToken;

    // Authenticate Admin (Has all permissions including patient_delete)
    const adminRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'admin.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    adminToken = adminRes.body.data.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/v1/patients without token -> 401 Unauthorized', () => {
    return request(app.getHttpServer()).get('/api/v1/patients').expect(401);
  });

  it('POST /api/v1/patients as Receptionist -> 201 Created with sequential ID and derived age', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        name: 'Amina Yousaf',
        birthdate: '1990-05-15',
        phone: '03001234567',
        sex: 'female',
        bloodGroup: 'O+',
        cnic: '35201-1234567-1',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Amina Yousaf');
    expect(res.body.data.patientId).toBe('000001');
    expect(Number(res.body.data.age)).toBeGreaterThanOrEqual(33);
    expect(res.body.data.cnic).toBe('35201-1234567-1');

    createdPatientId = res.body.data.id;
  });

  it('POST /api/v1/patients rejects missing name -> 400 Bad Request', () => {
    return request(app.getHttpServer())
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        phone: '03001234567',
      })
      .expect(400);
  });

  it('GET /api/v1/patients as Doctor -> 200 OK list with search filter', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/patients?q=Amina')
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items[0].name).toBe('Amina Yousaf');
  });

  it('GET /api/v1/patients/:id as Doctor -> 200 OK patient record', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/patients/${createdPatientId}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Amina Yousaf');
  });

  it('PUT /api/v1/patients/:id as Receptionist -> 200 OK updates record', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/patients/${createdPatientId}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        address: 'Updated Address, Islamabad',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.address).toBe('Updated Address, Islamabad');
  });

  it('DELETE /api/v1/patients/:id as Receptionist -> 403 Forbidden (Insufficient permissions)', () => {
    return request(app.getHttpServer())
      .delete(`/api/v1/patients/${createdPatientId}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(403)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.statusCode).toBe(403);
      });
  });

  it('DELETE /api/v1/patients/:id as Admin -> 200 OK deletes patient record', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/patients/${createdPatientId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('Deleted patient');
  });
});
