import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryBatchDto {
  @ApiPropertyOptional({ description: 'Search by batch number or medicine name' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by medicine ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  medicineId?: number;

  @ApiPropertyOptional({ description: 'Filter by supplier ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @ApiPropertyOptional({
    description: 'Filter by batch status',
    enum: ['ACTIVE', 'QUARANTINE', 'DEPLETED', 'EXPIRED', 'RECALLED'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter only expiring within N days', example: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  expiringInDays?: number;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class QueryStockMovementDto {
  @ApiPropertyOptional({ description: 'Filter by medicine ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  medicineId?: number;

  @ApiPropertyOptional({ description: 'Filter by batch ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  batchId?: number;

  @ApiPropertyOptional({
    description: 'Filter by movement type',
    enum: [
      'PURCHASE_RECEIPT',
      'DISPENSING',
      'CUSTOMER_RETURN',
      'SUPPLIER_RETURN',
      'STOCK_ADJUSTMENT_IN',
      'STOCK_ADJUSTMENT_OUT',
      'EXPIRED_WRITE_OFF',
      'DAMAGED_WRITE_OFF',
    ],
  })
  @IsOptional()
  @IsString()
  movementType?: string;

  @ApiPropertyOptional({ description: 'Filter from date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter to date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export class QueryDispensationDto {
  @ApiPropertyOptional({ description: 'Search dispensation number or patient name' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by patient ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  patientId?: number;

  @ApiPropertyOptional({ description: 'Filter by prescription ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  prescriptionId?: number;

  @ApiPropertyOptional({ description: 'Filter by date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
