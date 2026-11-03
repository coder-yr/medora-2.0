export interface PatientSummary {
  id: string;
  patientId: string;
  name: string;
  phone?: string | null;
}

export interface DoctorSummary {
  id: string;
  name: string;
  department?: string | null;
}

export type AppointmentStatus =
  | 'scheduled'
  | 'arrived'
  | 'in consultation'
  | 'completed'
  | 'cancelled'
  | 'no show';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  timeSlot: string;
  sTime: string;
  eTime: string;
  sTimeKey?: string;
  status: AppointmentStatus | string;
  remarks?: string | null;
  mode: string;
  videoRoom?: string | null;
  videoUrl?: string | null;
  branchId?: string | null;
  bp?: string | null;
  pulse?: string | null;
  temperature?: string | null;
  weight?: string | null;
  visitType?: string | null;
  patient?: PatientSummary;
  doctor?: DoctorSummary;
  checkedInAt?: string | null;
  consultStartedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface FreeSlot {
  start: string;
  minutes: number;
}

export interface CreateAppointmentDto {
  patient: string | number;
  doctor: string | number;
  date: string;
  start: string;
  minutes?: number;
  status?: AppointmentStatus;
  remarks?: string;
  b_p?: string;
  pulse?: string;
  temprature?: string;
  weight?: string;
  video?: boolean;
  visitType?: string;
  branchId?: string | number;
}

export interface PaginatedAppointments {
  data: Appointment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
