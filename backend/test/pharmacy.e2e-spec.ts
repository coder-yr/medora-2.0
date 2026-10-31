import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/modules/prisma/prisma.service';

jest.setTimeout(60000);

describe('Pharmacy & Inventory Management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let pharmacistToken: string;
  let receptionistToken: string;

  let testSupplierId: number;
  let testMedicineId: number;
  let testMedicine2Id: number;
  let testPatientId: number;
  let testDoctorId: number;
  let testPrescriptionId: number;
  let testPrescriptionMedicineId: number;

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


    // Authenticate Pharmacist
    const pharmRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'pharmacist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    pharmacistToken = pharmRes.body.data.accessToken;

    // Authenticate Receptionist
    const recRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'receptionist.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    receptionistToken = recRes.body.data.accessToken;

    // Create test Supplier
    const supplier = await prisma.supplier.create({
      data: {
        name: `E2E Pharma Supplier ${Date.now()}`,
        phone: '03009998888',
        email: `supplier_${Date.now()}@test.hospital`,
      },
    });
    testSupplierId = Number(supplier.id);

    // Create test Medicine
    const medicine = await prisma.medicine.create({
      data: {
        name: `E2E Test Amoxicillin ${Date.now()}`,
        generic: 'Amoxicillin Trihydrate',
        price: 5.0,
        sPrice: 10.0,
        quantity: 0,
        isActive: true,
      },
    });
    testMedicineId = Number(medicine.id);

    // Create a second test medicine for concurrent stress testing
    const medicine2 = await prisma.medicine.create({
      data: {
        name: `E2E Concurrency Capsule ${Date.now()}`,
        generic: 'Paracetamol',
        price: 2.0,
        sPrice: 5.0,
        quantity: 0,
        isActive: true,
      },
    });
    testMedicine2Id = Number(medicine2.id);

    // Create test Patient
    const patient = await prisma.patient.create({
      data: {
        name: `Pharmacy Patient ${Date.now()}`,
        patientId: `P${Date.now().toString().slice(-5)}`,
        phone: '03112223344',
        sex: 'male',
        age: '45',
      },
    });
    testPatientId = Number(patient.id);

    // Create test Doctor
    const doctor = await prisma.doctor.create({
      data: {
        name: `Dr. Pharm Tester ${Date.now()}`,
        department: 'Internal Medicine',
        phone: '03223334455',
      },
    });
    testDoctorId = Number(doctor.id);

    // Create test Prescription
    const rx = await prisma.prescription.create({
      data: {
        patientId: BigInt(testPatientId),
        doctorId: BigInt(testDoctorId),
        date: new Date().toISOString().split('T')[0],
        state: 'issued',
        medicines: {
          create: [
            {
              medicineId: BigInt(testMedicineId),
              name: 'Amoxicillin 500mg',
              dosage: '1+0+1',
              duration: '5 days',
              instructions: 'After meals',
            },
          ],
        },
      },
      include: { medicines: true },
    });
    testPrescriptionId = Number(rx.id);
    testPrescriptionMedicineId = Number(rx.medicines[0].id);
  });

  afterAll(async () => {
    // Clean up created test entities
    try {
      await prisma.pharmacyReturnItem.deleteMany({
        where: { medicineId: { in: [BigInt(testMedicineId), BigInt(testMedicine2Id)] } },
      });
      await prisma.pharmacyReturn.deleteMany({
        where: { supplierId: BigInt(testSupplierId) },
      });
      await prisma.pharmacyDispensationItem.deleteMany({
        where: { medicineId: { in: [BigInt(testMedicineId), BigInt(testMedicine2Id)] } },
      });
      await prisma.pharmacyDispensation.deleteMany({
        where: { patientId: BigInt(testPatientId) },
      });
      await prisma.stockAdjustmentItem.deleteMany({
        where: { medicineId: { in: [BigInt(testMedicineId), BigInt(testMedicine2Id)] } },
      });
      await prisma.stockAdjustment.deleteMany({});
      await prisma.stockMovement.deleteMany({
        where: { medicineId: { in: [BigInt(testMedicineId), BigInt(testMedicine2Id)] } },
      });
      await prisma.goodsReceiptItem.deleteMany({
        where: { medicineId: { in: [BigInt(testMedicineId), BigInt(testMedicine2Id)] } },
      });
      await prisma.goodsReceipt.deleteMany({
        where: { supplierId: BigInt(testSupplierId) },
      });
      await prisma.purchaseOrderItem.deleteMany({
        where: { medicineId: { in: [BigInt(testMedicineId), BigInt(testMedicine2Id)] } },
      });
      await prisma.purchaseOrder.deleteMany({
        where: { supplierId: BigInt(testSupplierId) },
      });
      await prisma.medicineBatch.deleteMany({
        where: { medicineId: { in: [BigInt(testMedicineId), BigInt(testMedicine2Id)] } },
      });
      await prisma.prescriptionMedicine.deleteMany({
        where: { prescriptionId: BigInt(testPrescriptionId) },
      });
      await prisma.prescription.deleteMany({
        where: { id: BigInt(testPrescriptionId) },
      });
      await prisma.payment.deleteMany({
        where: { patientId: BigInt(testPatientId) },
      });
      await prisma.medicine.deleteMany({
        where: { id: { in: [BigInt(testMedicineId), BigInt(testMedicine2Id)] } },
      });
      await prisma.supplier.deleteMany({
        where: { id: BigInt(testSupplierId) },
      });
      await prisma.patient.deleteMany({
        where: { id: BigInt(testPatientId) },
      });
      await prisma.doctor.deleteMany({
        where: { id: BigInt(testDoctorId) },
      });
    } catch {
      // Ignored in teardown
    }
    await app.close();
  });

  // ===========================================================================
  // 1. DASHBOARD & RBAC
  // ===========================================================================

  describe('Dashboard & RBAC access', () => {
    it('allows Pharmacist to access pharmacy dashboard', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/pharmacy/dashboard')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalMedicines');
      expect(res.body.data).toHaveProperty('totalCostValuation');
      expect(res.body.data).toHaveProperty('expiringWithin30Days');
    });

    it('denies Receptionist from dispensing without PHARMACY_DISPENSE permission', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/pharmacy/dispensations')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          dispenseDate: new Date().toISOString().split('T')[0],
          items: [{ medicineId: testMedicineId, quantity: 1 }],
        })
        .expect(403);
    });
  });

  // ===========================================================================
  // 2. PURCHASING & GOODS RECEIPT
  // ===========================================================================

  let createdBatchId: number;
  let createdBatchNumber: string;

  describe('Purchasing & Goods Receipt', () => {
    it('creates a purchase order with items', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pharmacy/purchases/orders')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          supplierId: testSupplierId,
          orderDate: new Date().toISOString().split('T')[0],
          expectedDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          items: [
            {
              medicineId: testMedicineId,
              quantityOrdered: 50,
              unitCost: 4.5,
            },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.poNumber).toMatch(/^PO-/);
      expect(Number(res.body.data.totalAmount)).toBe(225);
    });

    it('receives goods into a new batch via GRN, logs movement, and syncs medicine quantity', async () => {
      createdBatchNumber = `BATCH-E2E-${Date.now().toString().slice(-6)}`;

      const res = await request(app.getHttpServer())
        .post('/api/v1/pharmacy/purchases/receipts')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          supplierId: testSupplierId,
          receiptDate: new Date().toISOString().split('T')[0],
          supplierInvoiceNumber: 'INV-SUP-9988',
          items: [
            {
              medicineId: testMedicineId,
              batchNumber: createdBatchNumber,
              expiryDate: '2028-06-30',
              quantityReceived: 50,
              unitCost: 4.5,
              sellingPrice: 10.0,
            },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.receiptNumber).toMatch(/^GRN-/);

      // Verify batch in DB
      const batch = await prisma.medicineBatch.findUnique({
        where: {
          medicineId_batchNumber: {
            medicineId: BigInt(testMedicineId),
            batchNumber: createdBatchNumber,
          },
        },
      });
      expect(batch).toBeDefined();
      expect(batch?.currentQuantity).toBe(50);
      createdBatchId = Number(batch!.id);

      // Verify Medicine summary quantity updated
      const updatedMed = await prisma.medicine.findUnique({
        where: { id: BigInt(testMedicineId) },
      });
      expect(updatedMed?.quantity).toBe(50);

      // Verify StockMovement logged
      const movement = await prisma.stockMovement.findFirst({
        where: { batchId: batch!.id, movementType: 'PURCHASE_RECEIPT' },
      });
      expect(movement).toBeDefined();
      expect(movement?.quantity).toBe(50);
    });
  });

  // ===========================================================================
  // 3. EXPIRED BATCH & INSUFFICIENT STOCK REJECTION
  // ===========================================================================

  describe('Stock Validation & Expiry Rules', () => {
    let expiredBatchId: number;

    beforeAll(async () => {
      // Create an expired batch directly
      const expiredBatch = await prisma.medicineBatch.create({
        data: {
          medicineId: BigInt(testMedicineId),
          batchNumber: `EXP-BATCH-${Date.now()}`,
          expiryDate: new Date('2022-01-01'), // in the past
          costPrice: 4.0,
          sellingPrice: 8.0,
          initialQuantity: 10,
          currentQuantity: 10,
          status: 'ACTIVE',
        },
      });
      expiredBatchId = Number(expiredBatch.id);
    });

    it('rejects dispensing an expired batch with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pharmacy/dispensations')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          dispenseDate: new Date().toISOString().split('T')[0],
          items: [
            {
              medicineId: testMedicineId,
              batchId: expiredBatchId,
              quantity: 2,
            },
          ],
        })
        .expect(400);

      const msg = res.body.error?.message || res.body.message;
      expect(msg).toMatch(/expired/i);
    });

    it('rejects requested quantity exceeding batch stock with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pharmacy/dispensations')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          dispenseDate: new Date().toISOString().split('T')[0],
          items: [
            {
              medicineId: testMedicineId,
              batchId: createdBatchId,
              quantity: 9999, // Exceeds 50
            },
          ],
        })
        .expect(400);

      const msg = res.body.error?.message || res.body.message;
      expect(msg).toMatch(/insufficient stock/i);
    });
  });

  // ===========================================================================
  // 4. CONCURRENCY SAFETY TEST
  // ===========================================================================

  describe('Concurrency & Transaction Safety', () => {
    let limitedBatchId: number;

    beforeAll(async () => {
      // Seed a batch with exactly 10 units for medicine2
      const batch = await prisma.medicineBatch.create({
        data: {
          medicineId: BigInt(testMedicine2Id),
          batchNumber: `CONCUR-LOT-${Date.now()}`,
          expiryDate: new Date('2028-12-31'),
          costPrice: 2.0,
          sellingPrice: 5.0,
          initialQuantity: 10,
          currentQuantity: 10,
          status: 'ACTIVE',
        },
      });
      limitedBatchId = Number(batch.id);
      await prisma.medicine.update({
        where: { id: BigInt(testMedicine2Id) },
        data: { quantity: 10 },
      });
    });

    it('prevents overselling when two requests attempt to consume 8 units of a 10-unit batch simultaneously', async () => {
      const dispensePayload = {
        dispenseDate: new Date().toISOString().split('T')[0],
        items: [
          {
            medicineId: testMedicine2Id,
            batchId: limitedBatchId,
            quantity: 8,
          },
        ],
      };

      // Launch two requests concurrently against PostgreSQL
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/pharmacy/dispensations')
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(dispensePayload),
        request(app.getHttpServer())
          .post('/api/v1/pharmacy/dispensations')
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send(dispensePayload),
      ]);

      const statuses = [res1.status, res2.status];
      // Exactly one must succeed (201) and the second must fail (400)
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);

      // Verify batch balance is exactly 2 (10 - 8), NOT -6
      const finalBatch = await prisma.medicineBatch.findUnique({
        where: { id: BigInt(limitedBatchId) },
      });
      expect(finalBatch?.currentQuantity).toBe(2);

      // Verify Medicine summary quantity is synced to 2
      const finalMed = await prisma.medicine.findUnique({
        where: { id: BigInt(testMedicine2Id) },
      });
      expect(finalMed?.quantity).toBe(2);
    });
  });

  // ===========================================================================
  // 5. PRESCRIPTION INTEGRATION & PARTIAL DISPENSING
  // ===========================================================================

  describe('Prescription Dispensing & Partial Fulfillment', () => {
    it('loads prescription dispense context with FEFO batch allocations', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/pharmacy/dispensations/context/${testPrescriptionId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.lines).toHaveLength(1);
      expect(res.body.data.lines[0].matchedMedicineName).toContain('Amoxicillin');
      expect(res.body.data.lines[0].availableStock).toBeGreaterThanOrEqual(50);
      expect(res.body.data.lines[0].fefoPlan).toBeDefined();
    });

    let firstDispensationId: number;

    it('partially dispenses 4 units of prescription item, updates line item and state to dispensed', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pharmacy/dispensations')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          prescriptionId: testPrescriptionId,
          patientId: testPatientId,
          dispenseDate: new Date().toISOString().split('T')[0],
          generateInvoice: true,
          items: [
            {
              prescriptionMedicineId: testPrescriptionMedicineId,
              medicineId: testMedicineId,
              batchId: createdBatchId,
              quantity: 4,
              unitPrice: 10.0,
            },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      firstDispensationId = Number(res.body.data.id);
      expect(res.body.data.invoiceId).toBeDefined();

      // Verify Prescription line item dispensedQuantity incremented to 4
      const pm = await prisma.prescriptionMedicine.findUnique({
        where: { id: BigInt(testPrescriptionMedicineId) },
      });
      expect(pm?.dispensedQuantity).toBe(4);

      // Verify Prescription state updated
      const rx = await prisma.prescription.findUnique({
        where: { id: BigInt(testPrescriptionId) },
      });
      expect(rx?.state).toBe('dispensed');

      // Verify InvoiceModule integration created payment record
      const invoice = await prisma.payment.findUnique({
        where: { id: BigInt(res.body.data.invoiceId) },
      });
      expect(invoice).toBeDefined();
      expect(invoice?.category).toBe('PHARMACY');
      expect(Number(invoice?.grossTotal)).toBe(40.0);
    });

    it('allows patient return of 2 units, restocks to batch and logs CUSTOMER_RETURN movement', async () => {
      const dispItem = await prisma.pharmacyDispensationItem.findFirst({
        where: { dispensationId: BigInt(firstDispensationId) },
      });
      expect(dispItem).toBeDefined();

      const batchBefore = await prisma.medicineBatch.findUnique({
        where: { id: BigInt(createdBatchId) },
      });
      const qtyBefore = batchBefore!.currentQuantity;

      const res = await request(app.getHttpServer())
        .post('/api/v1/pharmacy/returns')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          returnType: 'PATIENT_RETURN',
          dispensationId: firstDispensationId,
          returnDate: new Date().toISOString().split('T')[0],
          reason: 'Patient experienced mild allergy',
          restockToInventory: true,
          items: [
            {
              dispensationItemId: Number(dispItem!.id),
              medicineId: testMedicineId,
              batchId: createdBatchId,
              quantity: 2,
              condition: 'SALEABLE',
            },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.returnNumber).toMatch(/^RET-/);

      // Batch quantity incremented by 2
      const batchAfter = await prisma.medicineBatch.findUnique({
        where: { id: BigInt(createdBatchId) },
      });
      expect(batchAfter?.currentQuantity).toBe(qtyBefore + 2);

      // StockMovement CUSTOMER_RETURN logged
      const movement = await prisma.stockMovement.findFirst({
        where: {
          batchId: BigInt(createdBatchId),
          movementType: 'CUSTOMER_RETURN',
        },
      });
      expect(movement).toBeDefined();
      expect(movement?.quantity).toBe(2);
    });
  });

  // ===========================================================================
  // 6. STOCK ADJUSTMENT & AUDIT REPORTS
  // ===========================================================================

  describe('Stock Adjustments & Reports', () => {
    it('records physical count adjustment and adjusts batch quantity with movement log', async () => {
      const batchBefore = await prisma.medicineBatch.findUnique({
        where: { id: BigInt(createdBatchId) },
      });
      const systemQty = batchBefore!.currentQuantity;
      const physicalQty = systemQty - 3; // 3 damaged bottles found

      const res = await request(app.getHttpServer())
        .post('/api/v1/pharmacy/adjustments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          adjustmentDate: new Date().toISOString().split('T')[0],
          reason: 'DAMAGED',
          notes: 'Damaged packaging during storage',
          items: [
            {
              medicineId: testMedicineId,
              batchId: createdBatchId,
              physicalQuantity: physicalQty,
            },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.adjustmentNumber).toMatch(/^ADJ-/);

      // Batch updated
      const batchAfter = await prisma.medicineBatch.findUnique({
        where: { id: BigInt(createdBatchId) },
      });
      expect(batchAfter?.currentQuantity).toBe(physicalQty);

      // StockMovement STOCK_ADJUSTMENT_OUT logged
      const movement = await prisma.stockMovement.findFirst({
        where: {
          batchId: BigInt(createdBatchId),
          movementType: 'STOCK_ADJUSTMENT_OUT',
        },
      });
      expect(movement).toBeDefined();
      expect(movement?.quantity).toBe(-3);
    });

    it('retrieves valuation, low stock and stock movement ledger reports', async () => {
      const [valRes, lowRes, ledgerRes] = await Promise.all([
        request(app.getHttpServer())
          .get('/api/v1/pharmacy/reports/valuation')
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .expect(200),
        request(app.getHttpServer())
          .get('/api/v1/pharmacy/reports/low-stock?threshold=100')
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .expect(200),
        request(app.getHttpServer())
          .get(`/api/v1/pharmacy/movements?medicineId=${testMedicineId}`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .expect(200),
      ]);

      expect(valRes.body.data.totalUnits).toBeGreaterThan(0);
      expect(Array.isArray(lowRes.body.data)).toBe(true);
      expect(ledgerRes.body.data.items.length).toBeGreaterThanOrEqual(2);
    });
  });
});
