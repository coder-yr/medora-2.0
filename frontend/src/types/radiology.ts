// Medora 2.0 - Radiology Information System (RIS) Types

export type RadiologyModality =
  | 'xray'
  | 'ultrasound'
  | 'ct'
  | 'mri'
  | 'mammography'
  | 'fluoroscopy'
  | 'other';

export type RadiologyUrgency = 'routine' | 'urgent' | 'stat';

export type RadiologyOrderStatus =
  | 'ordered'
  | 'scheduled'
  | 'arrived'
  | 'in_progress'
  | 'done'
  | 'reported'
  | 'VERIFIED'
  | 'COMPLETED'
  | 'cancelled';

export interface RadiologyCategory {
  id: number;
  name: string;
  modality: RadiologyModality;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
  examsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RadiologyExam {
  id: number;
  code: string;
  name: string;
  modality: RadiologyModality;
  bodyPart?: string | null;
  categoryId?: number | null;
  paymentCategoryId?: number | null;
  price?: number | string | null;
  reportTemplate?: string | null;
  preparationInstructions?: string | null;
  turnaroundHours?: number;
  active: boolean;
  category?: RadiologyCategory;
  paymentCategory?: {
    id: number;
    category: string;
    cPrice: number | string;
  };
  ordersCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RadiologyReportAmendment {
  id: number;
  radiologyOrderId: number;
  amendedBy: number;
  reason: string;
  previousFindings?: string | null;
  previousImpression?: string | null;
  newFindings?: string | null;
  newImpression?: string | null;
  createdAt: string;
  author?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface RadiologyOrder {
  id: number;
  orderNumber: string;
  patientId: number;
  doctorId?: number | null;
  appointmentId?: number | null;
  consultationId?: number | null;
  radiologyExamId: number;
  examName?: string | null;
  modality?: RadiologyModality | null;
  orderDate: string;
  clinicalIndication?: string | null;
  urgency: RadiologyUrgency;
  urgent: boolean;
  status: RadiologyOrderStatus;
  scheduledAt?: string | null;
  arrivedAt?: string | null;
  performedAt?: string | null;
  equipmentRoom?: string | null;
  findings?: string | null;
  impression?: string | null;
  recommendations?: string | null;
  reportedById?: number | null;
  reportedAt?: string | null;
  verifiedById?: number | null;
  verifiedAt?: string | null;
  technologistId?: number | null;
  invoiceId?: number | null;
  branchId?: number | null;
  cancelledAt?: string | null;
  cancelledById?: number | null;
  cancelReason?: string | null;
  createdBy?: number | null;
  createdAt?: string;
  updatedAt?: string;
  patient?: {
    id: number;
    name: string;
    patientId: string;
    phone?: string | null;
    sex?: string | null;
    age?: string | null;
    address?: string | null;
  };
  doctor?: {
    id: number;
    name: string;
    department?: string | null;
  };
  radiologyExam?: RadiologyExam;
  technologist?: {
    id: number;
    name: string;
  };
  reportedBy?: {
    id: number;
    name: string;
  };
  verifiedBy?: {
    id: number;
    name: string;
  };
  amendments?: RadiologyReportAmendment[];
}

export interface RadiologyDashboardMetrics {
  metrics: {
    pendingOrders: number;
    scheduledToday: number;
    awaitingExamination: number;
    inProgress: number;
    reportsPending: number;
    awaitingVerification: number;
    completedReports: number;
    cancelledOrders: number;
    totalExamsInCatalogue: number;
  };
  recentOrders: RadiologyOrder[];
}

export interface CreateRadiologyOrderPayload {
  patientId: number;
  doctorId?: number;
  appointmentId?: number;
  consultationId?: number;
  examIds: number[];
  clinicalNotes?: string;
  clinicalIndication?: string;
  urgent?: boolean;
  urgency?: RadiologyUrgency;
  bill?: boolean;
  scheduledAt?: string;
  equipmentRoom?: string;
}

export interface ScheduleRadiologyOrderPayload {
  scheduledAt: string;
  technologistId?: number;
  equipmentRoom?: string;
  notes?: string;
  forceConflict?: boolean;
}

export interface SaveReportDraftPayload {
  findings?: string;
  impression?: string;
  recommendations?: string;
}

export interface SubmitReportPayload {
  findings?: string;
  impression: string;
  recommendations?: string;
}

export interface CreateAmendmentPayload {
  reason: string;
  findings?: string;
  impression?: string;
  recommendations?: string;
}

export interface CancelOrderPayload {
  reason: string;
}
