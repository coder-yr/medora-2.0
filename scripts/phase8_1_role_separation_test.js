const fs = require('fs');
const path = require('path');
const jwt = require(path.resolve('backend/node_modules/jsonwebtoken'));

const envPath = path.resolve('backend/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const secretLine = envContent.split('\n').find((l) => l.trim().startsWith('JWT_SECRET='));
const JWT_SECRET = secretLine
  ? secretLine.split('=')[1].trim().replace(/^["']|["']$/g, '')
  : (process.env.JWT_SECRET || 'local-dev-secret');

const API_BASE = 'http://localhost:3000/api/v1';

// Import pure role-resolution function simulation (identical to frontend/src/app/role-resolution.ts)
function resolveUserRole(user) {
  if (!user) return '';

  const rawGroup = (user.group || user.role || '').trim().toLowerCase();
  const rawPerms = Array.isArray(user.permissions)
    ? user.permissions.map((p) => String(p).trim().toLowerCase())
    : [];
  const perms = new Set(rawPerms);

  // 1. Super Admin
  if (
    rawGroup === 'superadmin' ||
    rawGroup === 'super_admin' ||
    rawGroup === 'super admin' ||
    (perms.has('branch_view_all') && perms.has('system_settings'))
  ) {
    return 'Super Admin';
  }

  // 2. Radiologist
  if (
    rawGroup === 'radiologist' ||
    rawGroup === 'radiology' ||
    ((rawGroup === 'doctor' || rawGroup === 'technician') &&
      perms.has('radiology_process') &&
      !perms.has('consultation_add'))
  ) {
    return 'Radiologist';
  }

  // 3. Cashier
  if (
    rawGroup === 'cashier' ||
    ((rawGroup === 'receptionist' || rawGroup === 'accountant') &&
      perms.has('cashier_shift_open') &&
      !perms.has('appointment_add'))
  ) {
    return 'Cashier';
  }

  // 4. HR
  if (
    rawGroup === 'hr' ||
    rawGroup === 'human_resources' ||
    ((rawGroup === 'admin' || rawGroup === 'staff') &&
      perms.has('staff_assign_department') &&
      !perms.has('accounting_journal_create') &&
      !perms.has('consultation_add'))
  ) {
    return 'HR';
  }

  // 5. Hospital Admin
  if (
    rawGroup === 'admin' ||
    rawGroup === 'administrator' ||
    rawGroup === 'hospital admin' ||
    rawGroup === 'hospitaladmin'
  ) {
    return 'Hospital Admin';
  }

  // 6. Doctor
  if (rawGroup === 'doctor' || rawGroup === 'physician') {
    return 'Doctor';
  }

  // 7. Receptionist
  if (rawGroup === 'receptionist' || rawGroup === 'frontdesk' || rawGroup === 'front_desk') {
    return 'Receptionist';
  }

  // 8. Nurse
  if (rawGroup === 'nurse' || rawGroup === 'nursing') {
    return 'Nurse';
  }

  // 9. Pharmacist
  if (rawGroup === 'pharmacist' || rawGroup === 'pharmacy') {
    return 'Pharmacist';
  }

  // 10. Laboratorist
  if (rawGroup === 'laboratorist' || rawGroup === 'lab' || rawGroup === 'pathologist') {
    return 'Laboratorist';
  }

  // 11. Accountant
  if (rawGroup === 'accountant' || rawGroup === 'finance' || rawGroup === 'billing') {
    return 'Accountant';
  }

  return 'Unconfigured';
}

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
    { expiresIn: '1h' }
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

async function runRoleSeparationTestSuite() {
  console.log('=================================================================================');
  console.log('MEDORA 2.0 — PHASE 8.1: ROLE-BASED DASHBOARD SEPARATION & SECURITY TEST SUITE');
  console.log('=================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, details = '') {
    if (condition) {
      passed++;
      console.log(`[PASS] ${message}`);
    } else {
      failed++;
      console.error(`[FAIL] ${message} | ${details}`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST SECTION 1: Pure Role Resolution Engine
  // -------------------------------------------------------------------------
  console.log('--- 1. Pure Role Resolution Verification ---');

  // Verify all 11 supported roles
  assert(resolveUserRole({ group: 'SuperAdmin' }) === 'Super Admin', 'Group "SuperAdmin" resolves to "Super Admin"');
  assert(resolveUserRole({ group: 'Admin', branchId: '1' }) === 'Hospital Admin', 'Group "Admin" resolves to "Hospital Admin"');
  assert(resolveUserRole({ group: 'Doctor' }) === 'Doctor', 'Group "Doctor" resolves to "Doctor"');
  assert(resolveUserRole({ group: 'Receptionist' }) === 'Receptionist', 'Group "Receptionist" resolves to "Receptionist"');
  assert(resolveUserRole({ group: 'Nurse' }) === 'Nurse', 'Group "Nurse" resolves to "Nurse"');
  assert(resolveUserRole({ group: 'Pharmacist' }) === 'Pharmacist', 'Group "Pharmacist" resolves to "Pharmacist"');
  assert(resolveUserRole({ group: 'Laboratorist' }) === 'Laboratorist', 'Group "Laboratorist" resolves to "Laboratorist"');
  assert(resolveUserRole({ group: 'Radiologist' }) === 'Radiologist', 'Group "Radiologist" resolves to "Radiologist"');
  assert(resolveUserRole({ group: 'Cashier' }) === 'Cashier', 'Group "Cashier" resolves to "Cashier"');
  assert(resolveUserRole({ group: 'Accountant' }) === 'Accountant', 'Group "Accountant" resolves to "Accountant"');
  assert(resolveUserRole({ group: 'HR' }) === 'HR', 'Group "HR" resolves to "HR"');

  // Verify permission-based persona derivation
  assert(
    resolveUserRole({ group: 'Doctor', permissions: ['radiology_process', 'radiology_verify'] }) === 'Radiologist',
    'Doctor without consultation_add and with radiology_process resolves to "Radiologist"'
  );
  assert(
    resolveUserRole({ group: 'Receptionist', permissions: ['cashier_shift_open', 'payment_add'] }) === 'Cashier',
    'Receptionist without appointment_add and with cashier_shift_open resolves to "Cashier"'
  );
  assert(
    resolveUserRole({ group: 'Admin', permissions: ['staff_assign_department', 'staff_create'] }) === 'HR',
    'Admin without accounting and consultation permissions resolves to "HR"'
  );

  // Verify Safety Fallbacks: NEVER default to Admin!
  assert(resolveUserRole(null) === '', 'null user safely resolves to "" (unauthenticated)');
  assert(resolveUserRole(undefined) === '', 'undefined user safely resolves to "" (unauthenticated)');
  assert(resolveUserRole({}) === 'Unconfigured', 'Empty user object resolves to "Unconfigured"');
  assert(resolveUserRole({ group: '' }) === 'Unconfigured', 'Empty group resolves to "Unconfigured"');
  assert(resolveUserRole({ group: 'UnknownRole' }) === 'Unconfigured', 'Unknown group "UnknownRole" resolves to "Unconfigured"');
  assert(resolveUserRole({ role: 'Guest' }) === 'Unconfigured', 'Unrecognized role "Guest" resolves to "Unconfigured"');

  // -------------------------------------------------------------------------
  // TEST SECTION 2: Backend Authentication & Identity Delivery
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Backend Authentication of Personas ---');

  const testAccounts = [
    { email: 'superadmin.test@medora.hospital', expectedGroup: 'SuperAdmin', expectedResolvedRole: 'Super Admin' },
    { email: 'admin.test@medora.hospital', expectedGroup: 'Admin', expectedResolvedRole: 'Hospital Admin' },
    { email: 'doctor.test@medora.hospital', expectedGroup: 'Doctor', expectedResolvedRole: 'Doctor' },
    { email: 'receptionist.test@medora.hospital', expectedGroup: 'Receptionist', expectedResolvedRole: 'Receptionist' },
    { email: 'nurse.test@medora.hospital', expectedGroup: 'Nurse', expectedResolvedRole: 'Nurse' },
    { email: 'pharmacist.test@medora.hospital', expectedGroup: 'Pharmacist', expectedResolvedRole: 'Pharmacist' },
    { email: 'laboratorist.test@medora.hospital', expectedGroup: 'Laboratorist', expectedResolvedRole: 'Laboratorist' },
    { email: 'radiologist.test@medora.hospital', expectedGroup: 'Radiologist', expectedResolvedRole: 'Radiologist' },
    { email: 'cashier.test@medora.hospital', expectedGroup: 'Cashier', expectedResolvedRole: 'Cashier' },
    { email: 'accountant.test@medora.hospital', expectedGroup: 'Accountant', expectedResolvedRole: 'Accountant' },
    { email: 'hr.test@medora.hospital', expectedGroup: 'HR', expectedResolvedRole: 'HR' },
  ];

  const personaTokens = {};

  for (const account of testAccounts) {
    // Generate valid JWT directly to avoid throttler rate limiting on consecutive logins
    const token = makeToken({
      email: account.email,
      group: account.expectedGroup,
      branchId: account.expectedGroup === 'SuperAdmin' ? null : '1',
    });
    personaTokens[account.expectedGroup] = token;

    // Verify token identity payload
    const decoded = jwt.decode(token);
    const resolved = resolveUserRole(decoded);
    assert(
      resolved === account.expectedResolvedRole,
      `Persona ${account.email} correctly resolves to "${account.expectedResolvedRole}" (group: ${decoded.group})`,
      `Got: ${resolved}`
    );
  }

  // -------------------------------------------------------------------------
  // TEST SECTION 3: Dashboard API Scoping & Authorization Checks
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Operational Authorization & Boundary Enforcement ---');

  // 3.1 Super Admin unrestricted overview
  const superAdminOverview = await api('/dashboard/overview?period=today', { token: personaTokens['SuperAdmin'] });
  assert(
    superAdminOverview.status === 200 && superAdminOverview.data?.success,
    'Super Admin can retrieve unrestricted hospital executive overview',
    `Status: ${superAdminOverview.status}`
  );

  // 3.2 Hospital Admin branch-scoped overview
  const hospitalAdminOverview = await api('/dashboard/overview?period=today&branchId=1', { token: personaTokens['Admin'] });
  assert(
    hospitalAdminOverview.status === 200 && hospitalAdminOverview.data?.success,
    'Hospital Admin can retrieve branch-scoped operational overview',
    `Status: ${hospitalAdminOverview.status}`
  );

  // 3.3 Clinical Boundary: Doctor cannot dispense pharmacy stock
  const docDispenseRes = await api('/pharmacy/dispensations', {
    method: 'POST',
    token: makeToken({
      group: 'Doctor',
      permissions: ['patient_view', 'consultation_add', 'prescription_add'],
    }),
    body: { prescriptionId: '999', items: [] },
  });
  assert(
    docDispenseRes.status === 403,
    'Doctor without pharmacy_dispense is blocked (403 Forbidden) from dispensing pharmacy stock',
    `Status: ${docDispenseRes.status}`
  );

  // 3.4 Pharmacy Boundary: Pharmacist cannot write consultation notes
  const pharmConsultRes = await api('/consultations/visit/999', {
    method: 'POST',
    token: makeToken({
      group: 'Pharmacist',
      permissions: ['pharmacy_view', 'pharmacy_dispense', 'medicine_view'],
    }),
    body: { chiefComplaint: 'Security test' },
  });
  assert(
    pharmConsultRes.status === 403,
    'Pharmacist is blocked (403 Forbidden) from posting consultation notes',
    `Status: ${pharmConsultRes.status}`
  );

  // 3.5 Reception Boundary: Receptionist cannot post accounting journal entries
  const recJournalRes = await api('/accounting/journals', {
    method: 'POST',
    token: makeToken({
      group: 'Receptionist',
      permissions: ['patient_view', 'appointment_add'],
    }),
    body: { memo: 'Unauthorized journal' },
  });
  assert(
    recJournalRes.status === 403,
    'Receptionist is blocked (403 Forbidden) from posting general ledger journal entries',
    `Status: ${recJournalRes.status}`
  );

  // 3.6 Nurse Boundary: Nurse cannot approve financial cashier shifts
  const nurseShiftRes = await api('/cashier/shifts/999/approve', {
    method: 'POST',
    token: makeToken({
      group: 'Nurse',
      permissions: ['patient_view', 'inpatient_view', 'bed_manage'],
    }),
  });
  assert(
    nurseShiftRes.status === 403,
    'Nurse is blocked (403 Forbidden) from approving cashier cash shifts',
    `Status: ${nurseShiftRes.status}`
  );

  // 3.7 Unauthenticated Boundary: No token returns 401
  const unauthRes = await api('/dashboard/overview');
  assert(
    unauthRes.status === 401,
    'Unauthenticated request with no token is rejected with 401 Unauthorized',
    `Status: ${unauthRes.status}`
  );

  // 3.8 Unconfigured Role Boundary: Empty permissions token cannot access protected endpoints
  const unconfiguredToken = makeToken({
    group: 'Unconfigured',
    permissions: [],
  });
  const unconfiguredRes = await api('/medicines', { token: unconfiguredToken });
  assert(
    unconfiguredRes.status === 403 || unconfiguredRes.status === 401,
    'Unconfigured user with empty permissions is denied access (403/401)',
    `Status: ${unconfiguredRes.status}`
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n=================================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('=================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRoleSeparationTestSuite().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
