import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AppointmentQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by date (YYYY-MM-DD, or "all" for no date filter). Defaults to today.',
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
  @IsString()
  doctor?: string | number;

  @ApiPropertyOptional({
    description: 'Filter by patient ID or MRN',
    example: '1',
  })
  @IsOptional()
  @IsString()
  patient?: string | number;

  @ApiPropertyOptional({
    description: 'Filter by branch ID',
    example: '1',
  })
  @IsOptional()
  @IsString()
  branchId?: string | number;

  @ApiPropertyOptional({
    description: 'Filter by branch ID (snake_case alias)',
    example: '1',
  })
  @IsOptional()
  @IsString()
  branch_id?: string | number;

  @ApiPropertyOptional({
    description: 'Filter by appointment status',
    example: 'scheduled',
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
