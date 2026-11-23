import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum OrganizationTypeDto {
  CLINIC = 'CLINIC',
  POLYCLINIC = 'POLYCLINIC',
  DIAGNOSTIC_CENTER = 'DIAGNOSTIC_CENTER',
  HOSPITAL = 'HOSPITAL',
  HOSPITAL_NETWORK = 'HOSPITAL_NETWORK',
}

export enum OrganizationStatusDto {
  ACTIVE = 'ACTIVE',
  TRIAL = 'TRIAL',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
}

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Organization display name', example: 'Al-Shifa Family Clinic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    description: 'Unique alphanumeric organization code / URL slug',
    example: 'AL-SHIFA-CLINIC',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'organizationCode must contain only alphanumeric characters, underscores, or hyphens',
  })
  code!: string;

  @ApiPropertyOptional({
    description: 'Healthcare organization facility type',
    enum: OrganizationTypeDto,
    default: OrganizationTypeDto.HOSPITAL,
  })
  @IsEnum(OrganizationTypeDto)
  @IsOptional()
  type?: OrganizationTypeDto = OrganizationTypeDto.HOSPITAL;

  @ApiPropertyOptional({
    description: 'Subscription / operational status',
    enum: OrganizationStatusDto,
    default: OrganizationStatusDto.ACTIVE,
  })
  @IsEnum(OrganizationStatusDto)
  @IsOptional()
  status?: OrganizationStatusDto = OrganizationStatusDto.ACTIVE;

  @ApiPropertyOptional({ description: 'Official legal registered entity name' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ description: 'Default billing currency', example: 'INR', default: 'INR' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  defaultCurrency?: string;

  @ApiPropertyOptional({ description: 'Default timezone', example: 'Asia/Karachi', default: 'Asia/Karachi' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  defaultTimezone?: string;
}
