import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QueuePatientSummaryDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '000001' })
  patientId!: string;

  @ApiProperty({ example: 'Amina Yousaf' })
  name!: string;

  @ApiPropertyOptional({ example: '03001234567' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Penicillin' })
  allergies?: string | null;
}

export class QueueDoctorSummaryDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Dr. Tariq Khan' })
  name!: string;

  @ApiPropertyOptional({ example: 'General Medicine' })
  department?: string | null;
}

export class QueueItemDto {
  @ApiProperty({ example: '1' })
  appointmentId!: string;

  @ApiProperty({ example: 1 })
  queuePosition!: number;

  @ApiProperty({ example: 'Q-01' })
  tokenNumber!: string;

  @ApiProperty({ example: 'NORMAL' })
  priority!: string;

  @ApiProperty({ example: 'waiting' })
  status!: string;

  @ApiProperty({ example: '2026-11-23T10:00:00.000Z' })
  checkedInAt!: string;

  @ApiPropertyOptional()
  calledInAt?: string | null;

  @ApiPropertyOptional()
  consultStartedAt?: string | null;

  @ApiProperty({ example: 15, description: 'Waiting time in minutes from check-in' })
  waitingMinutes!: number;

  @ApiProperty({ type: QueuePatientSummaryDto })
  patient!: QueuePatientSummaryDto;

  @ApiProperty({ type: QueueDoctorSummaryDto })
  doctor!: QueueDoctorSummaryDto;

  @ApiPropertyOptional({ example: '1' })
  branchId?: string | null;

  @ApiPropertyOptional({ example: 'walk_in' })
  visitType?: string | null;

  @ApiProperty({ example: '10:00 - 10:15' })
  timeSlot!: string;

  @ApiPropertyOptional({ example: 'Acute cough and cold' })
  remarks?: string | null;
}

export class QueueSummaryDto {
  @ApiProperty({ example: 5 })
  totalWaiting!: number;

  @ApiProperty({ example: 1 })
  totalInConsultation!: number;

  @ApiProperty({ example: 12 })
  totalCompletedToday!: number;

  @ApiProperty({ example: 18, description: 'Average wait duration in minutes today' })
  averageWaitMinutes!: number;
}

export class OpdQueueResponseDto {
  @ApiProperty({ type: QueueSummaryDto })
  summary!: QueueSummaryDto;

  @ApiProperty({ type: [QueueItemDto] })
  items!: QueueItemDto[];
}
