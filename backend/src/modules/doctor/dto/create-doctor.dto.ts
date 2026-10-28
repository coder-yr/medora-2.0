import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateDoctorDto {
  @ApiProperty({
    example: 'Dr Sana Riaz',
    description: 'Doctor full legal/professional name (Only strictly required field)',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Doctor name is required' })
  @IsString()
  @MaxLength(100, { message: 'Doctor name cannot exceed 100 characters' })
  name!: string;

  @ApiPropertyOptional({
    example: 'sana.riaz@medora.hospital',
    description: 'Professional email address. Unique across doctors when provided.',
    maxLength: 100,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address format' })
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ example: '+92 300 1234567', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'Suite 401, Medical Towers, Islamabad', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    example: 'Cardiology',
    description:
      'Specialty or department name (referenced from department catalogue or suggestion list)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional({
    example: 'MBBS, FCPS (Cardiology), 12 years clinical experience',
    description: 'Doctor bio, qualifications, and clinical profile',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  profile?: string;

  @ApiPropertyOptional({ example: 'PROC-CARDIO-01', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  procedureId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  branchId?: number;

  @ApiPropertyOptional({
    example: 'sana.riaz',
    description: 'Optional login username for hospital portal access',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'Use letters, numbers, dots, dashes or underscores for the username.',
  })
  loginUsername?: string;

  @ApiPropertyOptional({
    example: 'SecretPassword123!',
    description: 'Optional login password for portal account (required if username is provided)',
    minLength: 8,
    maxLength: 64,
  })
  @ValidateIf((o) => !!o.loginUsername)
  @IsNotEmpty({ message: 'Enter a password for the new login.' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(64)
  loginPassword?: string;
}
