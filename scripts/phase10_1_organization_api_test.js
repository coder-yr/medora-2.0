/**
 * Phase 10.1 Organization & Tenant Foundation Live API Verification Script
 */
const http = require('http');

const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('========================================================================');
  console.log('MEDORA 2.0 — PHASE 10.1: ORGANIZATION & TENANT API VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;
  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Authenticate as SuperAdmin
  const loginRes = await request('POST', '/auth/login', {
    email: 'superadmin.test@medora.hospital',
    password: 'ValidPassword123!',
  });
  const loginData = loginRes.body?.data || loginRes.body;
  assert(loginRes.status === 200 && loginData?.accessToken, 'SuperAdmin login successful');
  const token = loginData?.accessToken;
  const user = loginData?.user;
  assert(user?.organizationId === '1', `User profile contains organizationId = 1 (actual: ${user?.organizationId})`);

  // 2. Fetch /organizations
  const orgsRes = await request('GET', '/organizations', null, token);
  const orgs = orgsRes.body?.data || orgsRes.body;
  assert(orgsRes.status === 200 && Array.isArray(orgs), 'GET /organizations returned array');
  const defaultOrg = orgs?.find((o) => o.code === 'MEDORA-HOSP-01');
  assert(defaultOrg !== undefined, 'Default organization MEDORA-HOSP-01 found in list');
  assert(defaultOrg?.type === 'HOSPITAL', `Default organization type is HOSPITAL (actual: ${defaultOrg?.type})`);
  assert(defaultOrg?.status === 'ACTIVE', `Default organization status is ACTIVE (actual: ${defaultOrg?.status})`);

  // 3. Fetch /organizations/:id
  const org1Res = await request('GET', `/organizations/${defaultOrg.id}`, null, token);
  const org1 = org1Res.body?.data || org1Res.body;
  assert(org1Res.status === 200, 'GET /organizations/:id returned 200');
  assert(org1?.name === 'Medora Healthcare System', `Org name is 'Medora Healthcare System' (actual: ${org1?.name})`);

  // 4. Fetch /organizations/:id/settings
  const settingsRes = await request('GET', `/organizations/${defaultOrg.id}/settings`, null, token);
  const settings = settingsRes.body?.data || settingsRes.body;
  assert(settingsRes.status === 200, 'GET /organizations/:id/settings returned 200');
  assert(settings?.defaultCurrency === 'PKR', `Default currency is PKR (actual: ${settings?.defaultCurrency})`);

  // 5. Fetch /organizations/:id/branches
  const branchesRes = await request('GET', `/organizations/${defaultOrg.id}/branches`, null, token);
  const branches = branchesRes.body?.data || branchesRes.body;
  assert(branchesRes.status === 200 && Array.isArray(branches), 'GET /organizations/:id/branches returned array');
  assert(branches?.length >= 2, `Org has >= 2 backfilled branches (actual: ${branches?.length})`);
  const mainBranch = branches?.find((b) => b.code === 'MAIN');
  assert(mainBranch !== undefined, 'MAIN branch associated with organization #1');

  // 6. Fetch /organizations/:id/members
  const membersRes = await request('GET', `/organizations/${defaultOrg.id}/members`, null, token);
  const members = membersRes.body?.data || membersRes.body;
  assert(membersRes.status === 200 && Array.isArray(members), 'GET /organizations/:id/members returned array');
  assert(members?.length >= 10, `Org has >= 10 backfilled members (actual: ${members?.length})`);

  // 7. Fetch /organizations/my-organizations
  const myOrgsRes = await request('GET', '/organizations/my-organizations', null, token);
  const myOrgs = myOrgsRes.body?.data || myOrgsRes.body;
  assert(myOrgsRes.status === 200 && Array.isArray(myOrgs), 'GET /organizations/my-organizations returned array');
  assert(myOrgs?.length >= 1, `User belongs to >= 1 organization (actual: ${myOrgs?.length})`);

  // 8. Create a new Organization (e.g. CLINIC)
  const newOrgCode = `CLN-TEST-${Date.now().toString().slice(-4)}`;
  const createRes = await request(
    'POST',
    '/organizations',
    {
      name: 'Al-Shifa Community Clinic',
      code: newOrgCode,
      type: 'CLINIC',
      status: 'ACTIVE',
      legalName: 'Al-Shifa Health Services Ltd.',
      defaultCurrency: 'PKR',
    },
    token
  );
  const created = createRes.body?.data || createRes.body;
  assert(createRes.status === 201, `POST /organizations created CLINIC successfully (status: ${createRes.status})`);
  assert(created?.code === newOrgCode, `Created clinic has correct code ${newOrgCode}`);
  assert(created?.type === 'CLINIC', `Created clinic has type CLINIC`);

  // 9. Unauthorized / unauthenticated check
  const unauthRes = await request('GET', '/organizations');
  assert(unauthRes.status === 401, 'Unauthenticated request to /organizations returns 401');

  // 10. Role-based guard check (Doctor cannot create organizations)
  const docLogin = await request('POST', '/auth/login', {
    email: 'doctor.test@medora.hospital',
    password: 'ValidPassword123!',
  });
  const docData = docLogin.body?.data || docLogin.body;
  const docToken = docData?.accessToken;
  const docCreateRes = await request(
    'POST',
    '/organizations',
    {
      name: 'Unauthorized Clinic',
      code: 'UNAUTH-01',
      type: 'CLINIC',
    },
    docToken
  );
  assert(docCreateRes.status === 403, `Doctor role blocked from creating organizations (403 Forbidden, actual: ${docCreateRes.status})`);

  console.log('\n========================================================================');
  console.log(`PHASE 10.1 API VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
