export interface Patient {
  id: string;
  patientId: string; // 6-digit zero-padded MRN
  name: string;
  fatherName?: string | null;
  email?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  address?: string | null;
  city?: string | null;
  birthdate?: string | null;
  age?: string | null;
  sex?: string | null;
  bloodGroup?: string | null;
  cnic?: string | null;
  guardianRelation?: string | null;
  guardianMrn?: string | null;
  mlc?: boolean;
  oldMrn?: string | null;
  employeeNo?: string | null;
  patientTypeId?: string | number | null;
  branchId?: string | number | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  allergies?: string | null;
  medicalHistory?: string | null;
  surgicalHistory?: string | null;
  familyHistory?: string | null;
  currentMedications?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePatientDto {
  name: string;
  fatherName?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  city?: string;
  birthdate?: string;
  sex?: string;
  bloodGroup?: string;
  cnic?: string;
  guardianRelation?: string;
  guardianMrn?: string;
  mlc?: boolean;
  oldMrn?: string;
  employeeNo?: string;
  patientTypeId?: number;
  branchId?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  allergies?: string;
  medicalHistory?: string;
  surgicalHistory?: string;
  familyHistory?: string;
  currentMedications?: string;
}

export interface UpdatePatientDto extends Partial<CreatePatientDto> {}

export interface PaginatedPatients {
  data: Patient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DuplicateMatchItem {
  patient: Patient;
  matchedOn: string[];
}

export interface DuplicateCheckResponse {
  hasMatch: boolean;
  matchCount: number;
  matches: DuplicateMatchItem[];
}

export interface EncounterAppointment {
  id: string;
  date: string;
  time?: string | null;
  doctorName?: string | null;
  status: string;
  type?: string | null;
}

export interface EncounterConsultation {
  id: string;
  date: string;
  doctorName?: string | null;
  diagnosis?: string | null;
  symptoms?: string | null;
  notes?: string | null;
  status: string;
}

export interface EncounterPrescription {
  id: string;
  date: string;
  doctorName?: string | null;
  itemCount: number;
  medicines: string[];
}

export interface EncounterLab {
  id: string;
  date: string;
  testName?: string | null;
  status: string;
}

export interface EncounterInvoice {
  id: string;
  date: string;
  amount: number;
  paidAmount: number;
  status: string;
}

export interface EncounterSummary {
  totalAppointments: number;
  totalConsultations: number;
  totalPrescriptions: number;
  totalLabs: number;
  totalInvoiced: number;
  outstandingBalance: number;
}

export interface PatientEncounterResponse {
  patientId: string;
  summary: EncounterSummary;
  appointments: EncounterAppointment[];
  consultations: EncounterConsultation[];
  prescriptions: EncounterPrescription[];
  labs: EncounterLab[];
  invoices: EncounterInvoice[];
}

export interface PatientDocument {
  id: string;
  patientId: string;
  branchId?: string | null;
  title: string;
  documentType: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
  notes?: string | null;
  uploadedByName?: string | null;
  createdAt?: string | null;
}

export interface CreatePatientDocumentDto {
  title: string;
  documentType?: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  notes?: string;
  branchId?: number;
}
