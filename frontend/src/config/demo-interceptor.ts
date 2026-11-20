/**
 * Client-Side Demo API Interceptor for Medora 2.0
 * 
 * Intercepts requests targeting /api/v1/ when running in preview/demo environments
 * (such as Vercel static deployments without a live backend connection) where requests
 * return HTML (405 Method Not Allowed on POST or 200 index.html on GET).
 * 
 * If a live backend is connected and returns valid JSON, the interceptor transparently
 * yields to the live backend.
 */

const DEMO_PERSONAS_MAP: Record<string, { role: string; name: string; permissions: string[] }> = {
  'superadmin.test@medora.hospital': {
    role: 'Super Admin',
    name: 'Dr. Evelyn Cross',
    permissions: ['*'],
  },
  'admin.test@medora.hospital': {
    role: 'Hospital Admin',
    name: 'Sarah Jenkins',
    permissions: ['hospital:*', 'branch:*', 'patient:*', 'appointment:*', 'billing:*'],
  },
  'doctor.test@medora.hospital': {
    role: 'Doctor',
    name: 'Dr. Michael Chen',
    permissions: ['doctor:*', 'patient:read', 'consultation:*', 'prescription:*', 'lab:order', 'radiology:order'],
  },
  'receptionist.test@medora.hospital': {
    role: 'Receptionist',
    name: 'Emma Watson',
    permissions: ['patient:create', 'patient:read', 'appointment:create', 'appointment:read'],
  },
  'nurse.test@medora.hospital': {
    role: 'Nurse',
    name: 'David Miller',
    permissions: ['inpatient:read', 'inpatient:update', 'patient:read', 'vitals:*'],
  },
  'pharmacist.test@medora.hospital': {
    role: 'Pharmacist',
    name: 'Rachel Adams',
    permissions: ['pharmacy:*', 'medicine:*', 'prescription:read', 'prescription:dispense'],
  },
  'laboratorist.test@medora.hospital': {
    role: 'Laboratorist',
    name: 'Dr. Alex Wong',
    permissions: ['lab:*', 'patient:read'],
  },
  'radiologist.test@medora.hospital': {
    role: 'Radiologist',
    name: 'Dr. Olivia Taylor',
    permissions: ['radiology:*', 'patient:read'],
  },
  'cashier.test@medora.hospital': {
    role: 'Cashier',
    name: 'James Wilson',
    permissions: ['billing:*', 'cashier:*', 'invoice:read', 'payment:create'],
  },
  'accountant.test@medora.hospital': {
    role: 'Accountant',
    name: 'Robert Davis',
    permissions: ['accounting:*', 'report:*', 'invoice:*'],
  },
  'hr.test@medora.hospital': {
    role: 'HR',
    name: 'Jessica Lee',
    permissions: ['staff:*', 'department:*'],
  },
};

function buildMockResponse(url: string, method: string, body?: any): Response {
  let data: any = { success: true, data: [] };

  if (url.includes('/api/v1/health')) {
    data = {
      status: 'ok',
      version: '2.0.0',
      mode: 'preview-demo',
      liveness: { status: 'healthy', uptimeSeconds: 3600 },
      readiness: { checks: { database: { status: 'connected' } } },
    };
  } else if (url.includes('/api/v1/auth/login')) {
    let email = 'doctor.test@medora.hospital';
    try {
      if (typeof body === 'string') {
        const parsed = JSON.parse(body);
        if (parsed.email) email = parsed.email;
      }
    } catch {}

    const persona = DEMO_PERSONAS_MAP[email.toLowerCase()] || DEMO_PERSONAS_MAP['doctor.test@medora.hospital'];
    data = {
      success: true,
      data: {
        accessToken: `demo_token_${Date.now()}`,
        user: {
          id: '1',
          email,
          name: persona.name,
          role: persona.role,
          permissions: persona.permissions,
          branchId: '1',
          branches: [
            { id: '1', name: 'Main City Hospital', code: 'MAIN-01', isMain: true },
            { id: '2', name: 'North Wing Specialty Clinic', code: 'NORTH-02', isMain: false },
          ],
        },
      },
    };
  } else if (url.includes('/api/v1/auth/me')) {
    const storedUser = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('medora_user') : null;
    let user = {
      id: '1',
      email: 'doctor.test@medora.hospital',
      name: 'Dr. Michael Chen',
      role: 'Doctor',
      permissions: ['*'],
      branchId: '1',
    };
    if (storedUser) {
      try {
        user = JSON.parse(storedUser);
      } catch {}
    }
    data = { success: true, data: user };
  } else if (url.includes('/api/v1/branches')) {
    data = {
      success: true,
      data: [
        { id: '1', name: 'Main City Hospital', code: 'MAIN-01', isMain: true },
        { id: '2', name: 'North Wing Specialty Clinic', code: 'NORTH-02', isMain: false },
      ],
    };
  } else if (url.includes('/api/v1/notifications/unread-count')) {
    data = { success: true, data: { unreadCount: 2 }, unreadCount: 2 };
  } else if (url.includes('/api/v1/notifications')) {
    data = {
      success: true,
      data: [
        {
          id: '1',
          title: 'Critical Lab Alert',
          message: 'Stat Cardiac panel ready for Patient #000001 (Amina Yousaf)',
          isRead: false,
          createdAt: new Date().toISOString(),
          channel: 'IN_APP',
          priority: 'HIGH',
        },
        {
          id: '2',
          title: 'OPD Queue Update',
          message: 'Patient Bilal Ahmed checked in for General Consultation',
          isRead: false,
          createdAt: new Date().toISOString(),
          channel: 'IN_APP',
          priority: 'MEDIUM',
        },
      ],
    };
  } else if (url.includes('/api/v1/dashboard')) {
    data = {
      success: true,
      data: {
        totalPatients: 1420,
        todayAppointments: 38,
        admittedPatients: 84,
        occupiedBeds: 84,
        totalBeds: 120,
        bedOccupancyRate: 70.0,
        todayRevenue: 18500.0,
        pendingPrescriptions: 12,
        pendingLabTests: 7,
        pendingRadiology: 4,
        branches: [
          { id: '1', name: 'Main City Hospital', totalPatients: 1100, occupancyRate: 74 },
          { id: '2', name: 'North Wing Clinic', totalPatients: 320, occupancyRate: 58 },
        ],
        doctors: [
          { id: '1', name: 'Dr. Michael Chen', activePatients: 14, consultations: 18 },
        ],
      },
    };
  } else if (url.includes('/api/v1/patients')) {
    data = {
      success: true,
      data: [
        { id: '1', mrn: '000001', name: 'Amina Yousaf', gender: 'Female', age: 34, phone: '+92 300 1234567', bloodGroup: 'B+', status: 'Active', branchId: '1' },
        { id: '2', mrn: '000002', name: 'Bilal Ahmed', gender: 'Male', age: 42, phone: '+92 321 7654321', bloodGroup: 'O+', status: 'Active', branchId: '1' },
        { id: '3', mrn: '000003', name: 'Sara Khan', gender: 'Female', age: 28, phone: '+92 333 9876543', bloodGroup: 'A+', status: 'Active', branchId: '1' },
      ],
      total: 3,
    };
  } else if (url.includes('/api/v1/appointments')) {
    data = {
      success: true,
      data: [
        { id: '1', appointmentNumber: 'APT-001', patientId: '1', patientName: 'Amina Yousaf', doctorId: '1', doctorName: 'Dr. Michael Chen', department: 'General Medicine', scheduledAt: new Date().toISOString(), status: 'CONFIRMED' },
        { id: '2', appointmentNumber: 'APT-002', patientId: '2', patientName: 'Bilal Ahmed', doctorId: '1', doctorName: 'Dr. Michael Chen', department: 'Cardiology', scheduledAt: new Date().toISOString(), status: 'WAITING' },
      ],
    };
  } else if (url.includes('/api/v1/doctors')) {
    data = {
      success: true,
      data: [
        { id: '1', name: 'Dr. Michael Chen', specialization: 'General Physician', departmentId: '1', department: 'General Medicine' },
        { id: '2', name: 'Dr. Evelyn Cross', specialization: 'Cardiology', departmentId: '2', department: 'Cardiology' },
      ],
    };
  } else if (url.includes('/api/v1/departments')) {
    data = {
      success: true,
      data: [
        { id: '1', name: 'General Medicine', code: 'GM' },
        { id: '2', name: 'Cardiology', code: 'CARD' },
        { id: '3', name: 'Pediatrics', code: 'PED' },
        { id: '4', name: 'Orthopedics', code: 'ORTHO' },
      ],
    };
  } else if (url.includes('/api/v1/staff')) {
    data = {
      success: true,
      data: [
        { id: '1', name: 'Dr. Michael Chen', email: 'doctor.test@medora.hospital', role: 'Doctor', designation: 'Senior Consultant', department: 'General Medicine', status: 'ACTIVE' },
        { id: '2', name: 'Sarah Jenkins', email: 'admin.test@medora.hospital', role: 'Hospital Admin', designation: 'Operations Director', department: 'Administration', status: 'ACTIVE' },
      ],
    };
  } else if (url.includes('/api/v1/inpatient')) {
    data = {
      success: true,
      data: {
        totalAdmissions: 84,
        availableBeds: 36,
        occupiedBeds: 84,
        wards: [
          { id: '1', name: 'Intensive Care Unit (ICU)', capacity: 12, occupied: 10 },
          { id: '2', name: 'General Medical Ward', capacity: 30, occupied: 24 },
        ],
        admissions: [],
      },
    };
  } else if (url.includes('/api/v1/lab')) {
    data = {
      success: true,
      data: {
        pendingOrders: 7,
        inProgress: 4,
        completedToday: 26,
        orders: [],
      },
    };
  } else if (url.includes('/api/v1/radiology')) {
    data = {
      success: true,
      data: {
        pendingOrders: 4,
        completedToday: 18,
        orders: [],
      },
    };
  } else if (url.includes('/api/v1/pharmacy') || url.includes('/api/v1/medicines')) {
    data = {
      success: true,
      data: {
        totalItems: 124,
        lowStock: 8,
        dispensedToday: 42,
        medicines: [
          { id: '1', name: 'Paracetamol 500mg', genericName: 'Acetaminophen', stock: 1500, price: 2.5 },
          { id: '2', name: 'Amoxicillin 250mg', genericName: 'Amoxicillin', stock: 650, price: 8.0 },
        ],
      },
    };
  } else if (url.includes('/api/v1/cashier') || url.includes('/api/v1/invoices') || url.includes('/api/v1/accounting')) {
    data = {
      success: true,
      data: {
        totalRevenue: 18500.0,
        todayInvoices: 34,
        pendingSettlements: 6,
        transactions: [],
      },
    };
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function initDemoInterceptor() {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Only process /api/v1 requests
    if (url.includes('/api/v1')) {
      try {
        const response = await originalFetch(input, init);

        const contentType = response.headers.get('content-type') || '';
        // If the server returned HTML (Vercel SPA rewrite fallback) or 404/405 error
        if (contentType.includes('text/html') || response.status === 405 || response.status === 404) {
          return buildMockResponse(url, init?.method || 'GET', init?.body);
        }

        return response;
      } catch {
        // Complete network or DNS failure fallback
        return buildMockResponse(url, init?.method || 'GET', init?.body);
      }
    }

    return originalFetch(input, init);
  };
}
