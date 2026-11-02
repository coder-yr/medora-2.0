import {
  IsNumber,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsString,
  IsDateString,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRadiologyOrderDto {
  @ApiProperty({ description: 'Target Patient ID' })
  @IsNumber()
  @IsNotEmpty()
  patientId!: number;

  @ApiPropertyOptional({ description: 'Requesting Doctor ID' })
  @IsNumber()
  @IsOptional()
  doctorId?: number;

  @ApiPropertyOptional({ description: 'Associated OPD appointment ID' })
  @IsNumber()
  @IsOptional()
  appointmentId?: number;

  @ApiPropertyOptional({ description: 'Associated Consultation ID' })
  @IsNumber()
  @IsOptional()
  consultationId?: number;

  @ApiProperty({ description: 'List of RadiologyExam IDs to order', type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  examIds!: number[];

  @ApiPropertyOptional({ description: 'Is exam urgent / STAT' })
  @IsBoolean()
  @IsOptional()
  urgent?: boolean;

  @ApiPropertyOptional({ description: 'Urgency tier: routine, urgent, stat', default: 'routine' })
  @IsString()
  @IsOptional()
  urgency?: string;

  @ApiPropertyOptional({ description: 'Clinical indications and provisional diagnosis notes' })
  @IsString()
  @IsOptional()
  clinicalNotes?: string;

  @ApiPropertyOptional({ description: 'Clinical indication alias' })
  @IsString()
  @IsOptional()
  clinicalIndication?: string;

  @ApiPropertyOptional({ description: 'Auto-generate itemized invoice in Billing Module', default: false })
  @IsBoolean()
  @IsOptional()
  bill?: boolean;

  @ApiPropertyOptional({ description: 'Immediate scheduled date and time' })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Equipment room / scanner suite' })
  @IsString()
  @IsOptional()
  equipmentRoom?: string;

  @ApiPropertyOptional({ description: 'Optional Active Admission ID for inpatient folio posting', example: 1 })
  @IsNumber()
  @IsOptional()
  admissionId?: number;
}

export class ScheduleRadiologyOrderDto {
  @ApiProperty({ description: 'Appointment datetime (ISO format)' })
  @IsDateString()
  @IsNotEmpty()
  scheduledAt!: string;

  @ApiPropertyOptional({ description: 'Assigned Technologist / Radiographer user ID' })
  @IsNumber()
  @IsOptional()
  technologistId?: number;

  @ApiPropertyOptional({ description: 'Designated scanner room or bay (e.g. "CT Suite 1", "US Bay 2")' })
  @IsString()
  @IsOptional()
  equipmentRoom?: string;

  @ApiPropertyOptional({ description: 'Scheduling notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Force booking even if room conflict exists (e.g. for emergency STAT override)', default: false })
  @IsBoolean()
  @IsOptional()
  forceConflict?: boolean;
}

export class CancelRadiologyOrderDto {
  @ApiProperty({ description: 'Mandatory clinical or administrative cancellation reason' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
