import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const ALLOWED_STAFF_ROLES = [
  'Admin',
  'Doctor',
  'Nurse',
  'Accountant',
  'Receptionist',
  'Pharmacist',
  'Laboratorist',
  'Radiologist',
  'Cashier',
  'HR',
] as const;

export type AllowedStaffRole = (typeof ALLOWED_STAFF_ROLES)[number];

export class InviteStaffDto {
  @ApiProperty({ example: 'dr.farooq@alshifa.hospital' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'Dr. Farooq Qureshi' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Doctor', enum: ALLOWED_STAFF_ROLES })
  @IsString()
  @IsNotEmpty()
  role!: AllowedStaffRole;

  @ApiProperty({ example: '1', required: false })
  @IsString()
  @IsOptional()
  branchId?: string;
}

export class UpdateStaffRoleDto {
  @ApiProperty({ example: 'Doctor', enum: ALLOWED_STAFF_ROLES })
  @IsString()
  @IsNotEmpty()
  role!: AllowedStaffRole;
}

export class UpdateStaffStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({ example: 'Staff member placed on medical leave', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AssignStaffBranchesDto {
  @ApiProperty({ example: ['1', '2'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  branchIds!: string[];
}
