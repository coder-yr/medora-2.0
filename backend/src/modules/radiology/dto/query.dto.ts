import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryRadiologyOrderDto {
  @ApiPropertyOptional({ description: 'Filter by patient ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  patientId?: number;

  @ApiPropertyOptional({ description: 'Filter by doctor ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  doctorId?: number;

  @ApiPropertyOptional({ description: 'Filter by order status (e.g. ordered, scheduled, done, reported, open, cancelled)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by modality (xray, ultrasound, ct, mri, mammography, fluoroscopy, other)' })
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional({ description: 'Filter by urgent flag' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  urgent?: boolean;

  @ApiPropertyOptional({ description: 'Filter from date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter to date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'General search keyword (patient name, order number, exam name)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Results limit per page', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 50;
}

export class QueryRadiologyExamDto {
  @ApiPropertyOptional({ description: 'Filter by modality' })
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Search name or code' })
  @IsOptional()
  @IsString()
  search?: string;
}
