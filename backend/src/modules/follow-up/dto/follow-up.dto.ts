import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FollowUpPriority {
  ROUTINE = 'ROUTINE',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL',
}

export enum FollowUpStatus {
  SCHEDULED = 'SCHEDULED',
  REMINDER_PENDING = 'REMINDER_PENDING',
  REMINDER_SENT = 'REMINDER_SENT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  MISSED = 'MISSED',
}

export enum ReminderPreference {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  NONE = 'NONE',
}

export class CreateFollowUpDto {
  @ApiProperty({ description: 'Target patient ID' })
  @IsNotEmpty()
  patientId!: string | number;

  @ApiProperty({ description: 'Responsible doctor ID' })
  @IsNotEmpty()
  doctorId!: string | number;

  @ApiPropertyOptional({ description: 'Optional consultation link' })
  @IsOptional()
  consultationId?: string | number;

  @ApiPropertyOptional({ description: 'Branch ID (defaults to active user branch)' })
  @IsOptional()
  branchId?: string | number;

  @ApiProperty({ description: 'Due date for follow-up (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ description: 'Optional preferred time slot (HH:mm)' })
  @IsOptional()
  @IsString()
  dueTime?: string;

  @ApiProperty({ description: 'Clinical reason for follow-up evaluation' })
  @IsNotEmpty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ enum: FollowUpPriority, default: FollowUpPriority.ROUTINE })
  @IsOptional()
  @IsEnum(FollowUpPriority)
  priority?: FollowUpPriority;

  @ApiPropertyOptional({ description: 'Internal clinical instructions / notes' })
  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @ApiPropertyOptional({ enum: ReminderPreference, default: ReminderPreference.IN_APP })
  @IsOptional()
  @IsEnum(ReminderPreference)
  reminderPreference?: ReminderPreference;
}

export class UpdateFollowUpDto {
  @ApiPropertyOptional({ description: 'Due date for follow-up (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Optional preferred time slot (HH:mm)' })
  @IsOptional()
  @IsString()
  dueTime?: string;

  @ApiPropertyOptional({ description: 'Clinical reason for follow-up evaluation' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ enum: FollowUpPriority })
  @IsOptional()
  @IsEnum(FollowUpPriority)
  priority?: FollowUpPriority;

  @ApiPropertyOptional({ description: 'Internal clinical instructions / notes' })
  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @ApiPropertyOptional({ enum: ReminderPreference })
  @IsOptional()
  @IsEnum(ReminderPreference)
  reminderPreference?: ReminderPreference;
}

export class CompleteFollowUpDto {
  @ApiPropertyOptional({ description: 'Completion notes or consultation summary' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelFollowUpDto {
  @ApiProperty({ description: 'Reason for cancellation' })
  @IsNotEmpty()
  @IsString()
  reason!: string;
}

export class QueryFollowUpDto {
  @ApiPropertyOptional({ description: 'Filter by patient ID' })
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Filter by doctor ID' })
  @IsOptional()
  doctorId?: string;

  @ApiPropertyOptional({ description: 'Filter by branch ID' })
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ enum: FollowUpStatus })
  @IsOptional()
  @IsEnum(FollowUpStatus)
  status?: FollowUpStatus;

  @ApiPropertyOptional({ enum: FollowUpPriority })
  @IsOptional()
  @IsEnum(FollowUpPriority)
  priority?: FollowUpPriority;

  @ApiPropertyOptional({ description: 'Start date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
