import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/modules/prisma/prisma.service';

function getData(res: any) {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

describe('Executive Dashboard & Operational Analytics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let doctorToken: string;
  let receptionistToken: string;
  let accountantToken: string;
  let doctorUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // 1. Authenticate Admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin.test@medora.hospital',
        password: 'ValidPassword123!',
      });
    adminToken = getData(adminRes).accessToken;

    // 2. Authenticate Doctor
    const docRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'doctor.test@medora.hospital',
        password: 'ValidPassword123!',
      });
    const docData = getData(docRes);
    doctorToken = docData.accessToken;
    doctorUserId = docData.user.id;

    // 3. Authenticate Receptionist
    const recRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'receptionist.test@medora.hospital',
        password: 'ValidPassword123!',
      });
    receptionistToken = getData(recRes).accessToken;

    // 4. Authenticate Accountant
    const accRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'accountant.test@medora.hospital',
        password: 'ValidPassword123!',
      });
    accountantToken = getData(accRes).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Executive Overview & Financial Permission Gating', () => {
    it('Admin retrieves executive overview WITH full financial summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/overview?period=today')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = getData(res);
      expect(data).toBeDefined();
      expect(data.patients).toBeDefined();
      expect(data.appointments).toBeDefined();
      expect(data.inpatient).toBeDefined();
      expect(data.pharmacy).toBeDefined();
      expect(data.diagnostics).toBeDefined();
      expect(data.financial).toBeDefined();
      expect(data.financial.recognizedRevenue).toBeDefined();
      expect(data.financial.cashCollections).toBeDefined();
      expect(data.financial.accountsReceivable).toBeDefined();
      expect(data.notifications).toBeDefined();
    });

    it('Accountant retrieves overview WITH financial summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/overview?period=today')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const data = getData(res);
      expect(data.financial).toBeDefined();
      expect(data.financial.recognizedRevenue).toBeDefined();
    });

    it('Doctor retrieves overview with financial summary STRICTLY REDACTED/NULL', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/overview?period=today')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      const data = getData(res);
      expect(data.patients).toBeDefined();
      expect(data.appointments).toBeDefined();
      expect(data.financial).toBeNull(); // Redacted for non-financial role
    });

    it('Receptionist retrieves overview with financial summary STRICTLY REDACTED/NULL', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/overview?period=today')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .expect(200);

      const data = getData(res);
      expect(data.patients).toBeDefined();
      expect(data.financial).toBeNull(); // Redacted
    });
  });

  describe('2. Date Filter Semantics & Validation', () => {
    it('supports custom date range within 366 days', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/overview?period=custom&startDate=2026-10-01&endDate=2026-10-31')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = getData(res);
      expect(data.period).toBe('custom');
      expect(data.dateRange.start).toContain('2026-10-01');
    });

    it('rejects inverted custom date range (startDate > endDate)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/dashboard/overview?period=custom&startDate=2026-11-10&endDate=2026-11-01')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('rejects excessive date ranges greater than 366 days', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/dashboard/overview?period=custom&startDate=2024-01-01&endDate=2026-01-01')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('3. Clinical Workload (Doctor Persona)', () => {
    it('Doctor fetches clinical workload for their workbench', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/doctor-workload?period=today')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      const data = getData(res);
      expect(data.doctorId).toBe(doctorUserId);
      expect(data.appointments).toBeDefined();
      expect(data.consultations).toBeDefined();
    });
  });

  describe('4. Multi-Branch Comparison & Access Isolation', () => {
    it('Global Admin can view cross-branch comparisons', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/branch-comparison?period=today')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = getData(res);
      expect(data.branches).toBeInstanceOf(Array);
      expect(data.branches.length).toBeGreaterThanOrEqual(1);
      expect(data.branches[0].branchCode).toBeDefined();
      expect(data.branches[0].appointmentsCount).toBeDefined();
    });

    it('Receptionist is FORBIDDEN from accessing branch comparisons (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/dashboard/branch-comparison?period=today')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .expect(403);
    });

    it('Doctor is FORBIDDEN from accessing branch comparisons (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/dashboard/branch-comparison?period=today')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(403);
    });
  });

  describe('5. Real-Time Operational Alerts', () => {
    it('Admin retrieves active actionable operational alerts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/operational-alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = getData(res);
      expect(data.alerts).toBeInstanceOf(Array);
      expect(data.totalAlerts).toBeDefined();
      expect(data.checkedAt).toBeDefined();
    });
  });
});
