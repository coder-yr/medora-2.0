// Medora 2.0 - Inpatient & Bed Management System (IPD) Types

export type BedStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'CLEANING'
  | 'MAINTENANCE'
  | 'BLOCKED';

export type AdmissionStatus =
  | 'PENDING'
  | 'ADMITTED'
  | 'TRANSFERRED'
  | 'DISCHARGE_PENDING'
  | 'DISCHARGED'
  | 'CANCELLED';

export type AdmissionType =
  | 'ELECTIVE'
  | 'EMERGENCY'
  | 'TRANSFER'
  | 'URGENT'
  | 'OBSERVATION';

export type DischargeCondition =
  | 'RECOVERED'
  | 'IMPROVED'
  | 'UNCHANGED'
  | 'REFERRED'
  | 'DECEASED'
  | 'LAMA';

export type FolioStatus = 'OPEN' | 'PARTIALLY_PAID' | 'SETTLED' | 'WRITTEN_OFF';

export type FolioSourceModule =
  | 'BED'
  | 'PHARMACY'
  | 'LABORATORY'
  | 'RADIOLOGY'
  | 'SERVICE'
  | 'PROCEDURE'
  | 'NURSING';

export interface Ward {
  id: number | string;
  category: string;
  name?: string;
  code?: string | null;
  description?: string | null;
  baseRate: number | string;
  billingUnit: string;
  isActive: boolean;
  totalBeds?: number;
  occupiedBeds?: number;
  availableBeds?: number;
  currentPatients?: number;
  beds?: Bed[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Bed {
  id: number | string;
  categoryId: number | string;
  number: string;
  description?: string | null;
  status: BedStatus;
  isActive: boolean;
  category?: Ward;
  admissions?: Admission[];
  allocations?: BedAllocationHistory[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BedAllocationHistory {
  id: number | string;
  admissionId: number | string;
  bedId: number | string;
  allocatedAt: string;
  releasedAt?: string | null;
  rateSnapshot: number | string;
  transferReason?: string | null;
  allocatedBy?: number | string | null;
  releasedBy?: number | string | null;
  bed?: Bed;
  admission?: Admission;
}

export interface InpatientFolioItem {
  id: number | string;
  folioId: number | string;
  sourceModule: FolioSourceModule | string;
  sourceRecordId?: string | null;
  idempotencyKey?: string | null;
  chargeCategory: string;
  description: string;
  quantity: number;
  unitPrice: number | string;
  totalAmount: number | string;
  postedAt: string;
  postedBy?: number | string | null;
  isReversed: boolean;
  reversedAt?: string | null;
  reversedBy?: number | string | null;
  reversalReason?: string | null;
}

export interface InpatientFolio {
  id: number | string;
  folioNumber: string;
  admissionId: number | string;
  patientId: number | string;
  status: FolioStatus;
  totalCharges: number | string;
  totalPaid: number | string;
  balance: number | string;
  settledAt?: string | null;
  settledBy?: number | string | null;
  finalInvoiceId?: number | string | null;
  items?: InpatientFolioItem[];
  categoryTotals?: Record<string, number>;
  admission?: Admission;
  createdAt?: string;
  updatedAt?: string;
}

export interface Admission {
  id: number | string;
  admissionNumber: string;
  patientId: number | string;
  attendingDoctorId?: number | string | null;
  admittingDoctorId?: number | string | null;
  wardId: number | string;
  bedId: number | string;
  admissionDate: string;
  expectedDischargeDate?: string | null;
  actualDischargeDate?: string | null;
  admissionType: AdmissionType | string;
  admissionReason?: string | null;
  diagnosis?: string | null;
  clinicalNotes?: string | null;
  status: AdmissionStatus;
  dischargeSummary?: string | null;
  dischargeCondition?: DischargeCondition | string | null;
  createdBy?: number | string | null;
  dischargedBy?: number | string | null;
  patient?: {
    id: number | string;
    patientId: string;
    name: string;
    phone?: string;
    sex?: string;
    age?: string;
  };
  attendingDoctor?: {
    id: number | string;
    name: string;
    department?: string;
  };
  ward?: Ward;
  bed?: Bed;
  folio?: InpatientFolio;
  allocations?: BedAllocationHistory[];
  createdAt?: string;
  updatedAt?: string;
}

export interface InpatientDashboardMetrics {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  cleaningBeds: number;
  maintenanceBeds: number;
  otherBeds: number;
  occupancyPercentage: number;
  activeAdmissionsCount: number;
  expectedDischargesTodayCount: number;
  wards: Array<{
    id: number | string;
    name: string;
    total: number;
    occupied: number;
    available: number;
    cleaning: number;
  }>;
}
