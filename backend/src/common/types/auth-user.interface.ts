export type HospitalRole =
  | 'SuperAdmin'
  | 'Admin'
  | 'OrganizationAdmin'
  | 'ClinicAdmin'
  | 'Doctor'
  | 'Nurse'
  | 'Accountant'
  | 'Receptionist'
  | 'Pharmacist'
  | 'Laboratorist'
  | 'Radiologist'
  | 'Cashier'
  | 'HR'
  | 'Unconfigured';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  group: HospitalRole;
  permissions: string[];
  branchId?: bigint | null;
  staffId?: bigint | null;
  organizationId?: bigint | null;
  organizationRole?: string | null;
  organizationEdition?: string | null;
  organizationStatus?: string | null;
  isSuperAdmin?: boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  group: HospitalRole;
  permissions: string[];
  branchId?: string | null;
  staffId?: string | null;
  organizationId?: string | null;
  organizationRole?: string | null;
  organizationEdition?: string | null;
  isSuperAdmin?: boolean;
  iat?: number;
  exp?: number;
}
