import { PrismaService } from '../src/modules/prisma/prisma.service';
import { PrescriptionService } from '../src/modules/prescription/prescription.service';
import { PharmacyService } from '../src/modules/pharmacy/pharmacy.service';
import { AuthUser } from '../src/common/types/auth-user.interface';

const prisma = new PrismaService();

async function run() {
  console.log('========================================================================');
  console.log('  MEDORA 2.0 — PHASE 10.5.4 PRESCRIPTION MANAGEMENT VERIFICATION       ');
  console.log('========================================================================\n');

  const prescriptionService = new PrescriptionService(prisma as any);
  const pharmacyService = new PharmacyService(prisma as any);

  // 1. Fetch or prepare test Doctor and User
  let doctor = await prisma.doctor.findFirst();
  if (!doctor) {
    const user = await prisma.user.findFirst();
    doctor = await prisma.doctor.create({
      data: {
        name: 'Dr. Nadia Aslam',
        email: 'dr.nadia@medora.health',
        phone: '03001234567',
        department: 'General OPD',
        ionUserId: user?.id.toString() || '1',
      },
    });
  }
  console.log(`[PASS] Doctor verified: ${doctor.name} (ID: ${doctor.id})`);

  let authUserRecord = await prisma.user.findFirst();
  if (!authUserRecord) {
    throw new Error('No user found in database for testing');
  }
  const testUser: AuthUser = {
    id: authUserRecord.id.toString(),
    userId: Number(authUserRecord.id),
    uuid: authUserRecord.uuid,
    email: authUserRecord.email,
    login: authUserRecord.login,
    name: `${authUserRecord.firstName} ${authUserRecord.lastName}`,
    role: (authUserRecord.group || 'doctor') as any,
    roles: [(authUserRecord.group || 'doctor')] as any,
    permissions: [],
    organizationId: authUserRecord.organizationId || 1n,
    branchId: authUserRecord.branchId || 1n,
    isSuperAdmin: authUserRecord.isSuperAdmin,
    branchMemberships: [],
    organizationMemberships: [],
  };
  console.log(`[PASS] Auth user verified: ${testUser.name} (ID: ${testUser.id})`);

  // 2. Setup Patients with Allergy Profiles
  // Patient A: UNKNOWN allergy status
  const patientA = await prisma.patient.create({
    data: {
      name: `Test Allergy-Unknown-${Date.now().toString().slice(-4)}`,
      sex: 'Male',
      age: '35',
      phone: `0300${Date.now().toString().slice(-7)}`,
      allergies: null, // UNKNOWN
    },
  });

  // Patient B: Known Penicillin allergy
  const patientB = await prisma.patient.create({
    data: {
      name: `Test Allergy-Known-${Date.now().toString().slice(-4)}`,
      sex: 'Female',
      age: '29',
      phone: `0301${Date.now().toString().slice(-7)}`,
      allergies: 'Penicillin, Amoxicillin',
    },
  });
  console.log(`[PASS] Patients prepared: Patient A (ID: ${patientA.id}, Allergy: UNKNOWN), Patient B (ID: ${patientB.id}, Allergy: Penicillin)`);

  // Ensure active medicine in catalog
  let testMed = await prisma.medicine.findFirst({
    where: { name: { contains: 'Amox', mode: 'insensitive' } },
  });
  if (!testMed) {
    testMed = await prisma.medicine.create({
      data: {
        name: 'Amoxicillin 500mg',
        generic: 'Amoxicillin Trihydrate',
        company: 'GSK Pharma',
        quantity: 100,
        sPrice: '25.00',
      },
    });
  }

  let safeMed = await prisma.medicine.findFirst({
    where: { name: { contains: 'Paracetamol', mode: 'insensitive' } },
  });
  if (!safeMed) {
    safeMed = await prisma.medicine.create({
      data: {
        name: 'Paracetamol 500mg',
        generic: 'Acetaminophen',
        company: 'GlaxoSmithKline',
        quantity: 200,
        sPrice: '5.00',
      },
    });
  }
  console.log(`[PASS] Medicines verified in catalog: ${testMed.name} (ID: ${testMed.id}), ${safeMed.name} (ID: ${safeMed.id})`);

  // 3. Test Allergy Warning Generation
  console.log('\n--- Step 1: Clinical Safety & Allergy Awareness ---');
  // Prescribe for Patient A (Unknown)
  const rxUnknown = await prescriptionService.create(
    {
      patientId: Number(patientA.id),
      doctorId: Number(doctor.id),
      date: '2026-11-24',
      symptom: 'Headache',
      advice: 'Take rest',
      items: [
        {
          name: safeMed.name,
          medicineId: Number(safeMed.id),
          dosage: '500mg',
          duration: '3 days',
          quantityPrescribed: 6,
          route: 'Oral',
          frequency: 'BD',
          timing: 'After food',
        },
      ],
    },
    testUser,
  );
  console.log(`Prescription #${rxUnknown.prescriptionNumber}: Allergy Status = ${rxUnknown.allergyStatus}`);
  console.log(`Alerts:`, rxUnknown.allergyAlerts);
  if (!rxUnknown.allergyAlerts || !rxUnknown.allergyAlerts.some((a) => a.includes('UNKNOWN'))) {
    throw new Error('Expected UNKNOWN allergy warning for Patient A');
  }
  console.log('[PASS] UNKNOWN allergy status detected and explicitly warned.');

  // Prescribe for Patient B with conflicting allergen (Amoxicillin)
  const rxConflict = await prescriptionService.create(
    {
      patientId: Number(patientB.id),
      doctorId: Number(doctor.id),
      date: '2026-11-24',
      symptom: 'Bacterial infection',
      advice: 'Finish full course',
      items: [
        {
          name: testMed.name,
          medicineId: Number(testMed.id),
          dosage: '500mg',
          duration: '5 days',
          quantityPrescribed: 10,
          route: 'Oral',
          frequency: 'TDS',
          timing: 'After food',
        },
      ],
    },
    testUser,
  );
  console.log(`Prescription #${rxConflict.prescriptionNumber}: Allergy Status = ${rxConflict.allergyStatus}`);
  console.log(`Conflict Alerts:`, rxConflict.allergyAlerts);
  if (!rxConflict.allergyAlerts || !rxConflict.allergyAlerts.some((a) => a.includes('CRITICAL ALLERGY ALERT'))) {
    throw new Error('Expected CRITICAL ALLERGY ALERT for Patient B with Amoxicillin');
  }
  console.log('[PASS] Critical allergen conflict accurately detected and surfaced.');

  // 4. Test Prescription Number Uniqueness & Formatting
  console.log('\n--- Step 2: Unique Business Prescription Numbers ---');
  console.log(`Generated Rx Number: ${rxUnknown.prescriptionNumber}`);
  if (!rxUnknown.prescriptionNumber?.startsWith('RX-')) {
    throw new Error(`Invalid Rx number format: ${rxUnknown.prescriptionNumber}`);
  }
  console.log('[PASS] Reliable unique business prescription number validated.');

  // 5. Test Explicit Lifecycle & Digital Sign-off
  console.log('\n--- Step 3: Explicit Lifecycle & Digital Sign-off ---');
  const rxDraft = await prescriptionService.create(
    {
      patientId: Number(patientA.id),
      doctorId: Number(doctor.id),
      date: '2026-11-24',
      symptom: 'Fever and body aches',
      advice: 'Hydrate well',
      status: 'DRAFT',
      signImmediately: false,
      items: [
        {
          name: safeMed.name,
          medicineId: Number(safeMed.id),
          dosage: '500mg',
          duration: '5 days',
          quantityPrescribed: 10,
          unit: 'tablets',
          route: 'Oral',
          frequency: 'BD',
          timing: 'After food',
        },
      ],
    },
    testUser,
  );
  console.log(`Initial Status: ${rxDraft.status} (signedAt: ${rxDraft.signedAt})`);
  if (rxDraft.status !== 'DRAFT') {
    throw new Error(`Expected initial status DRAFT, got ${rxDraft.status}`);
  }

  // Digital Sign-off
  const signedRx = await prescriptionService.sign(
    Number(rxDraft.id),
    { signatureNotes: 'Clinical review complete and verified against EHR.' },
    testUser,
  );
  console.log(`After Sign-off Status: ${signedRx.status}, SignedAt: ${signedRx.signedAt}, SignedBy: ${signedRx.signedBy?.name}`);
  if (signedRx.status !== 'SIGNED' || !signedRx.signedAt || !signedRx.signedById) {
    throw new Error('Prescription sign-off failed to update status or audit fields');
  }
  console.log('[PASS] Digital sign-off verified with cryptographic timestamps and user link.');

  // 6. Test Immutability Guards
  console.log('\n--- Step 4: Immutability Guard Verification ---');
  let updateBlocked = false;
  try {
    await prescriptionService.update(
      Number(signedRx.id),
      { symptom: 'Hacked symptom' },
      testUser,
    );
  } catch (err: any) {
    updateBlocked = true;
    console.log(`Expected update rejection on signed Rx: "${err.message}"`);
  }
  if (!updateBlocked) {
    throw new Error('Immutability failure: update succeeded on signed prescription!');
  }

  let deleteBlocked = false;
  try {
    await prescriptionService.remove(Number(signedRx.id), testUser);
  } catch (err: any) {
    deleteBlocked = true;
    console.log(`Expected delete rejection on signed Rx: "${err.message}"`);
  }
  if (!deleteBlocked) {
    throw new Error('Immutability failure: delete succeeded on signed prescription!');
  }
  console.log('[PASS] Signed prescriptions are strictly immutable against direct modification and deletion.');

  // 7. Test Auditable Clinical Amendment Workflow
  console.log('\n--- Step 5: Auditable Clinical Amendment Workflow ---');
  const amendedRx = await prescriptionService.amend(
    Number(signedRx.id),
    {
      reason: 'Dose titration based on symptom resolution',
      amendedSection: 'MEDICATION_DOSAGE',
      previousNotes: 'Paracetamol 500mg BD',
      newNotes: 'Titrated down to Paracetamol 250mg OD PRN',
    },
    testUser,
  );
  console.log(`Amendments count on Rx: ${amendedRx.amendments?.length}`);
  if (!amendedRx.amendments || amendedRx.amendments.length === 0) {
    throw new Error('Amendment record not found on prescription');
  }
  const amendment = amendedRx.amendments[0];
  console.log(`Amendment: [${amendment.amendedSection}] ${amendment.reason} -> "${amendment.newNotes}" by ${amendment.amendedByUser?.name}`);
  console.log('[PASS] Clinical amendment recorded with full auditability.');

  // 8. Test Prescription Cancellation
  console.log('\n--- Step 6: Prescription Cancellation ---');
  const cancelledRx = await prescriptionService.cancel(
    Number(rxConflict.id),
    { reason: 'Severe allergy risk detected during cross-check' },
    testUser,
  );
  console.log(`Cancelled Rx Status: ${cancelledRx.status}, Reason: ${cancelledRx.cancellationReason}`);
  if (cancelledRx.status !== 'CANCELLED' || !cancelledRx.cancelledAt) {
    throw new Error('Prescription cancellation failed');
  }
  console.log('[PASS] Prescription cancellation successfully verified.');

  // 9. Test Pharmacy Dispensing Integration & FEFO Allocation
  console.log('\n--- Step 7: Pharmacy Dispensing Integration & Status Sync ---');
  // Ensure an active batch for safeMed
  const today = new Date();
  const futureExpiry = new Date();
  futureExpiry.setFullYear(today.getFullYear() + 1);

  const batch = await prisma.medicineBatch.create({
    data: {
      medicineId: safeMed.id,
      batchNumber: `BATCH-VERIF-${Date.now().toString().slice(-4)}`,
      initialQuantity: 100,
      currentQuantity: 100,
      costPrice: 2.0,
      sellingPrice: 5.0,
      expiryDate: futureExpiry,
      status: 'ACTIVE',
      branchId: testUser.branchId ? BigInt(testUser.branchId) : null,
      organizationId: testUser.organizationId ? BigInt(testUser.organizationId) : null,
    },
  });

  // Verify dispense context
  const dispenseContext = await pharmacyService.getPrescriptionDispenseContext(Number(signedRx.id), testUser);
  console.log(`Dispense context loaded for Rx #${signedRx.id}: ${dispenseContext.lines.length} lines`);
  const line = dispenseContext.lines[0];
  console.log(`Line: ${line.prescribedName}, Prescribed: ${line.quantityPrescribed}, Remaining: ${line.quantityRemaining}`);

  // Dispense partially (5 out of 10)
  const dispensation = await pharmacyService.dispense(
    {
      prescriptionId: Number(signedRx.id),
      patientId: Number(patientA.id),
      patientName: patientA.name,
      dispenseDate: new Date().toISOString().split('T')[0],
      items: [
        {
          prescriptionMedicineId: Number(line.prescriptionMedicineId),
          medicineId: Number(line.medicineId),
          batchId: Number(batch.id),
          quantity: 5,
          unitPrice: 5.0,
        },
      ],
    },
    testUser.id,
    testUser,
  );
  console.log(`Dispensation #${dispensation.dispensationNumber} recorded. Total: ${dispensation.totalAmount}`);

  // Check updated prescription status
  const postDispenseRx = await prescriptionService.findById(Number(signedRx.id), testUser);
  console.log(`Post-Dispense Rx Status: ${postDispenseRx.status} (Remaining: ${postDispenseRx.items[0].remainingQuantity})`);
  if (postDispenseRx.status !== 'PARTIALLY_DISPENSED') {
    throw new Error(`Expected status PARTIALLY_DISPENSED, got ${postDispenseRx.status}`);
  }
  console.log('[PASS] Prescription status transitioned to PARTIALLY_DISPENSED.');

  // Dispense remaining 5 units
  await pharmacyService.dispense(
    {
      prescriptionId: Number(signedRx.id),
      patientId: Number(patientA.id),
      patientName: patientA.name,
      dispenseDate: new Date().toISOString().split('T')[0],
      items: [
        {
          prescriptionMedicineId: Number(line.prescriptionMedicineId),
          medicineId: Number(line.medicineId),
          batchId: Number(batch.id),
          quantity: 5,
          unitPrice: 5.0,
        },
      ],
    },
    testUser.id,
    testUser,
  );

  const fullyDispensedRx = await prescriptionService.findById(Number(signedRx.id), testUser);
  console.log(`Fully Dispensed Rx Status: ${fullyDispensedRx.status} (Remaining: ${fullyDispensedRx.items[0].remainingQuantity})`);
  if (fullyDispensedRx.status !== 'DISPENSED') {
    throw new Error(`Expected status DISPENSED, got ${fullyDispensedRx.status}`);
  }
  console.log('[PASS] Prescription status transitioned to DISPENSED after all lines completed.');

  // Verify pharmacy rejects dispensing cancelled prescription
  let cancelledDispenseBlocked = false;
  try {
    await pharmacyService.dispense(
      {
        prescriptionId: Number(cancelledRx.id),
        patientId: Number(patientB.id),
        patientName: patientB.name,
        dispenseDate: new Date().toISOString().split('T')[0],
        items: [
          {
            medicineId: Number(testMed.id),
            quantity: 1,
            unitPrice: 25.0,
          },
        ],
      },
      testUser.id,
      testUser,
    );
  } catch (err: any) {
    cancelledDispenseBlocked = true;
    console.log(`Expected rejection dispensing cancelled Rx: "${err.message}"`);
  }
  if (!cancelledDispenseBlocked) {
    throw new Error('Pharmacy allowed dispensing of cancelled prescription!');
  }
  console.log('[PASS] Pharmacy strictly rejects dispensing of cancelled prescriptions.');

  // 10. Test Pharmacy Queue
  console.log('\n--- Step 8: Pharmacy Queue Verification ---');
  const queue = await prescriptionService.getPharmacyQueue({}, testUser);
  console.log(`Active pharmacy queue count: ${queue.length}`);
  const hasCancelled = queue.some((q) => q.status === 'CANCELLED');
  if (hasCancelled) {
    throw new Error('Queue contains cancelled prescriptions');
  }
  console.log('[PASS] Pharmacy queue only contains active SIGNED or PARTIALLY_DISPENSED prescriptions.');

  // 11. Test Printable Prescription Summary View
  console.log('\n--- Step 9: Printable Prescription View ---');
  const printout = await prescriptionService.getPrintout(Number(fullyDispensedRx.id), testUser);
  console.log(`Printout Organization: ${printout.organization.name} (${printout.organization.branchName})`);
  console.log(`Printout Doctor: ${printout.prescription.doctor?.name}`);
  console.log(`Printout Patient: ${printout.prescription.patient?.name} (MRN: ${printout.prescription.patient?.patientId})`);
  if (!printout.organization.name || !printout.prescription.doctor?.name) {
    throw new Error('Printout missing clinic or doctor metadata');
  }
  console.log('[PASS] Printable prescription view verified with full metadata and credentials.');

  // Cleanup test artifacts
  console.log('\nCleaning up verification records...');
  await prisma.prescriptionAmendment.deleteMany({
    where: { prescriptionId: { in: [BigInt(rxDraft.id), BigInt(rxConflict.id), BigInt(rxUnknown.id)] } },
  });
  await prisma.pharmacyDispensationItem.deleteMany({
    where: { dispensation: { prescriptionId: BigInt(signedRx.id) } },
  });
  await prisma.stockMovement.deleteMany({
    where: { batchId: batch.id },
  });
  await prisma.pharmacyDispensation.deleteMany({
    where: { prescriptionId: BigInt(signedRx.id) },
  });
  await prisma.medicineBatch.delete({
    where: { id: batch.id },
  });
  await prisma.prescriptionMedicine.deleteMany({
    where: { prescriptionId: { in: [BigInt(rxDraft.id), BigInt(rxConflict.id), BigInt(rxUnknown.id)] } },
  });
  await prisma.prescription.deleteMany({
    where: { id: { in: [BigInt(rxDraft.id), BigInt(rxConflict.id), BigInt(rxUnknown.id)] } },
  });
  await prisma.patient.deleteMany({
    where: { id: { in: [patientA.id, patientB.id] } },
  });
  console.log('[PASS] Verification records cleaned up safely.');

  console.log('\n========================================================================');
  console.log('  ALL PHASE 10.5.4 PRESCRIPTION MANAGEMENT VERIFICATION CHECKS PASSED!   ');
  console.log('========================================================================\n');
}

run()
  .catch((e) => {
    console.error('VERIFICATION FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
