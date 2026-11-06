import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { HospitalRole } from '../../../common/types/auth-user.interface';

export class RegisterDto {
  @ApiProperty({
    example: 'dr.aisha@medora.hospital',
    description: 'Hospital staff work email address',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: 'ValidPassword123!',
    description: 'Password (minimum 8 characters)',
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password!: string;

  @ApiProperty({
    example: 'Dr. Aisha Khan',
    description: 'Full name of the clinical or administrative staff member',
  })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name!: string;

  @ApiProperty({
    example: 'Doctor',
    enum: ['Admin', 'Doctor', 'Nurse', 'Accountant', 'Receptionist', 'Pharmacist', 'Laboratorist'],
    required: false,
    description: 'Assigned hospital role / department group',
  })
  @IsOptional()
  @IsIn(['Admin', 'Doctor', 'Nurse', 'Accountant', 'Receptionist', 'Pharmacist', 'Laboratorist'], {
    message: 'Role must be one of: Admin, Doctor, Nurse, Accountant, Receptionist, Pharmacist, Laboratorist',
  })
  role?: HospitalRole;

  @ApiProperty({ example: '1', required: false, description: 'Default hospital branch ID' })
  @IsOptional()
  @IsString()
  branchId?: string;
}

