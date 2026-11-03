export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' | 'LOCUM';

export type StaffStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'INACTIVE' | 'TERMINATED';

export interface StaffDesignation {
  id: string;
  code: string;
  title: string;
  category: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffDepartmentAssignment {
  id: string;
  staffProfileId: string;
  departmentId: string;
  branchId?: string | null;
  isPrimary: boolean;
  effectiveStart: string;
  effectiveEnd?: string | null;
  reason?: string | null;
  assignedBy?: string | null;
  department?: {
    id: string;
    name: string;
  };
  branch?: {
    id: string;
    name: string;
    code: string;
  } | null;
  assigner?: {
    id: string;
    login: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface StaffEmploymentHistory {
  id: string;
  staffProfileId: string;
  eventType: string;
  previousValue?: string | null;
  newValue?: string | null;
  effectiveDate: string;
  comments?: string | null;
  recordedBy: string;
  createdAt: string;
  recorder?: {
    id: string;
    login: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface StaffProfile {
  id: string;
  employeeNumber: string;
  userId?: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  nationalId?: string | null;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  joiningDate: string;
  employmentType: EmploymentType;
  employmentStatus: StaffStatus;
  departmentId?: string | null;
  designationId?: string | null;
  branchId?: string | null;
  reportingManagerId?: string | null;
  profileImage?: string | null;
  qualifications?: string | null;
  offboardedAt?: string | null;
  offboardingReason?: string | null;
  createdAt: string;
  updatedAt?: string | null;

  user?: {
    id: string;
    login: string;
    email: string;
    group: string;
    createdAt?: string;
  } | null;
  department?: {
    id: string;
    name: string;
    description?: string;
  } | null;
  designation?: StaffDesignation | null;
  branch?: {
    id: string;
    name: string;
    code: string;
  } | null;
  reportingManager?: {
    id: string;
    employeeNumber: string;
    displayName: string;
  } | null;
  departmentAssignments?: StaffDepartmentAssignment[];
  employmentHistory?: StaffEmploymentHistory[];
}

export interface StaffDashboardMetrics {
  overview: {
    totalEmployees: number;
    activeEmployees: number;
    onLeaveEmployees: number;
    suspendedEmployees: number;
    inactiveEmployees: number;
    terminatedEmployees: number;
    unlinkedAccounts: number;
  };
  staffByDepartment: Array<{
    departmentId: string;
    departmentName: string;
    count: number;
  }>;
  staffByDesignation: Array<{
    designationId: string;
    title: string;
    category: string;
    count: number;
  }>;
  recentChanges: StaffEmploymentHistory[];
}

export interface StaffListResponse {
  data: StaffProfile[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateStaffPayload {
  firstName: string;
  lastName: string;
  displayName?: string;
  gender?: string;
  dateOfBirth?: string;
  nationalId?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  joiningDate?: string;
  employmentType?: EmploymentType;
  employmentStatus?: StaffStatus;
  departmentId?: number;
  designationId?: number;
  branchId?: number;
  reportingManagerId?: number;
  userId?: number;
  qualifications?: string;
}

export interface UpdateStaffPayload {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  gender?: string;
  dateOfBirth?: string;
  nationalId?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  joiningDate?: string;
  employmentType?: EmploymentType;
  reportingManagerId?: number;
  qualifications?: string;
}

export interface DepartmentTransferPayload {
  targetDepartmentId: number;
  branchId?: number;
  effectiveDate?: string;
  reason?: string;
  isPrimary?: boolean;
}

export interface ChangeDesignationPayload {
  targetDesignationId: number;
  effectiveDate?: string;
  reason?: string;
}

export interface OffboardStaffPayload {
  reason: string;
  offboardingDate?: string;
  deactivateUserAccount?: boolean;
}

export interface CreateDesignationPayload {
  code: string;
  title: string;
  category: string;
  description?: string;
  isActive?: boolean;
}
