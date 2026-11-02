import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';

function getData(res: any) {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

function getError(res: any) {
  const err = res.body?.error?.message || res.body?.message;
  return Array.isArray(err) ? err.join('; ') : String(err || '');
}

describe('Cashier, Shift Close & Treasury Settlement (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let receptionistToken: string;

  let receptionistUser: any;
  let adminUser: any;

  let testPatientId: number;
  let testDoctorId: number;
  let testInvoice1Id: number;
  let testInvoice2Id: number;

  let shiftId: number;
  let supervisorShiftId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Authenticate users
    const recRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'receptionist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    receptionistToken = getData(recRes).accessToken;

    const adminRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'admin.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    adminToken = getData(adminRes).accessToken;

    // Get user records
    receptionistUser = await prisma.user.findFirst({
      where: { email: 'receptionist.test@medora.hospital' },
    });
    adminUser = await prisma.user.findFirst({
      where: { email: 'admin.test@medora.hospital' },
    });

    // Close any lingering active shifts for test users to guarantee clean test isolation
    await prisma.cashierShift.updateMany({
      where: {
        cashierId: { in: [receptionistUser.id, adminUser.id] },
        status: { in: ['OPEN', 'CLOSING', 'PENDING_APPROVAL'] },
      },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    // Ensure a doctor exists
    let doc = await prisma.doctor.findFirst();
    if (!doc) {
      doc = await prisma.doctor.create({
        data: {
          name: `Dr. Cashier E2E ${Date.now()}`,
          email: `doc_cash_${Date.now()}@test.hospital`,
          phone: '03001234567',
          department: 'General OPD',
        },
      });
    }
    testDoctorId = Number(doc.id);

    // Create a test patient
    const patient = await prisma.patient.create({
      data: {
        name: `Cashier E2E Patient ${Date.now()}`,
        patientId: `CP-${Date.now().toString().slice(-6)}`,
        phone: '03112233445',
        sex: 'male',
        age: '40',
      },
    });
    testPatientId = Number(patient.id);

    // Create 2 test unpaid invoices
    const inv1 = await prisma.payment.create({
      data: {
        patientId: BigInt(testPatientId),
        date: new Date().toISOString().slice(0, 10),
        amount: 1000,
        grossTotal: 1000,
        amountReceived: 0,
        status: 'unpaid',
        careSetting: 'opd',
      },
    });
    testInvoice1Id = Number(inv1.id);

    const inv2 = await prisma.payment.create({
      data: {
        patientId: BigInt(testPatientId),
        date: new Date().toISOString().slice(0, 10),
        amount: 2000,
        grossTotal: 2000,
        amountReceived: 0,
        status: 'unpaid',
        careSetting: 'opd',
      },
    });
    testInvoice2Id = Number(inv2.id);
  });

  afterAll(async () => {
    try {
      if (shiftId) {
        await prisma.cashTransaction.deleteMany({ where: { shiftId: BigInt(shiftId) } });
        await prisma.shiftCloseDenomination.deleteMany({ where: { shiftId: BigInt(shiftId) } });
        await prisma.cashierShift.deleteMany({ where: { id: BigInt(shiftId) } });
      }
      if (supervisorShiftId) {
        await prisma.cashTransaction.deleteMany({ where: { shiftId: BigInt(supervisorShiftId) } });
        await prisma.shiftCloseDenomination.deleteMany({ where: { shiftId: BigInt(supervisorShiftId) } });
        await prisma.cashierShift.deleteMany({ where: { id: BigInt(supervisorShiftId) } });
      }
      if (testPatientId) {
        const payments = await prisma.payment.findMany({ where: { patientId: BigInt(testPatientId) } });
        const pIds = payments.map((p) => p.id);
        if (pIds.length > 0) {
          await prisma.cashTransaction.deleteMany({ where: { paymentId: { in: pIds } } });
          await prisma.invoicePayment.deleteMany({ where: { paymentId: { in: pIds } } });
          await prisma.payment.deleteMany({ where: { id: { in: pIds } } });
        }
        await prisma.patient.deleteMany({ where: { id: BigInt(testPatientId) } });
      }
    } catch {
      // Ignore cleanup error
    }
    await app.close();
  });

  // ===========================================================================
  // 1. SHIFT OPENING & DUPLICATE RESTRICTION
  // ===========================================================================

  describe('1. Shift Opening & Single Active Shift Invariant', () => {
    it('should open a new cashier shift with opening float (500 PKR)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cashier/shifts/open')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          openingCash: 500.0,
          notes: 'Morning shift opening float',
        })
        .expect(201);

      const data = getData(res);
      expect(data).toHaveProperty('id');
      expect(data.status).toBe('OPEN');
      expect(data.shiftNumber).toMatch(/^SHF-\d{8}-\d{4}$/);
      expect(Number(data.openingCash)).toBe(500);

      shiftId = Number(data.id);
    });

    it('should reject opening a second shift while one is active (409 Conflict)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cashier/shifts/open')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          openingCash: 200.0,
        })
        .expect(409);

      expect(getError(res)).toContain('already has an active shift');
    });

    it('should fetch the active shift with live totals', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cashier/shifts/active')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .expect(200);

      const data = getData(res);
      expect(data).not.toBeNull();
      expect(data.id).toBe(String(shiftId));
      expect(data.liveTotals.openingFloat).toBe(500);
      expect(data.liveTotals.expectedCash).toBe(500);
    });
  });

  // ===========================================================================
  // 2. PAYMENT COLLECTION & CASH/NON-CASH SEPARATION
  // ===========================================================================

  describe('2. Payment Collection & Non-Cash Isolation', () => {
    it('should record cash payment on invoice and automatically track CashTransaction in active shift', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${testInvoice1Id}/pay`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          amount: 1000.0,
          method: 'Cash',
          reference: 'REC-CASH-001',
        })
        .expect(200);

      const data = getData(res);
      expect(data.status).toBe('paid');

      // Check active shift live totals
      const totalsRes = await request(app.getHttpServer())
        .get(`/api/v1/cashier/shifts/${shiftId}/totals`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .expect(200);

      const totals = getData(totalsRes);
      expect(totals.cashInflow).toBe(1000);
      // Expected cash = 500 (float) + 1000 (payment) = 1500
      expect(totals.expectedCash).toBe(1500);
    });

    it('should record card payment and separate it from physical expected cash', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/invoices/${testInvoice2Id}/pay`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          amount: 1500.0,
          method: 'Card',
          reference: 'POS-AUTH-9988',
        })
        .expect(200);

      const data = getData(res);
      expect(data.status).toBe('part paid');

      // Check shift totals
      const totalsRes = await request(app.getHttpServer())
        .get(`/api/v1/cashier/shifts/${shiftId}/totals`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .expect(200);

      const totals = getData(totalsRes);
      // Physical cash must NOT include the 1500 card payment
      expect(totals.expectedCash).toBe(1500);
      expect(totals.cardTotal).toBe(1500);
      expect(totals.totalCollected).toBe(3000); // 500 float + 1000 cash + 1500 card
    });
  });

  // ===========================================================================
  // 3. CASH PAYOUTS & ADJUSTMENTS
  // ===========================================================================

  describe('3. Drawer Payouts and Adjustments', () => {
    it('should record authorized petty cash payout (200 PKR)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cashier/shifts/${shiftId}/payout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 200.0,
          reason: 'Emergency ambulance fuel top-up',
          recipient: 'Driver Aslam',
          reference: 'VOUCHER-044',
        })
        .expect(200);

      const data = getData(res);
      expect(data.transactionType).toBe('CASH_PAYOUT');
      expect(data.direction).toBe('OUTFLOW');
      expect(Number(data.amount)).toBe(200);

      // Check shift expected cash: 1500 - 200 = 1300
      const totalsRes = await request(app.getHttpServer())
        .get(`/api/v1/cashier/shifts/${shiftId}/totals`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .expect(200);

      const totals = getData(totalsRes);
      expect(totals.cashOutflow).toBe(200);
      expect(totals.expectedCash).toBe(1300);
    });

    it('should record approved cash float adjustment (100 PKR top-up)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cashier/shifts/${shiftId}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 100.0,
          reason: 'Float adjustment for coins',
          direction: 'INFLOW',
        })
        .expect(200);

      const data = getData(res);
      expect(data.transactionType).toBe('CASH_ADJUSTMENT');

      // Expected cash: 1300 + 100 = 1400
      const totalsRes = await request(app.getHttpServer())
        .get(`/api/v1/cashier/shifts/${shiftId}/totals`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .expect(200);

      const totals = getData(totalsRes);
      expect(totals.expectedCash).toBe(1400);
    });
  });

  // ===========================================================================
  // 4. SHIFT CLOSING, REJECTION & APPROVAL WORKFLOW
  // ===========================================================================

  describe('4. Shift Closing, Rejection and Supervisor Approval', () => {
    it('should submit shift close with discrepancy and denomination breakdown', async () => {
      // Expected cash is 1400. Counted is 1350 (-50 variance).
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cashier/shifts/${shiftId}/close`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          countedCash: 1350.0,
          closingNotes: 'Short 50 PKR due to small change shortage',
          denominations: [
            { denomination: 1000, count: 1 },
            { denomination: 100, count: 3 },
            { denomination: 50, count: 1 },
          ],
        })
        .expect(200);

      const data = getData(res);
      expect(data.status).toBe('PENDING_APPROVAL');
      expect(Number(data.countedCash)).toBe(1350);
      expect(Number(data.expectedCash)).toBe(1400);
      expect(Number(data.cashVariance)).toBe(-50);
    });

    it('should reject self-approval by the cashier (separation of duties, 403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cashier/shifts/${shiftId}/approve`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          notes: 'Attempting self-signoff',
        })
        .expect(403);

      expect(getError(res)).toMatch(/(Separation of duties|Insufficient permissions)/);
    });

    it('should allow supervisor to reject shift with mandatory reason', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cashier/shifts/${shiftId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rejectionReason: 'Please recount the small change tin before submitting.',
        })
        .expect(200);

      const data = getData(res);
      expect(data.status).toBe('REJECTED');
      expect(data.rejectionReason).toContain('Please recount');
    });

    it('should allow cashier to re-submit corrected shift count', async () => {
      // Recounted: found the missing 50 note -> counted is 1400 (balanced)
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cashier/shifts/${shiftId}/close`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          countedCash: 1400.0,
          closingNotes: 'Found 50 PKR note under drawer tray. Perfectly balanced.',
          denominations: [
            { denomination: 1000, count: 1 },
            { denomination: 100, count: 4 },
          ],
        })
        .expect(200);

      const data = getData(res);
      expect(data.status).toBe('PENDING_APPROVAL');
      expect(Number(data.cashVariance)).toBe(0);
    });

    it('should allow supervisor to approve shift and finalize closure', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cashier/shifts/${shiftId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Verified and approved by Shift Supervisor.',
        })
        .expect(200);

      const data = getData(res);
      expect(data.status).toBe('CLOSED');
      expect(data.approvedBy).not.toBeNull();
      expect(data.closedAt).not.toBeNull();

      // Verify legacy shift_close row was created
      const legacyClose = await prisma.shiftClose.findFirst({
        where: { userId: BigInt(receptionistUser.id) },
        orderBy: { closedAt: 'desc' },
      });
      expect(legacyClose).not.toBeNull();
      expect(Number(legacyClose?.expectedCash)).toBe(1400);
    });
  });

  // ===========================================================================
  // 5. PATIENT MULTI-INVOICE SETTLEMENT
  // ===========================================================================

  describe('5. Patient Multi-Invoice Settlement (Oldest First)', () => {
    let settleInvoice1Id: number;
    let settleInvoice2Id: number;

    beforeAll(async () => {
      const i1 = await prisma.payment.create({
        data: {
          patientId: BigInt(testPatientId),
          date: '2026-10-01',
          amount: 800,
          grossTotal: 800,
          amountReceived: 0,
          status: 'unpaid',
          careSetting: 'opd',
        },
      });
      settleInvoice1Id = Number(i1.id);

      const i2 = await prisma.payment.create({
        data: {
          patientId: BigInt(testPatientId),
          date: '2026-10-15',
          amount: 1200,
          grossTotal: 1200,
          amountReceived: 0,
          status: 'unpaid',
          careSetting: 'opd',
        },
      });
      settleInvoice2Id = Number(i2.id);
    });

    it('should reject settlement if amount exceeds total patient debt', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cashier/settlement/${testPatientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 99999.0,
          method: 'Cash',
        })
        .expect(400);

      expect(getError(res)).toContain('outstanding for this patient');
    });

    it('should reject write-off without mandatory reason', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cashier/settlement/${testPatientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 1000.0,
          writeOff: 500.0,
          writeOffReason: '',
          method: 'Cash',
        })
        .expect(400);

      expect(getError(res)).toContain('why the balance is being written off');
    });

    it('should allocate payment to oldest invoice first and apply write-off', async () => {
      // Total debt on i1 + i2 is 800 + 1200 = 2000 (plus remainder from testInvoice2: 500 = 2500 total)
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cashier/settlement/${testPatientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 1000.0,
          writeOff: 200.0,
          writeOffReason: 'Zakat fund concession',
          method: 'Cash',
        })
        .expect(200);

      const data = getData(res);
      expect(data.success).toBe(true);
      expect(data.amountSettled).toBe(1000);
      expect(data.amountWrittenOff).toBe(200);

      // Verify oldest invoice (settleInvoice1, 800) is now fully paid
      const i1Fresh = await prisma.payment.findUnique({ where: { id: BigInt(settleInvoice1Id) } });
      expect(i1Fresh?.status).toBe('paid');
      expect(Number(i1Fresh?.amountReceived)).toBe(800);

      // Verify second invoice (settleInvoice2) received remaining 200 payment
      const i2Fresh = await prisma.payment.findUnique({ where: { id: BigInt(settleInvoice2Id) } });
      expect(Number(i2Fresh?.amountReceived)).toBe(200);
      expect(i2Fresh?.status).toBe('part paid');
    });
  });

  // ===========================================================================
  // 6. FINANCIAL DAY BOOK & REPORTING
  // ===========================================================================

  describe('6. Financial Day Book and CSV Export', () => {
    it('should return Day Book summary grouped by department, doctor share, and payment mode', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cashier/day-book?from=${today}&to=${today}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = getData(res);
      expect(data).toHaveProperty('lines');
      expect(data).toHaveProperty('collections');
      expect(data.collections).toHaveProperty('cash');
      expect(data.collections).toHaveProperty('card');
      expect(data.collections).toHaveProperty('total');
    });

    it('should stream CSV export of Day Book', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cashier/day-book?from=${today}&to=${today}&export=csv`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Date,Invoice,Patient');
      expect(res.text).toContain('Doctor Share,Hospital Share');
    });
  });

  // ===========================================================================
  // 7. INPATIENT FOLIO INTEGRATION & CONCURRENCY
  // ===========================================================================

  describe('7. Inpatient Folio Settlement & Concurrency Race Condition', () => {
    it(
      'should verify inpatient folio settlement creates payment and counts towards cashier shift',
      async () => {
        // 1. Open shift for Admin
        const shiftRes = await request(app.getHttpServer())
          .post('/api/v1/cashier/shifts/open')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ openingCash: 1000.0, notes: 'Admin supervisor shift' })
          .expect(201);
        supervisorShiftId = Number(getData(shiftRes).id);

        // 2. Create ward & bed
        const ward = await prisma.bedCategory.create({
          data: { category: `Folio Ward ${Date.now()}`, description: 'Test', baseRate: 1000, billingUnit: 'DAILY' },
        });
        const bed = await prisma.bed.create({
          data: { number: `FB-${Date.now()}`, categoryId: ward.id, status: 'AVAILABLE' },
        });

        // 3. Admit patient using adminToken (which has INPATIENT_ADMIT permission)
        const admitRes = await request(app.getHttpServer())
          .post('/api/v1/inpatient/admissions')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            patientId: testPatientId,
            attendingDoctorId: testDoctorId,
            bedId: Number(bed.id),
            admissionType: 'ELECTIVE',
            admissionReason: 'Folio settlement E2E verification',
          })
          .expect(201);

        const admissionId = getData(admitRes).id;

        // 4. Settle folio with 1000 payment
        const settleRes = await request(app.getHttpServer())
          .post(`/api/v1/inpatient/admissions/${admissionId}/folio/settle`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            amountPaid: 1000.0,
            paymentMethod: 'Cash',
            remarks: 'E2E Folio direct cash collection',
          })
          .expect(200);

        const settleData = getData(settleRes);
        expect(settleData.folio.status).toBe('SETTLED');

        // 5. Check supervisor shift totals: 1000 float + 1000 folio cash payment = 2000
        const totalsRes = await request(app.getHttpServer())
          .get(`/api/v1/cashier/shifts/${supervisorShiftId}/totals`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const totals = getData(totalsRes);
        expect(totals.cashInflow).toBe(1000);
        expect(totals.expectedCash).toBe(2000);

        // Cleanup admission
        try {
          await prisma.inpatientFolioItem.deleteMany({ where: { folioId: BigInt(settleData.folio.id) } });
          await prisma.inpatientFolio.deleteMany({ where: { admissionId: BigInt(admissionId) } });
          await prisma.bedAllocationHistory.deleteMany({ where: { admissionId: BigInt(admissionId) } });
          await prisma.$executeRawUnsafe(`DELETE FROM alloted_bed WHERE bed_id = ${bed.id}`).catch(() => {});
          await prisma.admission.deleteMany({ where: { id: BigInt(admissionId) } });
          await prisma.bed.deleteMany({ where: { id: bed.id } });
          await prisma.bedCategory.deleteMany({ where: { id: ward.id } });
        } catch {
          // ignore cleanup
        }
      },
      30000,
    );

    it('should handle concurrent payout requests without corrupting shift balance', async () => {
      // Fire 5 concurrent payouts of 100 PKR each
      const payouts = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .post(`/api/v1/cashier/shifts/${supervisorShiftId}/payout`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            amount: 100.0,
            reason: `Concurrent payout #${i + 1}`,
            recipient: `Recipient #${i + 1}`,
          }),
      );

      const responses = await Promise.all(payouts);
      for (const r of responses) {
        expect(r.status).toBe(200);
      }

      // Expected cash was 2000 - 500 (5 * 100 payouts) = 1500
      const totalsRes = await request(app.getHttpServer())
        .get(`/api/v1/cashier/shifts/${supervisorShiftId}/totals`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const totals = getData(totalsRes);
      expect(totals.cashOutflow).toBe(500);
      expect(totals.expectedCash).toBe(1500);
    });
  });
});
