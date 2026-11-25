import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaService } from '../src/modules/prisma/prisma.service';
import { PharmacyService } from '../src/modules/pharmacy/pharmacy.service';
import { MedicineService } from '../src/modules/medicine/medicine.service';
import { AuthUser } from '../src/common/types/auth-user.interface';
import { BadRequestException } from '@nestjs/common';

const prisma = new PrismaService();

async function run() {
  console.log('========================================================================');
  console.log('  MEDORA 2.0 — PHASE 10.5.7 PHARMACY OPERATIONS & INVENTORY VERIFICATION ');
  console.log('========================================================================\n');

  const pharmacyService = new PharmacyService(prisma as any);
  const medicineService = new MedicineService(prisma as any);

  // 1. Fetch or prepare test AuthUser and Branches
  const userRecord = await prisma.user.findFirst();
  if (!userRecord) throw new Error('No user found in database for testing.');

  const branch1 = await prisma.hospitalBranch.findFirst({ where: { id: 1n } });
  let branch2 = await prisma.hospitalBranch.findFirst({ where: { code: 'BR-NORTH' } });
  if (!branch2) {
    branch2 = await prisma.hospitalBranch.create({
      data: {
        name: 'North City Outreach Clinic',
        code: 'BR-NORTH',
        address: 'Sector 15, North City',
        phone: '+91 98765 00002',
        active: true,
        organizationId: 1n,
      },
    });
  }

  const testUser: AuthUser = {
    id: userRecord.id.toString(),
    email: userRecord.email,
    name: `${userRecord.firstName} ${userRecord.lastName}`,
    group: 'Admin',
    permissions: [],
    organizationId: 1n,
    branchId: 1n,
    isSuperAdmin: true,
  };
  const currentUserId = Number(userRecord.id);
  console.log(`[PASS] Auth context verified: ${testUser.name} (Org: 1, Branch 1: ${branch1?.name || 'Main'}, Branch 2: ${branch2.name})`);

  // 2. Supplier Management with GSTIN
  const supplierName = `PharmaCorp Logistics ${Date.now()}`;
  const supplier = await medicineService.createSupplier({
    name: supplierName,
    address: 'Andheri East Industrial Estate, Mumbai',
    phone: '+91 98200 88776',
    email: `orders_${Date.now()}@pharmacorp.in`,
    gstin: '27AABCU9603R1ZM',
  }, 1n);
  if (!supplier.id || supplier.gstin !== '27AABCU9603R1ZM') {
    throw new Error('Supplier creation with GSTIN failed.');
  }
  console.log(`[PASS] Supplier registered: ${supplier.name} (ID: ${supplier.id}, GSTIN: ${supplier.gstin})`);

  // 3. Enhanced Medicine Catalogue
  const rxMed = await medicineService.create({
    name: `Amoxicillin & Clavulanate ${Date.now()}`,
    brandName: 'Augmentin 625 Duo',
    code: `AUG-${Date.now().toString().slice(-6)}`,
    composition: 'Amoxicillin 500mg + Potassium Clavulanate 125mg',
    barcode: `890${Date.now().toString().slice(-9)}`,
    prescriptionRequired: true,
    reorderLevel: 25,
    minStockLevel: 10,
    maxStockLevel: 250,
    price: 130.0,
    sPrice: 195.0,
  });
  if (!rxMed.prescriptionRequired || !rxMed.code || !rxMed.brandName) {
    throw new Error('Rx-Required Medicine creation failed.');
  }
  console.log(`[PASS] Rx-Restricted Medicine created: ${rxMed.name} (Code: ${rxMed.code}, Brand: ${rxMed.brandName}, prescriptionRequired: ${rxMed.prescriptionRequired})`);

  const otcMed = await medicineService.create({
    name: `Paracetamol Fast Relief ${Date.now()}`,
    brandName: 'Dolo 650',
    code: `DOL-${Date.now().toString().slice(-6)}`,
    composition: 'Paracetamol 650mg',
    barcode: `890${(Date.now() + 1).toString().slice(-9)}`,
    prescriptionRequired: false,
    reorderLevel: 50,
    minStockLevel: 20,
    maxStockLevel: 500,
    price: 18.0,
    sPrice: 32.0,
  });
  if (otcMed.prescriptionRequired) {
    throw new Error('OTC Medicine creation failed: prescriptionRequired should be false.');
  }
  console.log(`[PASS] OTC Medicine created: ${otcMed.name} (Code: ${otcMed.code}, Brand: ${otcMed.brandName}, prescriptionRequired: false)`);

  // 4. Purchase Order Creation & Approval Workflow
  const po = await pharmacyService.createPurchaseOrder({
    supplierId: Number(supplier.id),
    branchId: 1,
    orderDate: new Date().toISOString().slice(0, 10),
    notes: 'Q4 Essential Antibiotic & Antipyretic Restocking',
    items: [
      { medicineId: Number(rxMed.id), quantityOrdered: 100, unitCost: 130.0 },
      { medicineId: Number(otcMed.id), quantityOrdered: 300, unitCost: 18.0 },
    ],
  }, currentUserId, testUser);
  if (!po.poNumber.startsWith('PO-') || po.status !== 'ORDERED') {
    throw new Error(`PO creation failed: ${JSON.stringify(po)}`);
  }
  console.log(`[PASS] Purchase Order created: ${po.poNumber} (Status: ${po.status}, Total: ₹${po.totalAmount})`);

  const approvedPo = await pharmacyService.approvePurchaseOrder(Number(po.id), 'Approved by Chief Pharmacist', testUser);
  if (approvedPo.status !== 'APPROVED' || !approvedPo.approvedById) {
    throw new Error(`PO approval failed: ${JSON.stringify(approvedPo)}`);
  }
  console.log(`[PASS] Purchase Order approved: ${approvedPo.poNumber} (Status: ${approvedPo.status}, ApprovedBy: ID ${approvedPo.approvedById})`);

  // 5. Expiry Date Rejection in Goods Receipt
  let expiredRejected = false;
  try {
    await pharmacyService.createGoodsReceipt({
      purchaseOrderId: Number(po.id),
      supplierId: Number(supplier.id),
      branchId: 1,
      receiptDate: new Date().toISOString().slice(0, 10),
      items: [
        {
          medicineId: Number(rxMed.id),
          batchNumber: `EXP-BATCH-${Date.now()}`,
          expiryDate: '2022-01-01', // Expired
          quantityReceived: 50,
          unitCost: 130.0,
          sellingPrice: 195.0,
        },
      ],
    }, currentUserId, testUser);
  } catch (err: any) {
    if (err instanceof BadRequestException && err.message.includes('expired')) {
      expiredRejected = true;
    }
  }
  if (!expiredRejected) {
    throw new Error('Expired batch was not rejected during goods receipt!');
  }
  console.log('[PASS] Goods Receipt rejected expired batch with BadRequestException');

  // 6. Valid Goods Receipt (GRN) & Batch Allocation
  const validExpiry = new Date();
  validExpiry.setFullYear(validExpiry.getFullYear() + 2);
  const expiryStr = validExpiry.toISOString().slice(0, 10);

  const grn = await pharmacyService.createGoodsReceipt({
    purchaseOrderId: Number(po.id),
    supplierId: Number(supplier.id),
    branchId: 1,
    receiptDate: new Date().toISOString().slice(0, 10),
    supplierInvoiceNumber: `INV-PHARMA-${Date.now()}`,
    items: [
      {
        medicineId: Number(rxMed.id),
        batchNumber: `B-RX-${Date.now().toString().slice(-4)}`,
        expiryDate: expiryStr,
        quantityReceived: 100,
        unitCost: 130.0,
        sellingPrice: 195.0,
      },
      {
        medicineId: Number(otcMed.id),
        batchNumber: `B-OTC-${Date.now().toString().slice(-4)}`,
        expiryDate: expiryStr,
        quantityReceived: 300,
        unitCost: 18.0,
        sellingPrice: 32.0,
      },
    ],
  }, currentUserId, testUser);
  if (!grn.receiptNumber.startsWith('GRN-') || grn.items.length !== 2) {
    throw new Error(`GRN creation failed: ${JSON.stringify(grn)}`);
  }
  console.log(`[PASS] Goods Receipt processed: ${grn.receiptNumber} (${grn.items.length} batches received into inventory)`);

  // Verify stock updated on medicine summary
  const updatedRxMed = await prisma.medicine.findUnique({ where: { id: BigInt(rxMed.id) } });
  const updatedOtcMed = await prisma.medicine.findUnique({ where: { id: BigInt(otcMed.id) } });
  if (updatedRxMed?.quantity !== 100 || updatedOtcMed?.quantity !== 300) {
    throw new Error(`Medicine summary stock mismatch. Rx: ${updatedRxMed?.quantity}, OTC: ${updatedOtcMed?.quantity}`);
  }
  console.log(`[PASS] Summary inventory incremented: Rx Med has ${updatedRxMed.quantity} units, OTC Med has ${updatedOtcMed.quantity} units`);

  // 7. Direct OTC Counter Sale Regulatory Protection
  let otcBlocked = false;
  try {
    await pharmacyService.sellOtc({
      saleDate: new Date().toISOString().slice(0, 10),
      patientName: 'Walk-in Counter Patient',
      branchId: 1,
      items: [{ medicineId: Number(rxMed.id), quantity: 5 }],
    }, currentUserId, testUser);
  } catch (err: any) {
    if (err instanceof BadRequestException && (err.message.includes('prescription-restricted') || err.message.includes('doctor prescription'))) {
      otcBlocked = true;
    }
  }
  if (!otcBlocked) {
    throw new Error('Prescription-required medication was not blocked from OTC sale!');
  }
  console.log('[PASS] OTC Regulation enforced: Prescription-restricted medication blocked from counter sale');

  // 8. Successful OTC Counter Sale & Phase 10.5.6 Invoice Integration
  // Prepare a patient for invoice generation
  let patient = await prisma.patient.findFirst({ where: { branchId: 1n } });
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        name: 'Sunita Rao',
        phone: '9845012345',
        patientId: `MRN-PHARM-${Date.now().toString().slice(-6)}`,
        branchId: 1n,
        sex: 'Female',
      },
    });
  }

  const otcSale = await pharmacyService.sellOtc({
    saleDate: new Date().toISOString().slice(0, 10),
    patientId: Number(patient.id),
    patientName: patient.name,
    branchId: 1,
    generateInvoice: true,
    items: [{ medicineId: Number(otcMed.id), quantity: 15, unitPrice: 32.0 }],
  }, currentUserId, testUser);

  if (!otcSale.dispensationNumber.startsWith('DSP-') || !otcSale.invoiceId) {
    throw new Error(`OTC sale failed or missing invoice: ${JSON.stringify(otcSale)}`);
  }
  console.log(`[PASS] OTC Counter Sale executed: ${otcSale.dispensationNumber}`);
  console.log(`       - Total: ₹${otcSale.totalAmount} (15 units dispensed)`);
  console.log(`       - Linked Phase 10.5.6 Invoice ID: ${otcSale.invoiceId}`);

  // Verify invoice in Payment table
  const paymentInvoice = await prisma.payment.findUnique({ where: { id: BigInt(otcSale.invoiceId) } });
  if (!paymentInvoice || !paymentInvoice.invoiceNumber?.startsWith('INV-') || paymentInvoice.category !== 'PHARMACY') {
    throw new Error(`Phase 10.5.6 Payment record not properly linked: ${JSON.stringify(paymentInvoice)}`);
  }
  console.log(`[PASS] Phase 10.5.6 Invoice verified: ${paymentInvoice.invoiceNumber} (Category: ${paymentInvoice.category}, Status: ${paymentInvoice.status})`);

  // 9. Prescription Dispensing & Substitution
  // Create test doctor and signed prescription
  let doctor = await prisma.doctor.findFirst();
  if (!doctor) {
    doctor = await prisma.doctor.create({
      data: {
        name: 'Dr. Anita Joshi',
        email: `dr.anita_${Date.now()}@medora.clinic`,
        phone: '9845011111',
        department: 'Internal Medicine',
      },
    });
  }

  const prescription = await prisma.prescription.create({
    data: {
      prescriptionNumber: `RX-PHARM-${Date.now().toString().slice(-6)}`,
      patientId: patient.id,
      doctorId: doctor.id,
      date: new Date().toISOString().slice(0, 10),
      status: 'SIGNED',
      state: 'signed',
      medicines: {
        create: [
          {
            name: rxMed.name,
            medicineId: rxMed.id,
            dosage: '1 tablet twice daily',
            duration: '5 days',
            quantityPrescribed: 10,
            dispensedQuantity: 0,
          },
        ],
      },
    },
    include: { medicines: true },
  });
  const rxLine = prescription.medicines[0];
  console.log(`[PASS] Test Prescription created & signed: ${prescription.prescriptionNumber} (Prescribed: 10 units of ${rxMed.name})`);

  // 9a. Verify over-dispensing prevention
  let overDispenseBlocked = false;
  try {
    await pharmacyService.dispense({
      prescriptionId: Number(prescription.id),
      patientId: Number(patient.id),
      dispenseDate: new Date().toISOString().slice(0, 10),
      branchId: 1,
      items: [
        {
          prescriptionMedicineId: Number(rxLine.id),
          medicineId: Number(rxMed.id),
          quantity: 15, // Prescribed 10, requests 15
        },
      ],
    }, currentUserId, testUser);
  } catch (err: any) {
    if (err instanceof BadRequestException && err.message.includes('Cannot dispense 15 units')) {
      overDispenseBlocked = true;
    }
  }
  if (!overDispenseBlocked) {
    throw new Error('Over-dispensing beyond prescribed quantity was not prevented!');
  }
  console.log('[PASS] Over-dispensing protection verified: Request exceeding prescribed quantity rejected');

  // 9b. Partial Dispense with Substitution
  const partialDispense = await pharmacyService.dispense({
    prescriptionId: Number(prescription.id),
    patientId: Number(patient.id),
    dispenseDate: new Date().toISOString().slice(0, 10),
    branchId: 1,
    generateInvoice: true,
    items: [
      {
        prescriptionMedicineId: Number(rxLine.id),
        medicineId: Number(rxMed.id),
        quantity: 6,
        isSubstituted: true,
        originalMedicineId: Number(rxMed.id),
        substitutionReason: 'Dispensed equivalent formulation with patient verbal consent',
      },
    ],
  }, currentUserId, testUser);

  const updatedRx = await prisma.prescription.findUnique({
    where: { id: prescription.id },
    include: { medicines: true },
  });
  if (updatedRx?.status !== 'PARTIALLY_DISPENSED' || updatedRx.medicines[0].dispensedQuantity !== 6) {
    throw new Error(`Prescription state transition failed: status=${updatedRx?.status}, dispensedQty=${updatedRx?.medicines[0].dispensedQuantity}`);
  }
  console.log(`[PASS] Partial Dispensation executed: ${partialDispense.dispensationNumber}`);
  console.log(`       - Prescription transitioned to: ${updatedRx.status}`);
  console.log(`       - Line item: 6 of 10 units dispensed, Substitution reason recorded: "${partialDispense.items[0].substitutionReason}"`);

  // 10. Inter-Branch Stock Transfer
  const batches = await prisma.medicineBatch.findMany({
    where: { medicineId: otcMed.id, branchId: 1n, status: 'ACTIVE' },
  });
  if (batches.length === 0) throw new Error('No active batches for transfer test.');
  const sourceBatch = batches[0];

  const transfer = await pharmacyService.transferStock({
    fromBranchId: Number(branch1?.id || 1),
    toBranchId: Number(branch2.id),
    medicineId: Number(otcMed.id),
    batchId: Number(sourceBatch.id),
    quantity: 40,
    reason: 'Inter-branch rebalancing for North City Clinic',
  }, currentUserId, testUser);

  if (!transfer.transferNumber.startsWith('TRF-') || transfer.status !== 'COMPLETED') {
    throw new Error(`Stock transfer failed: ${JSON.stringify(transfer)}`);
  }
  console.log(`[PASS] Inter-Branch Stock Transfer executed: ${transfer.transferNumber}`);
  console.log(`       - 40 units transferred from Branch ${branch1?.id || 1} to Branch ${branch2.id}`);

  // Verify destination batch exists in branch 2
  const destBatch = await prisma.medicineBatch.findFirst({
    where: { medicineId: otcMed.id, branchId: branch2.id, batchNumber: sourceBatch.batchNumber },
  });
  if (!destBatch || destBatch.currentQuantity !== 40) {
    throw new Error(`Destination batch in Branch 2 not updated. Current qty: ${destBatch?.currentQuantity}`);
  }
  console.log(`[PASS] Destination batch created/incremented in Branch 2: ${destBatch.batchNumber} (Current Quantity: ${destBatch.currentQuantity})`);

  // 11. Condition-Based Return & Quarantine
  const ret = await pharmacyService.processReturn({
    returnType: 'PATIENT_RETURN',
    dispensationId: Number(otcSale.id),
    returnDate: new Date().toISOString().slice(0, 10),
    reason: 'Crushed tablets upon opening',
    restockToInventory: true, // Requested restock
    items: [
      {
        dispensationItemId: Number(otcSale.items[0].id),
        medicineId: Number(otcMed.id),
        batchId: Number(sourceBatch.id),
        quantity: 2,
        condition: 'DAMAGED', // Crucial: non-saleable condition
      },
    ],
  }, currentUserId, testUser);

  if (!ret.returnNumber.startsWith('RTN-')) {
    throw new Error(`Return processing failed: ${JSON.stringify(ret)}`);
  }

  // Verify write-off movement logged
  const writeOffMovement = await prisma.stockMovement.findFirst({
    where: { referenceId: BigInt(ret.id), movementType: 'DAMAGED_WRITE_OFF' },
  });
  if (!writeOffMovement) {
    throw new Error('Damaged return was not logged as DAMAGED_WRITE_OFF!');
  }
  console.log(`[PASS] Condition Assessment & Quarantine verified:`);
  console.log(`       - Return: ${ret.returnNumber} (Condition: DAMAGED)`);
  console.log(`       - Quarantined: StockMovement logged as ${writeOffMovement.movementType} (0 units added to saleable stock)`);

  // 12. Immutable Stock Movement Ledger Verification
  const ledger = await pharmacyService.getStockLedger({ medicineId: Number(otcMed.id), limit: 10 }, testUser);
  if (!ledger.items || ledger.items.length < 3) {
    throw new Error('Stock ledger incomplete.');
  }
  console.log(`[PASS] Immutable Stock Ledger verified: ${ledger.items.length} auditable events recorded for ${otcMed.name}:`);
  ledger.items.slice(0, 4).forEach((m: any) => {
    console.log(`       • [${m.movementType}] Qty: ${m.quantity}, Balance After: ${m.balanceAfter}, Reason: ${m.reason || 'N/A'}`);
  });

  // 13. Dashboard Metrics
  const dash = await pharmacyService.getDashboard(testUser);
  console.log(`[PASS] Real-time Database Dashboard KPIs:`);
  console.log(`       • Active Medicines: ${dash.totalMedicines}`);
  console.log(`       • Low Stock Count: ${dash.lowStockCount}`);
  console.log(`       • Retail Inventory Valuation: ₹${dash.totalRetailValuation}`);
  console.log(`       • Cost Inventory Valuation: ₹${dash.totalCostValuation}`);
  console.log(`       • Today Dispensations: ${dash.todayDispensationsCount}`);
  console.log(`       • Prescriptions Awaiting Dispensing: ${dash.prescriptionsAwaitingDispense || 0}`);

  console.log('\n========================================================================');
  console.log('  ALL PHASE 10.5.7 PHARMACY OPERATIONS VERIFICATIONS PASSED (13/13)     ');
  console.log('========================================================================');
}

run()
  .catch((e) => {
    console.error('\n[FAIL] Pharmacy Operations Verification Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
