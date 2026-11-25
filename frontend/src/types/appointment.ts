export interface PatientSummary {
  id: string;
  patientId: string;
  name: string;
  phone?: string | null;
  allergies?: string | null;
}

export interface DoctorSummary {
  id: string;
  name: string;
  department?: string | null;
}

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'waiting'
  | 'called'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no show'
  | 'rescheduled';

export type AppointmentPriority = 'NORMAL' | 'URGENT' | 'VIP' | 'EMERGENCY';

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
  priority?: AppointmentPriority | string;
  department?: string | null;
  tokenNo?: number | null;
  queueNumber?: number | null;
  tokenNumber?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  rescheduledFromId?: string | null;
  rescheduleReason?: string | null;
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
  calledInAt?: string | null;
  consultStartedAt?: string | null;
  checkedOutAt?: string | null;
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
  status?: AppointmentStatus | string;
  priority?: AppointmentPriority;
  department?: string;
  remarks?: string;
  b_p?: string;
  pulse?: string;
  temprature?: string;
  weight?: string;
  video?: boolean;
  visitType?: string;
  branchId?: string | number;
}

export interface WalkInAppointmentDto {
  patient?: string | number;
  newPatient?: {
    name: string;
    phone?: string;
    sex?: string;
    age?: string | number;
    bloodGroup?: string;
    address?: string;
  };
  doctor: string | number;
  department?: string;
  branchId?: number;
  priority?: AppointmentPriority;
  reason?: string;
  remarks?: string;
}

export interface RescheduleAppointmentDto {
  date: string;
  start: string;
  minutes?: number;
  reason?: string;
}

export interface CancelAppointmentDto {
  reason: string;
}

export interface QueueItem {
  appointmentId: string;
  queuePosition: number;
  tokenNumber: string;
  priority: string;
  status: string;
  checkedInAt: string;
  calledInAt?: string | null;
  consultStartedAt?: string | null;
  waitingMinutes: number;
  patient: PatientSummary;
  doctor: DoctorSummary;
  branchId?: string | null;
  visitType?: string | null;
  timeSlot: string;
  remarks?: string | null;
}

export interface QueueSummary {
  totalWaiting: number;
  totalInConsultation: number;
  totalCompletedToday: number;
  averageWaitMinutes: number;
}

export interface OpdQueueResponse {
  summary: QueueSummary;
  items: QueueItem[];
}

export interface DoctorSlot {
  id?: string;
  doctorId?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  active: boolean;
  branchId?: number;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
}

export interface DoctorLeave {
  id?: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  branchId?: number;
}

export interface PaginatedAppointments {
  data: Appointment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
