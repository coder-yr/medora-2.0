import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationSettingsDto {
  @ApiPropertyOptional({ description: 'Registered legal entity name', example: 'Al-Shifa Healthcare Ltd' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  legalName?: string;

  @ApiPropertyOptional({ description: 'Healthcare regulatory registration number', example: 'HMC-REG-2026-99' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'National tax number / NTN', example: 'NTN-99887766' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  taxNumber?: string;

  @ApiPropertyOptional({ description: 'Official organization contact email', example: 'contact@alshifa.clinic' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ description: 'Primary contact phone number', example: '+92 21 34567890' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Official website URL', example: 'https://alshifa.clinic' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  website?: string;

  @ApiPropertyOptional({ description: 'Physical address', example: 'Plot 42, Block 5, Clifton, Karachi' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ description: 'Default ISO currency code', example: 'PKR' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  defaultCurrency?: string;

  @ApiPropertyOptional({ description: 'Default timezone', example: 'Asia/Karachi' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  defaultTimezone?: string;

  @ApiPropertyOptional({ description: 'Primary brand accent color hex code', example: '#0284c7' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'Secondary brand color hex code', example: '#0f172a' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  secondaryColor?: string;

  @ApiPropertyOptional({ description: 'Receipt header text' })
  @IsString()
  @IsOptional()
  receiptHeader?: string;

  @ApiPropertyOptional({ description: 'Receipt footer text' })
  @IsString()
  @IsOptional()
  receiptFooter?: string;

  @ApiPropertyOptional({ description: 'Invoice footer text' })
  @IsString()
  @IsOptional()
  invoiceFooter?: string;
}

