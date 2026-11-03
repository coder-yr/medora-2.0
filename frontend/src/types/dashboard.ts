export type DashboardPeriod = 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'currentMonth' | 'previousMonth' | 'custom';

export interface DashboardFilter {
  period: DashboardPeriod;
  startDate?: string;
  endDate?: string;
  branchId?: string;
}

export interface PatientMetrics {
  totalRegistered: number;
  newInPeriod: number;
}

export interface AppointmentMetrics {
  total: number;
  completed: number;
  cancelled: number;
  completionRatePercent: number;
  consultationsCompleted: number;
}

export interface InpatientMetrics {
  activeAdmissions: number;
  totalBeds: number;
  occupiedBeds: number;
  occupancyRatePercent: number;
}

export interface PharmacyMetrics {
  lowStockMedicines: number;
  nearExpiryBatches: number;
}

export interface DiagnosticsMetrics {
  pendingLabOrders: number;
  pendingRadiologyStudies: number;
}

export interface FinancialMetrics {
  recognizedRevenue: number;
  cashCollections: number;
  nonCashCollections: number;
  accountsReceivable: number;
  openOrPendingShifts: number;
}

export interface NotificationMetrics {
  deadLetterJobs: number;
  queueStatus: 'HEALTHY' | 'DEGRADED';
}

export interface ExecutiveOverviewData {
  period: string;
  dateRange: { start: string; end: string };
  branchScope: string;
  patients: PatientMetrics;
  appointments: AppointmentMetrics;
  inpatient: InpatientMetrics;
  pharmacy: PharmacyMetrics;
  diagnostics: DiagnosticsMetrics;
  financial: FinancialMetrics | null;
  notifications: NotificationMetrics;
  generatedAt: string;
}

export interface DoctorWorkloadData {
  doctorId: string;
  period: string;
  dateRange: { start: string; end: string };
  appointments: {
    total: number;
    completed: number;
    items: Array<{
      id: string;
      patientId: string;
      status: string;
      date: string;
      sTime: string;
      eTime: string;
      remarks?: string | null;
    }>;
  };
  consultations: {
    pendingDrafts: number;
    completed: number;
  };
  generatedAt: string;
}

export interface BranchComparisonItem {
  branchId: string;
  branchName: string;
  branchCode: string;
  address?: string | null;
  appointmentsCount: number;
  admissionsCount: number;
  netRevenue: number;
}

export interface BranchComparisonData {
  period: string;
  dateRange: { start: string; end: string };
  branches: BranchComparisonItem[];
  generatedAt: string;
}

export interface OperationalAlertItem {
  id: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  category: string;
  title: string;
  description: string;
  count: number;
}

export interface OperationalAlertsData {
  alerts: OperationalAlertItem[];
  totalAlerts: number;
  checkedAt: string;
}

