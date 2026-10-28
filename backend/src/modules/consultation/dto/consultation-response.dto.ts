import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConsultationPatientSummaryDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '000050' })
  patientId!: string;

  @ApiProperty({ example: 'Nazish Saba' })
  name!: string;

  @ApiPropertyOptional({ example: 'female' })
  sex?: string | null;

  @ApiPropertyOptional({ example: '30' })
  age?: string | null;

  @ApiPropertyOptional({ example: '+923001234567' })
  phone?: string | null;
}

export class ConsultationDoctorSummaryDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Dr Saman' })
  name!: string;

  @ApiPropertyOptional({ example: 'General OPD' })
  department?: string | null;
}

export class ConsultationVisitSummaryDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '2026-10-01' })
  date!: string;

  @ApiProperty({ example: '11:00 - 11:15' })
  timeSlot!: string;

  @ApiProperty({ example: 'in consultation' })
  status!: string;

  @ApiPropertyOptional({ example: '120/80' })
  bp?: string | null;

  @ApiPropertyOptional({ example: '72' })
  pulse?: string | null;

  @ApiPropertyOptional({ example: '98.6 F' })
  temperature?: string | null;

  @ApiPropertyOptional({ example: '70' })
  weight?: string | null;
}

export class ConsultationResponseDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiPropertyOptional({ example: '1' })
  appointmentId?: string | null;

  @ApiProperty({ example: '1' })
  patientId!: string;

  @ApiPropertyOptional({ example: '1' })
  doctorId?: string | null;

  @ApiProperty({ example: '2026-10-01' })
  date!: string;

  @ApiPropertyOptional({ example: 'Fever for 3 days' })
  presentingComplaint?: string | null;

  @ApiPropertyOptional({ example: 'Detailed history' })
  history?: string | null;

  @ApiPropertyOptional()
  examination?: any | null;

  @ApiPropertyOptional({ example: 'Viral fever' })
  provisionalDiagnosis?: string | null;

  @ApiPropertyOptional({ example: 'Acute URTI' })
  diagnosis?: string | null;

  @ApiPropertyOptional({ example: 'Paracetamol 500mg TDS' })
  plan?: string | null;

  @ApiPropertyOptional({ example: 'Rest, fluids' })
  treatment?: string | null;

  @ApiPropertyOptional({ example: '2026-11-05' })
  followUpDate?: string | null;

  @ApiPropertyOptional({ example: 'Review if fever > 48h' })
  followUpNotes?: string | null;

  @ApiPropertyOptional({ example: 'Penicillin: rash' })
  allergies?: string | null;

  @ApiPropertyOptional()
  pastHistory?: any | null;

  @ApiPropertyOptional()
  socialHistory?: any | null;

  @ApiPropertyOptional()
  specialty?: any | null;

  @ApiPropertyOptional()
  immunizations?: any | null;

  @ApiProperty({ example: 'completed' })
  status!: string;

  @ApiPropertyOptional()
  completedAt?: string | null;

  @ApiPropertyOptional({ example: '1' })
  createdBy?: string | null;

  @ApiPropertyOptional({ type: () => ConsultationPatientSummaryDto })
  patient?: ConsultationPatientSummaryDto;

  @ApiPropertyOptional({ type: () => ConsultationDoctorSummaryDto })
  doctor?: ConsultationDoctorSummaryDto;

  @ApiPropertyOptional({ type: () => ConsultationVisitSummaryDto })
  visit?: ConsultationVisitSummaryDto;

  @ApiPropertyOptional()
  createdAt?: string | null;

  @ApiPropertyOptional()
  updatedAt?: string | null;
}

export class ConsultTemplateResponseDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Viral fever' })
  name!: string;

  @ApiPropertyOptional({ example: '1' })
  doctorId?: string | null;

  @ApiProperty({ example: { plan: 'Paracetamol, fluids' } })
  fields!: any;

  @ApiPropertyOptional()
  createdAt?: string | null;
}

export class VisitConsultationContextDto {
  @ApiProperty({ type: () => ConsultationResponseDto })
  consultation!: ConsultationResponseDto;

  @ApiProperty({ type: () => ConsultationVisitSummaryDto })
  visit!: ConsultationVisitSummaryDto;

  @ApiProperty({ type: () => ConsultationPatientSummaryDto })
  patient!: ConsultationPatientSummaryDto;

  @ApiPropertyOptional({ type: () => ConsultationDoctorSummaryDto })
  doctor?: ConsultationDoctorSummaryDto;

  @ApiProperty({ type: [ConsultationResponseDto] })
  previous!: ConsultationResponseDto[];

  @ApiProperty({ type: [ConsultTemplateResponseDto] })
  templates!: ConsultTemplateResponseDto[];
}

export class PaginatedConsultationsDto {
  @ApiProperty({ type: [ConsultationResponseDto] })
  data!: ConsultationResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}
