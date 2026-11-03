export interface MedicineItem {
  medicineId?: number | null;
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  symptom: string | null;
  advice: string | null;
  state: string | null;
  medicine: string | null;
  validity: string | null;
  note: string | null;
  patient?: { id: string; name: string; patientId: string; phone: string };
  doctor?: { id: string; name: string; department: string };
  items: Array<{
    id: string;
    medicineId: string | null;
    name: string;
    dosage: string | null;
    duration: string | null;
    instructions: string | null;
  }>;
  createdAt: string;
}

export interface CreatePrescriptionDto {
  patientId: number;
  doctorId: number;
  date: string;
  symptom?: string;
  advice?: string;
  note?: string;
  validity?: string;
  items: Array<{
    medicineId?: number;
    name: string;
    dosage?: string;
    duration?: string;
    instructions?: string;
  }>;
}
