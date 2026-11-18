import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  Pill,
  CreditCard,
  Boxes,
  Microscope,
  Radio,
  BedDouble,
  DollarSign,
  Building2,
  UserCheck,
  FileText,
  Bell,
  type LucideIcon,
} from 'lucide-react';

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
  // Category 1: Clinical Operations
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
    id: 'prescriptions',
    label: 'Prescriptions (Rx)',
    path: '/prescriptions',
    icon: Pill,
    category: 'Clinical Operations',
    requiredPermissions: ['prescription_view'],
    order: 5,
  },

  // Category 2: Diagnostics & Pharmacy
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

  // Category 3: Inpatient & Billing
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
    icon: DollarSign,
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

  // Category 4: Hospital Administration
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
