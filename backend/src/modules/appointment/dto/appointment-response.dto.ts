import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PatientSummaryDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '000001' })
  patientId!: string;

  @ApiProperty({ example: 'Amina Yousaf' })
  name!: string;

  @ApiPropertyOptional({ example: '+923001234567' })
  phone?: string | null;
}

export class DoctorSummaryDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Dr Nadia Aslam' })
  name!: string;

  @ApiPropertyOptional({ example: 'Cardiology' })
  department?: string | null;
}

export class AppointmentResponseDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '1' })
  patientId!: string;

  @ApiProperty({ example: '1' })
  doctorId!: string;

  @ApiProperty({ example: '2026-10-01' })
  date!: string;

  @ApiProperty({ example: '09:00 - 09:30' })
  timeSlot!: string;

  @ApiProperty({ example: '2026-10-01 09:00:00' })
  sTime!: string;

  @ApiProperty({ example: '2026-10-01 09:30:00' })
  eTime!: string;

  @ApiProperty({ example: '202610010900' })
  sTimeKey!: string;

  @ApiProperty({ example: 'scheduled' })
  status!: string;

  @ApiPropertyOptional({ example: 'Routine consultation' })
  remarks?: string | null;

  @ApiProperty({ example: 'in_person' })
  mode!: string;

  @ApiPropertyOptional({ example: 'icthospital-a1b2c3d4e5f6' })
  videoRoom?: string | null;

  @ApiPropertyOptional({ example: 'https://meet.jit.si/icthospital-a1b2c3d4e5f6' })
  videoUrl?: string | null;

  @ApiPropertyOptional({ example: '1' })
  branchId?: string | null;

  @ApiPropertyOptional({ example: '120/80' })
  bp?: string | null;

  @ApiPropertyOptional({ example: '72' })
  pulse?: string | null;

  @ApiPropertyOptional({ example: '98.6 F' })
  temperature?: string | null;

  @ApiPropertyOptional({ example: '70 kg' })
  weight?: string | null;

  @ApiPropertyOptional({ example: 'first_visit' })
  visitType?: string | null;

  @ApiProperty({ type: () => PatientSummaryDto })
  patient?: PatientSummaryDto;

  @ApiProperty({ type: () => DoctorSummaryDto })
  doctor?: DoctorSummaryDto;

  @ApiPropertyOptional()
  createdAt?: string | null;

  @ApiPropertyOptional()
  updatedAt?: string | null;
}

export class PaginatedAppointmentsDto {
  @ApiProperty({ type: [AppointmentResponseDto] })
  data!: AppointmentResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class FreeSlotDto {
  @ApiProperty({ example: '09:00' })
  start!: string;

  @ApiProperty({ example: 15 })
  minutes!: number;
}
