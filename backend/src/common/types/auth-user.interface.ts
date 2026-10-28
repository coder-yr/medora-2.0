export type HospitalRole =
  'Admin' | 'Doctor' | 'Nurse' | 'Accountant' | 'Receptionist' | 'Pharmacist' | 'Laboratorist';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  group: HospitalRole;
  permissions: string[];
  branchId?: bigint | null;
  staffId?: bigint | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  group: HospitalRole;
  permissions: string[];
  branchId?: string | null;
  staffId?: string | null;
  iat?: number;
  exp?: number;
}
