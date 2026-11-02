import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryLabOrdersDto {
  @ApiPropertyOptional({ description: 'Filter by patient ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId?: number;

  @ApiPropertyOptional({ description: 'Filter by doctor ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  doctorId?: number;

  @ApiPropertyOptional({
    description: 'Filter by order lifecycle status',
    enum: [
      'requested',
      'partial',
      'reported',
      'ORDERED',
      'SAMPLE_PENDING',
      'SAMPLE_COLLECTED',
      'SAMPLE_RECEIVED',
      'PROCESSING',
      'RESULT_ENTERED',
      'VERIFIED',
      'COMPLETED',
      'CANCELLED',
    ],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by priority',
    enum: ['ROUTINE', 'URGENT', 'STAT'],
  })
  @IsOptional()
  @IsIn(['ROUTINE', 'URGENT', 'STAT'])
  priority?: string;

  @ApiPropertyOptional({ description: 'Filter by specific date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Search term across order number, patient name, doctor name, test name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Records per page', default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export class QueryLabCatalogueDto {
  @ApiPropertyOptional({ description: 'Search query for test name or description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by specimen type' })
  @IsOptional()
  @IsString()
  sampleType?: string;

  @ApiPropertyOptional({ description: 'Filter by active status', default: true })
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;
}
