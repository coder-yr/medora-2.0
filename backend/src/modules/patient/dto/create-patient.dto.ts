import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const SEXES = ['male', 'female', 'other'] as const;
export type Sex = (typeof SEXES)[number];

export class CreatePatientDto {
  @ApiProperty({
    example: 'Amina Yousaf',
    description: 'Patient full legal name (Only strictly required field)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Patient name is required' })
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Muhammad Yousaf' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fatherName?: string;

  @ApiPropertyOptional({ example: 'amina@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Must be a valid email address' })
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ example: '03001234567' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  phone?: string;

  @ApiPropertyOptional({ example: 'House 12, Street 4, Sector G-9, Islamabad' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    example: '1990-05-15',
    description: 'Birthdate formatted as YYYY-MM-DD. Age will be derived automatically.',
  })
  @IsOptional()
  @IsString()
  birthdate?: string;

  @ApiPropertyOptional({ example: 'female', enum: SEXES })
  @IsOptional()
  @IsIn(SEXES, { message: 'Sex must be male, female, or other' })
  sex?: Sex;

  @ApiPropertyOptional({ example: 'O+', enum: BLOOD_GROUPS })
  @IsOptional()
  @IsIn(BLOOD_GROUPS, { message: 'Blood group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-' })
  bloodGroup?: BloodGroup;

  @ApiPropertyOptional({ example: 'Dr. Tariq Khan' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  attendingDoctor?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  patientTypeId?: number;

  @ApiPropertyOptional({
    example: '35201-1234567-1',
    description: '13-digit Pakistani CNIC number (written as 12345-1234567-1 or 13 digits)',
  })
  @IsOptional()
  @Matches(/^\d{5}-?\d{7}-?\d$/, {
    message: 'A CNIC must be 13 digits, formatted as 12345-1234567-1',
  })
  cnic?: string;

  @ApiPropertyOptional({ example: 'Father' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  guardianRelation?: string;

  @ApiPropertyOptional({ example: '000045' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  guardianMrn?: string;

  @ApiPropertyOptional({ example: false, description: 'Medico-Legal Case (MLC) flag' })
  @IsOptional()
  @IsBoolean()
  mlc?: boolean;

  @ApiPropertyOptional({ example: 'MRN-OLD-2023' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  oldMrn?: string;

  @ApiPropertyOptional({ example: 'EMP-9082' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeNo?: string;

  @ApiPropertyOptional({ example: '03119876543' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  altPhone?: string;

  @ApiPropertyOptional({ example: 'Islamabad' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  branchId?: number;

  @ApiPropertyOptional({ description: 'Base64 data URL for webcam registration photo' })
  @IsOptional()
  @IsString()
  photoData?: string;
}
