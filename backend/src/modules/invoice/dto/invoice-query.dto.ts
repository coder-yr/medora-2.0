import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class InvoiceQueryDto {
  @ApiPropertyOptional({
    description: 'Filter invoices by settlement status: outstanding, settled, or all',
    enum: ['outstanding', 'settled', 'all'],
    default: 'outstanding',
  })
  @IsOptional()
  @IsIn(['outstanding', 'settled', 'all'], {
    message: 'show must be "outstanding", "settled", or "all".',
  })
  show?: 'outstanding' | 'settled' | 'all';

  @ApiPropertyOptional({
    description: 'Filter invoices by Patient numeric ID or MRN',
    example: '1',
  })
  @IsOptional()
  @IsString()
  patient?: string;

  @ApiPropertyOptional({
    description: 'Filter invoices by calendar date (YYYY-MM-DD)',
    example: '2026-10-28',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: '1-indexed page number',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of invoices per page (max 200)',
    example: 50,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
