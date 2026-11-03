export interface ConsultationPatientSummary {
  id: string;
  patientId: string;
  name: string;
  sex?: string | null;
  age?: string | null;
  phone?: string | null;
}

export interface ConsultationDoctorSummary {
  id: string;
  name: string;
  department?: string | null;
}

export interface ConsultationVisitSummary {
  id: string;
  date: string;
  timeSlot: string;
  status: string;
  bp?: string | null;
  pulse?: string | null;
  temperature?: string | null;
  weight?: string | null;
}

export interface Consultation {
  id: string;
  appointmentId?: string | null;
  patientId: string;
  doctorId?: string | null;
  date: string;
  presentingComplaint?: string | null;
  history?: string | null;
  examination?: any | null;
  provisionalDiagnosis?: string | null;
  diagnosis?: string | null;
  plan?: string | null;
  treatment?: string | null;
  followUpDate?: string | null;
  followUpNotes?: string | null;
  allergies?: string | null;
  pastHistory?: any | null;
  socialHistory?: any | null;
  specialty?: any | null;
  immunizations?: any | null;
  status: 'draft' | 'completed' | string;
  completedAt?: string | null;
  createdBy?: string | null;
  patient?: ConsultationPatientSummary;
  doctor?: ConsultationDoctorSummary;
  visit?: ConsultationVisitSummary;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ConsultTemplate {
  id: string;
  name: string;
  doctorId?: string | null;
  fields: {
    presenting_complaint?: string;
    history?: string;
    provisional_diagnosis?: string;
    diagnosis?: string;
    plan?: string;
    treatment?: string;
  };
}

export interface VisitConsultationContext {
  consultation: Consultation;
  visit: ConsultationVisitSummary;
  patient: ConsultationPatientSummary;
  doctor?: ConsultationDoctorSummary;
  previous: Consultation[];
  templates: ConsultTemplate[];
}

export interface SaveConsultationDto {
  presenting_complaint?: string;
  history?: string;
  provisional_diagnosis?: string;
  diagnosis?: string;
  plan?: string;
  treatment?: string;
  follow_up_date?: string;
  follow_up_notes?: string;
  allergies?: string;
  exam?: Record<string, { status?: string; note?: string }>;
  examination?: any;
  past?: Record<string, string>;
  past_history?: any;
  social?: Record<string, string>;
  social_history?: any;
  b_p?: string;
  pulse?: string;
  temprature?: string;
  weight?: string;
  action?: 'save' | 'complete';
  template_name?: string;
}

export interface PaginatedConsultations {
  data: Consultation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
