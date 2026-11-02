import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ADMISSION_STATUSES } from './admission.dto';
import { BED_STATUSES } from './bed.dto';

export class QueryAdmissionDto {
  @ApiPropertyOptional({ description: 'Filter by admission status', enum: ADMISSION_STATUSES })
  @IsOptional()
  @IsIn(ADMISSION_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by patient ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  patientId?: number;

  @ApiPropertyOptional({ description: 'Filter by ward / bed category ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  wardId?: number;

  @ApiPropertyOptional({ description: 'Filter by attending doctor ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  doctorId?: number;

  @ApiPropertyOptional({ description: 'Search query across admission number, patient name, MRN, diagnosis' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page limit', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class QueryBedDto {
  @ApiPropertyOptional({ description: 'Filter by Ward / Bed Category ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Filter by Bed Status', enum: BED_STATUSES })
  @IsOptional()
  @IsIn(BED_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by hospital branch ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  branchId?: number;
}
