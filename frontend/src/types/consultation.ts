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

export interface StructuredDiagnosis {
  type: 'PRIMARY' | 'SECONDARY' | 'DIFFERENTIAL';
  description: string;
  code?: string;
  status?: string;
}

export interface ConsultationAmendmentItem {
  id: string;
  amendedBy: string;
  amendedByName?: string;
  reason: string;
  amendedSection: string;
  previousNotes?: string | null;
  newNotes: string;
  createdAt: string;
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
  allergyStatus?: 'NKDA' | 'ALLERGIES_RECORDED' | 'UNKNOWN' | null;
  pastHistory?: any | null;
  socialHistory?: any | null;
  specialty?: any | null;
  immunizations?: any | null;

  // Phase 10.5.3 SOAP additions
  soapSubjective?: string | null;
  soapObjective?: string | null;
  soapAssessment?: string | null;
  soapPlan?: string | null;
  chiefComplaintDetails?: Record<string, any> | null;
  hpiDetails?: Record<string, any> | null;
  vitals?: {
    bp?: string;
    pulse?: string | number;
    respiratoryRate?: string | number;
    temperature?: string | number;
    oxygenSaturation?: string | number;
    height?: string | number;
    weight?: string | number;
    bmi?: string | number;
  } | null;
  diagnoses?: StructuredDiagnosis[] | null;
  treatmentPlan?: Record<string, any> | null;

  signedAt?: string | null;
  signedById?: string | null;
  signedBy?: { id: string; name: string } | null;
  branchId?: string | null;
  amendments?: ConsultationAmendmentItem[];

  status: 'draft' | 'completed' | 'signed' | string;
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
  allergy_status?: 'NKDA' | 'ALLERGIES_RECORDED' | 'UNKNOWN';
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

  // SOAP additions
  soap_subjective?: string;
  soap_objective?: string;
  soap_assessment?: string;
  soap_plan?: string;
  chief_complaint_details?: Record<string, any>;
  hpi_details?: Record<string, any>;
  vitals?: {
    bp?: string;
    pulse?: string | number;
    respiratoryRate?: string | number;
    temperature?: string | number;
    oxygenSaturation?: string | number;
    height?: string | number;
    weight?: string | number;
    bmi?: string | number;
  };
  diagnoses?: StructuredDiagnosis[];
  treatment_plan?: Record<string, any>;

  action?: 'save' | 'draft' | 'sign' | 'complete';
  template_name?: string;
}

export interface AmendConsultationDto {
  reason: string;
  amendedSection: string;
  previousNotes?: string;
  newNotes: string;
}

export interface ChartVitals {
  bp?: string;
  pulse?: string;
  respiratoryRate?: string;
  temperature?: string;
  oxygenSaturation?: string;
  height?: string;
  weight?: string;
  bmi?: string;
  recordedAt?: string;
  recordedBy?: string;
}

export interface ChartDiagnosis {
  type: string;
  description: string;
  code?: string;
  diagnosedDate?: string;
  diagnosedBy?: string;
}

export interface PatientClinicalChart {
  patient: {
    id: string;
    patientId: string;
    name: string;
    sex: string | null;
    birthdate: string | null;
    age: number | null;
    phone: string | null;
    bloodGroup: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelation: string | null;
  };
  allergyStatus: 'NKDA' | 'ALLERGIES_RECORDED' | 'UNKNOWN';
  allergies?: string | null;
  history: {
    medicalConditions: Record<string, string> | null;
    surgicalHistory: Record<string, string> | null;
    familyHistory: Record<string, string> | null;
    socialHistory: Record<string, string> | null;
  };
  latestVitals?: ChartVitals | null;
  diagnoses: ChartDiagnosis[];
  prescriptions: any[];
  consultations: Consultation[];
  labResults: any[];
  radiologyReports: any[];
  documents: any[];
  previousAppointments: any[];
}

export interface DoctorDashboardSummary {
  todayAppointments: number;
  waitingPatients: number;
  calledPatients: number;
  activeConsultations: number;
  completedConsultations: number;
  pendingDrafts: number;
  criticalAlertsCount: number;
  queue: Array<{
    id: string;
    appointmentId: string;
    patientId: string;
    patientName: string;
    mrn: string;
    age?: number | null;
    sex?: string | null;
    doctorName: string;
    department?: string | null;
    timeSlot: string;
    queueNumber?: number | null;
    status: string;
    appointmentType?: string;
    reasonForVisit?: string | null;
    vitals?: {
      bp?: string | null;
      pulse?: string | null;
      temperature?: string | null;
      weight?: string | null;
    };
    consultationId?: string | null;
    consultationStatus?: string | null;
  }>;
  drafts: Consultation[];
}
