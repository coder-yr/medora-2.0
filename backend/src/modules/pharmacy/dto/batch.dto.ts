import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBatchDto {
  @ApiProperty({ description: 'Catalogue Medicine ID', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'Medicine ID must be an integer.' })
  medicineId!: number;

  @ApiProperty({ description: 'Batch / Lot identification code', example: 'BATCH-2026-001' })
  @IsString()
  @IsNotEmpty({ message: 'Batch number is required.' })
  @MaxLength(100)
  batchNumber!: string;

  @ApiPropertyOptional({ description: 'Manufacturing date (YYYY-MM-DD)', example: '2026-01-15' })
  @IsOptional()
  @IsString()
  mfgDate?: string;

  @ApiProperty({ description: 'Expiration date (YYYY-MM-DD or ISO)', example: '2028-06-30' })
  @IsDateString({}, { message: 'Expiry date must be a valid ISO date string.' })
  expiryDate!: string;

  @ApiProperty({ description: 'Acquisition / wholesale cost price per unit in PKR', example: 12.5 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Cost price must be a valid number.' })
  @Min(0, { message: 'Cost price cannot be negative.' })
  costPrice!: number;

  @ApiPropertyOptional({ description: 'Retail patient selling price per unit in PKR (defaults to catalogue s_price if omitted)', example: 18.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Selling price must be a valid number.' })
  @Min(0, { message: 'Selling price cannot be negative.' })
  sellingPrice?: number;

  @ApiProperty({ description: 'Initial received stock quantity', example: 500 })
  @Type(() => Number)
  @IsInt({ message: 'Initial quantity must be an integer.' })
  @Min(1, { message: 'Initial quantity must be at least 1.' })
  quantity!: number;

  @ApiPropertyOptional({ description: 'Wholesale Supplier ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @ApiPropertyOptional({ description: 'Storage conditions or lot notes', example: 'Store below 25°C in dry room' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBatchStatusDto {
  @ApiProperty({
    description: 'Updated lot status',
    enum: ['ACTIVE', 'QUARANTINE', 'DEPLETED', 'EXPIRED', 'RECALLED'],
    example: 'ACTIVE',
  })
  @IsString()
  @IsIn(['ACTIVE', 'QUARANTINE', 'DEPLETED', 'EXPIRED', 'RECALLED'], {
    message: 'Status must be ACTIVE, QUARANTINE, DEPLETED, EXPIRED, or RECALLED.',
  })
  status!: string;

  @ApiPropertyOptional({ description: 'Reason for status update', example: 'Cold chain integrity alert' })
  @IsOptional()
  @IsString()
  notes?: string;
}
