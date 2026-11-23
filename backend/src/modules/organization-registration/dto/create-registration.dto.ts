import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { OrganizationEdition, OrganizationType } from '@prisma/client';

export class CreateOrganizationRegistrationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  organizationName!: string;

  @IsEnum(OrganizationType, {
    message: 'organizationType must be CLINIC, POLYCLINIC, DIAGNOSTIC_CENTER, HOSPITAL, or HOSPITAL_NETWORK',
  })
  organizationType!: OrganizationType;

  @IsEnum(OrganizationEdition, {
    message: 'requestedEdition must be CLINIC, PROFESSIONAL, HOSPITAL, or ENTERPRISE',
  })
  requestedEdition!: OrganizationEdition;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  specialization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  healthcareSpecialization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  licenseNumber?: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  organizationEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  contactPhone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  adminFullName!: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  adminEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  adminPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  adminDesignation?: string;
}
