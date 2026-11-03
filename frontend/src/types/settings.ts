export interface HospitalSettings {
  id: string;
  hospitalName: string;
  legalName?: string | null;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  website?: string | null;
  address?: string | null;
  defaultLocale: string;
  defaultTimezone: string;
  defaultCurrency: string;
  dateFormat: string;
  timeFormat: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  invoiceFooter?: string | null;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface BranchSettings {
  id: string;
  branchId: string;
  operatingHours?: Record<string, any> | null;
  timezoneOverride?: string | null;
  currencyOverride?: string | null;
  receiptHeaderOverride?: string | null;
  receiptFooterOverride?: string | null;
  invoicePrefix?: string | null;
  mrnPrefix?: string | null;
  appointmentPrefix?: string | null;
  admissionPrefix?: string | null;
  logoUrlOverride?: string | null;
  primaryColorOverride?: string | null;
  updatedAt?: string;
}

export interface HospitalBranch {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  active: boolean;
  createdAt?: string;
  settings?: BranchSettings | null;
  _count?: {
    userMemberships?: number;
    patients?: number;
    invoices?: number;
  };
}

export interface EffectiveSettings {
  hospitalName: string;
  legalName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  timezone: string;
  currency: string;
  locale: string;
  dateFormat: string;
  timeFormat: string;
  invoicePrefix: string;
  mrnPrefix: string;
  appointmentPrefix: string;
  admissionPrefix: string;
  receiptHeader: string;
  receiptFooter: string;
  invoiceFooter: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  operatingHours: Record<string, any> | null;
}

export interface UserBranchMembership {
  id: string;
  userId: string;
  branchId: string;
  isDefault: boolean;
  isActive: boolean;
  accessRole?: string | null;
  assignedAt: string;
  notes?: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    login: string;
    group: string;
  };
  branch?: {
    id: string;
    name: string;
    code: string;
    active: boolean;
  };
  assignedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface ConfigurationAuditLog {
  id: string;
  actorUserId?: string | null;
  scope: 'HOSPITAL' | 'BRANCH';
  branchId?: string | null;
  settingKey: string;
  previousValue?: string | null;
  newValue?: string | null;
  changeReason?: string | null;
  createdAt: string;
  actorUser?: {
    id: string;
    firstName: string;
    lastName: string;
    login: string;
  } | null;
  branch?: {
    id: string;
    name: string;
    code: string;
  } | null;
}
