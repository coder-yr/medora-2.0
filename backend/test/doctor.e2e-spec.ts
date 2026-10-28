import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { DoctorService } from '../src/modules/doctor/doctor.service';

describe('DoctorModule (e2e)', () => {
  let app: INestApplication;
  let doctorService: DoctorService;
  let adminToken: string;
  let receptionistToken: string;
  let doctorToken: string;
  let createdDoctorId: string;

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

    doctorService = app.get<DoctorService>(DoctorService);
    doctorService.clearMemoryStore();

    // Authenticate Admin (has all permissions including doctor_add, doctor_update, doctor_delete)
    const adminRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'admin.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // Authenticate Receptionist (has doctor_view, but NOT doctor_add or doctor_delete)
    const recepRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'receptionist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    receptionistToken = recepRes.body.data.accessToken;

    // Authenticate Doctor (has doctor_view)
    const docRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'doctor.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    doctorToken = docRes.body.data.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. Unauthenticated request returns 401 Unauthorized', async () => {
    await request(app.getHttpServer()).get('/api/v1/doctors').expect(401);
  });

  it('2. Receptionist without doctor_add receives 403 Forbidden on create', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/doctors')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ name: 'Dr Unauthorized' })
      .expect(403);
  });

  it('3. Admin creates a new doctor with only a name', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/doctors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dr Sana Riaz',
        email: 'sana.riaz@medora.hospital',
        department: 'Cardiology',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Dr Sana Riaz');
    expect(res.body.data.email).toBe('sana.riaz@medora.hospital');
    expect(res.body.data.department).toBe('Cardiology');
    expect(typeof res.body.data.id).toBe('string');
    createdDoctorId = res.body.data.id;
  });

  it('4. Rejects duplicate doctor email with 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/doctors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dr Duplicate',
        email: 'sana.riaz@medora.hospital',
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain(
      'Another doctor is already on file with that email address.',
    );
  });

  it('5. Allows blank email doctors without conflict', async () => {
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/doctors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dr Locum A' })
      .expect(201);

    const res2 = await request(app.getHttpServer())
      .post('/api/v1/doctors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dr Locum B' })
      .expect(201);

    expect(res1.body.data.id).not.toBe(res2.body.data.id);
  });

  it('6. Doctor/Receptionist lists doctors with search filter (200 OK)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/doctors?q=Sana')
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items[0].name).toBe('Dr Sana Riaz');
  });

  it('7. Fetches department suggestions for doctors', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/doctors/departments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toContain('Cardiology');
  });

  it('8. Updates doctor record successfully', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/doctors/${createdDoctorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dr Sana Riaz FCPS',
        phone: '+92 300 9999999',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Dr Sana Riaz FCPS');
    expect(res.body.data.phone).toBe('+92 300 9999999');
  });

  it('9. Rejects deleting doctor when appointments exist on file', async () => {
    // Seed an appointment for this doctor
    doctorService.seedMemoryAppointment(createdDoctorId, 'scheduled');

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/doctors/${createdDoctorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('has appointments on file, so the record stays.');
  });

  it('10. Deleting doctor with zero appointments succeeds', async () => {
    const newDoc = await request(app.getHttpServer())
      .post('/api/v1/doctors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dr Deletable' })
      .expect(201);

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/v1/doctors/${newDoc.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(deleteRes.body.data.message).toContain('Removed Dr Deletable.');
  });
});
