import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ConsultationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter consultations by date (YYYY-MM-DD or "all"). Defaults to today.',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Filter by doctor ID',
    example: '1',
  })
  @IsOptional()
  doctor?: string | number;

  @ApiPropertyOptional({
    description: 'Filter by patient ID',
    example: '1',
  })
  @IsOptional()
  patient?: string | number;

  @ApiPropertyOptional({
    description: 'Filter by status (e.g. draft, completed)',
    example: 'completed',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
