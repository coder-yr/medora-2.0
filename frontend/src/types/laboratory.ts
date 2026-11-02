// Medora 2.0 - Laboratory Information System (LIS) Types

export type LabPriority = 'ROUTINE' | 'URGENT' | 'STAT';

export type LabOrderStatus =
  | 'requested'
  | 'partial'
  | 'reported'
  | 'ORDERED'
  | 'SAMPLE_PENDING'
  | 'SAMPLE_COLLECTED'
  | 'SAMPLE_RECEIVED'
  | 'PROCESSING'
  | 'RESULT_ENTERED'
  | 'PARTIAL'
  | 'VERIFIED'
  | 'COMPLETED'
  | 'CANCELLED';

export type SampleStatus = 'PENDING' | 'COLLECTED' | 'RECEIVED' | 'REJECTED';

export type AbnormalFlag = 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL' | 'ABNORMAL';

export interface LabTestParameter {
  id: string | number;
  labCategoryId: string | number;
  name: string;
  unit: string | null;
  referenceRange: string | null;
  gender: string;
  ageMin: number | null;
  ageMax: number | null;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
}

export interface LabCategory {
  id: string | number;
  category: string; // Test Name
  name?: string;
  department?: string;
  referenceValue: string | null;
  description: string | null;
  price: number | null;
  sampleType: string | null;
  turnaroundHours: number;
  instructions: string | null;
  isActive: boolean;
  status?: string;
  parameters?: LabTestParameter[];
  timesRequested?: number;
}

export interface LabSample {
  id: string | number;
  labId: string | number;
  sampleNumber: string;
  sampleType: string;
  status: SampleStatus;
  collectedAt: string | null;
  collectedBy: string | number | null;
  receivedAt: string | null;
  receivedBy: string | number | null;
  rejectedAt: string | null;
  rejectedBy: string | number | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lab?: {
    orderNumber?: string;
    patientName?: string;
    patientPhone?: string;
    priority?: string;
  };
  tests?: Array<{
    id: string | number;
    name: string;
  }>;
}

export interface LabResultParameter {
  id: string | number;
  labTestId: string | number;
  parameterId: string | number | null;
  parameterName: string;
  value: string;
  unitSnapshot: string | null;
  referenceRangeSnapshot: string | null;
  abnormalFlag: AbnormalFlag;
  clinicalComments: string | null;
  createdAt?: string;
}

export interface LabTest {
  id: string | number;
  labId: string | number;
  labCategoryId: string | number | null;
  sampleId: string | number | null;
  name: string;
  referenceValue: string | null;
  priceSnapshot: number | null;
  sampleType: string | null;
  result: string | null;
  status: string;
  reportedAt: string | null;
  resultParameters?: LabResultParameter[];
  labCategory?: LabCategory;
  sample?: LabSample;
}

export interface LabReportAmendment {
  id: string | number;
  labId: string | number;
  amendedBy: string | number;
  reason: string;
  previousSnapshot: any;
  newSnapshot: any;
  createdAt: string;
}

export interface LabOrder {
  id: string | number;
  orderNumber: string;
  patientId: string | number;
  doctorId: string | number | null;
  appointmentId: string | number | null;
  consultationId: string | number | null;
  invoiceId: string | number | null;
  date: string;
  dateString?: string;
  category?: string;
  categoryName?: string;
  report?: string;
  status: LabOrderStatus;
  priority: LabPriority;
  clinicalNotes: string | null;
  patientName: string;
  patientPhone: string | null;
  patientAddress: string | null;
  doctorName: string | null;
  verifiedBy?: string | number | null;
  verifiedAt?: string | null;
  approvedBy?: string | number | null;
  approvedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: {
    id: string | number;
    patientId: string;
    name: string;
    sex: string;
    age: string;
    phone: string;
  };
  doctor?: {
    id: string | number;
    name: string;
    department: string;
  };
  tests: LabTest[];
  samples: LabSample[];
  amendments?: LabReportAmendment[];
  invoice?: any;
}

export interface LabDashboardMetrics {
  pendingOrders: number;
  sampleCollectionQueue: number;
  processingQueue: number;
  awaitingVerification: number;
  completedReports: number;
  rejectedSamples: number;
  totalTestsInCatalogue: number;
}
