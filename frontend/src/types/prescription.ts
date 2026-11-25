export interface MedicineItem {
  medicineId?: number | null;
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
  quantityPrescribed?: number;
  unit?: string;
  route?: string;
  frequency?: string;
  timing?: string;
  refills?: number;
  startDate?: string;
  endDate?: string;
}

export interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  medicineId: string | null;
  name: string;
  dosage: string | null;
  duration: string | null;
  instructions: string | null;
  quantityPrescribed: number;
  unit?: string | null;
  route?: string | null;
  frequency?: string | null;
  timing?: string | null;
  refills: number;
  startDate?: string | null;
  endDate?: string | null;
  dispensedQuantity: number;
  remainingQuantity: number;
}

export interface PrescriptionAmendment {
  id: string;
  prescriptionId: string;
  amendedBy: string;
  amendedByUser?: {
    id: string;
    name: string;
    role: string;
  };
  reason: string;
  amendedSection: string;
  previousNotes?: string | null;
  newNotes: string;
  createdAt: string;
}

export interface Prescription {
  id: string;
  prescriptionNumber?: string | null;
  consultationId?: string | null;
  organizationId?: string | null;
  branchId?: string | null;
  patientId: string;
  doctorId: string;
  date: string;
  symptom: string | null;
  advice: string | null;
  status: 'DRAFT' | 'SIGNED' | 'PARTIALLY_DISPENSED' | 'DISPENSED' | 'CANCELLED' | 'EXPIRED' | string;
  state: string | null;
  dd?: string | null;
  medicine: string | null;
  validity: string | null;
  note: string | null;
  signedAt?: string | null;
  signedById?: string | null;
  signedBy?: {
    id: string;
    name: string;
    role: string;
  } | null;
  cancelledAt?: string | null;
  cancelledById?: string | null;
  cancelledBy?: {
    id: string;
    name: string;
    role: string;
  } | null;
  cancellationReason?: string | null;
  patient?: {
    id: string;
    name: string;
    patientId?: string;
    phone?: string;
    gender?: string;
    age?: string;
    bloodGroup?: string;
    allergies?: string | null;
    allergyStatus?: string | null;
  };
  doctor?: {
    id: string;
    name: string;
    department?: string;
    qualifications?: string | null;
    licenseNumber?: string | null;
  };
  items: PrescriptionItem[];
  amendments?: PrescriptionAmendment[];
  allergyAlerts?: string[];
  allergyStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePrescriptionDto {
  patientId: number;
  doctorId: number;
  date: string;
  symptom?: string;
  advice?: string;
  note?: string;
  validity?: string;
  status?: string;
  signImmediately?: boolean;
  consultationId?: number;
  branchId?: number;
  items: Array<{
    medicineId?: number;
    name: string;
    dosage?: string;
    duration?: string;
    instructions?: string;
    quantityPrescribed?: number;
    unit?: string;
    route?: string;
    frequency?: string;
    timing?: string;
    refills?: number;
    startDate?: string;
    endDate?: string;
  }>;
}

export interface SignPrescriptionDto {
  signatureNotes?: string;
}

export interface CancelPrescriptionDto {
  reason: string;
}

export interface AmendPrescriptionDto {
  reason: string;
  amendedSection?: string;
  previousNotes?: string;
  newNotes: string;
}

export interface PrescriptionPrintout {
  prescription: Prescription;
  organization: {
    name: string;
    branchName?: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
  };
}
