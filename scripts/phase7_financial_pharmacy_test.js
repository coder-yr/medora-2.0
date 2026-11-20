const fs = require('fs');
const path = require('path');
const jwt = require(path.join(__dirname, '../backend/node_modules/jsonwebtoken'));

const envPath = path.join(__dirname, '../backend/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const secretLine = envContent.split('\n').find((l) => l.trim().startsWith('JWT_SECRET='));
const JWT_SECRET = secretLine
  ? secretLine.split('=')[1].trim().replace(/^["']|["']$/g, '')
  : (process.env.JWT_SECRET || 'local-dev-secret');

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

function makeToken(payload) {
  return jwt.sign(
    {
      sub: payload.sub || '1',
      userId: payload.sub || '1',
      email: payload.email || 'test@medora.hospital',
      name: payload.name || 'Test User',
      group: payload.group || 'Admin',
      branchId: payload.branchId !== undefined ? payload.branchId : '1',
      permissions: payload.permissions || ['*'],
      ...payload,
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

async function api(reqPath, options = {}) {
  const token = options.token;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${reqPath}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const status = res.status;
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status, ok: res.ok, data: json };
}

async function runPhase7Tests() {
  console.log('========================================================================');
  console.log('MEDORA 2.0 — PHASE 7: FINANCIAL INTEGRITY & PHARMACY SAFETY TEST RUN');
  console.log('========================================================================\n');

  const results = {
    passed: 0,
    failed: 0,
    details: [],
  };

  function assert(condition, message, details = '') {
    if (condition) {
      results.passed++;
      console.log(`[PASS] ${message}`);
      results.details.push({ status: 'PASSED', message });
    } else {
      results.failed++;
      console.error(`[FAIL] ${message} | ${details}`);
      results.details.push({ status: 'FAILED', message, details });
    }
  }

  // Persona Tokens
  const adminToken = makeToken({ sub: '1', group: 'Admin', permissions: ['*'] });
  const cashierToken = makeToken({
    sub: '4', // Receptionist / Cashier
    group: 'Receptionist',
    permissions: [
      'cashier_view',
      'cashier_shift_open',
      'cashier_shift_close',
      'payment_add',
      'cashier_daybook_view',
      'invoice_view',
      'invoice_add',
      'invoice_edit',
    ],
  });
  const supervisorToken = makeToken({
    sub: '1',
    group: 'Admin',
    permissions: ['cashier_shift_approve', 'cashier_view', '*'],
  });
  const pharmacistToken = makeToken({
    sub: '7',
    group: 'Pharmacist',
    permissions: [
      'pharmacy_view',
      'pharmacy_dispense',
      'pharmacy_inventory_view',
      'pharmacy_inventory_manage',
      'prescription_view',
      'medicine_view',
      'medicine_add',
    ],
  });
  const doctorToken = makeToken({
    sub: '3',
    group: 'Doctor',
    permissions: ['prescription_add', 'prescription_view', 'patient_view'],
  });
  const nurseToken = makeToken({
    sub: '6',
    group: 'Nurse',
    permissions: ['inpatient_view', 'patient_view'],
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  // ===========================================================================
  // SECTION 1: PHYSICAL CASH DRAWER & SHIFT CONCURRENCY INTEGRITY
  // ===========================================================================
  console.log('\n--- 1. Cash Drawer Management & Concurrency Controls ---');

  // Step 1.0: Clean up any existing active shift for Cashier 4
  const activeShiftRes = await api('/cashier/shifts/active', { token: cashierToken });
  if (activeShiftRes.status === 200 && activeShiftRes.data?.data?.id) {
    const activeId = activeShiftRes.data.data.id;
    console.log(`Closing prior active shift #${activeId} for cashier 4...`);
    await api(`/cashier/shifts/${activeId}/close`, {
      method: 'POST',
      token: cashierToken,
      body: { countedCash: 0, denominations: [{ denomination: 1000, count: 0 }], closingNotes: 'Resetting for Phase 7 test' },
    });
    await api(`/cashier/shifts/${activeId}/approve`, {
      method: 'POST',
      token: supervisorToken,
      body: { notes: 'Auto-approved for Phase 7 test' },
    });
  }

  // Step 1.1: Register a physical cash drawer
  const drawerCode = `DRW-${Date.now().toString().slice(-6)}`;
  const drawerRes = await api('/cashier/drawers', {
    method: 'POST',
    token: adminToken,
    body: {
      code: drawerCode,
      name: `Physical Drawer ${drawerCode}`,
      branchId: '1',
      isActive: true,
    },
  });
  assert(
    drawerRes.status === 201 && drawerRes.data?.data?.id,
    'Physical cash drawer created successfully with branch binding',
    `Status: ${drawerRes.status}, data: ${JSON.stringify(drawerRes.data)}`
  );
  const cashDrawerId = drawerRes.data?.data?.id;

  // Step 1.2: Open Cashier Shift with physical drawer and initial float
  const openShiftRes = await api('/cashier/shifts/open', {
    method: 'POST',
    token: cashierToken,
    body: {
      cashDrawerId,
      openingCash: 5000,
      branchId: '1',
      notes: 'Phase 7 Verification Shift',
    },
  });
  assert(
    openShiftRes.status === 201 && openShiftRes.data?.data?.id,
    `Cashier shift opened successfully bound to drawer #${cashDrawerId} with PKR 5,000 float`,
    `Status: ${openShiftRes.status}, data: ${JSON.stringify(openShiftRes.data)}`
  );
  const shiftId = openShiftRes.data?.data?.id;

  // Step 1.3: Concurrency Control - Second Cashier attempts to open shift with SAME drawer
  const cashier2Token = makeToken({
    sub: '5', // Accountant attempting to open shift on same drawer
    group: 'Accountant',
    permissions: ['cashier_shift_open', 'cashier_view'],
  });
  const duplicateDrawerRes = await api('/cashier/shifts/open', {
    method: 'POST',
    token: cashier2Token,
    body: {
      cashDrawerId,
      openingCash: 2000,
      branchId: '1',
      notes: 'Conflicting shift attempt',
    },
  });
  assert(
    duplicateDrawerRes.status === 409,
    'Drawer concurrency protection enforced: 409 Conflict when second shift claims active drawer',
    `Status: ${duplicateDrawerRes.status}, message: ${duplicateDrawerRes.data?.message}`
  );

  // ===========================================================================
  // SECTION 2: COMPLETE INVOICE PAYMENT, SETTLEMENT & SAFETY CHECKS
  // ===========================================================================
  console.log('\n--- 2. Invoicing, Payments, Settlement & Safety Controls ---');

  // Step 2.1: Register a fresh patient record for clean invoice settlement
  const patientRegRes = await api('/patients', {
    method: 'POST',
    token: adminToken,
    body: {
      name: `Phase 7 Patient ${Date.now()}`,
      phone: `0300${Math.floor(1000000 + Math.random() * 9000000)}`,
      sex: 'male',
      birthdate: '1990-01-01',
      bloodGroup: 'O+',
      address: '123 Hospital Way',
      email: `ph7.patient.${Date.now()}@example.com`,
    },
  });
  const patientId = patientRegRes.data?.data?.id || patientRegRes.data?.id;
  assert(
    patientId !== undefined,
    `Patient #${patientId} registered successfully for financial workflow`,
    `Status: ${patientRegRes.status}, data: ${JSON.stringify(patientRegRes.data)}`
  );

  // Create patient invoice for testing
  const invoiceRes = await api('/invoices', {
    method: 'POST',
    token: cashierToken,
    body: {
      patient: String(patientId),
      branchId: '1',
      date: todayStr,
      items: [
        {
          name: 'Specialist Consultation & Diagnostics',
          quantity: 1,
          unit_price: 4000,
        },
      ],
    },
  });
  assert(
    invoiceRes.status === 201 && invoiceRes.data?.data?.id,
    'Patient invoice generated for PKR 4,000 in unpaid status',
    `Status: ${invoiceRes.status}, data: ${JSON.stringify(invoiceRes.data)}`
  );
  const invoiceId = invoiceRes.data?.data?.id;

  // Step 2.2: Partial Payment of PKR 1,500
  const partialPayRes = await api(`/invoices/${invoiceId}/pay`, {
    method: 'POST',
    token: cashierToken,
    body: {
      amount: 1500,
      method: 'Cash',
      reference: 'PART-001',
      date: todayStr,
    },
  });
  assert(
    partialPayRes.status === 200 || partialPayRes.status === 201,
    'Partial payment of PKR 1,500 accepted and linked to active cashier shift',
    `Status: ${partialPayRes.status}, data: ${JSON.stringify(partialPayRes.data)}`
  );

  // Check invoice balance
  const invAfterPartial = await api(`/invoices/${invoiceId}`, { token: cashierToken });
  const remainingBal = Number(invAfterPartial.data?.data?.balance);
  const paymentStatus = invAfterPartial.data?.data?.status;
  assert(
    remainingBal === 2500 && String(paymentStatus).toLowerCase().includes('part'),
    `Invoice balance updated correctly: Remaining balance PKR ${remainingBal}, status: ${paymentStatus}`,
    `Bal: ${remainingBal}, Status: ${paymentStatus}`
  );

  // Step 2.3: Full Settlement of remaining PKR 2,500
  const finalPayRes = await api(`/invoices/${invoiceId}/pay`, {
    method: 'POST',
    token: cashierToken,
    body: {
      amount: 2500,
      method: 'Cash',
      reference: 'FULL-001',
      date: todayStr,
    },
  });
  assert(
    finalPayRes.status === 200 || finalPayRes.status === 201,
    'Full settlement of remaining PKR 2,500 processed successfully',
    `Status: ${finalPayRes.status}`
  );

  const invAfterFull = await api(`/invoices/${invoiceId}`, { token: cashierToken });
  const finalBal = Number(invAfterFull.data?.data?.balance);
  const finalStatus = invAfterFull.data?.data?.status;
  assert(
    finalBal === 0 && String(finalStatus).toLowerCase().includes('paid'),
    `Invoice settled in full: Balance PKR 0, status: ${finalStatus}`,
    `Bal: ${finalBal}, Status: ${finalStatus}`
  );

  // Step 2.4: Overpayment Rejection Safety Test
  const overpayRes = await api(`/invoices/${invoiceId}/pay`, {
    method: 'POST',
    token: cashierToken,
    body: {
      amount: 500,
      method: 'Cash',
    },
  });
  assert(
    overpayRes.status === 400,
    'Overpayment safety enforced: 400 Bad Request on payment exceeding outstanding balance',
    `Status: ${overpayRes.status}, message: ${overpayRes.data?.message}`
  );

  // ===========================================================================
  // SECTION 3: CASHIER SHIFT RECONCILIATION & SUPERVISOR DUAL-CONTROL
  // ===========================================================================
  console.log('\n--- 3. Cashier Shift Reconciliation & Dual-Control Closure ---');

  // Step 3.1: Verify Shift Totals
  const shiftTotalsRes = await api(`/cashier/shifts/${shiftId}/totals`, { token: cashierToken });
  const expectedCash = Number(shiftTotalsRes.data?.data?.expectedCash);
  const cashCollected = Number(shiftTotalsRes.data?.data?.totalCashIn);
  assert(
    shiftTotalsRes.status === 200 && expectedCash === 9000,
    `Shift totals reconciled: Float (5,000) + Inflow (4,000) = Expected Cash PKR ${expectedCash}`,
    `Expected: ${expectedCash}, Collected: ${cashCollected}`
  );

  // Step 3.2: Submit Shift Close (Counted Cash: 9,000)
  const submitCloseRes = await api(`/cashier/shifts/${shiftId}/close`, {
    method: 'POST',
    token: cashierToken,
    body: {
      countedCash: 9000,
      denominations: [
        { denomination: 5000, count: 1 },
        { denomination: 1000, count: 4 },
      ],
      closingNotes: 'Shift reconciled with zero variance',
    },
  });
  const shiftAfterClose = submitCloseRes.data?.data;
  assert(
    submitCloseRes.status === 200 && shiftAfterClose?.status === 'PENDING_APPROVAL',
    'Shift close submitted successfully: Status transitioned to PENDING_APPROVAL with 0 variance',
    `Status: ${submitCloseRes.status}, Shift status: ${shiftAfterClose?.status}`
  );

  // Step 3.3: Separation of Duties - Cashier attempts self-approval
  const selfApproveRes = await api(`/cashier/shifts/${shiftId}/approve`, {
    method: 'POST',
    token: cashierToken,
    body: { notes: 'Illegal self-approval attempt' },
  });
  assert(
    selfApproveRes.status === 403,
    'Separation of duties enforced: 403 Forbidden when cashier attempts self-approval',
    `Status: ${selfApproveRes.status}, message: ${selfApproveRes.data?.message}`
  );

  // Step 3.4: Supervisor (Admin) approves shift
  const supervisorApproveRes = await api(`/cashier/shifts/${shiftId}/approve`, {
    method: 'POST',
    token: supervisorToken,
    body: { notes: 'Approved by Shift Supervisor after count verification' },
  });
  assert(
    supervisorApproveRes.status === 200 && supervisorApproveRes.data?.data?.status === 'CLOSED',
    'Supervisor approval verified: Shift status transitioned to CLOSED',
    `Status: ${supervisorApproveRes.status}, shift status: ${supervisorApproveRes.data?.data?.status}`
  );

  // ===========================================================================
  // SECTION 4: PHARMACY DISPENSING SAFETY & INVENTORY INTEGRITY
  // ===========================================================================
  console.log('\n--- 4. Pharmacy Safety, Expiry & Stock Controls ---');

  // Step 4.1: Retrieve medicine catalogue & batch
  const medRes = await api('/medicines', { token: pharmacistToken });
  let medicineId = null;
  if (medRes.status === 200 && medRes.data?.data?.length > 0) {
    medicineId = medRes.data.data[0].id;
  } else {
    // Create a medicine if none exist
    const createMedRes = await api('/medicines', {
      method: 'POST',
      token: pharmacistToken,
      body: {
        name: `Amoxicillin ${Date.now().toString().slice(-4)} 500mg`,
        generic: 'Amoxicillin Trihydrate',
        company: 'GSK',
        price: 25,
        sPrice: 30,
      },
    });
    medicineId = createMedRes.data?.data?.id || createMedRes.data?.id;
  }

  assert(
    medicineId !== null,
    `Pharmacy catalogue active medicine #${medicineId}`,
    `Found medicine: ${medicineId}`
  );

  // Retrieve active batches for this medicine
  const batchRes = await api(`/pharmacy/batches?medicineId=${medicineId}`, { token: pharmacistToken });
  let activeBatch = null;
  if (batchRes.data?.data?.length > 0) {
    activeBatch = batchRes.data.data.find((b) => Number(b.quantity) > 5 && b.status === 'ACTIVE');
  }

  // If no suitable batch, create one with future expiry
  if (!activeBatch) {
    const today = new Date();
    const futureExpiry = new Date(today.setFullYear(today.getFullYear() + 2)).toISOString().slice(0, 10);
    const newBatchRes = await api('/pharmacy/batches', {
      method: 'POST',
      token: pharmacistToken,
      body: {
        medicineId: Number(medicineId),
        batchNumber: `PH7-BAT-${Date.now().toString().slice(-5)}`,
        expiryDate: futureExpiry,
        quantity: 100,
        costPrice: 15,
        sellingPrice: 25,
      },
    });
    activeBatch = newBatchRes.data?.data;
  }

  assert(
    activeBatch && activeBatch.id,
    `Active medicine batch confirmed: Batch #${activeBatch?.batchNumber} with stock ${activeBatch?.quantity}`,
    `Batch: ${JSON.stringify(activeBatch)}`
  );

  // Step 4.2: Create prescription to dispense
  const rxRes = await api('/prescriptions', {
    method: 'POST',
    token: doctorToken,
    body: {
      patientId: Number(patientId),
      doctorId: 3,
      date: todayStr,
      branchId: '1',
      symptom: 'Acute bacterial infection - verification regimen',
      advice: 'Take with full glass of water after food',
      items: [
        {
          medicineId: Number(medicineId),
          name: 'Amoxicillin 500mg',
          dosage: '1+0+1',
          duration: '5 days',
        },
      ],
    },
  });
  assert(
    rxRes.status === 201 && rxRes.data?.data?.id,
    'Clinical prescription issued in PENDING status for pharmacy dispensing',
    `Status: ${rxRes.status}, data: ${JSON.stringify(rxRes.data)}`
  );
  const prescriptionId = rxRes.data?.data?.id;

  // Step 4.3: Negative Safety Check - Expired Batch Rejection
  const expiredDate = '2023-01-01';
  const expBatchRes = await api('/pharmacy/batches', {
    method: 'POST',
    token: pharmacistToken,
    body: {
      medicineId: Number(medicineId),
      batchNumber: `EXP-${Date.now().toString().slice(-5)}`,
      expiryDate: expiredDate,
      quantity: 50,
      costPrice: 10,
      sellingPrice: 20,
    },
  });
  const expiredBatchId = expBatchRes.data?.data?.id;

  if (expiredBatchId) {
    const expiredDispenseRes = await api('/pharmacy/dispensations', {
      method: 'POST',
      token: pharmacistToken,
      body: {
        prescriptionId: Number(prescriptionId),
        dispenseDate: todayStr,
        items: [
          {
            medicineId: Number(medicineId),
            batchId: Number(expiredBatchId),
            quantity: 1,
          },
        ],
      },
    });
    assert(
      expiredDispenseRes.status === 400,
      'Clinical safety enforced: 400 Bad Request on attempt to dispense expired medicine batch',
      `Status: ${expiredDispenseRes.status}, message: ${expiredDispenseRes.data?.message}`
    );
  }

  // Step 4.4: Negative Safety Check - Insufficient Quantity Rejection
  const excessDispenseRes = await api('/pharmacy/dispensations', {
    method: 'POST',
    token: pharmacistToken,
    body: {
      prescriptionId: Number(prescriptionId),
      dispenseDate: todayStr,
      items: [
        {
          medicineId: Number(medicineId),
          batchId: Number(activeBatch.id),
          quantity: 999999, // Exceeds stock
        },
      ],
    },
  });
  assert(
    excessDispenseRes.status === 400,
    'Inventory safety enforced: 400 Bad Request on attempt to dispense quantity exceeding available stock',
    `Status: ${excessDispenseRes.status}, message: ${excessDispenseRes.data?.message}`
  );

  // Step 4.5: Valid Dispensing Workflow
  const preDispenseStock = Number(activeBatch.currentQuantity ?? activeBatch.quantity);
  const dispenseRes = await api('/pharmacy/dispensations', {
    method: 'POST',
    token: pharmacistToken,
    body: {
      prescriptionId: Number(prescriptionId),
      dispenseDate: todayStr,
      items: [
        {
          medicineId: Number(medicineId),
          batchId: Number(activeBatch.id),
          quantity: 2,
        },
      ],
    },
  });
  assert(
    dispenseRes.status === 201 && dispenseRes.data?.data?.id,
    'Prescription dispensed successfully with batch-level inventory deduction',
    `Status: ${dispenseRes.status}, ID: ${dispenseRes.data?.data?.id}`
  );

  // Step 4.6: Verify Stock Movement and Batch Decrement
  const batchCheck = await api(`/pharmacy/batches/${activeBatch.id}`, { token: pharmacistToken });
  const postDispenseStock = Number(batchCheck.data?.data?.currentQuantity ?? batchCheck.data?.data?.quantity);
  assert(
    postDispenseStock === preDispenseStock - 2,
    `Stock atomically decremented: ${preDispenseStock} -> ${postDispenseStock} (-2 units)`,
    `Initial: ${preDispenseStock}, Final: ${postDispenseStock}`
  );

  // ===========================================================================
  // SECTION 5: ACCOUNTING INTEGRITY & AUDIT REPORTING
  // ===========================================================================
  console.log('\n--- 5. Financial Reconciliation & Ledger Integrity ---');

  // Step 5.1: Cashier Day Book Report
  const dayBookRes = await api('/cashier/day-book', { token: cashierToken });
  assert(
    dayBookRes.status === 200 && Array.isArray(dayBookRes.data?.data?.lines),
    'Cashier day-book generated with complete transaction history and audit trail',
    `Count: ${dayBookRes.data?.data?.lines?.length}`
  );

  // Step 5.2: Accounting Trial Balance
  const trialBalRes = await api('/accounting/reports/trial-balance', { token: supervisorToken });
  assert(
    trialBalRes.status === 200 && trialBalRes.data?.data?.isBalanced !== undefined,
    `Trial balance generated: Ledger is balanced = ${trialBalRes.data?.data?.isBalanced}`,
    `Total Debit: ${trialBalRes.data?.data?.totalDebit}, Total Credit: ${trialBalRes.data?.data?.totalCredit}`
  );

  // ===========================================================================
  // SECTION 6: CROSS-ROLE AUTHORIZATION BOUNDARY REGRESSION
  // ===========================================================================
  console.log('\n--- 6. Cross-Role Authorization Boundary Regression ---');

  // Step 6.1: Nurse cannot post financial journal entries
  const nurseJournalRes = await api('/accounting/journals', {
    method: 'POST',
    token: nurseToken,
    body: { journalNumber: 'ILLEGAL-01' },
  });
  assert(
    nurseJournalRes.status === 403,
    'Nurse boundary enforced: 403 Forbidden on accounting journal creation',
    `Status: ${nurseJournalRes.status}`
  );

  // Step 6.2: Pharmacist cannot view inpatient clinical charts
  const pharmInpatientRes = await api('/inpatient/dashboard', { token: pharmacistToken });
  assert(
    pharmInpatientRes.status === 403,
    'Pharmacist boundary enforced: 403 Forbidden on inpatient clinical dashboard',
    `Status: ${pharmInpatientRes.status}`
  );

  // Step 6.3: Receptionist cannot dispense pharmacy medicines
  const recepDispenseRes = await api('/pharmacy/dispensations', {
    method: 'POST',
    token: cashierToken,
    body: { prescriptionId: 1, items: [] },
  });
  assert(
    recepDispenseRes.status === 403,
    'Receptionist boundary enforced: 403 Forbidden on pharmacy dispensing',
    `Status: ${recepDispenseRes.status}`
  );

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('\n========================================================================');
  console.log(`TEST RUN COMPLETE: ${results.passed} PASSED, ${results.failed} FAILED`);
  console.log('========================================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  }
}

runPhase7Tests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
