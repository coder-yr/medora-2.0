export interface Doctor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  department?: string | null;
  profile?: string | null;
  imageUrl?: string | null;
  ionUserId?: string | null;
  hasLogin: boolean;
  loginUsername?: string | null;
  upcomingAppointments: number;
  branchId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CreateDoctorDto {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  department?: string;
  profile?: string;
  procedureId?: string;
  branchId?: number;
  loginUsername?: string;
  loginPassword?: string;
}

export interface UpdateDoctorDto extends Partial<CreateDoctorDto> {}

export interface PaginatedDoctors {
  data: Doctor[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
