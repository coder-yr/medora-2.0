export interface Patient {
  id: string;
  patientId: string; // 6-digit zero-padded MRN
  name: string;
  fatherName?: string | null;
  email?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  address?: string | null;
  city?: string | null;
  birthdate?: string | null;
  age?: string | null;
  sex?: string | null;
  bloodGroup?: string | null;
  cnic?: string | null;
  guardianRelation?: string | null;
  guardianMrn?: string | null;
  mlc?: boolean;
  oldMrn?: string | null;
  employeeNo?: string | null;
  patientTypeId?: string | number | null;
  branchId?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePatientDto {
  name: string;
  fatherName?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  city?: string;
  birthdate?: string;
  sex?: string;
  bloodGroup?: string;
  cnic?: string;
  guardianRelation?: string;
  guardianMrn?: string;
  mlc?: boolean;
  oldMrn?: string;
  employeeNo?: string;
  patientTypeId?: number;
  branchId?: number;
}

export interface UpdatePatientDto extends Partial<CreatePatientDto> {}

export interface PaginatedPatients {
  data: Patient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
