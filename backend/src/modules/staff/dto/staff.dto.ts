import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERN = 'INTERN',
  LOCUM = 'LOCUM',
}

export enum StaffStatus {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
  TERMINATED = 'TERMINATED',
}

export class CreateStaffProfileDto {
  @ApiProperty({ description: 'First name', example: 'Grace' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ description: 'Last name', example: 'Hopper' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'Grace Hopper' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Gender', example: 'FEMALE' })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ description: 'Date of birth', example: '1985-12-09' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'National identification number or SSN', example: 'ID-992384' })
  @IsString()
  @IsOptional()
  nationalId?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'grace.hopper@medora.hospital' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Primary phone number', example: '+1-555-0199' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Alternate phone number', example: '+1-555-0198' })
  @IsString()
  @IsOptional()
  alternatePhone?: string;

  @ApiPropertyOptional({ description: 'Physical address', example: 'Suite 404, Hospital Road' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Emergency contact full name', example: 'John Hopper' })
  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @ApiPropertyOptional({ description: 'Emergency contact phone number', example: '+1-555-0100' })
  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ description: 'Employment start / joining date', example: '2026-01-15' })
  @IsDateString()
  @IsOptional()
  joiningDate?: string;

  @ApiPropertyOptional({ enum: EmploymentType, default: EmploymentType.FULL_TIME })
  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ enum: StaffStatus, default: StaffStatus.ACTIVE })
  @IsEnum(StaffStatus)
  @IsOptional()
  employmentStatus?: StaffStatus;

  @ApiPropertyOptional({ description: 'Department ID', example: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  departmentId?: number;

  @ApiPropertyOptional({ description: 'Staff Designation ID', example: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  designationId?: number;

  @ApiPropertyOptional({ description: 'Hospital Branch ID', example: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  branchId?: number;

  @ApiPropertyOptional({ description: 'Reporting Manager Staff ID', example: 2 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  reportingManagerId?: number;

  @ApiPropertyOptional({ description: 'Linked User Account ID', example: 5 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  userId?: number;

  @ApiPropertyOptional({ description: 'Educational and professional qualifications' })
  @IsString()
  @IsOptional()
  qualifications?: string;

  @ApiPropertyOptional({ description: 'Profile image reference URL or file path' })
  @IsString()
  @IsOptional()
  profileImage?: string;
}

export class UpdateStaffProfileDto {
  @ApiPropertyOptional({ description: 'First name' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Display name' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Gender' })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ description: 'Date of birth' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'National ID' })
  @IsString()
  @IsOptional()
  nationalId?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Primary phone' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Alternate phone' })
  @IsString()
  @IsOptional()
  alternatePhone?: string;

  @ApiPropertyOptional({ description: 'Physical address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Emergency contact name' })
  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @ApiPropertyOptional({ description: 'Emergency contact phone' })
  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ description: 'Joining date' })
  @IsDateString()
  @IsOptional()
  joiningDate?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ description: 'Reporting Manager ID' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  reportingManagerId?: number;

  @ApiPropertyOptional({ description: 'Qualifications' })
  @IsString()
  @IsOptional()
  qualifications?: string;

  @ApiPropertyOptional({ description: 'Profile image path' })
  @IsString()
  @IsOptional()
  profileImage?: string;
}

export class StaffQueryDto {
  @ApiPropertyOptional({ description: 'Search query for name, employee number, email, phone' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by Department ID' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  departmentId?: number;

  @ApiPropertyOptional({ description: 'Filter by Staff Designation ID' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  designationId?: number;

  @ApiPropertyOptional({ description: 'Filter by Designation Category (e.g. NURSING, RECEPTION, PHARMACY, LABORATORY, FINANCE)' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by Hospital Branch ID' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  branchId?: number;

  @ApiPropertyOptional({ enum: StaffStatus, description: 'Filter by Employment Status' })
  @IsEnum(StaffStatus)
  @IsOptional()
  employmentStatus?: StaffStatus;

  @ApiPropertyOptional({ enum: EmploymentType, description: 'Filter by Employment Type' })
  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ description: 'Filter by user account linked status: "true" or "false"' })
  @IsString()
  @IsOptional()
  hasUserAccount?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

export class DepartmentTransferDto {
  @ApiProperty({ description: 'Target Department ID to transfer to', example: 2 })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  targetDepartmentId!: number;

  @ApiPropertyOptional({ description: 'Hospital Branch ID if changing branch', example: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  branchId?: number;

  @ApiPropertyOptional({ description: 'Effective start date of transfer', example: '2026-11-03' })
  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: 'Reason for department transfer', example: 'Internal clinical rotation' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Whether this becomes primary department assignment', default: true })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean = true;
}

export class ChangeDesignationDto {
  @ApiProperty({ description: 'Target Designation ID to promote or assign', example: 3 })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  targetDesignationId!: number;

  @ApiPropertyOptional({ description: 'Effective date of designation change', example: '2026-11-03' })
  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: 'Reason for designation change', example: 'Annual promotion to Head Nurse' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class LinkUserDto {
  @ApiProperty({ description: 'User account ID to link to this staff profile', example: 4 })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  userId!: number;
}

export class UpdateStaffStatusDto {
  @ApiProperty({ enum: StaffStatus, description: 'New employment status', example: StaffStatus.ON_LEAVE })
  @IsEnum(StaffStatus)
  @IsNotEmpty()
  status!: StaffStatus;

  @ApiPropertyOptional({ description: 'Reason or comments for status transition', example: 'Maternity leave through Q1' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class OffboardStaffDto {
  @ApiProperty({ description: 'Mandatory reason for staff offboarding', example: 'Contract completed / Resignation' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ description: 'Effective termination / exit date', example: '2026-11-30' })
  @IsDateString()
  @IsOptional()
  offboardingDate?: string;

  @ApiPropertyOptional({ description: 'Whether to immediately revoke active login sessions and disable user account', default: true })
  @IsBoolean()
  @IsOptional()
  deactivateUserAccount?: boolean = true;
}

export class CreateDesignationDto {
  @ApiProperty({ description: 'Unique code for designation', example: 'NURSE-ICU' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Human readable designation title', example: 'Intensive Care Unit Specialist Nurse' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'Designation category (NURSING, RECEPTION, PHARMACY, LABORATORY, FINANCE, ADMINISTRATION, RADIOLOGY)', example: 'NURSING' })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiPropertyOptional({ description: 'Role and responsibilities description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether designation is active for new staff', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
