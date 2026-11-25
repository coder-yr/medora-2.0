import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PrescriptionItemDto {
  @ApiPropertyOptional({
    description: 'Catalog medicine ID if selected from hospital inventory',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  medicineId?: number;

  @ApiPropertyOptional({
    description: 'Medicine or drug name. If medicineId is provided, resolved automatically from catalog if blank.',
    example: 'Amoxil 500mg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    description: 'Dosage regimen (e.g. 1+0+1, 500mg TDS, 1 tab twice daily)',
    example: '1+0+1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dosage?: string;

  @ApiPropertyOptional({
    description: 'Treatment duration (e.g. 5 days, 2 weeks, 1 month)',
    example: '5 days',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  duration?: string;

  @ApiPropertyOptional({
    description: 'Special administration instructions (e.g. after meals, with water)',
    example: 'Take after meals',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  @ApiPropertyOptional({
    description: 'Prescribed quantity',
    example: 10,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  quantityPrescribed?: number;

  @ApiPropertyOptional({
    description: 'Dose unit (tablets, capsules, ml, etc.)',
    example: 'tablets',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;

  @ApiPropertyOptional({
    description: 'Route of administration (oral, IV, IM, topical, etc.)',
    example: 'oral',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  route?: string;

  @ApiPropertyOptional({
    description: 'Administration frequency (OD, BD, TDS, QID, PRN)',
    example: 'BD (Twice Daily)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  frequency?: string;

  @ApiPropertyOptional({
    description: 'Meal / timing instructions (Before food, After food, With food)',
    example: 'After food',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timing?: string;

  @ApiPropertyOptional({
    description: 'Permitted refills count',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  refills?: number;

  @ApiPropertyOptional({
    description: 'Therapy start date (YYYY-MM-DD)',
    example: '2026-11-24',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Therapy end date (YYYY-MM-DD)',
    example: '2026-11-29',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  endDate?: string;
}

export class CreatePrescriptionDto {
  @ApiProperty({
    description: 'Hospital patient database ID',
    example: 1,
  })
  @IsNotEmpty({ message: 'Patient ID is required.' })
  @IsInt()
  patientId!: number;

  @ApiProperty({
    description: 'Prescribing doctor database ID',
    example: 1,
  })
  @IsNotEmpty({ message: 'Doctor ID is required.' })
  @IsInt()
  doctorId!: number;

  @ApiProperty({
    description: 'Prescription date in YYYY-MM-DD format',
    example: '2026-10-30',
  })
  @IsNotEmpty({ message: 'Prescription date is required.' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    description: 'Reported patient symptoms or clinical presentation',
    example: 'Persistent dry cough and mild fever for 3 days',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  symptom?: string;

  @ApiPropertyOptional({
    description: 'Doctor medical advice or lifestyle guidance',
    example: 'Rest adequately and increase fluid intake',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  advice?: string;

  @ApiPropertyOptional({
    description: 'Clinical notes or dispensing instructions',
    example: 'Review if fever persists past 48 hours',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({
    description: 'Prescription validity timeframe',
    example: '30 days',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  validity?: string;

  @ApiPropertyOptional({
    description: 'Prescription lifecycle state',
    example: 'issued',
    default: 'issued',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  state?: string;

  @ApiPropertyOptional({
    description: 'Differential diagnosis or diagnostic code',
    example: 'Upper Respiratory Tract Infection',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dd?: string;

  @ApiProperty({
    description: 'List of prescribed medication items. Must contain at least one valid medication.',
    type: [PrescriptionItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items!: PrescriptionItemDto[];

  @ApiPropertyOptional({ description: 'Branch ID', example: '1' })
  @IsOptional()
  @Allow()
  branchId?: string | number;

  @ApiPropertyOptional({ description: 'Branch ID (snake_case alias)', example: '1' })
  @IsOptional()
  @Allow()
  branch_id?: string | number;

  @ApiPropertyOptional({ description: 'Linked consultation ID', example: 1 })
  @IsOptional()
  @IsInt()
  consultationId?: number;

  @ApiPropertyOptional({ description: 'Prescription lifecycle status (DRAFT, SIGNED)', example: 'SIGNED', default: 'DRAFT' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional({ description: 'Sign the prescription immediately upon creation', example: true, default: false })
  @IsOptional()
  signImmediately?: boolean;
}
