import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/modules/prisma/prisma.service';

jest.setTimeout(45000);

describe('MedicineModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let doctorToken: string;
  let receptionistToken: string;

  let testCategoryId: number;
  let testManufacturerId: number;
  let testDosageFormId: number;
  let testUnitId: number;
  let testSupplierId: number;
  let testMedicineId: number;
  let testPatientId: number;
  let testDoctorId: number;
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
    const recRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'receptionist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    receptionistToken = recRes.body.data.accessToken;

    // Ensure a test patient exists
    let patient = await prisma.patient.findFirst({ where: { name: 'E2E Medicine Test Patient' } });
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          name: 'E2E Medicine Test Patient',
          patientId: `P${Date.now().toString().slice(-5)}`,
          phone: '03001239999',
          sex: 'female',
          age: '30',
        },
      });
    }
    testPatientId = Number(patient.id);

    // Ensure a test doctor exists
    let doctor = await prisma.doctor.findFirst({ where: { name: 'Dr. Medicine Auditor' } });
    if (!doctor) {
      doctor = await prisma.doctor.create({
        data: {
          name: 'Dr. Medicine Auditor',
          department: 'General Medicine',
          phone: '03001112233',
        },
      });
    }
    testDoctorId = Number(doctor.id);
  });

  afterAll(async () => {
    // Cleanup created records in reverse order
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
    if (testCategoryId) {
      await prisma.medicineCategory.deleteMany({ where: { id: BigInt(testCategoryId) } });
    }
    if (testManufacturerId) {
      await prisma.manufacturer.deleteMany({ where: { id: BigInt(testManufacturerId) } });
    }
    if (testDosageFormId) {
      await prisma.dosageForm.deleteMany({ where: { id: BigInt(testDosageFormId) } });
    }
    if (testUnitId) {
      await prisma.measurementUnit.deleteMany({ where: { id: BigInt(testUnitId) } });
    }
    if (testSupplierId) {
      await prisma.supplier.deleteMany({ where: { id: BigInt(testSupplierId) } });
    }

    await app.close();
  });

  describe('1. Supporting Entities & Metadata Endpoints', () => {
    it('creates and lists medicine categories', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/medicines/meta/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: `Antibiotics-${Date.now()}`,
          description: 'Anti-infective antibacterial medications',
        })
        .expect(201);

      expect(res.body.data.id).toBeDefined();
      testCategoryId = Number(res.body.data.id);

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/medicines/meta/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = listRes.body.data.find((c: any) => c.id === testCategoryId.toString());
      expect(found).toBeDefined();
      expect(found.medicineCount).toBe(0);
    });

    it('creates manufacturer, dosage form, unit, and supplier', async () => {
      // Manufacturer
      const mRes = await request(app.getHttpServer())
        .post('/api/v1/medicines/meta/manufacturers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `GSK-${Date.now()}`, country: 'UK' })
        .expect(201);
      testManufacturerId = Number(mRes.body.data.id);

      // Dosage Form
      const dfRes = await request(app.getHttpServer())
        .post('/api/v1/medicines/meta/dosage-forms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Capsule-${Date.now()}`, description: 'Gelatin capsule' })
        .expect(201);
      testDosageFormId = Number(dfRes.body.data.id);

      // Unit
      const uRes = await request(app.getHttpServer())
        .post('/api/v1/medicines/meta/units')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Milligram-${Date.now()}`, symbol: 'mg' })
        .expect(201);
      testUnitId = Number(uRes.body.data.id);

      // Supplier
      const sRes = await request(app.getHttpServer())
        .post('/api/v1/medicines/meta/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Apex Pharma-${Date.now()}`, contactPerson: 'Tariq' })
        .expect(201);
      testSupplierId = Number(sRes.body.data.id);
    });
  });

  describe('2. Medicine Creation & Duplicate Prevention', () => {
    it('creates a new medicine in the hospital catalogue with all relations', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Amoxil 500mg',
          generic: 'Amoxicillin Trihydrate',
          company: 'GSK Pakistan',
          categoryId: testCategoryId,
          manufacturerId: testManufacturerId,
          dosageFormId: testDosageFormId,
          strength: '500',
          unitId: testUnitId,
          supplierId: testSupplierId,
          box: 'Strip of 10 Capsules',
          price: 15.5,
          sPrice: 22.0,
          quantity: 250,
          effects: 'Administer with food to reduce gastrointestinal discomfort',
          expiryDate: '2028-10-31',
        })
        .expect(201);

      expect(res.body.data.id).toBeDefined();
      testMedicineId = Number(res.body.data.id);
      expect(res.body.data.name).toBe('Amoxil 500mg');
      expect(res.body.data.category.id).toBe(testCategoryId.toString());
      expect(res.body.data.manufacturer.id).toBe(testManufacturerId.toString());
      expect(res.body.data.dosageForm.id).toBe(testDosageFormId.toString());
      expect(res.body.data.measurementUnit.id).toBe(testUnitId.toString());
      expect(res.body.data.price).toBe(15.5);
      expect(res.body.data.sPrice).toBe(22);
      expect(res.body.data.quantity).toBe(250);
      expect(res.body.data.isActive).toBe(true);
    });

    it('rejects duplicate medicine with same name and pack size (409 Conflict)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Amoxil 500mg',
          box: 'Strip of 10 Capsules',
        })
        .expect(409);

      const errMsg = res.body.error?.message || res.body.message;
      expect(errMsg).toContain('already in the catalogue with the same pack or strength');
    });

    it('allows same drug name with a different pack size', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Amoxil 500mg',
          box: 'Bottle of 100 Capsules (Bulk)',
          price: 120.0,
          sPrice: 180.0,
        })
        .expect(201);

      // Clean up the secondary variation
      await prisma.medicine.delete({ where: { id: BigInt(res.body.data.id) } });
    });
  });

  describe('3. Querying, Search, and Autocomplete', () => {
    it('retrieves paginated medicines list with category and company details', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/medicines?q=Amoxil&page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.data.find((m: any) => m.id === testMedicineId.toString());
      expect(found).toBeDefined();
      expect(found.generic).toBe('Amoxicillin Trihydrate');
      expect(res.body.data.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('returns autocomplete search results for active medications', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/medicines/search?q=Amoxil')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].name).toContain('Amoxil');
    });

    it('retrieves single medicine by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/medicines/${testMedicineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(testMedicineId.toString());
      expect(res.body.data.name).toBe('Amoxil 500mg');
    });
  });

  describe('4. Medicine Updates & Soft Deactivation', () => {
    it('updates retail price and pack description', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/medicines/${testMedicineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sPrice: 24.5,
          box: 'Strip of 10 Capsules (Blister)',
        })
        .expect(200);

      expect(res.body.data.sPrice).toBe(24.5);
      expect(res.body.data.box).toBe('Strip of 10 Capsules (Blister)');
    });

    it('deactivates medicine and verifies exclusion from prescribing search', async () => {
      // Deactivate
      await request(app.getHttpServer())
        .patch(`/api/v1/medicines/${testMedicineId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      // Search should no longer return it
      const searchRes = await request(app.getHttpServer())
        .get('/api/v1/medicines/search?q=Amoxil')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      const found = searchRes.body.data.find((m: any) => m.id === testMedicineId.toString());
      expect(found).toBeUndefined();

      // Reactivate for subsequent tests
      await request(app.getHttpServer())
        .patch(`/api/v1/medicines/${testMedicineId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true })
        .expect(200);
    });
  });

  describe('5. Prescription Integration & Deletion Protection', () => {
    it('creates a prescription linking the catalogue medicine and verifies snapshot preservation', async () => {
      const rxRes = await request(app.getHttpServer())
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: testPatientId,
          doctorId: testDoctorId,
          date: '2026-10-31',
          symptom: 'Bacterial pharyngitis',
          items: [
            {
              medicineId: testMedicineId,
              name: 'Amoxil 500mg',
              dosage: '1+0+1',
              duration: '5 days',
              instructions: 'After meals with full glass of water',
            },
          ],
        })
        .expect(201);

      createdPrescriptionId = Number(rxRes.body.data.id);
      expect(rxRes.body.data.items[0].medicineId).toBe(testMedicineId.toString());
      expect(rxRes.body.data.items[0].name).toBe('Amoxil 500mg');

      // Update catalogue drug name to 'Amoxil Forte 500mg'
      await request(app.getHttpServer())
        .put(`/api/v1/medicines/${testMedicineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Amoxil Forte 500mg' })
        .expect(200);

      // Verify prescription's copied historical name is unaffected
      const checkRx = await request(app.getHttpServer())
        .get(`/api/v1/prescriptions/${createdPrescriptionId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      expect(checkRx.body.data.items[0].name).toBe('Amoxil 500mg'); // Preserved!
    });

    it('blocks hard deletion of medicine referenced by prescription (400 Bad Request)', async () => {
      const delRes = await request(app.getHttpServer())
        .delete(`/api/v1/medicines/${testMedicineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      const errMsg = delRes.body.error?.message || delRes.body.message;
      expect(errMsg).toContain('has been prescribed in clinical encounters');
    });

    it('blocks category deletion if medicines exist in it (400 Bad Request)', async () => {
      const delRes = await request(app.getHttpServer())
        .delete(`/api/v1/medicines/meta/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      const errMsg = delRes.body.error?.message || delRes.body.message;
      expect(errMsg).toContain('still has');
    });

    it('allows medicine deletion after referencing prescription is removed', async () => {
      // Remove the prescription using Admin authority
      await request(app.getHttpServer())
        .delete(`/api/v1/prescriptions/${createdPrescriptionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      createdPrescriptionId = 0;

      // Delete the medicine now that it has no references
      const delRes = await request(app.getHttpServer())
        .delete(`/api/v1/medicines/${testMedicineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(delRes.body.data?.message || delRes.body.message).toContain('successfully removed');
      testMedicineId = 0;
    });

    it('allows category deletion after medicine is deleted', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/medicines/meta/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data?.message || res.body.message).toContain('removed successfully');
      testCategoryId = 0;
    });
  });

  describe('6. Authorization & RBAC Enforcement', () => {
    it('rejects unauthenticated requests (401 Unauthorized)', async () => {
      await request(app.getHttpServer()).get('/api/v1/medicines').expect(401);
    });

    it('rejects users without medicine_add permission (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/medicines')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ name: 'Unauthorized Drug' })
        .expect(403);
    });

    it('rejects users without medicine_delete permission (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/medicines/1')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(403);
    });
  });
});
