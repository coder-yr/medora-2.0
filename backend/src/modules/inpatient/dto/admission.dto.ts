import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export const ADMISSION_STATUSES = [
  'PENDING',
  'ADMITTED',
  'TRANSFERRED',
  'DISCHARGE_PENDING',
  'DISCHARGED',
  'CANCELLED',
] as const;

export type AdmissionStatusType = typeof ADMISSION_STATUSES[number];

export const ADMISSION_TYPES = [
  'ELECTIVE',
  'EMERGENCY',
  'TRANSFER',
  'URGENT',
  'OBSERVATION',
] as const;

export class CreateAdmissionDto {
  @ApiProperty({ description: 'Patient ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  patientId!: number;

  @ApiProperty({ description: 'Target Bed ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  bedId!: number;

  @ApiPropertyOptional({ description: 'Optional Ward ID' })
  @IsOptional()
  @IsNumber()
  wardId?: number;

  @ApiPropertyOptional({ description: 'Attending Doctor ID', example: 2 })
  @IsOptional()
  @IsNumber()
  attendingDoctorId?: number;

  @ApiPropertyOptional({ description: 'Admitting Doctor ID', example: 2 })
  @IsOptional()
  @IsNumber()
  admittingDoctorId?: number;

  @ApiPropertyOptional({ description: 'Admission timestamp (ISO string, defaults to now)', example: '2026-11-02T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiPropertyOptional({ description: 'Expected discharge date (ISO string)', example: '2026-11-06T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  expectedDischargeDate?: string;

  @ApiPropertyOptional({ description: 'Admission Type', enum: ADMISSION_TYPES, default: 'ELECTIVE' })
  @IsOptional()
  @IsIn(ADMISSION_TYPES)
  admissionType?: string;

  @ApiPropertyOptional({ description: 'Admission Reason', example: 'Acute abdominal pain, query appendicitis' })
  @IsOptional()
  @IsString()
  admissionReason?: string;

  @ApiPropertyOptional({ description: 'Provisional Diagnosis', example: 'Acute Appendicitis' })
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional({ description: 'Initial Clinical Notes', example: 'Admitted via Emergency. Vitals stable. NPO ordered.' })
  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @ApiPropertyOptional({ description: 'Hospital branch ID' })
  @IsOptional()
  @IsNumber()
  branchId?: number;
}

export class UpdateAdmissionDto {
  @ApiPropertyOptional({ description: 'Attending Doctor ID' })
  @IsOptional()
  @IsNumber()
  attendingDoctorId?: number;

  @ApiPropertyOptional({ description: 'Expected discharge date' })
  @IsOptional()
  @IsDateString()
  expectedDischargeDate?: string;

  @ApiPropertyOptional({ description: 'Admission Type', enum: ADMISSION_TYPES })
  @IsOptional()
  @IsIn(ADMISSION_TYPES)
  admissionType?: string;

  @ApiPropertyOptional({ description: 'Admission Reason' })
  @IsOptional()
  @IsString()
  admissionReason?: string;

  @ApiPropertyOptional({ description: 'Diagnosis' })
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional({ description: 'Clinical Notes' })
  @IsOptional()
  @IsString()
  clinicalNotes?: string;
}

export class CancelAdmissionDto {
  @ApiProperty({ description: 'Cancellation reason', example: 'Patient refused admission / transferred out prior to bed occupancy' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
