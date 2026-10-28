import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'arrived',
  'in consultation',
  'completed',
  'cancelled',
  'no show',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export class CreateAppointmentDto {
  @ApiProperty({
    description: 'Patient ID (numeric primary key or formatted MRN)',
    example: '1',
  })
  @IsNotEmpty({ message: 'Patient is required.' })
  patient!: string | number;

  @ApiProperty({
    description: 'Doctor ID (numeric primary key)',
    example: '1',
  })
  @IsNotEmpty({ message: 'Doctor is required.' })
  doctor!: string | number;

  @ApiProperty({
    description: 'Appointment date (YYYY-MM-DD)',
    example: '2026-10-01',
  })
  @IsNotEmpty({ message: 'Date is required.' })
  @IsDateString({}, { message: 'Date must be a valid YYYY-MM-DD date.' })
  date!: string;

  @ApiProperty({
    description: 'Start time in 24-hour HH:mm format',
    example: '09:00',
  })
  @IsNotEmpty({ message: 'Start time is required.' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Start time must be in HH:mm 24-hour format (e.g. 09:00).',
  })
  start!: string;

  @ApiPropertyOptional({
    description: 'Duration in minutes (default 15, between 5 and 480)',
    example: 30,
    default: 15,
  })
  @IsOptional()
  @IsInt({ message: 'Minutes must be an integer.' })
  @Min(5, { message: 'Duration must be at least 5 minutes.' })
  @Max(480, { message: 'Duration cannot exceed 480 minutes (8 hours).' })
  minutes?: number;

  @ApiPropertyOptional({
    description: 'Appointment status',
    enum: APPOINTMENT_STATUSES,
    default: 'scheduled',
  })
  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES as any, {
    message: `Status must be one of: ${APPOINTMENT_STATUSES.join(', ')}`,
  })
  status?: AppointmentStatus;

  @ApiPropertyOptional({
    description: 'Remarks or clinical notes',
    example: 'Follow-up consultation for hypertension',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @ApiPropertyOptional({
    description: 'Blood pressure reading',
    example: '120/80',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  b_p?: string;

  @ApiPropertyOptional({
    description: 'Pulse rate (bpm)',
    example: '72',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pulse?: string;

  @ApiPropertyOptional({
    description: 'Body temperature',
    example: '98.6 F',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  temprature?: string;

  @ApiPropertyOptional({
    description: 'Body weight',
    example: '70 kg',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  weight?: string;

  @ApiPropertyOptional({
    description: 'Whether this is a telemedicine video consultation',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  video?: boolean;

  @ApiPropertyOptional({
    description: 'Visit type classification',
    example: 'first_visit',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  visitType?: string;

  @ApiPropertyOptional({
    description: 'Branch ID',
    example: '1',
  })
  @IsOptional()
  branchId?: string | number;
}
