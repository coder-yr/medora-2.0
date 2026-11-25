import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePatientDto } from '../../patient/dto/create-patient.dto';
import { APPOINTMENT_PRIORITIES, AppointmentPriority } from './create-appointment.dto';

export class WalkInAppointmentDto {
  @ApiPropertyOptional({
    description: 'Existing patient ID or 6-digit patientId MRN',
    example: '1',
  })
  @IsOptional()
  patient?: string | number;

  @ApiPropertyOptional({
    description: 'Inline registration object for registering a new walk-in patient on the fly',
    type: CreatePatientDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePatientDto)
  newPatient?: CreatePatientDto;

  @ApiProperty({
    description: 'Assigned doctor ID',
    example: '1',
  })
  @IsNotEmpty({ message: 'Doctor is required.' })
  doctor!: string | number;

  @ApiPropertyOptional({
    description: 'Medical department name',
    example: 'General Medicine',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    description: 'Hospital branch ID',
    example: 1,
  })
  @IsOptional()
  branchId?: number;

  @ApiPropertyOptional({
    description: 'Priority level for waiting queue',
    enum: APPOINTMENT_PRIORITIES,
    default: 'NORMAL',
  })
  @IsOptional()
  @IsIn([...APPOINTMENT_PRIORITIES])
  priority?: AppointmentPriority;

  @ApiPropertyOptional({
    description: 'Chief complaint or reason for visit',
    example: 'Acute fever and cough',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Reception / front desk notes',
    example: 'Walk-in arrival at 10:15 AM',
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}
