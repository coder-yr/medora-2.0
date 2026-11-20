/**
 * Medora 2.0 — Phase 8.2 Role-Specific Workspace Dashboard Screenshot Capture
 * Direct Chrome DevTools Protocol (CDP) via native Node.js WebSocket & Signed Tokens
 */
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const jwt = require(path.join(__dirname, '../backend/node_modules/jsonwebtoken'));

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const ARTIFACT_DIR = path.resolve('C:/Users/Acer/.gemini/antigravity/brain/fee9c3f7-74ea-42d0-a86c-d6648836c1eb/screenshots');
const USER_DATA_DIR = path.resolve(process.env.TEMP, 'chrome_cdp_screens');

const envPath = path.join(__dirname, '../backend/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const secretLine = envContent.split('\n').find((l) => l.trim().startsWith('JWT_SECRET='));
const JWT_SECRET = secretLine
  ? secretLine.split('=')[1].trim().replace(/^["']|["']$/g, '')
  : (process.env.JWT_SECRET || 'local-dev-secret');

function makePersonaToken(user) {
  return jwt.sign(
    {
      sub: user.id || '1',
      userId: user.id || '1',
      email: user.email,
      name: user.name,
      group: user.group,
      branchId: user.branchId || '1',
      permissions: user.permissions,
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

const PERSONAS = [
  {
    role: 'Super Admin',
    group: 'SuperAdmin',
    name: 'Global Administrator',
    email: 'superadmin.test@medora.hospital',
    branchId: '1',
    permissions: ['*'],
    filename: '01_super_admin_dashboard.png',
  },
  {
    role: 'Hospital Admin',
    group: 'Admin',
    name: 'Hospital Administrator',
    email: 'admin.test@medora.hospital',
    branchId: '1',
    permissions: [
      'patient_view', 'patient_add', 'appointment_view', 'staff_view',
      'department_view', 'bed_manage', 'pharmacy_view', 'lab_view',
      'billing_view', 'dashboard_view', 'branch_settings_view'
    ],
    filename: '02_hospital_admin_dashboard.png',
  },
  {
    role: 'Doctor',
    group: 'Doctor',
    name: 'Dr. Tariq Khan',
    email: 'doctor.test@medora.hospital',
    branchId: '1',
    permissions: [
      'patient_view', 'appointment_view', 'consultation_view', 'consultation_add',
      'consultation_edit', 'prescription_view', 'prescription_add', 'prescription_edit',
      'lab_order', 'lab_view', 'radiology_order', 'radiology_view', 'inpatient_view', 'dashboard_view'
    ],
    filename: '03_doctor_dashboard.png',
  },
  {
    role: 'Receptionist',
    group: 'Receptionist',
    name: 'Sarah Jenkins',
    email: 'receptionist.test@medora.hospital',
    branchId: '1',
    permissions: [
      'patient_view', 'patient_add', 'patient_edit', 'appointment_view',
      'appointment_add', 'appointment_edit', 'appointment_cancel', 'appointment_update',
      'inpatient_admit', 'inpatient_view', 'cashier_view', 'dashboard_view'
    ],
    filename: '04_receptionist_dashboard.png',
  },
  {
    role: 'Nurse',
    group: 'Nurse',
    name: 'Nurse Ayesha',
    email: 'nurse.test@medora.hospital',
    branchId: '1',
    permissions: [
      'patient_view', 'inpatient_view', 'bed_manage', 'inpatient_bed_manage',
      'admission_view', 'inpatient_discharge', 'dashboard_view'
    ],
    filename: '05_nurse_dashboard.png',
  },
  {
    role: 'Pharmacist',
    group: 'Pharmacist',
    name: 'Zainab Ahmed',
    email: 'pharmacist.test@medora.hospital',
    branchId: '1',
    permissions: [
      'pharmacy_view', 'pharmacy_dispense', 'pharmacy_inventory_view',
      'pharmacy_inventory_manage', 'prescription_view', 'medicine_view', 'medicine_add', 'dashboard_view'
    ],
    filename: '06_pharmacist_dashboard.png',
  },
  {
    role: 'Laboratorist',
    group: 'Laboratorist',
    name: 'Bilal Farooq',
    email: 'laboratorist.test@medora.hospital',
    branchId: '1',
    permissions: [
      'lab_view', 'lab_order', 'lab_result_enter', 'lab_verify',
      'lab_approve', 'patient_view', 'dashboard_view'
    ],
    filename: '07_laboratorist_dashboard.png',
  },
  {
    role: 'Radiologist',
    group: 'Doctor',
    name: 'Dr. Usman Ghani',
    email: 'radiologist.test@medora.hospital',
    branchId: '1',
    permissions: [
      'radiology_view', 'radiology_schedule', 'radiology_process',
      'radiology_result_enter', 'radiology_verify', 'radiology_approve', 'patient_view', 'dashboard_view'
    ],
    filename: '08_radiologist_dashboard.png',
  },
  {
    role: 'Cashier',
    group: 'Receptionist',
    name: 'Usman Ali',
    email: 'cashier.test@medora.hospital',
    branchId: '1',
    permissions: [
      'cashier_view', 'cashier_shift_open', 'cashier_shift_close',
      'payment_add', 'cashier_daybook_view', 'invoice_view', 'invoice_add', 'dashboard_view'
    ],
    filename: '09_cashier_dashboard.png',
  },
  {
    role: 'Accountant',
    group: 'Accountant',
    name: 'Kamran Siddiqui',
    email: 'accountant.test@medora.hospital',
    branchId: '1',
    permissions: [
      'accounting_view', 'accounting_manage_accounts', 'accounting_journal_view',
      'accounting_journal_create', 'accounting_journal_post', 'accounting_journal_reverse',
      'accounting_expense_view', 'accounting_reports_view', 'cashier_daybook_view',
      'cashier_shift_approve', 'invoice_view', 'dashboard_view'
    ],
    filename: '10_accountant_dashboard.png',
  },
  {
    role: 'HR',
    group: 'Admin',
    name: 'Mariam Baig',
    email: 'hr.test@medora.hospital',
    branchId: '1',
    permissions: [
      'staff_view', 'staff_create', 'staff_update', 'staff_assign_department',
      'staff_change_designation', 'staff_link_user', 'staff_deactivate', 'dashboard_view'
    ],
    filename: '11_hr_dashboard.png',
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.callbacks = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  console.log(`Starting Chrome CDP capturing process...`);
  const chromeProc = cp.spawn(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-sandbox',
      '--disable-gpu',
      '--window-size=1440,900',
      'about:blank',
    ]
  );

  let cdp = null;
  try {
    await sleep(2000);
    const newPageRes = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' });
    const pageData = await newPageRes.json();
    const targetWsUrl = pageData.webSocketDebuggerUrl;

    cdp = new CDPClient(targetWsUrl);
    await cdp.connect();
    console.log(`CDP WebSocket connected.`);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    for (const persona of PERSONAS) {
      console.log(`\n--- Capturing ${persona.role} (${persona.name}) ---`);
      const token = makePersonaToken(persona);
      const userObj = {
        id: persona.id || '1',
        email: persona.email,
        name: persona.name,
        role: persona.role,
        group: persona.group,
        branchId: persona.branchId || '1',
        permissions: persona.permissions,
      };

      // Navigate to /login to set storage
      await cdp.send('Page.navigate', { url: `${FRONTEND_URL}/login` });
      await sleep(1000);

      // Inject auth session and navigate to /dashboard
      const script = `
        sessionStorage.setItem('medora_access_token', ${JSON.stringify(token)});
        sessionStorage.setItem('medora_user', ${JSON.stringify(JSON.stringify(userObj))});
        localStorage.setItem('medora_active_branch', '1');
        window.location.href = '/dashboard';
      `;
      await cdp.send('Runtime.evaluate', { expression: script });

      // Wait for dashboard and role-specific navigation to settle
      await sleep(2500);

      // Capture dashboard screenshot
      const screenResult = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(ARTIFACT_DIR, persona.filename);
      fs.writeFileSync(filePath, Buffer.from(screenResult.data, 'base64'));
      console.log(`[SAVED] ${persona.role} -> ${filePath} (${fs.statSync(filePath).size} bytes)`);

      // If Doctor or Super Admin, also capture Quick Actions dropdown
      if (persona.role === 'Doctor' || persona.role === 'Super Admin') {
        const toggleDropdownScript = `
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Add New'));
          if (btn) btn.click();
        `;
        await cdp.send('Runtime.evaluate', { expression: toggleDropdownScript });
        await sleep(500);

        const dropdownFilename = persona.role === 'Doctor' ? '03b_doctor_quick_actions.png' : '01b_super_admin_quick_actions.png';
        const dropdownResult = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const dropdownPath = path.join(ARTIFACT_DIR, dropdownFilename);
        fs.writeFileSync(dropdownPath, Buffer.from(dropdownResult.data, 'base64'));
        console.log(`[SAVED QUICK ACTIONS] ${persona.role} -> ${dropdownPath} (${fs.statSync(dropdownPath).size} bytes)`);
      }

      // Clear storage
      await cdp.send('Runtime.evaluate', { expression: `sessionStorage.clear(); localStorage.clear();` });
    }

    console.log(`\nAll 11 role screenshots successfully captured and saved to ${ARTIFACT_DIR}!`);
  } catch (err) {
    console.error('Capture error:', err);
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill();
  }
}

main();
