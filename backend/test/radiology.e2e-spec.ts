import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/modules/prisma/prisma.service';

jest.setTimeout(60000);

describe('Radiology Information System (RIS) (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let doctorToken: string;
  let receptionistToken: string;
  let laboratoristToken: string;
  let pharmacistToken: string;

  let testPatientId: number;
  let testDoctorId: number;

  let createdCategoryId: number | undefined;
  let createdExamId: number | undefined;
  let createdOrderId: number | undefined;
  let createdOrder2Id: number | undefined;
  let createdEmergencyOrderId: number | undefined;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Authenticate Doctor
    const docRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'doctor.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    doctorToken = docRes.body.data.accessToken;

    // Authenticate Receptionist
    const recRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'receptionist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    receptionistToken = recRes.body.data.accessToken;

    // Authenticate Laboratorist / Radiographer
    const labRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'laboratorist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    laboratoristToken = labRes.body.data.accessToken;

    // Authenticate Pharmacist (for unauthorized RBAC tests)
    const pharmRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'pharmacist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    pharmacistToken = pharmRes.body.data.accessToken;

    // Ensure a test Doctor exists
    let doc = await prisma.doctor.findFirst();
    if (!doc) {
      doc = await prisma.doctor.create({
        data: {
          name: `Dr. Radiologist ${Date.now()}`,
          email: `doc_rad_${Date.now()}@test.hospital`,
          phone: '03009876543',
          department: 'Radiology',
        },
      });
    }
    testDoctorId = Number(doc.id);

    // Create a test Patient
    const patient = await prisma.patient.create({
      data: {
        name: `Radiology Test Patient ${Date.now()}`,
        patientId: `RAD${Date.now().toString().slice(-5)}`,
        phone: '03221234567',
        sex: 'male',
        age: '45',
      },
    });
    testPatientId = Number(patient.id);
  });

  afterAll(async () => {
    // Teardown test records
    try {
      if (createdOrderId) {
        await prisma.radiologyReportAmendment.deleteMany({
          where: { radiologyOrderId: BigInt(createdOrderId) },
        });
        await prisma.radiologyOrder.deleteMany({
          where: { id: BigInt(createdOrderId) },
        });
      }
      if (createdOrder2Id) {
        await prisma.radiologyOrder.deleteMany({
          where: { id: BigInt(createdOrder2Id) },
        });
      }
      if (createdEmergencyOrderId) {
        await prisma.radiologyOrder.deleteMany({
          where: { id: BigInt(createdEmergencyOrderId) },
        });
      }
      if (createdExamId) {
        await prisma.radiologyExam.deleteMany({
          where: { id: BigInt(createdExamId) },
        });
      }
      if (createdCategoryId) {
        await prisma.radiologyCategory.deleteMany({
          where: { id: BigInt(createdCategoryId) },
        });
      }
      if (testPatientId) {
        await prisma.invoiceItem.deleteMany({
          where: { payment: { patientId: BigInt(testPatientId) } },
        });
        await prisma.payment.deleteMany({
          where: { patientId: BigInt(testPatientId) },
        });
        await prisma.patient.deleteMany({
          where: { id: BigInt(testPatientId) },
        });
      }
    } catch {
      // Ignore cleanup error if already removed
    }

    await app.close();
  });

  describe('1. Catalogue Management', () => {
    it('allows authorized staff to create a radiology category', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/radiology/catalogue/categories')
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          name: `Chest & Thoracic Imaging ${Date.now()}`,
          modality: 'xray',
          description: 'Plain film radiography of chest, ribs, and thoracic cage',
          displayOrder: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.modality).toBe('xray');
      createdCategoryId = Number(res.body.data.id);
    });

    it('creates an imaging procedure in the catalogue with pricing and instructions', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/radiology/catalogue/exams')
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          name: `Chest PA / Lateral View ${Date.now()}`,
          modality: 'xray',
          categoryId: createdCategoryId,
          price: 55.0,
          preparationInstructions: 'Remove all metallic jewelry and metal-buttoned garments.',
          reportTemplate: 'LUNGS: Clear. HEART: Normal size. PLEURAL SPACES: No effusion.',
          turnaroundHours: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.code).toMatch(/^RAD-XRA-/);
      expect(Number(res.body.data.price)).toBe(55);
      createdExamId = Number(res.body.data.id);
    });

    it('lists catalogue exams with search and modality filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/radiology/catalogue/exams?modality=xray')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('2. Order Requisition & Billing Integration', () => {
    it('creates a radiology order with clinical indication and auto-billing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/radiology/orders')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          examIds: [createdExamId],
          clinicalIndication: 'Persistent productive cough for 3 weeks, r/o pneumonia',
          urgent: false,
          bill: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      const order = res.body.data[0];
      expect(order.id).toBeDefined();
      expect(['ordered', 'pending']).toContain(order.status);
      expect(order.invoiceId).toBeDefined(); // Charge created
      createdOrderId = Number(order.id);
    });

    it('prevents duplicate active radiology orders for the same patient and exam on the same day', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/radiology/orders')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          examIds: [createdExamId],
          clinicalIndication: 'Duplicate order attempt',
          urgent: false,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('already placed for this patient today');
    });
  });

  describe('3. Scheduling & Collision Engine', () => {
    const scheduledTime = new Date(Date.now() + 3600000).toISOString();

    it('schedules the examination appointment and assigns room and technician', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrderId}/schedule`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          scheduledAt: scheduledTime,
          equipmentRoom: 'Room-X101',
          notes: 'Standard morning slot',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('scheduled');
      expect(res.body.data.equipmentRoom).toBe('Room-X101');
    });

    it('detects and rejects overlapping room booking within 30 minutes for another order', async () => {
      // First create another exam and order for a different patient
      const newExam = await prisma.radiologyExam.create({
        data: {
          name: `CT Abdomen ${Date.now()}`,
          code: `RAD-CT-${Date.now().toString().slice(-4)}`,
          modality: 'ct',
          price: 150,
        },
      });

      const newOrder = await prisma.radiologyOrder.create({
        data: {
          orderNumber: `RAD-E2E-${Date.now()}`,
          patientId: BigInt(testPatientId),
          doctorId: BigInt(testDoctorId),
          radiologyExamId: newExam.id,
          examName: newExam.name,
          modality: 'ct',
          status: 'pending',
          orderDate: new Date(),
        },
      });
      createdOrder2Id = Number(newOrder.id);

      // Attempt to schedule within 15 minutes in same room without forceConflict
      const conflictTime = new Date(new Date(scheduledTime).getTime() + 15 * 60000).toISOString();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrder2Id}/schedule`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          scheduledAt: conflictTime,
          equipmentRoom: 'Room-X101',
          notes: 'Conflicting slot',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Schedule conflict: Equipment room "Room-X101" is already reserved');
    });

    it('allows room collision when emergency STAT override (forceConflict: true) is provided', async () => {
      const conflictTime = new Date(new Date(scheduledTime).getTime() + 15 * 60000).toISOString();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrder2Id}/schedule`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          scheduledAt: conflictTime,
          equipmentRoom: 'Room-X101',
          notes: 'Emergency polytrauma override',
          forceConflict: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('scheduled');
    });
  });

  describe('4. Imaging Workflow Progression', () => {
    it('marks patient arrived for the scheduled examination', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrderId}/arrived`)
        .set('Authorization', `Bearer ${laboratoristToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('arrived');
      expect(res.body.data.arrivedAt).toBeDefined();
    });

    it('starts examination and transitions to in_progress', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrderId}/start`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({ equipmentRoom: 'Room-X101' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('in_progress');
    });

    it('completes examination and transitions to done', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrderId}/complete`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({ imageCount: 2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('done');
      expect(res.body.data.performedAt).toBeDefined();
    });
  });

  describe('5. Radiologist Reporting & Report Immutability', () => {
    it('saves draft report findings without finalizing', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrderId}/draft`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          findings: 'Initial draft: Lungs clear. No active focal consolidation observed.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('done'); // Still done, not yet reported
      expect(res.body.data.findings).toContain('Initial draft');
    });

    it('rejects formal report submission if impression is missing', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrderId}/report`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          findings: 'Right lower lobe hazy opacity.',
          impression: '', // Empty impression
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('submits finalized diagnostic report with impression and recommendations', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrderId}/report`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          findings: 'Patchy alveolar consolidation in the right lower lobe with prominent bronchovascular markings. Normal cardiac silhouette. Costophrenic angles are sharp.',
          impression: 'Right lower lobe bronchopneumonia. Clinical correlation and antibiotic therapy advised.',
          recommendations: 'Follow-up chest radiograph in 14 days after completion of treatment.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('reported');
      expect(res.body.data.reportedAt).toBeDefined();
      expect(res.body.data.impression).toContain('Right lower lobe bronchopneumonia');
    });

    it('rejects direct modification of an already reported/finalized examination', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrderId}/draft`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          findings: 'Attempting to overwrite finalized report directly',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Direct modification of authorized report is blocked');
    });
  });

  describe('6. Audited Report Amendment', () => {
    it('creates an audited amendment recording clinical reason and preserving history', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrderId}/amend`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          reason: 'Radiologist addendum: clarified mild compensatory hyperinflation in left lung.',
          findings: 'Patchy alveolar consolidation in right lower lobe. Left lung demonstrates mild compensatory hyperinflation.',
          impression: 'Right lower lobe bronchopneumonia with mild compensatory changes.',
          recommendations: 'Follow-up radiograph in 14 days.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amendment.reason).toContain('clarified mild compensatory hyperinflation');
      expect(res.body.data.order.findings).toContain('Left lung demonstrates mild compensatory');
      expect(res.body.data.order.amendments).toHaveLength(1);
    });

    it('verifies the diagnostic report by department chief or radiologist', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrderId}/verify`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verifiedAt).toBeDefined();
    });
  });

  describe('7. Order Cancellation & Protections', () => {
    it('blocks cancellation of a reported or completed examination', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrderId}/cancel`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ reason: 'Patient changed mind' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('A reported exam cannot be cancelled');
    });

    it('cancels an active pending or scheduled order with a mandatory reason', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrder2Id}/cancel`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ reason: 'Patient transferred to outside trauma center' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
      expect(res.body.data.cancelReason).toContain('Patient transferred to outside trauma center');
    });
  });

  describe('8. Role-Based Access Control (RBAC)', () => {
    it('forbids Pharmacist from creating radiology orders (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/radiology/orders')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          examIds: [createdExamId],
        });

      expect(res.status).toBe(403);
    });

    it('forbids Pharmacist from entering radiology reports (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${createdOrderId}/report`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          findings: 'Unauthorized findings attempt',
          impression: 'Unauthorized impression',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('9. Dashboard & Operational Analytics', () => {
    it('returns departmental dashboard statistics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/radiology/dashboard')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics.pendingOrders).toBeDefined();
      expect(res.body.data.metrics.totalExamsInCatalogue).toBeDefined();
      expect(Array.isArray(res.body.data.recentOrders)).toBe(true);
    });
  });
});
