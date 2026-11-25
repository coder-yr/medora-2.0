import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaService } from '../src/modules/prisma/prisma.service';
import { LaboratoryService } from '../src/modules/laboratory/laboratory.service';
import { AuthUser } from '../src/common/types/auth-user.interface';
import { BadRequestException } from '@nestjs/common';

const prisma = new PrismaService();

async function run() {
  console.log('========================================================================');
  console.log('  MEDORA 2.0 — PHASE 10.5.5 LABORATORY INTEGRATION VERIFICATION         ');
  console.log('========================================================================\n');

  const labService = new LaboratoryService(prisma as any);

  // 1. Fetch or prepare test Doctor and AuthUser
  let doctor = await prisma.doctor.findFirst();
  if (!doctor) {
    const user = await prisma.user.findFirst();
    doctor = await prisma.doctor.create({
      data: {
        name: 'Dr. Tariq Mahmood',
        email: 'dr.tariq@medora.health',
        phone: '03009876543',
        department: 'Internal Medicine',
        ionUserId: user?.id.toString() || '1',
      },
    });
  }
  console.log(`[PASS] Doctor verified: ${doctor.name} (ID: ${doctor.id})`);

  let authUserRecord = await prisma.user.findFirst();
  if (!authUserRecord) {
    throw new Error('No user found in database for testing');
  }
  const currentUserId = Number(authUserRecord.id);
  const testUser: AuthUser = {
    id: authUserRecord.id.toString(),
    email: authUserRecord.email,
    name: `${authUserRecord.firstName} ${authUserRecord.lastName}`,
    group: (authUserRecord.group || 'Admin') as any,
    permissions: [],
    organizationId: authUserRecord.organizationId || 1n,
    branchId: authUserRecord.branchId || 1n,
    isSuperAdmin: authUserRecord.isSuperAdmin,
  };
  console.log(`[PASS] Auth user verified: ${testUser.name} (ID: ${testUser.id})`);

  // 2. Setup Test Patient
  const patient = await prisma.patient.create({
    data: {
      name: `Test LIS Patient-${Date.now().toString().slice(-4)}`,
      sex: 'Male',
      age: '48',
      phone: `0321${Date.now().toString().slice(-7)}`,
      address: '77 Medical Plaza, Diagnostic Wing',
      branchId: testUser.branchId ? BigInt(testUser.branchId) : null,
    },
  });
  console.log(`[PASS] Patient prepared: ${patient.name} (ID: ${patient.id})`);

  // 3. Test Catalogue Management
  const uniqueCode = `CMP-${Date.now().toString().slice(-4)}`;
  const testName = `Comprehensive Metabolic Panel-${Date.now().toString().slice(-4)}`;
  const catalogueItem = await labService.createCatalogueItem({
    category: testName,
    code: uniqueCode,
    department: 'Biochemistry',
    sampleType: 'Serum',
    turnaroundHours: 4,
    description: 'Automated clinical chemistry panel for electrolytes, renal and liver function',
    price: 2500,
    instructions: '10-12 hours overnight fasting recommended',
    collectionNotes: 'Red top or gold top SST tube. Centrifuge within 2 hours.',
    criticalLow: 2.5,
    criticalHigh: 6.0,
    parameters: [
      {
        name: 'Serum Potassium (K+)',
        unit: 'mmol/L',
        referenceRange: '3.5 - 5.0',
        gender: 'ALL',
        displayOrder: 1,
      },
      {
        name: 'Fasting Blood Sugar (FBS)',
        unit: 'mg/dL',
        referenceRange: '70 - 99',
        gender: 'ALL',
        displayOrder: 2,
      },
      {
        name: 'Serum Creatinine',
        unit: 'mg/dL',
        referenceRange: '0.7 - 1.3',
        gender: 'ALL',
        displayOrder: 3,
      },
    ],
  });
  console.log(`[PASS] Test Catalogue Item created: ${catalogueItem.category} (Code: ${catalogueItem.code}, ID: ${catalogueItem.id}) with 3 parameters`);

  // 4. Lab Order Creation
  const order = await labService.createOrder(
    {
      patientId: Number(patient.id),
      doctorId: Number(doctor.id),
      priority: 'URGENT',
      clinicalNotes: 'Suspected diabetic ketoacidosis and electrolyte shift',
      testIds: [Number(catalogueItem.id)],
      generateInvoice: false,
    },
    currentUserId,
    testUser,
  );

  if (!order.orderNumber.startsWith('LAB-')) {
    throw new Error(`Order number format invalid: ${order.orderNumber}`);
  }
  if (order.status !== 'SAMPLE_PENDING' && order.status !== 'ORDERED') {
    throw new Error(`Unexpected initial order status: ${order.status}`);
  }
  if (!order.samples || order.samples.length === 0) {
    throw new Error('No samples auto-created for lab order');
  }
  const sample1 = order.samples[0];
  if (!sample1.sampleNumber.startsWith('SMP-')) {
    throw new Error(`Sample number format invalid: ${sample1.sampleNumber}`);
  }
  console.log(`[PASS] Order raised: ${order.orderNumber} (Status: ${order.status}), Sample auto-generated: ${sample1.sampleNumber} (Type: ${sample1.sampleType})`);

  // 5. Specimen Collection
  const collectedSample = await labService.collectSample(
    Number(sample1.id),
    {
      collectorLocation: 'OPD Phlebotomy Station 1',
      condition: 'GOOD',
      notes: 'Collected with 21G vacutainer, clean venipuncture',
    },
    currentUserId,
  );
  if (collectedSample.status !== 'COLLECTED') {
    throw new Error(`Expected COLLECTED sample status, got: ${collectedSample.status}`);
  }
  const orderAfterCollect = await labService.getOrderById(Number(order.id), testUser);
  if (orderAfterCollect.status !== 'SAMPLE_COLLECTED') {
    throw new Error(`Expected order status SAMPLE_COLLECTED, got: ${orderAfterCollect.status}`);
  }
  console.log(`[PASS] Phlebotomy recorded: Sample #${collectedSample.sampleNumber} collected at Station 1. Order status: ${orderAfterCollect.status}`);

  // 6. Accessioning in Laboratory
  const receivedSample = await labService.receiveSample(
    Number(sample1.id),
    { notes: 'Specimen cold-chain maintained, barcoded' },
    currentUserId,
  );
  if (receivedSample.status !== 'RECEIVED') {
    throw new Error(`Expected RECEIVED sample status, got: ${receivedSample.status}`);
  }
  const orderAfterReceive = await labService.getOrderById(Number(order.id), testUser);
  if (orderAfterReceive.status !== 'PROCESSING') {
    throw new Error(`Expected order status PROCESSING, got: ${orderAfterReceive.status}`);
  }
  console.log(`[PASS] Specimen accessioned into analytical laboratory pool. Order status: ${orderAfterReceive.status}`);

  // 7. Specimen Rejection Triage
  const rejectedSample = await labService.rejectSample(
    Number(sample1.id),
    {
      reason: 'HEMOLYZED',
      notes: 'Gross 3+ hemolysis observed post-centrifugation; potassium testing cannot be reliably performed',
    },
    currentUserId,
  );
  if (rejectedSample.status !== 'REJECTED') {
    throw new Error(`Expected REJECTED sample status, got: ${rejectedSample.status}`);
  }
  const orderAfterReject = await labService.getOrderById(Number(order.id), testUser);
  if (orderAfterReject.status !== 'SAMPLE_PENDING') {
    throw new Error(`Expected order status reset to SAMPLE_PENDING, got: ${orderAfterReject.status}`);
  }
  console.log(`[PASS] Specimen rejection verified: Sample marked REJECTED (Reason: HEMOLYZED). Order status reset to: ${orderAfterReject.status}`);

  // 8. Specimen Recollection Workflow
  const recollectedSample = await labService.recollectSample(
    Number(sample1.id),
    {
      collectorLocation: 'OPD Phlebotomy Station 2',
      condition: 'FRESH',
      notes: 'Recollected from opposite arm following hemolysis',
    },
    currentUserId,
  );
  if (!recollectedSample.isRecollection || recollectedSample.status !== 'COLLECTED') {
    throw new Error(`Recollection sample creation failed: ${JSON.stringify(recollectedSample)}`);
  }
  const orderAfterRecollect = await labService.getOrderById(Number(order.id), testUser);
  if (orderAfterRecollect.status !== 'SAMPLE_COLLECTED') {
    throw new Error(`Expected order status SAMPLE_COLLECTED after recollection, got: ${orderAfterRecollect.status}`);
  }
  console.log(`[PASS] Specimen recollection verified: Sample #${recollectedSample.sampleNumber} (Linked to #${sample1.id}, isRecollection: true). Order status: ${orderAfterRecollect.status}`);

  // Accession the recollected specimen
  await labService.receiveSample(
    Number(recollectedSample.id),
    { notes: 'Recollected specimen received in excellent condition' },
    currentUserId,
  );
  console.log('[PASS] Recollected specimen accessioned and ready for analysis');

  // 9. Structured Result Entry & Automated Server-Side Abnormality Evaluation
  const orderForResults = await labService.getOrderById(Number(order.id), testUser);
  const testItem = orderForResults.tests[0];
  const potassiumParam = testItem.resultParameters.find((p: any) => p.parameterName.includes('Potassium'));
  const fbsParam = testItem.resultParameters.find((p: any) => p.parameterName.includes('Fasting Blood Sugar'));
  const creatParam = testItem.resultParameters.find((p: any) => p.parameterName.includes('Creatinine'));

  const resultEntry = await labService.enterResults(
    Number(order.id),
    {
      parameters: [
        {
          testId: Number(testItem.id),
          parameterId: potassiumParam ? Number(potassiumParam.parameterId) : undefined,
          parameterName: 'Serum Potassium (K+)',
          value: '6.8', // Critical high: criticalHigh limit was 6.0
        },
        {
          testId: Number(testItem.id),
          parameterId: fbsParam ? Number(fbsParam.parameterId) : undefined,
          parameterName: 'Fasting Blood Sugar (FBS)',
          value: '165', // Above 70 - 99 range -> HIGH
        },
        {
          testId: Number(testItem.id),
          parameterId: creatParam ? Number(creatParam.parameterId) : undefined,
          parameterName: 'Serum Creatinine',
          value: '0.9', // Normal
        },
      ],
      summary: 'Marked hyperkalemia and fasting hyperglycemia detected. Urgent clinical notification indicated.',
    },
    currentUserId,
  );

  const updatedTest = resultEntry.tests[0];
  const evaluatedPotassium = updatedTest.resultParameters.find((p: any) => p.parameterName.includes('Potassium'));
  const evaluatedFbs = updatedTest.resultParameters.find((p: any) => p.parameterName.includes('Fasting Blood Sugar'));
  const evaluatedCreat = updatedTest.resultParameters.find((p: any) => p.parameterName.includes('Creatinine'));

  if (evaluatedPotassium.abnormalFlag !== 'CRITICAL_HIGH') {
    throw new Error(`Expected Potassium flag CRITICAL_HIGH, got: ${evaluatedPotassium.abnormalFlag}`);
  }
  if (evaluatedFbs.abnormalFlag !== 'HIGH') {
    throw new Error(`Expected FBS flag HIGH, got: ${evaluatedFbs.abnormalFlag}`);
  }
  if (evaluatedCreat.abnormalFlag !== 'NORMAL') {
    throw new Error(`Expected Creatinine flag NORMAL, got: ${evaluatedCreat.abnormalFlag}`);
  }
  if (resultEntry.status !== 'RESULT_ENTERED') {
    throw new Error(`Expected order status RESULT_ENTERED, got: ${resultEntry.status}`);
  }
  console.log(`[PASS] Server-side abnormality evaluation verified:`);
  console.log(`       - Potassium 6.8 mmol/L -> ${evaluatedPotassium.abnormalFlag} (Panic Alert)`);
  console.log(`       - FBS 165 mg/dL -> ${evaluatedFbs.abnormalFlag}`);
  console.log(`       - Creatinine 0.9 mg/dL -> ${evaluatedCreat.abnormalFlag}`);
  console.log(`       - Derived Order Status: ${resultEntry.status}`);

  // 10. Clinical Result Verification
  const verifiedOrder = await labService.verifyResults(
    Number(order.id),
    { comments: 'Critically high potassium verified with secondary electrode and rerun' },
    currentUserId,
  );
  if (verifiedOrder.status !== 'VERIFIED' || !verifiedOrder.verifiedBy) {
    throw new Error(`Verification failed: ${JSON.stringify(verifiedOrder)}`);
  }
  console.log(`[PASS] Senior Clinical Review: Order #${verifiedOrder.orderNumber} status -> VERIFIED (VerifiedBy: ${verifiedOrder.verifiedBy})`);

  // 11. Final Report Approval & Release
  const approvedOrder = await labService.approveReport(
    Number(order.id),
    { remarks: 'Released to attending physician with direct telephonic critical alert' },
    currentUserId,
  );
  if (approvedOrder.status !== 'COMPLETED' || !approvedOrder.approvedBy) {
    throw new Error(`Approval failed: ${JSON.stringify(approvedOrder)}`);
  }
  console.log(`[PASS] Final Pathologist Approval: Order #${approvedOrder.orderNumber} status -> COMPLETED (ApprovedBy: ${approvedOrder.approvedBy})`);

  // 12. Clinical Immutability Verification
  let immutabilityProtected = false;
  try {
    await labService.enterResults(
      Number(order.id),
      {
        parameters: [
          {
            testId: Number(testItem.id),
            parameterName: 'Serum Potassium (K+)',
            value: '4.5',
          },
        ],
      },
      currentUserId,
    );
  } catch (err: any) {
    if (err instanceof BadRequestException && err.message.includes('controlled amendment')) {
      immutabilityProtected = true;
    }
  }
  if (!immutabilityProtected) {
    throw new Error('Clinical record immutability violated: completed report allowed direct result modification');
  }
  console.log('[PASS] Record Immutability verified: Direct edits on finalized report blocked with BadRequestException');

  // 13. Controlled Auditable Amendment
  const amendedOrder = await labService.amendReport(
    Number(order.id),
    {
      reason: 'Recalibration adjustment following standardized reagent QC cross-check',
      parameters: [
        {
          testId: Number(testItem.id),
          parameterId: potassiumParam ? Number(potassiumParam.parameterId) : undefined,
          parameterName: 'Serum Potassium (K+)',
          value: '6.6',
          abnormalFlag: 'CRITICAL_HIGH',
          clinicalComments: 'Amended post analyzer bias recalibration',
        },
      ],
    },
    currentUserId,
  );
  if (!amendedOrder.amendments || amendedOrder.amendments.length === 0) {
    throw new Error('Amendment audit entry was not created');
  }
  const amendment = amendedOrder.amendments[0];
  console.log(`[PASS] Auditable Amendment recorded: Amendment ID #${amendment.id} (Reason: "${amendment.reason}")`);

  // 14. Printable Clinical Laboratory Report
  const printout = await labService.getPrintout(Number(order.id), testUser);
  if (!printout.orderNumber || !printout.hospital || !printout.patient || !printout.tests) {
    throw new Error(`Printout payload incomplete: ${JSON.stringify(printout)}`);
  }
  if (!printout.verification.verifiedByName || !printout.verification.approvedByName) {
    throw new Error(`Printout verifier / approver signatures missing: ${JSON.stringify(printout.verification)}`);
  }
  if (!printout.amendments || printout.amendments.length === 0) {
    throw new Error('Printout amendments audit list missing');
  }
  console.log(`[PASS] Printable Laboratory Report generated successfully:`);
  console.log(`       - Facility: ${printout.hospital.name}`);
  console.log(`       - Patient: ${printout.patient.name} (MRN: ${printout.patient.mrn})`);
  console.log(`       - Clinician Signatures: Verifier "${printout.verification.verifiedByName}", Approver "${printout.verification.approvedByName}"`);
  console.log(`       - Parameters Reported: ${printout.tests[0].parameters.length} parameter(s)`);
  console.log(`       - Printed Timestamp: ${printout.printedAt}`);

  // 15. Clean Cleanup of Test Records
  await prisma.labReportAmendment.deleteMany({ where: { labId: order.id } });
  await prisma.labResultParameter.deleteMany({ where: { labTest: { labId: order.id } } });
  await prisma.labTest.deleteMany({ where: { labId: order.id } });
  await prisma.labSample.deleteMany({ where: { labId: order.id } });
  await prisma.lab.delete({ where: { id: order.id } });
  await prisma.labTestParameter.deleteMany({ where: { labCategoryId: catalogueItem.id } });
  await prisma.labCategory.delete({ where: { id: catalogueItem.id } });
  await prisma.patient.delete({ where: { id: patient.id } });
  console.log('[PASS] Test fixtures cleaned up from database');

  console.log('\n========================================================================');
  console.log('  ALL PHASE 10.5.5 LABORATORY INTEGRATION VERIFICATIONS PASSED (15/15)  ');
  console.log('========================================================================');
}

run()
  .catch((e) => {
    console.error('\n[FAIL] Phase 10.5.5 Laboratory Integration verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
