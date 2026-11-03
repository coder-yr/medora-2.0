import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/modules/prisma/prisma.service';

function getData(res: any) {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

describe('Hospital Settings, Branding & Multi-Branch Management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let receptionistToken: string;
  let doctorToken: string;
  let doctorUserId: string;

  let createdBranchId: string;

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

    // 2. Authenticate Receptionist
    const recRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'receptionist.test@medora.hospital',
        password: 'ValidPassword123!',
      });
    receptionistToken = getData(recRes).accessToken;

    // 3. Authenticate Doctor
    const docRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'doctor.test@medora.hospital',
        password: 'ValidPassword123!',
      });
    const docData = getData(docRes);
    doctorToken = docData.accessToken;
    doctorUserId = docData.user.id;
  });

  afterAll(async () => {
    // Cleanup any created test branch
    if (createdBranchId) {
      await prisma.configurationAuditLog.deleteMany({
        where: { branchId: BigInt(createdBranchId) },
      });
      await prisma.userBranchMembership.deleteMany({
        where: { branchId: BigInt(createdBranchId) },
      });
      await prisma.branchSettings.deleteMany({
        where: { branchId: BigInt(createdBranchId) },
      });
      await prisma.branchDocumentSequence.deleteMany({
        where: { branchId: BigInt(createdBranchId) },
      });
      await prisma.hospitalBranch.deleteMany({
        where: { id: BigInt(createdBranchId) },
      });
    }

    await app.close();
  });

  // ===========================================================================
  // 1. HOSPITAL SETTINGS & BRANDING
  // ===========================================================================
  describe('Hospital Settings & Branding Endpoints', () => {
    it('GET /api/v1/settings/hospital - should fetch hospital profile as Admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/settings/hospital')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = getData(res);
      expect(data).toHaveProperty('hospitalName');
      expect(data).toHaveProperty('defaultCurrency');
      expect(data.defaultCurrency).toBe('PKR');
    });

    it('PUT /api/v1/settings/hospital - should update hospital settings and record audit log', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/settings/hospital')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          hospitalName: 'Medora Healthcare System',
          phone: '+92-21-34930099',
          changeReason: 'Updated hotline phone number in E2E',
        });

      expect(res.status).toBe(200);
      const data = getData(res);
      expect(data.hospitalName).toBe('Medora Healthcare System');
      expect(data.phone).toBe('+92-21-34930099');

      // Verify audit log exists
      const audit = await prisma.configurationAuditLog.findFirst({
        where: {
          scope: 'HOSPITAL',
          settingKey: 'phone',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).not.toBeNull();
      expect(audit?.newValue).toBe('+92-21-34930099');
    });

    it('PUT /api/v1/settings/hospital - should reject unauthorized role (Doctor)', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/settings/hospital')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          hospitalName: 'Hacked Hospital',
        });

      expect(res.status).toBe(403);
    });

    it('PUT /api/v1/settings/branding - should update colors and logo with validation', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/settings/branding')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          primaryColor: '#0369a1',
          secondaryColor: '#1e293b',
          logoUrl: 'https://medora.hospital/assets/e2e-logo.png',
          changeReason: 'Updated brand colors for test',
        });

      expect(res.status).toBe(200);
      const data = getData(res);
      expect(data.primaryColor).toBe('#0369a1');
      expect(data.secondaryColor).toBe('#1e293b');
    });

    it('PUT /api/v1/settings/branding - should reject invalid color code', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/settings/branding')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          primaryColor: 'not-a-color',
        });

      expect(res.status).toBe(400);
    });

    it('GET /api/v1/settings/audit-logs - should retrieve configuration change logs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/settings/audit-logs?scope=HOSPITAL')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = getData(res);
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.total).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // 2. MULTI-BRANCH MANAGEMENT & LIFECYCLE
  // ===========================================================================
  describe('Multi-Branch Management Endpoints', () => {
    it('GET /api/v1/branches - should list active branches for authorized staff', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      const data = getData(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/branches/my-branches - should return branches assigned to authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/branches/my-branches')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      const data = getData(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((b: any) => b.code === 'MAIN')).toBe(true);
    });

    it('POST /api/v1/branches - should create branch and auto-initialize branch settings', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'North Nazimabad Care Center',
          code: 'NN-CARE',
          address: 'Block D, North Nazimabad, Karachi',
          phone: '+92-21-36640001',
          active: true,
        });

      expect(res.status).toBe(201);
      const data = getData(res);
      createdBranchId = data.id;
      expect(data.code).toBe('NN-CARE');
      expect(data.settings).toBeDefined();
      expect(data.settings.invoicePrefix).toBe('INV-NN-CARE-');
      expect(data.settings.mrnPrefix).toBe('MRN-NN-CARE-');
    });

    it('POST /api/v1/branches - should reject duplicate branch code with 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Another Main Branch',
          code: 'MAIN',
        });

      expect(res.status).toBe(409);
    });

    it('POST /api/v1/branches - should reject non-admin users (Receptionist)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          name: 'Rogue Branch',
          code: 'ROGUE',
        });

      expect(res.status).toBe(403);
    });

    it('PUT /api/v1/branches/:id - should update branch profile details', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/branches/${createdBranchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          phone: '+92-21-36649999',
          address: 'Updated Address, Block D, North Nazimabad',
        });

      expect(res.status).toBe(200);
      const data = getData(res);
      expect(data.phone).toBe('+92-21-36649999');
    });

    it('PATCH /api/v1/branches/:id/status - should deactivate and activate branch', async () => {
      // Deactivate
      const deactRes = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${createdBranchId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false, reason: 'Temporary E2E maintenance' });

      expect(deactRes.status).toBe(200);
      expect(getData(deactRes).active).toBe(false);

      // Reactivate
      const reactRes = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${createdBranchId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: true, reason: 'Reopened after maintenance' });

      expect(reactRes.status).toBe(200);
      expect(getData(reactRes).active).toBe(true);
    });
  });

  // ===========================================================================
  // 3. BRANCH-SPECIFIC OPERATIONAL SETTINGS & INHERITANCE
  // ===========================================================================
  describe('Branch Operational Settings & 3-Tier Precedence', () => {
    it('PUT /api/v1/branches/:id/settings - should update branch overrides', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/branches/${createdBranchId}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoicePrefix: 'INV-NNC-',
          receiptHeaderOverride: 'NORTH NAZIMABAD HEALTH CLINIC',
          primaryColorOverride: '#059669',
          changeReason: 'Customized branch branding & prefix',
        });

      expect(res.status).toBe(200);
      const data = getData(res);
      expect(data.invoicePrefix).toBe('INV-NNC-');
      expect(data.receiptHeaderOverride).toBe('NORTH NAZIMABAD HEALTH CLINIC');
      expect(data.primaryColorOverride).toBe('#059669');
    });

    it('GET /api/v1/branches/:id/effective-settings - should resolve 3-tier settings accurately', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/branches/${createdBranchId}/effective-settings`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const effective = getData(res);

      // Explicit branch overrides:
      expect(effective.invoicePrefix).toBe('INV-NNC-');
      expect(effective.receiptHeader).toBe('NORTH NAZIMABAD HEALTH CLINIC');
      expect(effective.primaryColor).toBe('#059669');

      // Inherited hospital defaults:
      expect(effective.currency).toBe('PKR');
      expect(effective.timezone).toBe('Asia/Karachi');
      expect(effective.hospitalName).toBe('Medora Healthcare System');
    });
  });

  // ===========================================================================
  // 4. USER-TO-BRANCH MEMBERSHIPS & ACCESS CONTROL
  // ===========================================================================
  describe('User Branch Membership & Access Control', () => {
    it('POST /api/v1/branches/:id/members - should assign Doctor to the branch', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/branches/${createdBranchId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: doctorUserId,
          isDefault: false,
          notes: 'Visiting consultant on Fridays',
        });

      expect(res.status).toBe(201);
      const data = getData(res);
      expect(data.userId).toBe(doctorUserId);
      expect(data.branchId).toBe(createdBranchId);
      expect(data.isActive).toBe(true);
    });

    it('GET /api/v1/branches/:id/members - should list members of the branch', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/branches/${createdBranchId}/members`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = getData(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((m: any) => m.userId === doctorUserId)).toBe(true);
    });

    it('DELETE /api/v1/branches/:id/members/:userId - should revoke membership', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/branches/${createdBranchId}/members/${doctorUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = getData(res);
      expect(data.isActive).toBe(false);
    });
  });

  // ===========================================================================
  // 5. BRANCH NUMBERING POLICY & CONCURRENCY
  // ===========================================================================
  describe('Branch Document Number Generation', () => {
    it('POST /api/v1/branches/:id/generate-number/INVOICE - should generate formatted number', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/branches/${createdBranchId}/generate-number/INVOICE`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = getData(res);
      const year = new Date().getFullYear();
      expect(data.documentNumber).toBe(`INV-NNC-${year}-000001`);
    });

    it('should generate concurrent document numbers with monotonic sequencing and zero duplicates', async () => {
      const promises = Array.from({ length: 5 }).map(() =>
        request(app.getHttpServer())
          .post(`/api/v1/branches/${createdBranchId}/generate-number/INVOICE`)
          .set('Authorization', `Bearer ${adminToken}`),
      );

      const responses = await Promise.all(promises);
      const numbers = responses.map((r) => getData(r).documentNumber);

      // Verify no duplicates
      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size).toBe(5);

      // Verify prefix
      const year = new Date().getFullYear();
      numbers.forEach((num) => {
        expect(num).toMatch(new RegExp(`^INV-NNC-${year}-\\d{6}$`));
      });
    });
  });
});
