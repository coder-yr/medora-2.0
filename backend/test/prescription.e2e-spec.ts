import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/modules/prisma/prisma.service';

jest.setTimeout(45000);

describe('PrescriptionModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let doctorToken: string;
  let receptionistToken: string;

  let testPatientId: number;
  let testDoctorId: number;
  let testMedicineId: number;
  let createdPrescriptionId: number;

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

    prisma = app.get<PrismaService>(PrismaService);

    // Authenticate Admin
    const adminRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'admin.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // Authenticate Doctor
    const doctorRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'doctor.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    doctorToken = doctorRes.body.data.accessToken;

    // Authenticate Receptionist
    const recepRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'receptionist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    receptionistToken = recepRes.body.data.accessToken;

    const suffix = Date.now().toString().slice(-6);

    // Create test patient
    const p = await prisma.patient.create({
      data: {
        name: 'Prescription Test Patient',
        patientId: `P${suffix}`,
        phone: '03009999001',
        howAdded: 'e2e',
      },
    });
    testPatientId = Number(p.id);

    // Create test doctor
    const d = await prisma.doctor.create({
      data: {
        name: 'Dr Prescription Tester',
        email: `doc.rx.${suffix}@test.medora`,
        department: 'General Medicine',
      },
    });
    testDoctorId = Number(d.id);

    // Create test medicine
    const m = await prisma.medicine.create({
      data: {
        name: 'Amoxil 500mg',
        generic: 'Amoxicillin',
        company: 'GSK',
        price: 150.0,
        quantity: 100,
      },
    });
    testMedicineId = Number(m.id);
  }, 45000);

  afterAll(async () => {
    try {
      if (createdPrescriptionId) {
        await prisma.prescriptionMedicine.deleteMany({
          where: { prescriptionId: BigInt(createdPrescriptionId) },
        });
        await prisma.prescription.deleteMany({
          where: { id: BigInt(createdPrescriptionId) },
        });
      }
      if (testMedicineId) {
        await prisma.medicine.deleteMany({ where: { id: BigInt(testMedicineId) } });
      }
      if (testDoctorId) {
        await prisma.doctor.deleteMany({ where: { id: BigInt(testDoctorId) } });
      }
      if (testPatientId) {
        await prisma.patient.deleteMany({ where: { id: BigInt(testPatientId) } });
      }
    } catch {
      // Ignore cleanup error in test
    }
    await app.close();
  });

  describe('POST /api/v1/prescriptions', () => {
    it('doctor can create prescription with catalogue medicine and legacy summary', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          date: '2026-10-30',
          symptom: 'Sore throat and fever',
          advice: 'Drink warm fluids',
          note: 'Take after food',
          validity: '10 days',
          items: [
            {
              medicineId: testMedicineId,
              dosage: '1+0+1',
              duration: '5 days',
              instructions: 'After meals',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.patientId).toBe(testPatientId.toString());
      expect(res.body.data.doctorId).toBe(testDoctorId.toString());
      expect(res.body.data.medicine).toBe('Amoxil 500mg 1+0+1 for 5 days');
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].name).toBe('Amoxil 500mg');
      expect(res.body.data.items[0].dosage).toBe('1+0+1');

      createdPrescriptionId = Number(res.body.data.id);
    });

    it('allows a drug outside the catalogue to be prescribed with custom name', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          date: '2026-10-30',
          items: [
            {
              name: 'Imported Antifungal Cream',
              dosage: 'Apply BD',
              duration: '14 days',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.items[0].name).toBe('Imported Antifungal Cream');
      expect(res.body.data.items[0].medicineId).toBeNull();
      expect(res.body.data.medicine).toBe('Imported Antifungal Cream Apply BD for 14 days');

      // Cleanup
      await prisma.prescriptionMedicine.deleteMany({
        where: { prescriptionId: BigInt(res.body.data.id) },
      });
      await prisma.prescription.deleteMany({
        where: { id: BigInt(res.body.data.id) },
      });
    });

    it('rejects prescription with empty items list', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          date: '2026-10-30',
          items: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Add at least one medicine, or this prescription says nothing.');
    });

    it('rejects prescription with only blank items', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          date: '2026-10-30',
          items: [{ name: '   ', dosage: '' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Add at least one medicine, or this prescription says nothing.');
    });

    it('denies receptionist from creating prescriptions (RBAC)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          date: '2026-10-30',
          items: [{ name: 'Paracetamol', dosage: '1+1+1' }],
        });

      expect(res.status).toBe(403);
    });

    it('denies unauthenticated request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/prescriptions')
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          date: '2026-10-30',
          items: [{ name: 'Paracetamol', dosage: '1+1+1' }],
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/prescriptions', () => {
    it('doctor can list prescriptions with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    });

    it('can search prescriptions by drug name', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/prescriptions?drug=Amoxil')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.data[0].items[0].name).toContain('Amoxil');
    });

    it('returns empty list when searching for unmatched drug', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/prescriptions?drug=NonExistentMedicationXYZ123')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toHaveLength(0);
      expect(res.body.data.total).toBe(0);
    });
  });

  describe('GET /api/v1/prescriptions/:id', () => {
    it('retrieves single prescription with details and line items', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/prescriptions/${createdPrescriptionId}`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdPrescriptionId.toString());
      expect(res.body.data.patient.name).toBe('Prescription Test Patient');
      expect(res.body.data.doctor.name).toBe('Dr Prescription Tester');
      expect(res.body.data.items).toHaveLength(1);
    });

    it('returns 404 for nonexistent prescription', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/prescriptions/999999999')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/prescriptions/:id', () => {
    it('doctor can update prescription and wholesale replace drug list', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/prescriptions/${createdPrescriptionId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          advice: 'Updated medical advice: rest for 1 week',
          items: [
            {
              name: 'Paracetamol 500mg',
              dosage: '1+1+1',
              duration: '3 days',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.advice).toBe('Updated medical advice: rest for 1 week');
      expect(res.body.data.medicine).toBe('Paracetamol 500mg 1+1+1 for 3 days');
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].name).toBe('Paracetamol 500mg');
    });
  });

  describe('GET /api/v1/prescriptions/medicines/search', () => {
    it('searches medicine catalogue for prescribing autocomplete', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/prescriptions/medicines/search?q=Amox')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].name).toContain('Amoxil');
    });
  });

  describe('DELETE /api/v1/prescriptions/:id', () => {
    it('doctor is forbidden from deleting prescriptions (admin only)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/prescriptions/${createdPrescriptionId}`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(403);
    });

    it('admin can delete prescription', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/prescriptions/${createdPrescriptionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Prescription removed.');

      // Verify deletion
      const checkRes = await request(app.getHttpServer())
        .get(`/api/v1/prescriptions/${createdPrescriptionId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(checkRes.status).toBe(404);

      createdPrescriptionId = 0; // prevent double cleanup
    });
  });
});
