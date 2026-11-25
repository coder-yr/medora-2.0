import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EncounterAppointmentDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '2026-11-23' })
  date!: string;

  @ApiPropertyOptional({ example: '10:00 AM' })
  time?: string | null;

  @ApiPropertyOptional({ example: 'Dr. Tariq Khan' })
  doctorName?: string | null;

  @ApiProperty({ example: 'CONFIRMED' })
  status!: string;

  @ApiPropertyOptional({ example: 'ROUTINE' })
  type?: string | null;
}

export class EncounterConsultationDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '2026-11-23T10:30:00.000Z' })
  date!: string;

  @ApiPropertyOptional({ example: 'Dr. Tariq Khan' })
  doctorName?: string | null;

  @ApiPropertyOptional({ example: 'Acute Pharyngitis' })
  diagnosis?: string | null;

  @ApiPropertyOptional({ example: 'Sore throat, fever for 3 days' })
  symptoms?: string | null;

  @ApiPropertyOptional({ example: 'Prescribed antibiotics and rest' })
  notes?: string | null;

  @ApiProperty({ example: 'COMPLETED' })
  status!: string;
}

export class EncounterPrescriptionDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '2026-11-23' })
  date!: string;

  @ApiPropertyOptional({ example: 'Dr. Tariq Khan' })
  doctorName?: string | null;

  @ApiProperty({ example: 2 })
  itemCount!: number;

  @ApiProperty({ example: ['Amoxicillin 500mg', 'Paracetamol 500mg'] })
  medicines!: string[];
}

export class EncounterLabDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '2026-11-23' })
  date!: string;

  @ApiPropertyOptional({ example: 'Complete Blood Count (CBC)' })
  testName?: string | null;

  @ApiProperty({ example: 'COMPLETED' })
  status!: string;
}

export class EncounterInvoiceDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '2026-11-23' })
  date!: string;

  @ApiProperty({ example: 1500 })
  amount!: number;

  @ApiProperty({ example: 1500 })
  paidAmount!: number;

  @ApiProperty({ example: 'PAID' })
  status!: string;
}

export class EncounterSummaryDto {
  @ApiProperty({ example: 4 })
  totalAppointments!: number;

  @ApiProperty({ example: 3 })
  totalConsultations!: number;

  @ApiProperty({ example: 3 })
  totalPrescriptions!: number;

  @ApiProperty({ example: 2 })
  totalLabs!: number;

  @ApiProperty({ example: 4500 })
  totalInvoiced!: number;

  @ApiProperty({ example: 0 })
  outstandingBalance!: number;
}

export class PatientEncounterResponseDto {
  @ApiProperty({ example: '1' })
  patientId!: string;

  @ApiProperty({ type: EncounterSummaryDto })
  summary!: EncounterSummaryDto;

  @ApiProperty({ type: [EncounterAppointmentDto] })
  appointments!: EncounterAppointmentDto[];

  @ApiProperty({ type: [EncounterConsultationDto] })
  consultations!: EncounterConsultationDto[];

  @ApiProperty({ type: [EncounterPrescriptionDto] })
  prescriptions!: EncounterPrescriptionDto[];

  @ApiProperty({ type: [EncounterLabDto] })
  labs!: EncounterLabDto[];

  @ApiProperty({ type: [EncounterInvoiceDto] })
  invoices!: EncounterInvoiceDto[];
}
