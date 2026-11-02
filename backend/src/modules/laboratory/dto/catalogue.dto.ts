import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateTestParameterDto {
  @ApiProperty({ description: 'Parameter Name', example: 'Hemoglobin' })
  @IsNotEmpty({ message: 'Parameter name is required.' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Unit of measurement', example: 'g/dL' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({ description: 'Normal reference range', example: '13.5 - 17.5 g/dL' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referenceRange?: string;

  @ApiPropertyOptional({ description: 'Minimum reference limit' })
  @IsOptional()
  @IsString()
  referenceMin?: string;

  @ApiPropertyOptional({ description: 'Maximum reference limit' })
  @IsOptional()
  @IsString()
  referenceMax?: string;

  @ApiPropertyOptional({ description: 'Applicable gender (ALL, MALE, FEMALE)', example: 'ALL' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @ApiPropertyOptional({ description: 'Minimum age in years', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ageMin?: number;

  @ApiPropertyOptional({ description: 'Maximum age in years', example: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ageMax?: number;

  @ApiPropertyOptional({ description: 'Display order sequence', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;
}

export class CreateLabTestCatalogueDto {
  @ApiPropertyOptional({ description: 'Test Name (legacy field)', example: 'Complete Blood Count (CBC)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ description: 'Test Name alias', example: 'Complete Blood Count (CBC)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Department or section', example: 'Hematology' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Clinical description or methodology', example: 'Automated 5-part differential' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Overall reference value summary', example: 'See individual parameters' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referenceValue?: string;

  @ApiPropertyOptional({ description: 'Official service price in PKR', example: 1500.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Required specimen type', example: 'EDTA Whole Blood' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sampleType?: string;

  @ApiPropertyOptional({ description: 'Expected turnaround time in hours', example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  turnaroundHours?: number;

  @ApiPropertyOptional({ description: 'Pre-test patient preparation instructions', example: 'No fasting required' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Initial test parameters', type: [CreateTestParameterDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTestParameterDto)
  parameters?: CreateTestParameterDto[];
}

export class UpdateLabTestCatalogueDto {
  @ApiPropertyOptional({ description: 'Test Name (legacy field)', example: 'Complete Blood Count (CBC)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ description: 'Test Name alias', example: 'Complete Blood Count (CBC)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Department or section', example: 'Hematology' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Clinical description or methodology' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Overall reference value summary' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referenceValue?: string;

  @ApiPropertyOptional({ description: 'Official service price in PKR' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Required specimen type' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sampleType?: string;

  @ApiPropertyOptional({ description: 'Expected turnaround time in hours' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  turnaroundHours?: number;

  @ApiPropertyOptional({ description: 'Pre-test patient preparation instructions' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Test parameters to replace or update', type: [CreateTestParameterDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTestParameterDto)
  parameters?: CreateTestParameterDto[];
}
