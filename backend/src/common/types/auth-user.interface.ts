export type HospitalRole =
  | 'SuperAdmin'
  | 'Admin'
  | 'Doctor'
  | 'Nurse'
  | 'Accountant'
  | 'Receptionist'
  | 'Pharmacist'
  | 'Laboratorist'
  | 'Radiologist'
  | 'Cashier'
  | 'HR';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  group: HospitalRole;
  permissions: string[];
  branchId?: bigint | null;
  staffId?: bigint | null;
  organizationId?: bigint | null;
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
  iat?: number;
  exp?: number;
}
