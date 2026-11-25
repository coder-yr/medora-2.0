import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PrescriptionItemResponseDto {
  @ApiProperty({ description: 'Prescription medicine item ID', example: '1' })
  id!: string;

  @ApiProperty({ description: 'Parent prescription ID', example: '1' })
  prescriptionId!: string;

  @ApiPropertyOptional({ description: 'Linked catalog medicine ID if applicable', example: '10' })
  medicineId?: string | null;

  @ApiProperty({ description: 'Prescribed drug name', example: 'Amoxil' })
  name!: string;

  @ApiPropertyOptional({ description: 'Dosage regimen', example: '1+0+1' })
  dosage?: string | null;

  @ApiPropertyOptional({ description: 'Duration of treatment', example: '5 days' })
  duration?: string | null;

  @ApiPropertyOptional({ description: 'Administration instructions', example: 'After meals' })
  instructions?: string | null;

  @ApiProperty({ description: 'Prescribed quantity', example: 10, default: 1 })
  quantityPrescribed!: number;

  @ApiPropertyOptional({ description: 'Unit of measure', example: 'tablets' })
  unit?: string | null;

  @ApiPropertyOptional({ description: 'Route of administration', example: 'oral' })
  route?: string | null;

  @ApiPropertyOptional({ description: 'Frequency', example: 'BD' })
  frequency?: string | null;

  @ApiPropertyOptional({ description: 'Timing relative to meals', example: 'After food' })
  timing?: string | null;

  @ApiProperty({ description: 'Permitted refills', example: 0, default: 0 })
  refills!: number;

  @ApiPropertyOptional({ description: 'Start date', example: '2026-11-24' })
  startDate?: string | null;

  @ApiPropertyOptional({ description: 'End date', example: '2026-11-29' })
  endDate?: string | null;

  @ApiProperty({ description: 'Dispensed quantity so far', example: 0, default: 0 })
  dispensedQuantity!: number;

  @ApiProperty({ description: 'Remaining quantity to dispense', example: 10, default: 10 })
  remainingQuantity!: number;
}

export class PatientBriefDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Amina Yousaf' })
  name!: string;

  @ApiPropertyOptional({ example: '000001' })
  patientId?: string | null;

  @ApiPropertyOptional({ example: '03001234567' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Female' })
  gender?: string | null;

  @ApiPropertyOptional({ example: '32' })
  age?: string | null;

  @ApiPropertyOptional({ example: 'O+' })
  bloodGroup?: string | null;

  @ApiPropertyOptional({ example: 'Penicillin' })
  allergies?: string | null;

  @ApiPropertyOptional({ example: 'CONFIRMED' })
  allergyStatus?: string | null;
}

export class DoctorBriefDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Dr Nadia Aslam' })
  name!: string;

  @ApiPropertyOptional({ example: 'Cardiology' })
  department?: string | null;

  @ApiPropertyOptional({ example: 'MBBS, FCPS' })
  qualifications?: string | null;

  @ApiPropertyOptional({ example: 'PMC-12345' })
  licenseNumber?: string | null;
}

export class UserBriefDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Dr Nadia Aslam' })
  name!: string;

  @ApiProperty({ example: 'doctor' })
  role!: string;
}

export class PrescriptionAmendmentResponseDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '1' })
  prescriptionId!: string;

  @ApiProperty({ example: '1' })
  amendedBy!: string;

  @ApiPropertyOptional({ type: () => UserBriefDto })
  amendedByUser?: UserBriefDto;

  @ApiProperty({ example: 'Dose adjustment' })
  reason!: string;

  @ApiProperty({ example: 'MEDICATION_DOSAGE' })
  amendedSection!: string;

  @ApiPropertyOptional({ example: '500mg' })
  previousNotes?: string | null;

  @ApiProperty({ example: '250mg' })
  newNotes!: string;

  @ApiProperty({ example: '2026-11-24T10:00:00.000Z' })
  createdAt!: Date;
}

export class PrescriptionResponseDto {
  @ApiProperty({ description: 'Prescription database ID', example: '1' })
  id!: string;

  @ApiPropertyOptional({ description: 'Human-readable unique prescription number', example: 'RX-20261124-0001' })
  prescriptionNumber?: string | null;

  @ApiPropertyOptional({ description: 'Linked consultation ID', example: '1' })
  consultationId?: string | null;

  @ApiPropertyOptional({ description: 'Organization database ID', example: '1' })
  organizationId?: string | null;

  @ApiPropertyOptional({ description: 'Branch database ID', example: '1' })
  branchId?: string | null;

  @ApiProperty({ description: 'Patient database ID', example: '1' })
  patientId!: string;

  @ApiProperty({ description: 'Doctor database ID', example: '1' })
  doctorId!: string;

  @ApiProperty({ description: 'Prescription date (YYYY-MM-DD)', example: '2026-10-30' })
  date!: string;

  @ApiPropertyOptional({ description: 'Presenting symptoms', example: 'Dry cough and fever' })
  symptom?: string | null;

  @ApiPropertyOptional({ description: 'Medical advice', example: 'Rest adequately' })
  advice?: string | null;

  @ApiProperty({ description: 'Prescription lifecycle status', example: 'SIGNED', default: 'DRAFT' })
  status!: string;

  @ApiPropertyOptional({ description: 'Prescription legacy status', example: 'issued' })
  state?: string | null;

  @ApiPropertyOptional({ description: 'Differential diagnosis', example: 'URTI' })
  dd?: string | null;

  @ApiPropertyOptional({ description: 'Legacy readable medicine summary', example: 'Amoxil 1+0+1 for 5 days' })
  medicine?: string | null;

  @ApiPropertyOptional({ description: 'Validity duration', example: '30 days' })
  validity?: string | null;

  @ApiPropertyOptional({ description: 'Doctor notes', example: 'Follow up in 5 days' })
  note?: string | null;

  @ApiPropertyOptional({ description: 'Digital signature timestamp', example: '2026-11-24T10:00:00.000Z' })
  signedAt?: Date | null;

  @ApiPropertyOptional({ description: 'Signing user ID', example: '1' })
  signedById?: string | null;

  @ApiPropertyOptional({ type: () => UserBriefDto })
  signedBy?: UserBriefDto | null;

  @ApiPropertyOptional({ description: 'Cancellation timestamp', example: '2026-11-24T12:00:00.000Z' })
  cancelledAt?: Date | null;

  @ApiPropertyOptional({ description: 'Cancelling user ID', example: '1' })
  cancelledById?: string | null;

  @ApiPropertyOptional({ type: () => UserBriefDto })
  cancelledBy?: UserBriefDto | null;

  @ApiPropertyOptional({ description: 'Reason for prescription cancellation', example: 'Suspected allergy' })
  cancellationReason?: string | null;

  @ApiPropertyOptional({ type: () => PatientBriefDto })
  patient?: PatientBriefDto;

  @ApiPropertyOptional({ type: () => DoctorBriefDto })
  doctor?: DoctorBriefDto;

  @ApiProperty({ type: [PrescriptionItemResponseDto] })
  items!: PrescriptionItemResponseDto[];

  @ApiPropertyOptional({ type: [PrescriptionAmendmentResponseDto] })
  amendments?: PrescriptionAmendmentResponseDto[];

  @ApiPropertyOptional({ description: 'Clinical allergy alerts detected during prescribing', example: ['Warning: Patient allergy status is UNKNOWN.'] })
  allergyAlerts?: string[];

  @ApiPropertyOptional({ description: 'Patient allergy status at time of prescribing', example: 'UNKNOWN' })
  allergyStatus?: string;

  @ApiPropertyOptional({ description: 'Creation timestamp', example: '2026-10-30T10:00:00.000Z' })
  createdAt?: Date | null;

  @ApiPropertyOptional({ description: 'Last update timestamp', example: '2026-10-30T10:00:00.000Z' })
  updatedAt?: Date | null;
}

export class PaginatedPrescriptionsDto {
  @ApiProperty({ type: [PrescriptionResponseDto] })
  data!: PrescriptionResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  limit!: number;

  @ApiProperty({ example: 2 })
  totalPages!: number;
}

export class MedicineSearchResultDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Amoxil' })
  name!: string;

  @ApiPropertyOptional({ example: 'Amoxicillin' })
  generic?: string | null;

  @ApiPropertyOptional({ example: 'GSK' })
  company?: string | null;

  @ApiProperty({ example: 50 })
  quantity!: number;
}

export class PrescriptionPrintoutDto {
  @ApiProperty({ type: PrescriptionResponseDto })
  prescription!: PrescriptionResponseDto;

  @ApiProperty({
    example: {
      name: 'Central Hospital',
      branchName: 'Main Branch',
      address: '123 Health Ave',
      phone: '+1 234 567 890',
      logoUrl: '/logo.png',
    },
  })
  organization!: {
    name: string;
    branchName?: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
  };
}
