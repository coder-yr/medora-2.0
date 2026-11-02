import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/modules/prisma/prisma.service';

jest.setTimeout(60000);

describe('Inpatient & Bed Management System (IPD) (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let doctorToken: string;
  let receptionistToken: string;
  let pharmacistToken: string;
  let adminToken: string;

  let testPatient1Id: number;
  let testPatient2Id: number;
  let testPatient3Id: number;
  let testDoctorId: number;

  let createdWardId: number;
  let createdBed1Id: number;
  let createdBed2Id: number;
  let createdBed3Id: number;
  let createdBedConcurrencyId: number;

  let createdAdmissionId: number;
  let createdFolioId: number;

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
    doctorToken = docRes.body?.data?.accessToken;

    // Authenticate Receptionist
    const recRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'receptionist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    receptionistToken = recRes.body?.data?.accessToken;

    // Authenticate Pharmacist
    const pharmRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'pharmacist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    pharmacistToken = pharmRes.body?.data?.accessToken;

    // Authenticate Admin
    const adminRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'admin.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    adminToken = adminRes.body?.data?.accessToken;

    // Fallback: If admin token wasn't returned, use doctorToken
    if (!adminToken) adminToken = doctorToken;

    // Ensure test Doctor
    let doc = await prisma.doctor.findFirst();
    if (!doc) {
      doc = await prisma.doctor.create({
        data: {
          name: `Dr. IPD ${Date.now()}`,
          email: `doc_ipd_${Date.now()}@test.hospital`,
          phone: '03001122334',
          department: 'General Medicine',
        },
      });
    }
    testDoctorId = Number(doc.id);

    // Create 3 Test Patients
    const p1 = await prisma.patient.create({
      data: {
        name: `IPD Patient 1 ${Date.now()}`,
        patientId: `IPD${Date.now().toString().slice(-5)}1`,
        phone: '03001111111',
        sex: 'male',
        age: '35',
      },
    });
    testPatient1Id = Number(p1.id);

    const p2 = await prisma.patient.create({
      data: {
        name: `IPD Patient 2 ${Date.now()}`,
        patientId: `IPD${Date.now().toString().slice(-5)}2`,
        phone: '03002222222',
        sex: 'female',
        age: '28',
      },
    });
    testPatient2Id = Number(p2.id);

    const p3 = await prisma.patient.create({
      data: {
        name: `IPD Patient 3 ${Date.now()}`,
        patientId: `IPD${Date.now().toString().slice(-5)}3`,
        phone: '03003333333',
        sex: 'female',
        age: '40',
      },
    });
    testPatient3Id = Number(p3.id);
  });

  afterAll(async () => {
    try {
      // Clean up folio items & folio
      if (createdFolioId) {
        await prisma.inpatientFolioItem.deleteMany({
          where: { folioId: BigInt(createdFolioId) },
        });
        await prisma.inpatientFolio.deleteMany({
          where: { id: BigInt(createdFolioId) },
        });
      }
      // Clean up allocations & admissions
      if (createdWardId) {
        await prisma.bedAllocationHistory.deleteMany({
          where: { bed: { categoryId: BigInt(createdWardId) } },
        });
        await prisma.admission.deleteMany({
          where: { wardId: BigInt(createdWardId) },
        });
        await prisma.allotedBed.deleteMany({
          where: { patientId: { in: [BigInt(testPatient1Id), BigInt(testPatient2Id), BigInt(testPatient3Id)] } },
        });
        await prisma.bed.deleteMany({
          where: { categoryId: BigInt(createdWardId) },
        });
        await prisma.bedCategory.deleteMany({
          where: { id: BigInt(createdWardId) },
        });
      }
      // Clean up radiology orders for patients
      await prisma.radiologyOrder.deleteMany({
        where: { patientId: { in: [BigInt(testPatient1Id), BigInt(testPatient2Id), BigInt(testPatient3Id)] } },
      });
      await prisma.patient.deleteMany({
        where: { id: { in: [BigInt(testPatient1Id), BigInt(testPatient2Id), BigInt(testPatient3Id)] } },
      });
    } catch {
      // Ignore teardown errors
    }
    await app.close();
  });

  describe('1. Ward / Bed Category Lifecycle', () => {
    it('should create a new ward with base daily rate', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inpatient/wards')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: `General Ward E2E ${Date.now()}`,
          code: `GW${Date.now().toString().slice(-4)}`,
          description: 'General Medicine Ward',
          baseRate: 2000,
          billingUnit: 'DAILY',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(Number(res.body.data.baseRate)).toBe(2000);
      createdWardId = Number(res.body.data.id);
    });

    it('should list wards with bed counts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/inpatient/wards')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const ward = res.body.data.find((w: any) => Number(w.id) === createdWardId);
      expect(ward).toBeDefined();
    });
  });

  describe('2. Bed Management & Setup', () => {
    it('should create beds in the ward', async () => {
      // Bed 1
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/inpatient/beds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryId: createdWardId,
          number: 'B-101',
          description: 'Standard bed',
        });
      expect(res1.status).toBe(201);
      createdBed1Id = Number(res1.body.data.id);

      // Bed 2
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/inpatient/beds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryId: createdWardId,
          number: 'B-102',
          description: 'Standard bed near window',
        });
      expect(res2.status).toBe(201);
      createdBed2Id = Number(res2.body.data.id);

      // Bed 3 (for transfer target)
      const res3 = await request(app.getHttpServer())
        .post('/api/v1/inpatient/beds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryId: createdWardId,
          number: 'B-103',
          description: 'Isolation bed',
        });
      expect(res3.status).toBe(201);
      createdBed3Id = Number(res3.body.data.id);

      // Concurrency test bed
      const resC = await request(app.getHttpServer())
        .post('/api/v1/inpatient/beds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryId: createdWardId,
          number: 'B-CONCUR',
          description: 'Bed for race condition test',
        });
      expect(resC.status).toBe(201);
      createdBedConcurrencyId = Number(resC.body.data.id);
    });

    it('should reject creating duplicate bed number in same ward', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inpatient/beds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryId: createdWardId,
          number: 'B-101',
        });
      expect(res.status).toBe(409);
    });
  });

  describe('3. Concurrency & Pessimistic Locking Test', () => {
    it('should prevent race condition: exactly one of two concurrent admissions to the same bed succeeds', async () => {
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/inpatient/admissions')
          .set('Authorization', `Bearer ${receptionistToken}`)
          .send({
            patientId: testPatient2Id,
            attendingDoctorId: testDoctorId,
            bedId: createdBedConcurrencyId,
            admissionType: 'EMERGENCY',
            admissionReason: 'Severe asthma exacerbation',
          }),
        request(app.getHttpServer())
          .post('/api/v1/inpatient/admissions')
          .set('Authorization', `Bearer ${receptionistToken}`)
          .send({
            patientId: testPatient3Id,
            attendingDoctorId: testDoctorId,
            bedId: createdBedConcurrencyId,
            admissionType: 'ELECTIVE',
            admissionReason: 'Scheduled observation',
          }),
      ]);

      const statuses = [resA.status, resB.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);

      // Verify the bed is OCCUPIED
      const bed = await prisma.bed.findUnique({
        where: { id: BigInt(createdBedConcurrencyId) },
      });
      expect(bed?.status).toBe('OCCUPIED');
    });
  });

  describe('4. Admission & Inpatient Folio Initialization', () => {
    it('should admit patient 1 to Bed 101, transition bed to OCCUPIED and create folio', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inpatient/admissions')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId: testPatient1Id,
          attendingDoctorId: testDoctorId,
          bedId: createdBed1Id,
          admissionType: 'EMERGENCY',
          admissionReason: 'Acute appendicitis monitoring',
          diagnosis: 'K35.80 Acute appendicitis',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admissionNumber).toMatch(/^ADM-\d{8}-\d{4}$/);
      expect(res.body.data.status).toBe('ADMITTED');
      expect(res.body.data.folio).toBeDefined();
      expect(res.body.data.folio.folioNumber).toMatch(/^FOL-\d{8}-\d{4}$/);

      createdAdmissionId = Number(res.body.data.id);
      createdFolioId = Number(res.body.data.folio.id);

      // Check Bed status in DB
      const bed = await prisma.bed.findUnique({
        where: { id: BigInt(createdBed1Id) },
      });
      expect(bed?.status).toBe('OCCUPIED');
    });

    it('should reject admitting a patient who is already admitted', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inpatient/admissions')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId: testPatient1Id,
          attendingDoctorId: testDoctorId,
          bedId: createdBed2Id,
          admissionType: 'ELECTIVE',
          admissionReason: 'Double admission attempt',
        });

      expect(res.status).toBe(409);
      expect(res.body.error?.message || res.body.message).toContain('already admitted');
    });

    it('should reject admitting to an already OCCUPIED bed', async () => {
      // Create an auxiliary patient
      const auxPatient = await prisma.patient.create({
        data: {
          name: `Aux Patient ${Date.now()}`,
          patientId: `AUX${Date.now().toString().slice(-4)}`,
          phone: '03009999999',
          sex: 'male',
          age: '50',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/inpatient/admissions')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId: Number(auxPatient.id),
          attendingDoctorId: testDoctorId,
          bedId: createdBed1Id,
          admissionType: 'ELECTIVE',
          admissionReason: 'Collision test',
        });

      expect(res.status).toBe(409);
      expect(res.body.error?.message || res.body.message).toContain('OCCUPIED');

      await prisma.patient.delete({ where: { id: auxPatient.id } });
    });
  });

  describe('5. Inpatient Folio Charge Posting & Idempotency', () => {
    it('should post a manual charge to folio with idempotency key', async () => {
      const idempotencyKey = `NURSING-CARE-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/inpatient/admissions/${createdAdmissionId}/folio/charges`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          sourceModule: 'SERVICE',
          chargeCategory: 'PROCEDURE',
          description: 'Specialized Nursing Care Day 1',
          quantity: 1,
          unitPrice: 500,
          idempotencyKey,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(Number(res.body.data.item.totalAmount)).toBe(500);
      expect(Number(res.body.data.folio.totalCharges)).toBeGreaterThanOrEqual(500);

      // Re-posting with exact same idempotencyKey should return existing charge without double-billing
      const resDup = await request(app.getHttpServer())
        .post(`/api/v1/inpatient/admissions/${createdAdmissionId}/folio/charges`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          sourceModule: 'SERVICE',
          chargeCategory: 'PROCEDURE',
          description: 'Specialized Nursing Care Day 1',
          quantity: 1,
          unitPrice: 500,
          idempotencyKey,
        });

      expect(resDup.status).toBe(201);
      expect(resDup.body.data.duplicate).toBe(true);
    });

    it('should reverse a posted folio charge with reason and adjust folio balance', async () => {
      // Post item to reverse
      const resItem = await request(app.getHttpServer())
        .post(`/api/v1/inpatient/admissions/${createdAdmissionId}/folio/charges`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          sourceModule: 'SERVICE',
          chargeCategory: 'EQUIPMENT',
          description: 'Pulse Oximeter Rental',
          quantity: 1,
          unitPrice: 300,
          idempotencyKey: `EQUIP-OX-${Date.now()}`,
        });

      const itemId = resItem.body.data.item.id;
      const initialTotal = Number(resItem.body.data.folio.totalCharges);

      // Reverse item
      const resRev = await request(app.getHttpServer())
        .post(`/api/v1/inpatient/folio-items/${itemId}/reverse`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          reversalReason: 'Erroneously billed; equipment not used',
        });

      expect(resRev.status).toBe(200);
      expect(resRev.body.success).toBe(true);
      expect(resRev.body.data.item.isReversed).toBe(true);
      expect(resRev.body.data.item.reversalReason).toBe('Erroneously billed; equipment not used');
      expect(Number(resRev.body.data.folio.totalCharges)).toBe(initialTotal - 300);
    });
  });

  describe('6. Cross-Module Inpatient Posting Integration', () => {
    it('should link radiology orders for admitted patient to folio without raising outpatient invoice', async () => {
      // Find or create a radiology exam
      let exam = await prisma.radiologyExam.findFirst({
        where: { active: true },
      });
      if (!exam) {
        let cat = await prisma.radiologyCategory.findFirst();
        if (!cat) {
          cat = await prisma.radiologyCategory.create({
            data: {
              name: 'E2E Rad Cat',
              modality: 'xray',
            },
          });
        }
        exam = await prisma.radiologyExam.create({
          data: {
            categoryId: cat.id,
            name: 'Chest X-Ray PA',
            code: `RAD_E2E_${Date.now()}`,
            modality: 'xray',
            price: 1200,
            active: true,
          },
        });
      }

      const resRad = await request(app.getHttpServer())
        .post('/api/v1/radiology/orders')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: testPatient1Id,
          doctorId: testDoctorId,
          examIds: [Number(exam.id)],
          urgency: 'urgent',
          clinicalNotes: 'Pre-op chest evaluation',
          bill: true,
        });

      expect(resRad.status).toBe(201);

      // Folio should now include the Radiology charge item
      const resFolio = await request(app.getHttpServer())
        .get(`/api/v1/inpatient/admissions/${createdAdmissionId}/folio`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(resFolio.status).toBe(200);
      const radItem = resFolio.body.data.items.find((item: any) => item.sourceModule === 'RADIOLOGY');
      expect(radItem).toBeDefined();
      expect(Number(radItem.totalAmount)).toBe(Number(exam.price));
    });
  });

  describe('7. Bed Transfer Lifecycle', () => {
    it('should transfer patient from Bed 101 to Bed 103, marking Bed 101 as CLEANING and Bed 103 as OCCUPIED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/inpatient/admissions/${createdAdmissionId}/transfer`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          destinationBedId: createdBed3Id,
          transferReason: 'Patient moved to semi-private room',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const admissionData = res.body.data.admission || res.body.data;
      expect(Number(admissionData.bedId)).toBe(createdBed3Id);
      expect(admissionData.status).toBe('TRANSFERRED');

      // Verify previous Bed 101 is now CLEANING
      const bedOld = await prisma.bed.findUnique({
        where: { id: BigInt(createdBed1Id) },
      });
      expect(bedOld?.status).toBe('CLEANING');

      // Verify new Bed 103 is now OCCUPIED
      const bedNew = await prisma.bed.findUnique({
        where: { id: BigInt(createdBed3Id) },
      });
      expect(bedNew?.status).toBe('OCCUPIED');
    });
  });

  describe('8. Discharge Lifecycle & Folio Settlement', () => {
    it('should discharge patient, transition current bed to CLEANING, post bed charges, and update status', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/inpatient/admissions/${createdAdmissionId}/discharge/complete`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          dischargeCondition: 'IMPROVED',
          dischargeSummary: 'Patient responded well to IV therapy; discharged home with oral medication.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DISCHARGED');
      expect(res.body.data.dischargeSummary).toContain('Patient responded well');

      // Verify Bed 103 transitioned to CLEANING
      const bed3 = await prisma.bed.findUnique({
        where: { id: BigInt(createdBed3Id) },
      });
      expect(bed3?.status).toBe('CLEANING');
    });

    it('should settle the inpatient folio', async () => {
      const resFolio = await request(app.getHttpServer())
        .get(`/api/v1/inpatient/admissions/${createdAdmissionId}/folio`)
        .set('Authorization', `Bearer ${doctorToken}`);

      const balance = Number(resFolio.body.data.balance);

      const resSettle = await request(app.getHttpServer())
        .post(`/api/v1/inpatient/admissions/${createdAdmissionId}/folio/settle`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          paymentMethod: 'CASH',
          amountPaid: balance,
        });

      expect(resSettle.status).toBe(200);
      expect(resSettle.body.success).toBe(true);
      expect(resSettle.body.data.folio.status).toBe('SETTLED');
      expect(Number(resSettle.body.data.folio.balance)).toBe(0);
    });
  });

  describe('9. RBAC & Access Control', () => {
    it('should reject admission attempt by unauthorized user (e.g. pharmacist)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inpatient/admissions')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          patientId: testPatient1Id,
          attendingDoctorId: testDoctorId,
          bedId: createdBed2Id,
          admissionType: 'ELECTIVE',
          admissionReason: 'Unauthorized test',
        });

      expect(res.status).toBe(403);
    });

    it('should allow cleaning staff / receptionist to transition CLEANING bed back to AVAILABLE', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/inpatient/beds/${createdBed1Id}/status`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          status: 'AVAILABLE',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('AVAILABLE');
    });
  });
});
