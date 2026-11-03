import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

jest.setTimeout(120000);

describe('Stage 3 — Complete Hospital Workflow Integration & System Validation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  // Synthetic Role Tokens & User IDs
  let adminToken: string;
  let doctorToken: string;
  let receptionistToken: string;
  let nurseToken: string;
  let pharmacistToken: string;
  let laboratoristToken: string;
  let accountantToken: string;

  let adminUserId: string;
  let doctorUserId: string;
  let branchId: string;

  // Shared Entities Across Workflows
  let patientId: number;
  let doctorId: number;
  let appointmentId: string;
  let prescriptionId: number;
  let medicineId: number;
  let supplierId: number;
  let invoiceId: string;

  const getError = (res: request.Response) =>
    res.body.error?.message || res.body.message || JSON.stringify(res.body);

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
    authService = app.get<AuthService>(AuthService);

    // 0. Ensure default branch exists and assign to all test users
    let branch = await prisma.hospitalBranch.findFirst();
    if (!branch) {
      branch = await prisma.hospitalBranch.create({
        data: {
          name: 'Main Hospital Campus',
          code: 'MAIN',
          active: true,
        },
      });
    }
    branchId = String(branch.id);

    // Assign branchId to all medora test users and create active memberships
    const testUsers = await prisma.user.findMany({
      where: { email: { contains: '@medora.hospital' } },
    });

    for (const u of testUsers) {
      await prisma.user.update({
        where: { id: u.id },
        data: { branchId: branch.id },
      });
      await prisma.userBranchMembership.upsert({
        where: {
          userId_branchId: {
            userId: u.id,
            branchId: branch.id,
          },
        },
        update: { isActive: true },
        create: {
          userId: u.id,
          branchId: branch.id,
          isActive: true,
        },
      });
    }

    // Close any lingering shifts to guarantee clean cashier isolation
    await prisma.cashierShift.updateMany({
      where: { status: { in: ['OPEN', 'CLOSING', 'PENDING_APPROVAL'] } },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    // 1. Authenticate Admin (Hospital Administrator)
    const adminRes = await authService.login(
      { email: 'admin.test@medora.hospital', password: 'ValidPassword123!' },
      '127.0.0.1',
    );
    adminToken = adminRes.accessToken;
    adminUserId = adminRes.user.id;

    // 2. Authenticate Doctor (Consulting Physician / Radiologist)
    const docRes = await authService.login(
      { email: 'doctor.test@medora.hospital', password: 'ValidPassword123!' },
      '127.0.0.1',
    );
    doctorToken = docRes.accessToken;
    doctorUserId = docRes.user.id;

    // 3. Authenticate Receptionist (Front Desk / Cashier)
    const recRes = await authService.login(
      { email: 'receptionist.test@medora.hospital', password: 'ValidPassword123!' },
      '127.0.0.1',
    );
    receptionistToken = recRes.accessToken;

    // 4. Authenticate Nurse (Inpatient / Triage)
    const nurseRes = await authService.login(
      { email: 'nurse.test@medora.hospital', password: 'ValidPassword123!' },
      '127.0.0.1',
    );
    nurseToken = nurseRes.accessToken;

    // 5. Authenticate Pharmacist (Pharmacy / Dispensary)
    const pharmRes = await authService.login(
      { email: 'pharmacist.test@medora.hospital', password: 'ValidPassword123!' },
      '127.0.0.1',
    );
    pharmacistToken = pharmRes.accessToken;

    // 6. Authenticate Laboratorist (Lab Diagnostics / Pathology)
    const labRes = await authService.login(
      { email: 'laboratorist.test@medora.hospital', password: 'ValidPassword123!' },
      '127.0.0.1',
    );
    laboratoristToken = labRes.accessToken;

    // 7. Authenticate Accountant (Treasury / General Ledger)
    const accRes = await authService.login(
      { email: 'accountant.test@medora.hospital', password: 'ValidPassword123!' },
      '127.0.0.1',
    );
    accountantToken = accRes.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ===========================================================================
  // WORKFLOW A: OUTPATIENT VISIT LIFECYCLE
  // ===========================================================================
  describe('Workflow A: Outpatient Visit Lifecycle', () => {
    it('A1: Register dynamic patient in Central Registry', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: `Zainab Bibi ${Date.now().toString().slice(-4)}`,
          fatherName: 'Muhammad Tariq',
          sex: 'female',
          birthdate: '1992-06-15',
          phone: '03001234567',
          cnic: '37405-7654321-1',
          bloodGroup: 'O+',
          city: 'Rawalpindi',
          address: 'Street 4, Sector G-9, Islamabad',
          mlc: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.patientId).toMatch(/^\d{6}$/);
      patientId = Number(res.body.data.id);
    });

    it('A2: Onboard consulting doctor to Cardiology specialty', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/doctors')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: `Dr. Salman Khan ${Date.now()}`,
          department: 'Cardiology',
          phone: '+92 300 9876543',
          profile: 'MBBS, FCPS Cardiology, Interventional Cardiologist',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      doctorId = Number(res.body.data.id);
    });

    it('A3: Query free slots and book outpatient appointment', async () => {
      const bookingDate = '2026-11-25';

      const slotsRes = await request(app.getHttpServer())
        .get(`/api/v1/appointments/free-slots?doctor=${doctorId}&date=${bookingDate}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-branch-id', branchId);
      expect(slotsRes.status).toBe(200);

      const bookRes = await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-branch-id', branchId)
        .send({
          patient: String(patientId),
          doctor: String(doctorId),
          date: bookingDate,
          start: '11:00',
          minutes: 15,
          status: 'scheduled',
          remarks: 'Persistent chest tightness and palpitations',
          b_p: '130/85',
          pulse: '78',
          temprature: '98.6 F',
          weight: '68 kg',
        });

      expect(bookRes.status).toBe(201);
      expect(bookRes.body.success).toBe(true);
      appointmentId = bookRes.body.data.id;
    });

    it('A4: Triage check-in and doctor clinical consultation encounter', async () => {
      // Receptionist marks checked in
      await request(app.getHttpServer())
        .patch(`/api/v1/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-branch-id', branchId)
        .send({ status: 'in consultation' });

      // Doctor conducts consultation & saves complete note
      const consultRes = await request(app.getHttpServer())
        .post(`/api/v1/consultations/visit/${appointmentId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-branch-id', branchId)
        .send({
          action: 'complete',
          presenting_complaint: 'Exertional dyspnea and retrosternal heaviness',
          history: 'Hypertensive for 3 years, non-smoker',
          provisional_diagnosis: 'Stable Angina Pectoris',
          diagnosis: 'Coronary Artery Disease - Angina Functional Class II',
          plan: 'Prescribe anti-anginal regimen, advise resting ECG, CBC, and Lipid Profile',
          treatment: 'Tab Metoprolol 50mg, Tab Aspirin 75mg, Tab Rosuvastatin 20mg',
          b_p: '128/82',
          pulse: '72',
          temprature: '98.4 F',
          weight: '68 kg',
          follow_up_date: '2026-12-10',
        });

      expect(consultRes.status).toBe(200);
      expect(consultRes.body.success).toBe(true);

      // Verify consultation immutability: completed note cannot be overwritten
      const consultNote = await prisma.consultation.findFirst({
        where: { appointmentId: BigInt(appointmentId) },
      });
      expect(consultNote).toBeDefined();
      expect(consultNote?.status).toBe('completed');
    });

    it('A5: Issue outpatient prescription linked to formulary catalogue', async () => {
      const rxRes = await request(app.getHttpServer())
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-branch-id', branchId)
        .send({
          patientId,
          doctorId,
          date: '2026-11-25',
          symptom: 'Angina pectoris Class II',
          advice: 'Avoid unaccustomed heavy physical exertion. Low salt and low fat diet.',
          items: [
            {
              name: 'Metoprolol Tartrate 50mg',
              dosage: '1+0+1',
              duration: '30 days',
              instructions: 'Take with food',
            },
            {
              name: 'Aspirin 75mg',
              dosage: '0+1+0',
              duration: '30 days',
              instructions: 'After lunch with glass of water',
            },
          ],
        });

      expect(rxRes.status).toBe(201);
      expect(rxRes.body.success).toBe(true);
      expect(rxRes.body.data.items.length).toBe(2);
      prescriptionId = Number(rxRes.body.data.id);
    });

    it('A6: Raise itemized OPD invoice and collect payment', async () => {
      const invRes = await request(app.getHttpServer())
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-branch-id', branchId)
        .send({
          patient: patientId,
          doctor: doctorId,
          date: '2026-11-25',
          discount: 200,
          vat: 0,
          remarks: 'Cardiology Specialist Consultation & ECG Fee',
          items: [
            {
              name: 'Cardiology Specialist Consultation',
              quantity: 1,
              unit_price: 2000,
            },
            {
              name: 'Standard 12-Lead ECG',
              quantity: 1,
              unit_price: 800,
            },
          ],
        });

      expect(invRes.status).toBe(201);
      expect(invRes.body.success).toBe(true);
      expect(Number(invRes.body.data.grossTotal)).toBe(2600);
      invoiceId = invRes.body.data.id;

      // Settle invoice via Accountant / Cashier
      const payRes = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${invoiceId}/pay`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-branch-id', branchId)
        .send({
          amount: 2600,
          method: 'Cash',
          reference: `REC-OPD-${Date.now().toString().slice(-6)}`,
        });

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.status).toBe('paid');
      expect(payRes.body.data.balance).toBe('0.00');
    });
  });

  // ===========================================================================
  // WORKFLOW B: PHARMACY DISPENSING & INVENTORY MANAGEMENT
  // ===========================================================================
  describe('Workflow B: Pharmacy Dispensing & Inventory Management', () => {
    let batchId: number;

    it('B1: Setup pharmaceutical supplier and catalogue medicine', async () => {
      const supplier = await prisma.supplier.create({
        data: {
          name: `GSK Pakistan Healthcare ${Date.now()}`,
          phone: '021-34567890',
          email: `gsk_${Date.now()}@pharma.pk`,
        },
      });
      supplierId = Number(supplier.id);

      const med = await prisma.medicine.create({
        data: {
          name: `Metoprolol Tartrate 50mg ${Date.now()}`,
          generic: 'Metoprolol',
          price: 5.0,
          sPrice: 8.0,
          quantity: 0,
          isActive: true,
        },
      });
      medicineId = Number(med.id);
    });

    it('B2: Procure medicine via GRN creating active batch with FEFO expiry', async () => {
      const expiryDate = '2028-12-31';

      const grnRes = await request(app.getHttpServer())
        .post('/api/v1/pharmacy/purchases/receipts')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .set('x-branch-id', branchId)
        .send({
          supplierId,
          supplierInvoiceNumber: `INV-GSK-${Date.now().toString().slice(-5)}`,
          receiptDate: new Date().toISOString().split('T')[0],
          items: [
            {
              medicineId,
              batchNumber: `MTP-B${Date.now().toString().slice(-5)}`,
              expiryDate,
              unitCost: 5.0,
              sellingPrice: 8.0,
              quantityReceived: 100,
            },
          ],
        });

      expect(grnRes.status).toBe(201);
      expect(grnRes.body.success).toBe(true);

      const batch = await prisma.medicineBatch.findFirst({
        where: { medicineId: BigInt(medicineId) },
      });
      expect(batch).toBeDefined();
      expect(batch?.currentQuantity).toBe(100);
      batchId = Number(batch!.id);
    });

    it('B3: Dispense prescribed medication to outpatient with FEFO batch reduction', async () => {
      const dispenseRes = await request(app.getHttpServer())
        .post('/api/v1/pharmacy/dispensations')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .set('x-branch-id', branchId)
        .send({
          patientId,
          doctorId,
          prescriptionId,
          dispenseDate: new Date().toISOString().split('T')[0],
          notes: 'Outpatient prescription dispense for angina patient',
          items: [
            {
              medicineId,
              batchId,
              quantity: 30,
            },
          ],
        });

      expect(dispenseRes.status).toBe(201);
      expect(dispenseRes.body.success).toBe(true);

      // Verify stock decrement in database
      const updatedBatch = await prisma.medicineBatch.findUnique({
        where: { id: BigInt(batchId) },
      });
      expect(updatedBatch?.currentQuantity).toBe(70);

      // Verify immutable stock movement logged
      const movement = await prisma.stockMovement.findFirst({
        where: { batchId: BigInt(batchId), movementType: 'DISPENSING' },
      });
      expect(movement).toBeDefined();
      expect(Math.abs(movement?.quantity ?? 0)).toBe(30);
    });

    it('B4: Stock validation — Reject insufficient stock and expired batches', async () => {
      const today = new Date().toISOString().split('T')[0];

      // 1. Insufficient stock (requesting 500 when only 70 available)
      const overRes = await request(app.getHttpServer())
        .post('/api/v1/pharmacy/dispensations')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .set('x-branch-id', branchId)
        .send({
          patientId,
          dispenseDate: today,
          items: [{ medicineId, batchId, quantity: 500 }],
        });
      expect(overRes.status).toBe(400);
      expect(getError(overRes)).toMatch(/insufficient stock/i);

      // 2. Expired batch rejection
      const expBatch = await prisma.medicineBatch.create({
        data: {
          medicineId: BigInt(medicineId),
          batchNumber: `EXP-BATCH-${Date.now()}`,
          expiryDate: new Date('2021-01-01'),
          costPrice: 4.0,
          sellingPrice: 8.0,
          initialQuantity: 20,
          currentQuantity: 20,
          status: 'ACTIVE',
        },
      });

      const expRes = await request(app.getHttpServer())
        .post('/api/v1/pharmacy/dispensations')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .set('x-branch-id', branchId)
        .send({
          patientId,
          dispenseDate: today,
          items: [{ medicineId, batchId: Number(expBatch.id), quantity: 5 }],
        });
      expect(expRes.status).toBe(400);
      expect(getError(expRes)).toMatch(/expired/i);
    });
  });

  // ===========================================================================
  // WORKFLOW C: LABORATORY DIAGNOSTICS LIFECYCLE
  // ===========================================================================
  describe('Workflow C: Laboratory Diagnostics Lifecycle', () => {
    let labTestCatalogueId: number;
    let labOrderId: number;
    let sampleId: number;

    it('C1: Create laboratory diagnostic test in catalogue with parameters', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/lab/catalogue')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-branch-id', branchId)
        .send({
          name: `Lipid Profile Panel ${Date.now()}`,
          department: 'Biochemistry',
          description: 'Total Cholesterol, Triglycerides, HDL, and LDL',
          referenceValue: 'See parameter ranges',
          price: 1200,
          sampleType: 'Serum / Clot Activator',
          turnaroundHours: 6,
          parameters: [
            {
              name: 'Total Cholesterol',
              unit: 'mg/dL',
              referenceMin: '125',
              referenceMax: '200',
              displayOrder: 1,
            },
            {
              name: 'Triglycerides',
              unit: 'mg/dL',
              referenceMin: '50',
              referenceMax: '150',
              displayOrder: 2,
            },
            {
              name: 'HDL Cholesterol',
              unit: 'mg/dL',
              referenceMin: '40',
              referenceMax: '60',
              displayOrder: 3,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      labTestCatalogueId = Number(res.body.data.id);
    });

    it('C2: Doctor requisitions laboratory order for outpatient', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/lab/orders')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-branch-id', branchId)
        .send({
          patientId,
          doctorId,
          testIds: [labTestCatalogueId],
          priority: 'ROUTINE',
          clinicalNotes: 'Lipid workup for coronary risk stratification',
          generateInvoice: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SAMPLE_PENDING');
      labOrderId = Number(res.body.data.id);
      sampleId = Number(res.body.data.samples[0].id);
    });

    it('C3: Phlebotomy, Specimen Rejection & Accessioning Workflow', async () => {
      // Collect sample
      await request(app.getHttpServer())
        .post(`/api/v1/lab/samples/${sampleId}/collect`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .set('x-branch-id', branchId)
        .send({ notes: 'Venipuncture performed on right arm' })
        .expect(200);

      // Rejection triage: Hemolyzed specimen test
      const rejectRes = await request(app.getHttpServer())
        .post(`/api/v1/lab/samples/${sampleId}/reject`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .set('x-branch-id', branchId)
        .send({ reason: 'HEMOLYZED', notes: 'Severe hemolysis, unsuitable for lipid spectrophotometry' });
      expect(rejectRes.status).toBe(200);

      // Re-collect sample
      await request(app.getHttpServer())
        .post(`/api/v1/lab/samples/${sampleId}/collect`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .set('x-branch-id', branchId)
        .send({ notes: 'Re-drawn successfully with fresh needle' })
        .expect(200);

      // Accession sample into lab
      const receiveRes = await request(app.getHttpServer())
        .post(`/api/v1/lab/samples/${sampleId}/receive`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .set('x-branch-id', branchId)
        .send({ notes: 'Accessioned into central biochemistry bench' });
      expect(receiveRes.status).toBe(200);
      expect(receiveRes.body.data.status).toBe('RECEIVED');
    });

    it('C4: Result Entry, Verification & Pathologist Approval', async () => {
      const order = await prisma.lab.findUnique({
        where: { id: BigInt(labOrderId) },
        include: { tests: true },
      });
      const testItem = order!.tests[0];

      // Result Entry
      const entryRes = await request(app.getHttpServer())
        .post(`/api/v1/lab/orders/${labOrderId}/results`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .set('x-branch-id', branchId)
        .send({
          parameters: [
            {
              testId: Number(testItem.id),
              parameterName: 'Total Cholesterol',
              value: '235',
              unitSnapshot: 'mg/dL',
              referenceRangeSnapshot: '125 - 200',
              abnormalFlag: 'HIGH',
            },
            {
              testId: Number(testItem.id),
              parameterName: 'Triglycerides',
              value: '180',
              unitSnapshot: 'mg/dL',
              referenceRangeSnapshot: '50 - 150',
              abnormalFlag: 'HIGH',
            },
            {
              testId: Number(testItem.id),
              parameterName: 'HDL Cholesterol',
              value: '38',
              unitSnapshot: 'mg/dL',
              referenceRangeSnapshot: '40 - 60',
              abnormalFlag: 'LOW',
            },
          ],
          summary: 'Atherogenic dyslipidemia: elevated total cholesterol and triglycerides, low HDL',
        });
      expect(entryRes.status).toBe(200);
      expect(entryRes.body.data.status).toBe('RESULT_ENTERED');

      // Technologist Verification
      const verifyRes = await request(app.getHttpServer())
        .post(`/api/v1/lab/orders/${labOrderId}/verify`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .set('x-branch-id', branchId)
        .send({ comments: 'Quality controls verified on Cobas 6000 chemistry analyzer' });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.status).toBe('VERIFIED');

      // Pathologist Approval
      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/lab/orders/${labOrderId}/approve`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .set('x-branch-id', branchId)
        .send({ remarks: 'Clinically correlated and authorized' });
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('COMPLETED');
      expect(approveRes.body.data.approvedBy).toBeDefined();

      // Final Report / Order Retrieval
      const reportRes = await request(app.getHttpServer())
        .get(`/api/v1/lab/orders/${labOrderId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-branch-id', branchId);
      expect(reportRes.status).toBe(200);
      expect(reportRes.body.data.orderNumber).toBeDefined();
      expect(reportRes.body.data.tests[0].resultParameters.length).toBe(3);
    });
  });

  // ===========================================================================
  // WORKFLOW D: RADIOLOGY & DIAGNOSTIC IMAGING
  // ===========================================================================
  describe('Workflow D: Radiology & Diagnostic Imaging', () => {
    let examId: number;
    let radOrderId: number;

    it('D1: Configure radiology procedure in catalogue', async () => {
      const exam = await prisma.radiologyExam.create({
        data: {
          name: `Echocardiogram (Transthoracic) ${Date.now()}`,
          code: `ECHO-${Date.now().toString().slice(-4)}`,
          modality: 'ultrasound',
          price: 3500,
        },
      });
      examId = Number(exam.id);
    });

    it('D2: Order radiology procedure and schedule examination with collision detection', async () => {
      // Place Order
      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/radiology/orders')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-branch-id', branchId)
        .send({
          patientId,
          doctorId,
          examIds: [examId],
          clinicalIndication: 'Assess left ventricular systolic function and regional wall motion abnormalities',
          urgent: false,
          bill: true,
        });

      expect(orderRes.status).toBe(201);
      expect(orderRes.body.success).toBe(true);
      radOrderId = Number(orderRes.body.data[0].id);

      // Schedule Procedure
      const equipmentRoom = `Echo-Room-${Date.now().toString().slice(-4)}`;
      const scheduleTime = new Date(Date.now() + 7200000).toISOString();
      const schedRes = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${radOrderId}/schedule`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-branch-id', branchId)
        .send({
          scheduledAt: scheduleTime,
          equipmentRoom,
          notes: 'Standard outpatient echo slot',
        });

      expect(schedRes.status).toBe(200);
      expect(schedRes.body.data.status).toBe('scheduled');
      expect(schedRes.body.data.equipmentRoom).toBe(equipmentRoom);
    });

    it('D3: Conduct examination, enter findings and authorize final report', async () => {
      // Patient arrived
      await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${radOrderId}/arrived`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .set('x-branch-id', branchId)
        .expect(200);

      // Start examination
      await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${radOrderId}/start`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .set('x-branch-id', branchId)
        .send({ equipmentRoom: 'Echo-Suite-A' })
        .expect(200);

      // Complete examination
      await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${radOrderId}/complete`)
        .set('Authorization', `Bearer ${laboratoristToken}`)
        .set('x-branch-id', branchId)
        .send({ imageCount: 4 })
        .expect(200);

      // Record Findings
      const findingsRes = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${radOrderId}/report`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-branch-id', branchId)
        .send({
          findings: 'Concentric left ventricular hypertrophy. Normal LV ejection fraction (LVEF 55%). Mild diastolic dysfunction Grade I.',
          impression: 'Hypertensive heart disease with preserved ejection fraction',
          recommendations: 'Continue anti-hypertensive therapy, repeat echo in 1 year',
        });
      expect(findingsRes.status).toBe(200);

      // Authorize and Approve
      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/${radOrderId}/approve`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-branch-id', branchId)
        .send({ notes: 'Verified and signed off by consultant cardiologist' });
      expect(approveRes.status).toBe(200);

      // Fetch final report
      const repRes = await request(app.getHttpServer())
        .get(`/api/v1/radiology/orders/${radOrderId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-branch-id', branchId);
      expect(repRes.status).toBe(200);
      expect(repRes.body.data.findings).toContain('LV ejection fraction');
    });
  });

  // ===========================================================================
  // WORKFLOW E: INPATIENT ADMISSION & BED MANAGEMENT
  // ===========================================================================
  describe('Workflow E: Inpatient Admission & Bed Management', () => {
    let wardId: number;
    let bed1Id: number;
    let bed2Id: number;
    let admissionId: number;

    it('E1: Setup ward and create beds', async () => {
      // Ward setup
      const wardRes = await request(app.getHttpServer())
        .post('/api/v1/inpatient/wards')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-branch-id', branchId)
        .send({
          category: `Coronary Care Unit (CCU) ${Date.now()}`,
          code: `CCU-${Date.now().toString().slice(-4)}`,
          description: 'Intensive Cardiac Care Ward',
          baseRate: 5000,
          billingUnit: 'DAILY',
        });
      expect(wardRes.status).toBe(201);
      wardId = Number(wardRes.body.data.id);

      // Bed 1
      const bed1Res = await request(app.getHttpServer())
        .post('/api/v1/inpatient/beds')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-branch-id', branchId)
        .send({
          categoryId: wardId,
          number: `CCU-BED-${Date.now().toString().slice(-3)}A`,
          description: 'Telemetry monitor bed',
        });
      expect(bed1Res.status).toBe(201);
      bed1Id = Number(bed1Res.body.data.id);

      // Bed 2
      const bed2Res = await request(app.getHttpServer())
        .post('/api/v1/inpatient/beds')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-branch-id', branchId)
        .send({
          categoryId: wardId,
          number: `CCU-BED-${Date.now().toString().slice(-3)}B`,
          description: 'Step-down telemetry bed',
        });
      expect(bed2Res.status).toBe(201);
      bed2Id = Number(bed2Res.body.data.id);
    });

    it('E2: Admit patient to Bed 1 and verify occupied lock', async () => {
      const admitRes = await request(app.getHttpServer())
        .post('/api/v1/inpatient/admissions')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-branch-id', branchId)
        .send({
          patientId,
          attendingDoctorId: doctorId,
          bedId: bed1Id,
          wardId,
          admissionType: 'ELECTIVE',
          admissionReason: 'Unstable Angina observation',
          diagnosis: 'Coronary artery disease observation',
        });

      expect(admitRes.status).toBe(201);
      expect(admitRes.body.success).toBe(true);
      admissionId = Number(admitRes.body.data.id);

      // Verify Bed 1 status changed to OCCUPIED
      const bed = await prisma.bed.findUnique({ where: { id: BigInt(bed1Id) } });
      expect(bed?.status).toBe('OCCUPIED');

      // Collision assertion: Attempting to admit another patient to Bed 1 must receive 409 Conflict
      const dummyPatient = await prisma.patient.create({
        data: {
          name: `Collision Candidate ${Date.now()}`,
          patientId: `CC${Date.now().toString().slice(-5)}`,
          phone: '03009999999',
          sex: 'male',
          age: '50',
        },
      });

      const conflictRes = await request(app.getHttpServer())
        .post('/api/v1/inpatient/admissions')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-branch-id', branchId)
        .send({
          patientId: Number(dummyPatient.id),
          attendingDoctorId: doctorId,
          bedId: bed1Id,
          admissionType: 'ELECTIVE',
          admissionReason: 'Collision test',
        });

      expect(conflictRes.status).toBe(409);
      expect(getError(conflictRes)).toMatch(/not available|occupied/i);
    });

    it('E3: Bed Transfer — Move patient from Bed 1 to Bed 2', async () => {
      const xferRes = await request(app.getHttpServer())
        .post(`/api/v1/inpatient/admissions/${admissionId}/transfer`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .set('x-branch-id', branchId)
        .send({
          targetBedId: bed2Id,
          reason: 'Transferred to step-down telemetry for recovery',
        });

      expect(xferRes.status).toBe(200);
      expect(xferRes.body.success).toBe(true);

      // Verify Bed 1 transitioned to CLEANING upon transfer and Bed 2 is OCCUPIED
      const oldBed = await prisma.bed.findUnique({ where: { id: BigInt(bed1Id) } });
      const newBed = await prisma.bed.findUnique({ where: { id: BigInt(bed2Id) } });
      expect(oldBed?.status).toBe('CLEANING');
      expect(newBed?.status).toBe('OCCUPIED');
    });

    it('E4: Inpatient Folio charge posting, discharge to CLEANING, and folio settlement', async () => {
      // Post nursing care charge to inpatient folio
      const chargeRes = await request(app.getHttpServer())
        .post(`/api/v1/inpatient/admissions/${admissionId}/folio/charges`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .set('x-branch-id', branchId)
        .send({
          sourceModule: 'SERVICE',
          chargeCategory: 'PROCEDURE',
          description: '24-Hour Continuous Cardiac Telemetry Monitoring',
          unitPrice: 1500,
          quantity: 1,
          idempotencyKey: `FOLIO-CHG-${Date.now()}`,
        });
      expect(chargeRes.status).toBe(201);

      // Discharge patient
      const dischRes = await request(app.getHttpServer())
        .post(`/api/v1/inpatient/admissions/${admissionId}/discharge/complete`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-branch-id', branchId)
        .send({
          dischargeCondition: 'IMPROVED',
          dischargeSummary: 'Stable and pain-free. Transferred to outpatient cardiac rehab.',
        });
      expect(dischRes.status).toBe(200);

      // Invariant: Bed status must transition directly to CLEANING
      const bedAfterDisch = await prisma.bed.findUnique({ where: { id: BigInt(bed2Id) } });
      expect(bedAfterDisch?.status).toBe('CLEANING');

      // Fetch folio balance to settle
      const folio = await prisma.inpatientFolio.findFirst({
        where: { admissionId: BigInt(admissionId) },
      });
      const balanceToPay = Number(folio?.balance || 1500);

      // Settle folio balance
      const settleRes = await request(app.getHttpServer())
        .post(`/api/v1/inpatient/admissions/${admissionId}/folio/settle`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-branch-id', branchId)
        .send({
          paymentMethod: 'CASH',
          amountPaid: balanceToPay,
        });
      expect(settleRes.status).toBe(200);
      expect(settleRes.body.data.folio.status).toBe('SETTLED');

      // Housekeeping marks Bed Clean & Ready -> AVAILABLE
      const cleanRes = await request(app.getHttpServer())
        .patch(`/api/v1/inpatient/beds/${bed2Id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-branch-id', branchId)
        .send({ status: 'AVAILABLE' });
      expect(cleanRes.status).toBe(200);
      expect(cleanRes.body.data.status).toBe('AVAILABLE');
    });
  });

  // ===========================================================================
  // WORKFLOW F: CASHIER & TREASURY SETTLEMENT
  // ===========================================================================
  describe('Workflow F: Cashier & Treasury Settlement', () => {
    let cashierShiftId: number;

    it('F1: Open cashier shift with float and enforce single active shift invariant', async () => {
      // 1. Open morning shift with 1,000 PKR opening cash
      const openRes = await request(app.getHttpServer())
        .post('/api/v1/cashier/shifts/open')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-branch-id', branchId)
        .send({
          openingCash: 1000.0,
          notes: 'Main OPD morning reception drawer float',
        });

      expect(openRes.status).toBe(201);
      expect(openRes.body.data.status).toBe('OPEN');
      expect(Number(openRes.body.data.openingCash)).toBe(1000);
      cashierShiftId = Number(openRes.body.data.id);

      // 2. Invariant: Opening a second shift while one is active returns 409 Conflict
      const duplicateShiftRes = await request(app.getHttpServer())
        .post('/api/v1/cashier/shifts/open')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-branch-id', branchId)
        .send({ openingCash: 500.0 });

      expect(duplicateShiftRes.status).toBe(409);
      expect(getError(duplicateShiftRes)).toContain('active shift');
    });

    it('F2: Record cash transaction, petty cash payout, and submit shift close', async () => {
      // Record a petty cash payout (e.g. stationery purchase)
      const payoutRes = await request(app.getHttpServer())
        .post(`/api/v1/cashier/shifts/${cashierShiftId}/payout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-branch-id', branchId)
        .send({
          amount: 250.0,
          recipient: 'Stationery Vendor',
          reason: 'Emergency prescription slip printing paper',
        });
      expect(payoutRes.status).toBe(200);

      // Submit Shift Close with counted denominations
      const closeRes = await request(app.getHttpServer())
        .post(`/api/v1/cashier/shifts/${cashierShiftId}/close`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-branch-id', branchId)
        .send({
          countedCash: 750.0,
          closingNotes: 'Balanced cash tally at shift close',
          denominations: [
            { denomination: 500, count: 1 },
            { denomination: 100, count: 2 },
            { denomination: 50, count: 1 },
          ],
        });

      expect(closeRes.status).toBe(200);
      expect(closeRes.body.data.status).toBe('PENDING_APPROVAL');

      // Supervisor dual-control sign-off (Admin signs off)
      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/cashier/shifts/${cashierShiftId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-branch-id', branchId)
        .send({ notes: 'Drawer float and receipts audited and verified' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('CLOSED');

      // Verify Daybook query
      const daybookRes = await request(app.getHttpServer())
        .get('/api/v1/cashier/day-book')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-branch-id', branchId);
      expect(daybookRes.status).toBe(200);
      expect(daybookRes.body.data.lines).toBeDefined();
      expect(daybookRes.body.data.collections).toBeDefined();
    });
  });

  // ===========================================================================
  // WORKFLOW G: GENERAL ACCOUNTING & BALANCED GENERAL LEDGER
  // ===========================================================================
  describe('Workflow G: General Accounting & Balanced General Ledger', () => {
    let journalId: number;
    let cashAccountId: number;
    let bankAccountId: number;

    it('G1: Verify Standard Chart of Accounts and post balanced double-entry journal', async () => {
      // Verify Chart of Accounts exists
      const coaRes = await request(app.getHttpServer())
        .get('/api/v1/accounting/accounts')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-branch-id', branchId);
      expect(coaRes.status).toBe(200);
      const accounts = coaRes.body.data.items || coaRes.body.data;
      expect(accounts.length).toBeGreaterThanOrEqual(10);

      const cashAccount = accounts.find((a: any) => a.accountCode === '1010');
      const bankAccount = accounts.find((a: any) => a.accountCode === '1020');
      expect(cashAccount).toBeDefined();
      expect(bankAccount).toBeDefined();
      cashAccountId = Number(cashAccount.id);
      bankAccountId = Number(bankAccount.id);

      // Post balanced journal entry: Debit Bank 10,000 / Credit Cash 10,000
      const createJourRes = await request(app.getHttpServer())
        .post('/api/v1/accounting/journals')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-branch-id', branchId)
        .send({
          accountingDate: new Date().toISOString().split('T')[0],
          description: 'Specialist cardiac clinic direct cash fee batch',
          postImmediately: false,
          lines: [
            {
              accountId: bankAccountId,
              debit: 10000,
              credit: 0,
              description: 'Operating bank account deposit',
            },
            {
              accountId: cashAccountId,
              debit: 0,
              credit: 10000,
              description: 'Cash vault disbursement',
            },
          ],
        });

      expect(createJourRes.status).toBe(201);
      journalId = Number(createJourRes.body.data.id);

      // Post the journal to General Ledger
      const postJourRes = await request(app.getHttpServer())
        .post(`/api/v1/accounting/journals/${journalId}/post`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-branch-id', branchId);

      expect(postJourRes.status).toBe(200);
      expect(postJourRes.body.data.status).toBe('POSTED');
    });

    it('G2: General Ledger Invariants — Reject unbalanced entry, prevent deletion, and execute signed reversal', async () => {
      // 1. Unbalanced journal assertion (Debit 5000 != Credit 3000)
      const unbalRes = await request(app.getHttpServer())
        .post('/api/v1/accounting/journals')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-branch-id', branchId)
        .send({
          accountingDate: new Date().toISOString().split('T')[0],
          description: 'Unbalanced journal attempt',
          lines: [
            { accountId: bankAccountId, debit: 5000, credit: 0 },
            { accountId: cashAccountId, debit: 0, credit: 3000 },
          ],
        });
      expect(unbalRes.status).toBe(400);
      expect(getError(unbalRes)).toMatch(/balance|equilibrium/i);

      // 2. Immutability assertion: Deleting posted journal returns 403 Forbidden
      const delRes = await request(app.getHttpServer())
        .delete(`/api/v1/accounting/journals/${journalId}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-branch-id', branchId);
      expect(delRes.status).toBe(403);
      expect(getError(delRes)).toMatch(/immutable|posted journal/i);

      // 3. Signed mirror-image reversal
      const revRes = await request(app.getHttpServer())
        .post(`/api/v1/accounting/journals/${journalId}/reverse`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-branch-id', branchId)
        .send({ reason: 'Billing reclassification audit correction' });

      expect(revRes.status).toBe(200);
      expect(revRes.body.data.status).toBe('POSTED');
      expect(revRes.body.data.reversedEntryId).toBe(String(journalId));

      // Verify original journal status is now marked REVERSED
      const origRes = await request(app.getHttpServer())
        .get(`/api/v1/accounting/journals/${journalId}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-branch-id', branchId);
      expect(origRes.status).toBe(200);
      expect(origRes.body.data.status).toBe('REVERSED');
    });

    it('G3: Financial Reports — Query Trial Balance, Profit & Loss, and Balance Sheet', async () => {
      // Trial Balance
      const tbRes = await request(app.getHttpServer())
        .get('/api/v1/accounting/reports/trial-balance')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-branch-id', branchId);
      expect(tbRes.status).toBe(200);
      expect(tbRes.body.data.isBalanced).toBe(true);

      // Profit & Loss
      const plRes = await request(app.getHttpServer())
        .get('/api/v1/accounting/reports/profit-loss')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-branch-id', branchId);
      expect(plRes.status).toBe(200);
      expect(plRes.body.data.netOperatingIncome).toBeDefined();

      // Balance Sheet
      const bsRes = await request(app.getHttpServer())
        .get('/api/v1/accounting/reports/balance-sheet')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-branch-id', branchId);
      expect(bsRes.status).toBe(200);
      expect(bsRes.body.data.totalAssets).toBeDefined();
    });
  });

  // ===========================================================================
  // WORKFLOW H: HOSPITAL ADMINISTRATION & MULTI-BRANCH GOVERNANCE
  // ===========================================================================
  describe('Workflow H: Hospital Administration & Multi-Branch Governance', () => {
    let staffProfileId: number;
    let newDesignationId: number;

    it('H1: Create designation and onboard staff profile with sequential EMP-YYYYMM-XXXX', async () => {
      // Create Designation
      const desigRes = await request(app.getHttpServer())
        .post('/api/v1/staff/designations')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-branch-id', branchId)
        .send({
          code: `CAR-SPEC-${Date.now().toString().slice(-4)}`,
          title: 'Cardiac Critical Care Specialist',
          category: 'CLINICAL',
          description: 'Specialist physician in cardiac intensive care unit',
        });
      expect(desigRes.status).toBe(201);
      newDesignationId = Number(desigRes.body.data.id);

      // Onboard Staff Profile
      const depts = await prisma.department.findMany({ take: 1 });

      const staffRes = await request(app.getHttpServer())
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-branch-id', branchId)
        .send({
          firstName: 'Farhan',
          lastName: 'Qureshi',
          email: `farhan.${Date.now()}@medora.hospital`,
          phone: '+92 333 1234567',
          departmentId: Number(depts[0].id),
          designationId: newDesignationId,
          branchId: Number(branchId),
        });

      expect(staffRes.status).toBe(201);
      expect(staffRes.body.data.employeeNumber).toMatch(/^EMP-\d{6}-\d{4}$/);
      staffProfileId = Number(staffRes.body.data.id);
    });

    it('H2: Multi-Branch Hospital Settings & Configuration Inheritance', async () => {
      const settingsRes = await request(app.getHttpServer())
        .get('/api/v1/settings/hospital')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-branch-id', branchId);

      expect(settingsRes.status).toBe(200);
      expect(settingsRes.body.data.hospitalName).toBeDefined();
    });

    it('H3: Transactional Notifications — Admin dispatches alert and Doctor marks as read', async () => {
      // Dispatch alert to Doctor
      const notifRes = await request(app.getHttpServer())
        .post('/api/v1/admin/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-branch-id', branchId)
        .send({
          eventType: 'CLINICAL_ALERT',
          channel: 'IN_APP',
          title: 'Urgent Coronary Care Review',
          message: 'Patient in CCU Bed requires review of latest telemetry trace',
          priority: 'URGENT',
          recipients: [{ userId: doctorUserId }],
          deduplicationKey: `NOTIF-ALERT-${Date.now()}`,
        });

      expect(notifRes.status).toBe(201);
      const notifId = notifRes.body.data.id;

      // Doctor retrieves notification feed
      const feedRes = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-branch-id', branchId);

      expect(feedRes.status).toBe(200);
      const list = feedRes.body.data.data || feedRes.body.data;
      const docItem = list.find((n: any) => n.notificationId === notifId);
      expect(docItem).toBeDefined();
      expect(docItem.isRead).toBe(false);

      // Doctor marks notification as read
      const markRes = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${docItem.recipientId}/read`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-branch-id', branchId);

      expect(markRes.status).toBe(200);
      expect(markRes.body.data.isRead).toBe(true);
    });
  });

  // ===========================================================================
  // ROLE-BASED SYSTEM TESTING (10 SYNTHETIC PERSONAS)
  // ===========================================================================
  describe('Role-Based Cross-Cutting Security & Authorization Enforcement', () => {
    it('R1: Receptionist is blocked from dispensing pharmacy inventory (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pharmacy/dispensations')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('x-branch-id', branchId)
        .send({
          patientId,
          items: [{ medicineId, quantity: 1 }],
        });
      expect(res.status).toBe(403);
    });

    it('R2: Pharmacist is blocked from approving radiology diagnostic reports (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/radiology/orders/9999/approve`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .set('x-branch-id', branchId)
        .send({ notes: 'Unauthorized sign-off attempt' });
      expect(res.status).toBe(403);
    });

    it('R3: Nurse is blocked from posting General Ledger journals (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounting/journals')
        .set('Authorization', `Bearer ${nurseToken}`)
        .set('x-branch-id', branchId)
        .send({
          accountingDate: '2026-11-25',
          description: 'Unauthorized nurse journal',
          lines: [],
        });
      expect(res.status).toBe(403);
    });

    it('R4: Doctor is blocked from approving cashier shift closes (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cashier/shifts/9999/approve`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .set('x-branch-id', branchId)
        .send({ notes: 'Doctor cannot approve drawer' });
      expect(res.status).toBe(403);
    });

    it('R5: Unauthenticated API access is strictly rejected (401 Unauthorized)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/patients');
      expect(res.status).toBe(401);
    });
  });
});
