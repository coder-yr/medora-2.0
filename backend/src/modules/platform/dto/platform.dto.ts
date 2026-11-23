import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsEmail,
  IsArray,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrganizationEdition, OrganizationStatus, OrganizationType, RegistrationStatus } from '@prisma/client';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Al-Shifa Healthcare Center' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'ASH-01' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ enum: OrganizationEdition, default: OrganizationEdition.HOSPITAL })
  @IsEnum(OrganizationEdition)
  @IsOptional()
  edition?: OrganizationEdition;

  @ApiProperty({ example: 'ENTERPRISE', default: 'PROFESSIONAL' })
  @IsString()
  @IsOptional()
  subscriptionTier?: string;

  @ApiProperty({ example: 5, default: 3 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maxBranches?: number;

  @ApiProperty({ example: 50, default: 25 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maxUsers?: number;

  // Initial Organization Administrator
  @ApiProperty({ example: 'Dr. Tariq Malik' })
  @IsString()
  @IsNotEmpty()
  adminName!: string;

  @ApiProperty({ example: 'tariq.malik@alshifa.hospital' })
  @IsEmail()
  @IsNotEmpty()
  adminEmail!: string;

  @ApiProperty({ example: 'SecureInitialPass123!' })
  @IsString()
  @IsNotEmpty()
  adminPassword!: string;
}

export class UpdateOrganizationStatusDto {
  @ApiProperty({ example: 'SUSPENDED', enum: OrganizationStatus })
  @IsEnum(OrganizationStatus)
  @IsNotEmpty()
  status!: OrganizationStatus;

  @ApiProperty({ example: 'Annual compliance review pending' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateOrganizationEditionDto {
  @ApiProperty({ enum: OrganizationEdition })
  @IsEnum(OrganizationEdition)
  edition!: OrganizationEdition;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maxBranches?: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maxUsers?: number;
}

export class UpdateOrganizationEntitlementsDto {
  @ApiProperty({
    example: ['patients', 'appointments', 'consultations', 'inpatient', 'laboratory', 'radiology', 'pharmacy', 'billing'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  enabledModules!: string[];
}

export class AssignOrganizationAdminDto {
  @ApiProperty({ example: 'Sarah Connor' })
  @IsString()
  @IsNotEmpty()
  adminName!: string;

  @ApiProperty({ example: 'sarah.connor@hospital.org' })
  @IsEmail()
  @IsNotEmpty()
  adminEmail!: string;

  @ApiProperty({ example: 'TemporaryPassword123!' })
  @IsString()
  @IsNotEmpty()
  adminPassword!: string;
}

export class RequestBreakGlassDto {
  @ApiProperty({ example: '1' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ example: 'Production database index corruption support investigation (Ticket #SUP-8821)' })
  @IsString()
  @IsNotEmpty()
  requestedReason!: string;

  @ApiProperty({ example: 4, description: 'Duration in hours (1-24 hours)' })
  @IsNumber()
  @Min(1)
  @Max(24)
  durationHours!: number;
}

export class QueryRegistrationsDto {
  @ApiProperty({ enum: RegistrationStatus, required: false })
  @IsEnum(RegistrationStatus)
  @IsOptional()
  status?: RegistrationStatus;

  @ApiProperty({ enum: OrganizationType, required: false })
  @IsEnum(OrganizationType)
  @IsOptional()
  organizationType?: OrganizationType;

  @ApiProperty({ enum: OrganizationEdition, required: false })
  @IsEnum(OrganizationEdition)
  @IsOptional()
  requestedEdition?: OrganizationEdition;

  @ApiProperty({ example: 'Al-Shifa', required: false })
  @IsString()
  @IsOptional()
  search?: string;
}

export class ApproveRegistrationDto {
  @ApiProperty({ enum: OrganizationEdition, required: false })
  @IsEnum(OrganizationEdition)
  @IsOptional()
  approvedEdition?: OrganizationEdition;

  @ApiProperty({ example: ['patients', 'appointments', 'billing'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  approvedModules?: string[];

  @ApiProperty({ example: 'PROFESSIONAL', required: false })
  @IsString()
  @IsOptional()
  subscriptionTier?: string;

  @ApiProperty({ example: 3, required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maxBranches?: number;

  @ApiProperty({ example: 25, required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maxUsers?: number;
}

export class RejectRegistrationDto {
  @ApiProperty({ example: 'Invalid medical healthcare license verification. Contact support.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  rejectionReason!: string;
}

