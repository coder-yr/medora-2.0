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
}

export class DoctorBriefDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Dr Nadia Aslam' })
  name!: string;

  @ApiPropertyOptional({ example: 'Cardiology' })
  department?: string | null;
}

export class PrescriptionResponseDto {
  @ApiProperty({ description: 'Prescription database ID', example: '1' })
  id!: string;

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

  @ApiPropertyOptional({ description: 'Prescription status', example: 'issued' })
  state?: string | null;

  @ApiPropertyOptional({ description: 'Differential diagnosis', example: 'URTI' })
  dd?: string | null;

  @ApiPropertyOptional({ description: 'Legacy readable medicine summary', example: 'Amoxil 1+0+1 for 5 days' })
  medicine?: string | null;

  @ApiPropertyOptional({ description: 'Validity duration', example: '30 days' })
  validity?: string | null;

  @ApiPropertyOptional({ description: 'Doctor notes', example: 'Follow up in 5 days' })
  note?: string | null;

  @ApiPropertyOptional({ type: () => PatientBriefDto })
  patient?: PatientBriefDto;

  @ApiPropertyOptional({ type: () => DoctorBriefDto })
  doctor?: DoctorBriefDto;

  @ApiProperty({ type: [PrescriptionItemResponseDto] })
  items!: PrescriptionItemResponseDto[];

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
