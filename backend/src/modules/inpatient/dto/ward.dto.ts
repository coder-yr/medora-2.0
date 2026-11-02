import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateWardDto {
  @ApiPropertyOptional({ description: 'Ward Name / Category', example: 'Intensive Care Unit' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Ward Name (e.g. Intensive Care Unit, Male Surgical Ward)', example: 'Intensive Care Unit' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ description: 'Ward Code (e.g. ICU-01)', example: 'ICU-01' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ description: 'Description or notes', example: 'Third floor critical care ward' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Base daily rate for bed stay', example: 5000.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseRate?: number;

  @ApiPropertyOptional({ description: 'Billing unit', example: 'DAILY', default: 'DAILY' })
  @IsOptional()
  @IsString()
  billingUnit?: string;

  @ApiPropertyOptional({ description: 'Active state', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWardDto {
  @ApiPropertyOptional({ description: 'Ward Name / Category' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Ward Name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ description: 'Ward Code' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Base daily rate' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseRate?: number;

  @ApiPropertyOptional({ description: 'Billing unit' })
  @IsOptional()
  @IsString()
  billingUnit?: string;

  @ApiPropertyOptional({ description: 'Active state' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
