import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/modules/prisma/prisma.service';

jest.setTimeout(60000);

describe('Laboratory Management System (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let laboratoristToken: string;
  let doctorToken: string;
  let receptionistToken: string;

  let testPatientId: number;
  let testDoctorId: number;

  let createdCatalogueId: number;
  let createdCatalogue2Id: number;
  let createdOrderId: number;
  let createdOrderWithInvoiceId: number;
  let sampleId: number;

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

    // Authenticate Laboratorist
    const labRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'laboratorist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    laboratoristToken = labRes.body.data.accessToken;

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

    // Ensure a Doctor exists
    let doc = await prisma.doctor.findFirst();
    if (!doc) {
      doc = await prisma.doctor.create({
        data: {
          name: `Dr. Diagnostic ${Date.now()}`,
          email: `doc_${Date.now()}@test.hospital`,
          phone: '03001234567',
          department: 'General Medicine',
        },
      });
    }
    testDoctorId = Number(doc.id);

    // Create test Patient
    const patient = await prisma.patient.create({
      data: {
        name: `Lab Patient ${Date.now()}`,
        patientId: `LP${Date.now().toString().slice(-5)}`,
        phone: '03115556677',
        sex: 'female',
        age: '32',
      },
    });
    testPatientId = Number(patient.id);
  });

  afterAll(async () => {
    // Clean up test lab records
    try {
      if (createdOrderId) {
        await prisma.labReportAmendment.deleteMany({ where: { labId: BigInt(createdOrderId) } });
        await prisma.labResultParameter.deleteMany({
          where: { labTest: { labId: BigInt(createdOrderId) } },
        });
        await prisma.labTest.deleteMany({ where: { labId: BigInt(createdOrderId) } });
        await prisma.labSample.deleteMany({ where: { labId: BigInt(createdOrderId) } });
        await prisma.lab.delete({ where: { id: BigInt(createdOrderId) } });
      }
      if (createdOrderWithInvoiceId) {
        await prisma.labTest.deleteMany({ where: { labId: BigInt(createdOrderWithInvoiceId) } });
        await prisma.labSample.deleteMany({ where: { labId: BigInt(createdOrderWithInvoiceId) } });
        await prisma.lab.delete({ where: { id: BigInt(createdOrderWithInvoiceId) } });
      }
      if (createdCatalogueId) {
        await prisma.labTestParameter.deleteMany({
          where: { labCategoryId: BigInt(createdCatalogueId) },
        });
        await prisma.labCategory.deleteMany({ where: { id: BigInt(createdCatalogueId) } });
      }
      if (createdCatalogue2Id) {
        await prisma.labTestParameter.deleteMany({
          where: { labCategoryId: BigInt(createdCatalogue2Id) },
        });
        await prisma.labCategory.deleteMany({ where: { id: BigInt(createdCatalogue2Id) } });
      }
    } catch {
      // Ignore cleanup error in case cascading already removed
    }

    await app.close();
  });

  describe('1. Test Catalogue Management', () => {
    it('allows Laboratorist to create a test catalogue entry with parameters', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/lab/catalogue')
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          name: `Complete Blood Count (CBC) ${Date.now()}`,
          department: 'Hematology',
          description: 'Standard complete blood count with differential',
          referenceValue: 'See parameter breakdown',
          price: 45.0,
          sampleType: 'Whole Blood (EDTA)',
          turnaroundHours: 4,
          parameters: [
            {
              name: 'Hemoglobin',
              unit: 'g/dL',
              referenceMin: '12.0',
              referenceMax: '16.0',
              displayOrder: 1,
            },
            {
              name: 'White Blood Cell Count',
              unit: '10^3/uL',
              referenceMin: '4.0',
              referenceMax: '11.0',
              displayOrder: 2,
            },
            {
              name: 'Platelet Count',
              unit: '10^3/uL',
              referenceMin: '150',
              referenceMax: '450',
              displayOrder: 3,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(Number(res.body.data.price)).toBe(45);
      expect(res.body.data.parameters).toHaveLength(3);
      createdCatalogueId = Number(res.body.data.id);
    });

    it('creates a second test catalogue entry for panel orders', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/lab/catalogue')
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          name: `Fasting Blood Glucose ${Date.now()}`,
          department: 'Biochemistry',
          description: 'Serum fasting glucose',
          referenceValue: '70 - 99 mg/dL',
          price: 20.0,
          sampleType: 'Fluoride Plasma',
          turnaroundHours: 2,
        });

      expect(res.status).toBe(201);
      createdCatalogue2Id = Number(res.body.data.id);
    });

    it('rejects duplicate catalogue test name with 409 Conflict', async () => {
      const existing = await prisma.labCategory.findUnique({
        where: { id: BigInt(createdCatalogueId) },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/lab/catalogue')
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          name: existing!.category,
          price: 50.0,
        });

      expect(res.status).toBe(409);
    });

    it('lists catalogue entries with search filtering', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/lab/catalogue?search=Complete Blood Count')
        .set('Authorization', `Bearer ${laboratoristToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('retrieves single catalogue entry with its parameters', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/lab/catalogue/${createdCatalogueId}`)
        .set('Authorization', `Bearer ${laboratoristToken}`);

      expect(res.status).toBe(200);
      expect(Number(res.body.data.id)).toBe(createdCatalogueId);
      expect(res.body.data.parameters).toHaveLength(3);
    });

    it('updates catalogue details and parameters', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/lab/catalogue/${createdCatalogueId}`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          price: 48.0,
          turnaroundHours: 3,
          parameters: [
            {
              name: 'Hemoglobin',
              unit: 'g/dL',
              referenceMin: '12.0',
              referenceMax: '16.0',
              displayOrder: 1,
            },
            {
              name: 'Hematocrit (Hct)',
              unit: '%',
              referenceMin: '36.0',
              referenceMax: '48.0',
              displayOrder: 2,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(Number(res.body.data.price)).toBe(48);
      expect(res.body.data.turnaroundHours).toBe(3);
      expect(res.body.data.parameters).toHaveLength(2);
    });

    it('rejects catalogue creation by Receptionist with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/lab/catalogue')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          name: `Unauthorized Test ${Date.now()}`,
          price: 15.0,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('2. Lab Ordering Workflow', () => {
    it('validates that order must contain at least one test', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/lab/orders')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          testIds: [],
        });

      expect(res.status).toBe(400);
    });

    it('allows Doctor to create lab order with multiple tests and generates specimen sample', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/lab/orders')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          testIds: [createdCatalogueId, createdCatalogue2Id],
          priority: 'URGENT',
          clinicalNotes: 'Pre-operative diagnostic panel evaluation',
          generateInvoice: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.orderNumber).toMatch(/^LAB-\d+/);
      expect(res.body.data.priority).toBe('URGENT');
      expect(res.body.data.status).toBe('SAMPLE_PENDING');
      expect(res.body.data.tests).toHaveLength(2);
      expect(res.body.data.samples).toHaveLength(2); // One per distinct sampleType

      createdOrderId = Number(res.body.data.id);
      sampleId = Number(res.body.data.samples[0].id);
    });

    it('allows creating lab order with automatic invoice generation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/lab/orders')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          testIds: [createdCatalogue2Id],
          priority: 'ROUTINE',
          clinicalNotes: 'Annual checkup routine glucose',
          generateInvoice: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.invoiceId).toBeDefined();

      createdOrderWithInvoiceId = Number(res.body.data.id);

      // Verify invoice was created in database
      const invoice = await prisma.payment.findUnique({
        where: { id: BigInt(res.body.data.invoiceId) },
      });
      expect(invoice).toBeDefined();
      expect(Number(invoice!.grossTotal)).toBe(20);
    });

    it('queries lab orders with status and priority filtering', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/lab/orders?status=SAMPLE_PENDING&priority=URGENT')
        .set('Authorization', `Bearer ${laboratoristToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.items || res.body.data.data || res.body.data;
      expect(Array.isArray(items)).toBe(true);
      const found = items.some(
        (o: { id: string | number }) => Number(o.id) === createdOrderId,
      );
      expect(found).toBe(true);
    });

    it('retrieves single lab order detail with tests and sample details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/lab/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${laboratoristToken}`);

      expect(res.status).toBe(200);
      expect(Number(res.body.data.id)).toBe(createdOrderId);
      expect(res.body.data.tests).toHaveLength(2);
      expect(res.body.data.samples).toBeDefined();
    });
  });

  describe('3. Sample Management (Collection, Rejection, Accessioning)', () => {
    it('lists pending samples in sample collection queue', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/lab/samples/queue')
        .set('Authorization', `Bearer ${laboratoristToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const sampleItem = res.body.data.find(
        (s: { id: string | number }) => Number(s.id) === sampleId,
      );
      expect(sampleItem).toBeDefined();
    });

    it('marks sample as collected and updates order status to SAMPLE_COLLECTED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/lab/samples/${sampleId}/collect`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          notes: 'Collected from left antecubital vein without complications',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COLLECTED');
      expect(res.body.data.collectedAt).toBeDefined();
    });

    it('allows rejecting a compromised sample and resets order status to SAMPLE_PENDING', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/lab/samples/${sampleId}/reject`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          reason: 'HEMOLYZED',
          notes: 'Hemolyzed specimen unsuitable for automated hematology count',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.rejectionReason).toContain('HEMOLYZED');

      // Verify the order has returned to SAMPLE_PENDING
      const order = await prisma.lab.findUnique({
        where: { id: BigInt(createdOrderId) },
      });
      expect(order!.status).toBe('SAMPLE_PENDING');
    });

    it('re-collects sample and receives (accessions) it into the laboratory', async () => {
      // Re-collect sample
      await request(app.getHttpServer())
        .post(`/api/v1/lab/samples/${sampleId}/collect`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          notes: 'Re-drawn successfully',
        });

      // Receive sample in lab
      const res = await request(app.getHttpServer())
        .post(`/api/v1/lab/samples/${sampleId}/receive`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          notes: 'Sample received at central accessioning in proper cold chain',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RECEIVED');
      expect(res.body.data.receivedAt).toBeDefined();

      // Verify order status is updated
      const order = await prisma.lab.findUnique({
        where: { id: BigInt(createdOrderId) },
      });
      expect(['SAMPLE_RECEIVED', 'PROCESSING']).toContain(order!.status);
    });
  });

  describe('4. Result Entry & Blank-Box Protection', () => {
    it('allows Laboratorist to enter test results and sets order status to RESULT_ENTERED', async () => {
      const orderDetail = await prisma.lab.findUnique({
        where: { id: BigInt(createdOrderId) },
        include: { tests: true },
      });

      const cbcTest = orderDetail!.tests.find(
        (t) => Number(t.labCategoryId) === createdCatalogueId,
      );
      const glucoseTest = orderDetail!.tests.find(
        (t) => Number(t.labCategoryId) === createdCatalogue2Id,
      );
      expect(cbcTest).toBeDefined();
      expect(glucoseTest).toBeDefined();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/lab/orders/${createdOrderId}/results`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          parameters: [
            {
              testId: Number(cbcTest!.id),
              parameterName: 'Hemoglobin',
              value: '13.5',
              unitSnapshot: 'g/dL',
              referenceRangeSnapshot: '12.0 - 16.0',
              abnormalFlag: 'NORMAL',
            },
            {
              testId: Number(cbcTest!.id),
              parameterName: 'Hematocrit (Hct)',
              value: '39.8',
              unitSnapshot: '%',
              referenceRangeSnapshot: '36.0 - 48.0',
              abnormalFlag: 'NORMAL',
            },
            {
              testId: Number(glucoseTest!.id),
              parameterName: 'Fasting Blood Glucose',
              value: '85',
              unitSnapshot: 'mg/dL',
              referenceRangeSnapshot: '70 - 99 mg/dL',
              abnormalFlag: 'NORMAL',
            },
          ],
          summary: 'Normal count and normoglycemic',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESULT_ENTERED');
    });

    it('protects recorded results from blank-box overwriting', async () => {
      const orderDetail = await prisma.lab.findUnique({
        where: { id: BigInt(createdOrderId) },
        include: { tests: true },
      });
      const cbcTest = orderDetail!.tests.find(
        (t) => Number(t.labCategoryId) === createdCatalogueId,
      );

      // Submit an empty result value for an already recorded test
      const res = await request(app.getHttpServer())
        .post(`/api/v1/lab/orders/${createdOrderId}/results`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          parameters: [
            {
              testId: Number(cbcTest!.id),
              parameterName: 'Hemoglobin',
              value: '   ', // Blank whitespace
            },
          ],
        });

      expect(res.status).toBe(200);

      // Verify that the prior result was preserved and NOT cleared
      const updatedTest = await prisma.labTest.findUnique({
        where: { id: cbcTest!.id },
        include: { resultParameters: true },
      });
      expect(updatedTest!.result).toBeDefined();
      const hgbParam = updatedTest!.resultParameters.find((p) => p.parameterName === 'Hemoglobin');
      expect(hgbParam!.value).toBe('13.5');
    });
  });

  describe('5. Result Verification & Report Approval', () => {
    it('allows Laboratorist to verify results and sets status to VERIFIED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/lab/orders/${createdOrderId}/verify`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          comments: 'Technical validation complete. Controls in range.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('VERIFIED');
      expect(res.body.data.verifiedAt).toBeDefined();
    });

    it('allows Laboratorist/Pathologist to approve report and transitions to COMPLETED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/lab/orders/${createdOrderId}/approve`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          remarks: 'Clinical sign-off approved by Consultant Pathologist.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.approvedAt).toBeDefined();
      expect(res.body.data.completedAt).toBeDefined();
    });

    it('enforces immutability: blocks direct result modification on completed report', async () => {
      const orderDetail = await prisma.lab.findUnique({
        where: { id: BigInt(createdOrderId) },
        include: { tests: true },
      });
      const cbcTest = orderDetail!.tests[0];

      const res = await request(app.getHttpServer())
        .post(`/api/v1/lab/orders/${createdOrderId}/results`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          parameters: [
            {
              testId: Number(cbcTest.id),
              parameterName: 'Hemoglobin',
              value: '15.0',
            },
          ],
        });

      expect(res.status).toBe(400);
      const msg = res.body?.message || res.text || '';
      expect(msg).toContain('completed');
    });
  });

  describe('6. Controlled Amendment Workflow', () => {
    it('records an audited amendment with reason and snapshots for completed report', async () => {
      const orderDetail = await prisma.lab.findUnique({
        where: { id: BigInt(createdOrderId) },
        include: { tests: true },
      });
      const cbcTest = orderDetail!.tests.find(
        (t) => Number(t.labCategoryId) === createdCatalogueId,
      );

      const res = await request(app.getHttpServer())
        .post(`/api/v1/lab/orders/${createdOrderId}/amend`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .send({
          reason: 'Dilution factor correction upon secondary review',
          parameters: [
            {
              testId: Number(cbcTest!.id),
              parameterName: 'Hemoglobin',
              value: '14.1',
              unitSnapshot: 'g/dL',
              referenceRangeSnapshot: '12.0 - 16.0',
              abnormalFlag: 'NORMAL',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify amendment record was persisted in database
      const amendment = await prisma.labReportAmendment.findFirst({
        where: { labId: BigInt(createdOrderId) },
      });
      expect(amendment).toBeDefined();
      expect(amendment!.reason).toContain('Dilution factor correction');
      expect(amendment!.previousSnapshot).toBeDefined();
      expect(amendment!.newSnapshot).toBeDefined();

      // Verify order details endpoint includes amendments array
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/lab/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${laboratoristToken}`);

      expect(detailRes.body.data.amendments).toHaveLength(1);
      expect(detailRes.body.data.amendments[0].reason).toContain('Dilution factor correction');
    });
  });

  describe('7. Catalogue Deletion Guard & RBAC Protections', () => {
    it('blocks deleting a catalogue test that is referenced by existing lab orders', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/lab/catalogue/${createdCatalogueId}`)
        .set('Authorization', `Bearer ${laboratoristToken}`);

      expect(res.status).toBe(400);
      const msg = res.body?.message || res.text || '';
      expect(msg).toContain('has been requested');
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/lab/orders');
      expect(res.status).toBe(401);
    });

    it('rejects Receptionist attempting to enter results or approve reports with 403 Forbidden', async () => {
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/lab/orders/${createdOrderId}/results`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ parameters: [{ testId: 1, parameterName: 'Hgb', value: '12' }] });
      expect(res1.status).toBe(403);

      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/lab/orders/${createdOrderId}/approve`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ remarks: 'Illegal sign-off attempt' });
      expect(res2.status).toBe(403);
    });
  });

  describe('8. Order Cancellation', () => {
    let cancellableOrderId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/lab/orders')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          testIds: [createdCatalogue2Id],
          priority: 'ROUTINE',
          clinicalNotes: 'Test order for cancellation check',
        });
      cancellableOrderId = Number(res.body.data.id);
    });

    afterAll(async () => {
      try {
        if (cancellableOrderId) {
          await prisma.labTest.deleteMany({ where: { labId: BigInt(cancellableOrderId) } });
          await prisma.labSample.deleteMany({ where: { labId: BigInt(cancellableOrderId) } });
          await prisma.lab.delete({ where: { id: BigInt(cancellableOrderId) } });
        }
      } catch {
        // Ignore cleanup error
      }
    });

    it('allows cancelling an uncompleted order with reason', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/lab/orders/${cancellableOrderId}/cancel`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          reason: 'Patient discharged prior to sample collection',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');

      const dbOrder = await prisma.lab.findUnique({
        where: { id: BigInt(cancellableOrderId) },
      });
      expect(dbOrder!.status).toBe('CANCELLED');
      expect(dbOrder!.cancelledAt).toBeDefined();
    });

    it('blocks cancelling an already completed lab report', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/lab/orders/${createdOrderId}/cancel`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          reason: 'Attempting to cancel finalized report',
        });

      expect(res.status).toBe(400);
      const msg = res.body?.message || res.text || '';
      expect(msg).toContain('completed');
    });
  });
});
