import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class RescheduleAppointmentDto {
  @ApiProperty({
    description: 'New appointment date (YYYY-MM-DD)',
    example: '2026-10-02',
  })
  @IsNotEmpty({ message: 'New date is required.' })
  @IsDateString({}, { message: 'Date must be a valid YYYY-MM-DD format.' })
  date!: string;

  @ApiProperty({
    description: 'New start time in 24-hour HH:mm format',
    example: '11:00',
  })
  @IsNotEmpty({ message: 'Start time is required.' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Start time must be in HH:mm 24-hour format.',
  })
  start!: string;

  @ApiPropertyOptional({
    description: 'Duration in minutes (default 15)',
    example: 20,
    default: 15,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  minutes?: number;

  @ApiPropertyOptional({
    description: 'Reason for rescheduling the appointment',
    example: 'Patient requested later time slot due to travel delay',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
