import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryMedicineDto {
  @ApiPropertyOptional({
    description: 'Search term across brand name, generic name, company, strength',
    example: 'Amoxicillin',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter by Category ID',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;

  @ApiPropertyOptional({
    description: 'Filter by Manufacturer ID',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  manufacturerId?: number;

  @ApiPropertyOptional({
    description: 'Filter by Dosage Form ID',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dosageFormId?: number;

  @ApiPropertyOptional({
    description: 'Filter by active status: "all", "true", or "false"',
    example: 'true',
  })
  @IsOptional()
  @IsString()
  isActive?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination (starts at 1)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Records per page (1-100)',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Column to sort by',
    example: 'name',
    default: 'name',
    enum: ['name', 'createdAt', 'quantity', 'price', 'sPrice'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['name', 'createdAt', 'quantity', 'price', 'sPrice'])
  sortBy: string = 'name';

  @ApiPropertyOptional({
    description: 'Sort direction',
    example: 'asc',
    default: 'asc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
}
