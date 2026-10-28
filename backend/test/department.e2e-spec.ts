import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { DepartmentService } from '../src/modules/department/department.service';

describe('DepartmentModule (e2e)', () => {
  let app: INestApplication;
  let departmentService: DepartmentService;
  let adminToken: string;
  let receptionistToken: string;
  let createdDeptId: string;

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

    departmentService = app.get<DepartmentService>(DepartmentService);
    departmentService.clearMemoryStore();

    // Authenticate Admin (has all permissions including department_add, department_update, department_delete)
    const adminRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'admin.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // Authenticate Receptionist (lacks department permissions)
    const recepRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'receptionist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    receptionistToken = recepRes.body.data.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. Unauthenticated request returns 401 Unauthorized', async () => {
    await request(app.getHttpServer()).get('/api/v1/departments').expect(401);
  });

  it('2. Receptionist without department permissions receives 403 Forbidden on create', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ name: 'Emergency' })
      .expect(403);
  });

  it('3. Admin creates a new department successfully', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Cardiology',
        description: 'Heart and cardiovascular care',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Cardiology');
    expect(res.body.data.description).toBe('Heart and cardiovascular care');
    expect(typeof res.body.data.id).toBe('string');
    createdDeptId = res.body.data.id;
  });

  it('4. Rejects creating a duplicate department name with 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Cardiology' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('That department is already on the list.');
  });

  it('5. Rejects validation when name is missing', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'No name given' })
      .expect(400);
  });

  it('6. Lists departments with doctor usage counts and unlisted specialties', async () => {
    departmentService.seedMemoryDoctor('doc-1', 'Dr Heart', 'Cardiology');
    departmentService.seedMemoryDoctor('doc-2', 'Dr Skin', 'Dermatology'); // Unlisted

    const res = await request(app.getHttpServer())
      .get('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.departments.length).toBeGreaterThanOrEqual(1);
    const cardio = res.body.data.departments.find((d: any) => d.name === 'Cardiology');
    expect(cardio).toBeDefined();
    expect(cardio.doctorCount).toBe(1);

    expect(res.body.data.unlisted).toContain('Dermatology');
  });

  it('7. Updates department and cascades rename to doctors', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/departments/${createdDeptId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Cardiology & Vascular' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.department.name).toBe('Cardiology & Vascular');
    expect(res.body.data.movedDoctors).toBe(1);
    expect(res.body.data.message).toContain('1 doctor record(s) moved with it');
  });

  it('8. Rejects deleting department when doctors are assigned to it', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/departments/${createdDeptId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain(
      'doctor(s) in it. Move them first, or rename it instead.',
    );
  });

  it('9. Adopt automatically imports unlisted doctor departments into the catalogue', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/departments/adopt')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.adoptedCount).toBe(1);
    expect(res.body.data.adoptedNames).toContain('Dermatology');

    // Dermatology can now be safely deleted since it has 1 doctor? Let's check:
    // Doctor 'doc-2' has department 'Dermatology', so deleting Dermatology would be rejected
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listRes.body.data.unlisted.length).toBe(0);
  });

  it('10. Deleting department with 0 doctors succeeds', async () => {
    const emptyDept = await request(app.getHttpServer())
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Temporary Clinic' })
      .expect(201);

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/v1/departments/${emptyDept.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(deleteRes.body.data.message).toContain('Temporary Clinic removed.');
  });
});
