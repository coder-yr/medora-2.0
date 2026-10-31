import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class StockAdjustmentItemDto {
  @ApiProperty({ description: 'Catalogue Medicine ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  medicineId!: number;

  @ApiProperty({ description: 'Batch ID being adjusted', example: 1 })
  @Type(() => Number)
  @IsInt()
  batchId!: number;

  @ApiProperty({ description: 'Actual physical count verified in pharmacy', example: 45 })
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Physical count cannot be negative.' })
  physicalQuantity!: number;
}

export class CreateStockAdjustmentDto {
  @ApiProperty({ description: 'Adjustment date (YYYY-MM-DD)', example: '2026-10-31' })
  @IsString()
  @IsNotEmpty()
  adjustmentDate!: string;

  @ApiProperty({
    description: 'Adjustment rationale',
    enum: ['PHYSICAL_COUNT', 'DAMAGED', 'EXPIRED', 'AUDIT_CORRECTION', 'OTHER'],
    example: 'PHYSICAL_COUNT',
  })
  @IsString()
  @IsIn(['PHYSICAL_COUNT', 'DAMAGED', 'EXPIRED', 'AUDIT_CORRECTION', 'OTHER'], {
    message: 'Reason must be PHYSICAL_COUNT, DAMAGED, EXPIRED, AUDIT_CORRECTION, or OTHER.',
  })
  reason!: string;

  @ApiPropertyOptional({ description: 'Audit explanation notes', example: 'Monthly physical inventory count' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Items being adjusted', type: [StockAdjustmentItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one batch item must be specified for adjustment.' })
  @ValidateNested({ each: true })
  @Type(() => StockAdjustmentItemDto)
  items!: StockAdjustmentItemDto[];
}
