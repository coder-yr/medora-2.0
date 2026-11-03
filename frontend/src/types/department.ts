export interface Department {
  id: string;
  name: string;
  description?: string | null;
  doctorCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface DepartmentListResponse {
  departments: Department[];
  unlisted: string[];
}

export interface CreateDepartmentDto {
  name: string;
  description?: string;
}

export interface UpdateDepartmentDto {
  name?: string;
  description?: string;
}
