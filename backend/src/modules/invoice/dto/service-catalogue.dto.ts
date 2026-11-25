import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateServiceItemDto {
  @ApiProperty({
    description: 'Service item name',
    example: 'General Consultation',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Service name is required.' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Unique service catalogue code',
    example: 'SRV-CONS-001',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the service item',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Default list price for the service in INR',
    example: 500.0,
  })
  @IsNotEmpty({ message: 'Price is required.' })
  @IsNumber({}, { message: 'Price must be a number.' })
  @Min(0, { message: 'Price cannot be negative.' })
  price!: number;

  @ApiPropertyOptional({
    description: 'Service classification / kind (consultation, procedure, lab, misc)',
    example: 'consultation',
    default: 'misc',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  kind?: string;

  @ApiPropertyOptional({
    description: 'Applicable tax percentage rate (0 - 100)',
    example: 5.0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional({
    description: 'Doctor commission percentage',
    example: 20.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  commission?: number;

  @ApiPropertyOptional({
    description: 'Active status',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Optional branch scoping ID for branch-specific pricing',
  })
  @IsOptional()
  branchId?: string | number;
}

export class UpdateServiceItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  kind?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  commission?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
