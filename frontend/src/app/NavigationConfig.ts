import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarCheck,
  Stethoscope,
  Pill,
  CreditCard,
  Boxes,
  Microscope,
  Radio,
  BedDouble,
  IndianRupee,
  IndianRupee as DollarSign,
  Building2,
  UserCheck,
  FileText,
  Bell,
  Shield,
  Activity,
  FileSpreadsheet,
  Settings,
  Sliders,
  UserPlus,
  FolderTree,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// Legacy Categorization (Preserved for Backward Compatibility)
// ============================================================================
export type NavigationCategory =
  | 'Clinical Operations'
  | 'Diagnostics & Pharmacy'
  | 'Inpatient & Billing'
  | 'Hospital Administration';

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  category: NavigationCategory;
  requiredPermissions: string[];
  requiredAnyPermissions?: string[];
  order: number;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  // Clinical Operations
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    category: 'Clinical Operations',
    requiredPermissions: ['dashboard_view'],
    order: 1,
  },
  {
    id: 'patients',
    label: 'Patient Central Registry',
    path: '/patients',
    icon: Users,
    category: 'Clinical Operations',
    requiredPermissions: ['patient_view'],
    order: 2,
  },
  {
    id: 'appointments',
    label: 'Appointments & Visits',
    path: '/appointments',
    icon: Calendar,
    category: 'Clinical Operations',
    requiredPermissions: ['appointment_view'],
    order: 3,
  },
  {
    id: 'consultations',
    label: 'Doctor Consultation',
    path: '/consultations',
    icon: Stethoscope,
    category: 'Clinical Operations',
    requiredPermissions: ['consultation_view'],
    order: 4,
  },
  {
    id: 'follow-ups',
    label: 'Follow-ups & Alerts',
    path: '/follow-ups',
    icon: CalendarCheck,
    category: 'Clinical Operations',
    requiredPermissions: ['consultation_view'],
    order: 4.5,
  },
  {
    id: 'prescriptions',
    label: 'Prescriptions (Rx)',
    path: '/prescriptions',
    icon: Pill,
    category: 'Clinical Operations',
    requiredPermissions: ['prescription_view'],
    order: 5,
  },

  // Diagnostics & Pharmacy
  {
    id: 'pharmacy',
    label: 'Pharmacy & Inventory',
    path: '/pharmacy',
    icon: Boxes,
    category: 'Diagnostics & Pharmacy',
    requiredPermissions: ['pharmacy_view'],
    order: 6,
  },
  {
    id: 'medicines',
    label: 'Medicine Catalogue',
    path: '/medicines',
    icon: Pill,
    category: 'Diagnostics & Pharmacy',
    requiredPermissions: ['medicine_view'],
    order: 7,
  },
  {
    id: 'laboratory',
    label: 'Laboratory (LIS)',
    path: '/laboratory',
    icon: Microscope,
    category: 'Diagnostics & Pharmacy',
    requiredPermissions: ['lab_view'],
    order: 8,
  },
  {
    id: 'radiology',
    label: 'Radiology & PACS (RIS)',
    path: '/radiology',
    icon: Radio,
    category: 'Diagnostics & Pharmacy',
    requiredPermissions: ['radiology_view'],
    order: 9,
  },

  // Inpatient & Billing
  {
    id: 'inpatient',
    label: 'Inpatient & Beds (IPD)',
    path: '/inpatient',
    icon: BedDouble,
    category: 'Inpatient & Billing',
    requiredPermissions: ['inpatient_view'],
    order: 10,
  },
  {
    id: 'cashier',
    label: 'Cashier & Shifts (POS)',
    path: '/cashier',
    icon: IndianRupee,
    category: 'Inpatient & Billing',
    requiredPermissions: ['cashier_view'],
    order: 11,
  },
  {
    id: 'billing',
    label: 'Invoices & Billing',
    path: '/billing',
    icon: CreditCard,
    category: 'Inpatient & Billing',
    requiredPermissions: ['invoice_view'],
    order: 12,
  },

  // Hospital Administration
  {
    id: 'doctors',
    label: 'Medical Consultants',
    path: '/doctors',
    icon: Stethoscope,
    category: 'Hospital Administration',
    requiredPermissions: ['doctor_view'],
    order: 13,
  },
  {
    id: 'departments',
    label: 'Departments & Specialties',
    path: '/departments',
    icon: Building2,
    category: 'Hospital Administration',
    requiredPermissions: ['department_view'],
    order: 14,
  },
  {
    id: 'staff',
    label: 'Staff & HR Directory',
    path: '/staff',
    icon: UserCheck,
    category: 'Hospital Administration',
    requiredPermissions: ['staff_view'],
    order: 15,
  },
  {
    id: 'accounting',
    label: 'General Accounting & COA',
    path: '/accounting',
    icon: FileText,
    category: 'Hospital Administration',
    requiredPermissions: ['accounting_view'],
    order: 16,
  },
  {
    id: 'settings',
    label: 'Hospital Settings & Branches',
    path: '/settings',
    icon: Building2,
    category: 'Hospital Administration',
    requiredPermissions: ['hospital_settings_view'],
    order: 17,
  },
  {
    id: 'notifications',
    label: 'Notifications & Outbox',
    path: '/notifications',
    icon: Bell,
    category: 'Hospital Administration',
    requiredPermissions: ['notification_view'],
    order: 18,
  },
];

export const NAVIGATION_CATEGORIES: NavigationCategory[] = [
  'Clinical Operations',
  'Diagnostics & Pharmacy',
  'Inpatient & Billing',
  'Hospital Administration',
];

// ============================================================================
// Phase 8.2: Role-Tailored Navigation Hierarchy & Workspace Design
// ============================================================================

export interface RoleNavigationItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  requiredPermissions: string[];
  requiredAnyPermissions?: string[];
}

export interface RoleNavigationSection {
  title: string;
  items: RoleNavigationItem[];
}

export interface RoleQuickAction {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  color?: string;
  requiredPermission?: string;
}

export interface RoleDepartmentMeta {
  badge: string;
  subtext: string;
}

export const ROLE_DEPARTMENT_META: Record<string, RoleDepartmentMeta> = {
  'Super Admin': { badge: 'GLOBAL GOVERNANCE', subtext: 'Hospital Network Federation' },
  'Hospital Admin': { badge: 'FACILITY OPERATIONS', subtext: 'Campus Administrative Core' },
  'Organization Admin': { badge: 'ORGANIZATION ADMIN', subtext: 'Tenant Operations & Staff' },
  'Clinic Admin': { badge: 'CLINICAL FACILITY', subtext: 'Ambulatory Care Administration' },
  'Doctor': { badge: 'CLINICAL SERVICES', subtext: 'Consultant & OPD Workstation' },
  'Receptionist': { badge: 'PATIENT ACCESS', subtext: 'Front Desk & Ambulatory Registration' },
  'Nurse': { badge: 'INPATIENT CARE', subtext: 'Ward Station & Bedside Nursing' },
  'Pharmacist': { badge: 'DISPENSARY', subtext: 'Formulary & Prescription Pharmacy' },
  'Laboratorist': { badge: 'PATHOLOGY LIS', subtext: 'Diagnostic Laboratory Core' },
  'Radiologist': { badge: 'IMAGING RIS', subtext: 'Radiology Modalities & PACS' },
  'Cashier': { badge: 'CASH OFFICE', subtext: 'Patient Settlements & POS Till' },
  'Accountant': { badge: 'FINANCE & GL', subtext: 'General Ledger & Financial Control' },
  'HR': { badge: 'WORKFORCE & HR', subtext: 'Human Resources & Staff Directory' },
};

export const ROLE_NAVIGATION_CONFIG: Record<string, RoleNavigationSection[]> = {
  // --------------------------------------------------------------------------
  // 1. Super Admin
  // --------------------------------------------------------------------------
  'Super Admin': [
    {
      title: 'Global Governance',
      items: [
        {
          id: 'global-dashboard',
          label: 'Global Dashboard',
          path: '/dashboard',
          icon: Shield,
          requiredPermissions: ['dashboard_view'],
        },
        {
          id: 'platform-governance',
          label: 'Platform Organizations',
          path: '/platform',
          icon: Building2,
          requiredPermissions: [],
        },
        {
          id: 'hospital-network',
          label: 'Hospital Network',
          path: '/settings',
          icon: Sliders,
          requiredPermissions: ['hospital_settings_view'],
        },
        {
          id: 'branch-management',
          label: 'Branch Management',
          path: '/settings',
          icon: Sliders,
          requiredPermissions: ['hospital_settings_view'],
        },
      ],
    },
    {
      title: 'Access & System Security',
      items: [
        {
          id: 'user-management',
          label: 'User & Staff Directory',
          path: '/staff',
          icon: UserCheck,
          requiredPermissions: ['staff_view'],
        },
        {
          id: 'system-configuration',
          label: 'System Configuration',
          path: '/settings',
          icon: Settings,
          requiredPermissions: ['hospital_settings_view'],
        },
        {
          id: 'background-jobs',
          label: 'Background Jobs & Outbox',
          path: '/notifications',
          icon: Bell,
          requiredPermissions: ['notification_view'],
        },
      ],
    },
    {
      title: 'Enterprise Intelligence',
      items: [
        {
          id: 'global-reports',
          label: 'Consolidated Financials',
          path: '/accounting',
          icon: FileSpreadsheet,
          requiredPermissions: ['accounting_view'],
        },
      ],
    },
  ],

  // --------------------------------------------------------------------------
  // 2. Hospital Admin
  // --------------------------------------------------------------------------
  'Hospital Admin': [
    {
      title: 'Facility Operations',
      items: [
        {
          id: 'hospital-dashboard',
          label: 'Hospital Dashboard',
          path: '/dashboard',
          icon: LayoutDashboard,
          requiredPermissions: ['dashboard_view'],
        },
        {
          id: 'patients-directory',
          label: 'Patient Central Registry',
          path: '/patients',
          icon: Users,
          requiredPermissions: ['patient_view'],
        },
        {
          id: 'appointments-schedule',
          label: 'Appointments & Schedule',
          path: '/appointments',
          icon: Calendar,
          requiredPermissions: ['appointment_view'],
        },
        {
          id: 'doctors-consultants',
          label: 'Medical Consultants',
          path: '/doctors',
          icon: Stethoscope,
          requiredPermissions: ['doctor_view'],
        },
        {
          id: 'staff-directory',
          label: 'Hospital Staff Directory',
          path: '/staff',
          icon: UserCheck,
          requiredPermissions: ['staff_view'],
        },
        {
          id: 'staff-management',
          label: 'Staff Onboarding & Access',
          path: '/staff-management',
          icon: Users,
          requiredPermissions: ['staff_view'],
        },
        {
          id: 'departments',
          label: 'Clinical Departments',
          path: '/departments',
          icon: FolderTree,
          requiredPermissions: ['department_view'],
        },
      ],
    },
    {
      title: 'Clinical & Ancillary Care',
      items: [
        {
          id: 'wards-beds',
          label: 'Wards & Beds (IPD)',
          path: '/inpatient',
          icon: BedDouble,
          requiredPermissions: ['inpatient_view'],
        },
        {
          id: 'pharmacy-monitoring',
          label: 'Pharmacy Monitoring',
          path: '/pharmacy',
          icon: Boxes,
          requiredPermissions: ['pharmacy_view'],
        },
        {
          id: 'laboratory-monitoring',
          label: 'Laboratory Monitoring',
          path: '/laboratory',
          icon: Microscope,
          requiredPermissions: ['lab_view'],
        },
        {
          id: 'radiology-monitoring',
          label: 'Radiology Monitoring',
          path: '/radiology',
          icon: Radio,
          requiredPermissions: ['radiology_view'],
        },
        {
          id: 'billing-overview',
          label: 'Billing & Invoicing',
          path: '/billing',
          icon: CreditCard,
          requiredPermissions: ['invoice_view'],
        },
      ],
    },
    {
      title: 'Administration & Settings',
      items: [
        {
          id: 'hospital-reports',
          label: 'Financial Statements',
          path: '/accounting',
          icon: FileText,
          requiredPermissions: ['accounting_view'],
        },
        {
          id: 'branch-settings',
          label: 'Branch Settings',
          path: '/settings',
          icon: Settings,
          requiredPermissions: ['hospital_settings_view'],
        },
      ],
    },
  ],

  // --------------------------------------------------------------------------
  // 3. Doctor
  // --------------------------------------------------------------------------
  'Doctor': [
    {
      title: 'Clinical Practice',
      items: [
        {
          id: 'doc-dashboard',
          label: 'My Clinical Dashboard',
          path: '/dashboard',
          icon: Activity,
          requiredPermissions: ['dashboard_view'],
        },
        {
          id: 'doc-appointments',
          label: 'My Patient Schedule',
          path: '/appointments',
          icon: Calendar,
          requiredPermissions: ['appointment_view'],
        },
        {
          id: 'doc-records',
          label: 'Patient Medical Records',
          path: '/patients',
          icon: Users,
          requiredPermissions: ['patient_view'],
        },
        {
          id: 'doc-consultations',
          label: 'Consultation Workbench',
          path: '/consultations',
          icon: Stethoscope,
          requiredPermissions: ['consultation_view'],
        },
        {
          id: 'doc-prescriptions',
          label: 'Electronic Prescriptions (Rx)',
          path: '/prescriptions',
          icon: Pill,
          requiredPermissions: ['prescription_view'],
        },
      ],
    },
    {
      title: 'Diagnostic Workstation',
      items: [
        {
          id: 'doc-lab-orders',
          label: 'Laboratory Requisitions',
          path: '/laboratory',
          icon: Microscope,
          requiredPermissions: ['lab_view'],
        },
        {
          id: 'doc-rad-orders',
          label: 'Radiology Requisitions',
          path: '/radiology',
          icon: Radio,
          requiredPermissions: ['radiology_view'],
        },
      ],
    },
    {
      title: 'Inpatient Care',
      items: [
        {
          id: 'doc-inpatient-rounds',
          label: 'Inpatient Bedside Rounds',
          path: '/inpatient',
          icon: BedDouble,
          requiredPermissions: ['inpatient_view'],
        },
      ],
    },
  ],

  // --------------------------------------------------------------------------
  // 4. Receptionist
  // --------------------------------------------------------------------------
  'Receptionist': [
    {
      title: 'Front Desk Operations',
      items: [
        {
          id: 'rec-dashboard',
          label: 'Reception Dashboard',
          path: '/dashboard',
          icon: LayoutDashboard,
          requiredPermissions: ['dashboard_view'],
        },
        {
          id: 'rec-patients',
          label: 'Patient Registration',
          path: '/patients',
          icon: Users,
          requiredPermissions: ['patient_view'],
        },
        {
          id: 'rec-appointments',
          label: 'Appointment Booking',
          path: '/appointments',
          icon: Calendar,
          requiredPermissions: ['appointment_view'],
        },
        {
          id: 'rec-doctors',
          label: 'Consultant Rosters',
          path: '/doctors',
          icon: Stethoscope,
          requiredPermissions: ['doctor_view'],
        },
      ],
    },
    {
      title: 'Patient Intake & Desk',
      items: [
        {
          id: 'rec-inpatient',
          label: 'Admissions Desk',
          path: '/inpatient',
          icon: BedDouble,
          requiredPermissions: ['inpatient_view'],
        },
        {
          id: 'rec-cashier',
          label: 'Front Desk Cashier Till',
          path: '/cashier',
          icon: IndianRupee,
          requiredPermissions: ['cashier_view'],
        },
      ],
    },
  ],

  // --------------------------------------------------------------------------
  // 5. Nurse
  // --------------------------------------------------------------------------
  'Nurse': [
    {
      title: 'Nursing Operations',
      items: [
        {
          id: 'nurse-dashboard',
          label: 'Nursing Station',
          path: '/dashboard',
          icon: Activity,
          requiredPermissions: ['dashboard_view'],
        },
        {
          id: 'nurse-inpatient',
          label: 'Inpatient Ward Census',
          path: '/inpatient',
          icon: BedDouble,
          requiredPermissions: ['inpatient_view'],
        },
        {
          id: 'nurse-patients',
          label: 'Patient Vitals & Directory',
          path: '/patients',
          icon: Users,
          requiredPermissions: ['patient_view'],
        },
      ],
    },
    {
      title: 'Bedside Care & Orders',
      items: [
        {
          id: 'nurse-consultations',
          label: 'Clinical Progress Notes',
          path: '/consultations',
          icon: Stethoscope,
          requiredPermissions: ['consultation_view'],
        },
        {
          id: 'nurse-prescriptions',
          label: 'Medication Administration',
          path: '/prescriptions',
          icon: Pill,
          requiredPermissions: ['prescription_view'],
        },
      ],
    },
  ],

  // --------------------------------------------------------------------------
  // 6. Pharmacist
  // --------------------------------------------------------------------------
  'Pharmacist': [
    {
      title: 'Dispensary Operations',
      items: [
        {
          id: 'pharm-dashboard',
          label: 'Dispensary Dashboard',
          path: '/dashboard',
          icon: Boxes,
          requiredPermissions: ['dashboard_view'],
        },
        {
          id: 'pharm-prescriptions',
          label: 'Prescription Queue',
          path: '/prescriptions',
          icon: Pill,
          requiredPermissions: ['prescription_view'],
        },
        {
          id: 'pharm-dispense',
          label: 'Drug Dispensing & Stock',
          path: '/pharmacy',
          icon: Boxes,
          requiredPermissions: ['pharmacy_view'],
        },
        {
          id: 'pharm-catalogue',
          label: 'Formulary & Medicine Catalogue',
          path: '/medicines',
          icon: Pill,
          requiredPermissions: ['medicine_view'],
        },
      ],
    },
    {
      title: 'Retail & Settlements',
      items: [
        {
          id: 'pharm-billing',
          label: 'Pharmacy Billing & Invoicing',
          path: '/billing',
          icon: CreditCard,
          requiredPermissions: ['invoice_view'],
        },
      ],
    },
  ],

  // --------------------------------------------------------------------------
  // 7. Laboratorist
  // --------------------------------------------------------------------------
  'Laboratorist': [
    {
      title: 'Laboratory Information System',
      items: [
        {
          id: 'lab-dashboard',
          label: 'LIS Pathology Dashboard',
          path: '/dashboard',
          icon: Microscope,
          requiredPermissions: ['dashboard_view'],
        },
        {
          id: 'lab-worklist',
          label: 'Specimen Worklist & Orders',
          path: '/laboratory',
          icon: Microscope,
          requiredPermissions: ['lab_view'],
        },
        {
          id: 'lab-patients',
          label: 'Patient Laboratory Registry',
          path: '/patients',
          icon: Users,
          requiredPermissions: ['patient_view'],
        },
      ],
    },
  ],

  // --------------------------------------------------------------------------
  // 8. Radiologist
  // --------------------------------------------------------------------------
  'Radiologist': [
    {
      title: 'Radiology Information System',
      items: [
        {
          id: 'rad-dashboard',
          label: 'RIS Imaging Dashboard',
          path: '/dashboard',
          icon: Radio,
          requiredPermissions: ['dashboard_view'],
        },
        {
          id: 'rad-worklist',
          label: 'Modality Studies & PACS Worklist',
          path: '/radiology',
          icon: Radio,
          requiredPermissions: ['radiology_view'],
        },
        {
          id: 'rad-patients',
          label: 'Patient Radiology Records',
          path: '/patients',
          icon: Users,
          requiredPermissions: ['patient_view'],
        },
      ],
    },
  ],

  // --------------------------------------------------------------------------
  // 9. Cashier
  // --------------------------------------------------------------------------
  'Cashier': [
    {
      title: 'Cash Desk & Counter',
      items: [
        {
          id: 'cash-dashboard',
          label: 'Cashier Till Dashboard',
          path: '/dashboard',
          icon: IndianRupee,
          requiredPermissions: ['dashboard_view'],
        },
        {
          id: 'cash-shift',
          label: 'Active Shift & Drawer Till',
          path: '/cashier',
          icon: IndianRupee,
          requiredPermissions: ['cashier_view'],
        },
        {
          id: 'cash-billing',
          label: 'Patient Invoices & Settlements',
          path: '/billing',
          icon: CreditCard,
          requiredPermissions: ['invoice_view'],
        },
        {
          id: 'cash-patients',
          label: 'Patient Directory Lookup',
          path: '/patients',
          icon: Users,
          requiredPermissions: ['patient_view'],
        },
      ],
    },
  ],

  // --------------------------------------------------------------------------
  // 10. Accountant
  // --------------------------------------------------------------------------
  'Accountant': [
    {
      title: 'Financial Accounting & GL',
      items: [
        {
          id: 'acc-dashboard',
          label: 'Financial Cockpit',
          path: '/dashboard',
          icon: FileText,
          requiredPermissions: ['dashboard_view'],
        },
        {
          id: 'acc-gl',
          label: 'General Ledger & Journals',
          path: '/accounting',
          icon: FileText,
          requiredPermissions: ['accounting_view'],
        },
        {
          id: 'acc-billing',
          label: 'Accounts Receivable & Invoices',
          path: '/billing',
          icon: CreditCard,
          requiredPermissions: ['invoice_view'],
        },
        {
          id: 'acc-cashier',
          label: 'Cashier Shift Supervisor Sign-off',
          path: '/cashier',
          icon: IndianRupee,
          requiredPermissions: ['cashier_view'],
        },
      ],
    },
  ],

  // --------------------------------------------------------------------------
  // 11. HR
  // --------------------------------------------------------------------------
  'HR': [
    {
      title: 'Workforce Administration',
      items: [
        {
          id: 'hr-dashboard',
          label: 'HR Operations Dashboard',
          path: '/dashboard',
          icon: UserCheck,
          requiredPermissions: ['dashboard_view'],
        },
        {
          id: 'hr-staff',
          label: 'Staff Directory & Profiles',
          path: '/staff',
          icon: UserCheck,
          requiredPermissions: ['staff_view'],
        },
        {
          id: 'hr-departments',
          label: 'Hospital Departments',
          path: '/departments',
          icon: Building2,
          requiredPermissions: ['department_view'],
        },
        {
          id: 'hr-doctors',
          label: 'Medical Consultants Roster',
          path: '/doctors',
          icon: Stethoscope,
          requiredPermissions: ['doctor_view'],
        },
        {
          id: 'hr-notifications',
          label: 'Internal Staff Outbox',
          path: '/notifications',
          icon: Bell,
          requiredPermissions: ['notification_view'],
        },
      ],
    },
  ],
};

// ============================================================================
// Phase 8.2: Persona-Specific Quick Actions ("+ Add New" Dropdown)
// ============================================================================

export const ROLE_QUICK_ACTIONS: Record<string, RoleQuickAction[]> = {
  'Super Admin': [
    {
      id: 'super-add-branch',
      label: 'Create Hospital Branch',
      path: '/settings',
      icon: Building2,
      color: '#0284c7',
      requiredPermission: 'hospital_settings_view',
    },
    {
      id: 'super-add-user',
      label: 'Add System Staff User',
      path: '/staff',
      icon: UserPlus,
      color: '#16a34a',
      requiredPermission: 'staff_create',
    },
    {
      id: 'super-config',
      label: 'Global Configuration',
      path: '/settings',
      icon: Sliders,
      color: '#7c3aed',
      requiredPermission: 'hospital_settings_view',
    },
    {
      id: 'super-outbox',
      label: 'Dispatch System Broadcast',
      path: '/notifications',
      icon: Bell,
      color: '#d97706',
      requiredPermission: 'notification_view',
    },
  ],

  'Hospital Admin': [
    {
      id: 'admin-add-patient',
      label: 'Register New Patient',
      path: '/patients',
      icon: Users,
      color: '#0284c7',
      requiredPermission: 'patient_add',
    },
    {
      id: 'admin-add-appointment',
      label: 'Book Consultation Visit',
      path: '/appointments',
      icon: Calendar,
      color: '#7c3aed',
      requiredPermission: 'appointment_add',
    },
    {
      id: 'admin-add-staff',
      label: 'Onboard Staff Member',
      path: '/staff',
      icon: UserCheck,
      color: '#16a34a',
      requiredPermission: 'staff_create',
    },
    {
      id: 'admin-add-dept',
      label: 'Add Clinical Department',
      path: '/departments',
      icon: Building2,
      color: '#d97706',
      requiredPermission: 'department_add',
    },
    {
      id: 'admin-beds',
      label: 'Configure Wards & Beds',
      path: '/inpatient',
      icon: BedDouble,
      color: '#dc2626',
      requiredPermission: 'inpatient_view',
    },
  ],

  'Doctor': [
    {
      id: 'doc-consult',
      label: 'Start Patient Consultation',
      path: '/consultations',
      icon: Stethoscope,
      color: '#059669',
      requiredPermission: 'consultation_add',
    },
    {
      id: 'doc-rx',
      label: 'Issue Prescription (Rx)',
      path: '/prescriptions',
      icon: Pill,
      color: '#0284c7',
      requiredPermission: 'prescription_add',
    },
    {
      id: 'doc-lab',
      label: 'Requisition Lab Test',
      path: '/laboratory',
      icon: Microscope,
      color: '#7c3aed',
      requiredPermission: 'lab_view',
    },
    {
      id: 'doc-rad',
      label: 'Requisition Radiology Scan',
      path: '/radiology',
      icon: Radio,
      color: '#d97706',
      requiredPermission: 'radiology_view',
    },
  ],

  'Receptionist': [
    {
      id: 'rec-patient',
      label: 'Register Walk-in Patient',
      path: '/patients',
      icon: Users,
      color: '#0284c7',
      requiredPermission: 'patient_add',
    },
    {
      id: 'rec-appt',
      label: 'Schedule Appointment',
      path: '/appointments',
      icon: Calendar,
      color: '#7c3aed',
      requiredPermission: 'appointment_add',
    },
    {
      id: 'rec-admit',
      label: 'Admit Patient to Ward',
      path: '/inpatient',
      icon: BedDouble,
      color: '#dc2626',
      requiredPermission: 'inpatient_view',
    },
  ],

  'Nurse': [
    {
      id: 'nurse-admit',
      label: 'Admit Patient to Bed',
      path: '/inpatient',
      icon: BedDouble,
      color: '#dc2626',
      requiredPermission: 'inpatient_view',
    },
    {
      id: 'nurse-vitals',
      label: 'Review Patient Vitals',
      path: '/patients',
      icon: Activity,
      color: '#059669',
      requiredPermission: 'patient_view',
    },
    {
      id: 'nurse-meds',
      label: 'Review Drug Chart (Rx)',
      path: '/prescriptions',
      icon: Pill,
      color: '#0284c7',
      requiredPermission: 'prescription_view',
    },
  ],

  'Pharmacist': [
    {
      id: 'pharm-dispense',
      label: 'Dispense Prescription',
      path: '/pharmacy',
      icon: Boxes,
      color: '#059669',
      requiredPermission: 'pharmacy_view',
    },
    {
      id: 'pharm-receive',
      label: 'Receive Stock Batch',
      path: '/pharmacy',
      icon: Boxes,
      color: '#0284c7',
      requiredPermission: 'pharmacy_view',
    },
    {
      id: 'pharm-med',
      label: 'Add Medicine to Formulary',
      path: '/medicines',
      icon: Pill,
      color: '#7c3aed',
      requiredPermission: 'medicine_view',
    },
  ],

  'Laboratorist': [
    {
      id: 'lab-collect',
      label: 'Accession Sample Worklist',
      path: '/laboratory',
      icon: Microscope,
      color: '#0284c7',
      requiredPermission: 'lab_view',
    },
    {
      id: 'lab-result',
      label: 'Enter Quantitative Results',
      path: '/laboratory',
      icon: Microscope,
      color: '#059669',
      requiredPermission: 'lab_view',
    },
  ],

  'Radiologist': [
    {
      id: 'rad-acquire',
      label: 'Initiate Imaging Study',
      path: '/radiology',
      icon: Radio,
      color: '#7c3aed',
      requiredPermission: 'radiology_view',
    },
    {
      id: 'rad-report',
      label: 'Author Diagnostic Report',
      path: '/radiology',
      icon: FileText,
      color: '#0284c7',
      requiredPermission: 'radiology_view',
    },
  ],

  'Cashier': [
    {
      id: 'cash-shift',
      label: 'Open Cash Drawer Shift',
      path: '/cashier',
      icon: IndianRupee,
      color: '#059669',
      requiredPermission: 'cashier_view',
    },
    {
      id: 'cash-inv',
      label: 'Raise Patient Invoice',
      path: '/billing',
      icon: CreditCard,
      color: '#0284c7',
      requiredPermission: 'invoice_view',
    },
    {
      id: 'cash-pay',
      label: 'Collect Counter Settlement',
      path: '/billing',
      icon: CreditCard,
      color: '#d97706',
      requiredPermission: 'invoice_view',
    },
  ],

  'Accountant': [
    {
      id: 'acc-journal',
      label: 'Post General Ledger Journal',
      path: '/accounting',
      icon: FileText,
      color: '#0284c7',
      requiredPermission: 'accounting_view',
    },
    {
      id: 'acc-audit',
      label: 'Audit Cashier Shift Drawer',
      path: '/cashier',
      icon: IndianRupee,
      color: '#16a34a',
      requiredPermission: 'cashier_view',
    },
    {
      id: 'acc-tb',
      label: 'Generate Trial Balance',
      path: '/accounting',
      icon: FileSpreadsheet,
      color: '#7c3aed',
      requiredPermission: 'accounting_view',
    },
  ],

  'HR': [
    {
      id: 'hr-onboard',
      label: 'Onboard Staff Member',
      path: '/staff',
      icon: UserCheck,
      color: '#16a34a',
      requiredPermission: 'staff_view',
    },
    {
      id: 'hr-dept',
      label: 'Add Clinical Department',
      path: '/departments',
      icon: Building2,
      color: '#0284c7',
      requiredPermission: 'department_view',
    },
    {
      id: 'hr-doctor',
      label: 'Add Medical Consultant',
      path: '/doctors',
      icon: Stethoscope,
      color: '#7c3aed',
      requiredPermission: 'doctor_view',
    },
  ],
};

// Aliases for Organization and Clinic Administration
ROLE_NAVIGATION_CONFIG['Organization Admin'] = ROLE_NAVIGATION_CONFIG['Hospital Admin'];
ROLE_NAVIGATION_CONFIG['Clinic Admin'] = ROLE_NAVIGATION_CONFIG['Hospital Admin'];

ROLE_QUICK_ACTIONS['Organization Admin'] = ROLE_QUICK_ACTIONS['Hospital Admin'];
ROLE_QUICK_ACTIONS['Clinic Admin'] = ROLE_QUICK_ACTIONS['Hospital Admin'];
