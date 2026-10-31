import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PharmacyReturnItemDto {
  @ApiPropertyOptional({ description: 'Referenced PharmacyDispensationItem ID (for patient returns)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  dispensationItemId?: number;

  @ApiProperty({ description: 'Catalogue Medicine ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  medicineId!: number;

  @ApiProperty({ description: 'Batch ID being returned', example: 1 })
  @Type(() => Number)
  @IsInt()
  batchId!: number;

  @ApiProperty({ description: 'Quantity being returned', example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Returned quantity must be at least 1.' })
  quantity!: number;

  @ApiProperty({
    description: 'Condition of returned medication',
    enum: ['SALEABLE', 'DAMAGED', 'EXPIRED'],
    default: 'SALEABLE',
    example: 'SALEABLE',
  })
  @IsString()
  @IsIn(['SALEABLE', 'DAMAGED', 'EXPIRED'])
  condition!: string;
}

export class CreatePharmacyReturnDto {
  @ApiProperty({
    description: 'Type of return',
    enum: ['PATIENT_RETURN', 'SUPPLIER_RETURN'],
    example: 'PATIENT_RETURN',
  })
  @IsString()
  @IsIn(['PATIENT_RETURN', 'SUPPLIER_RETURN'])
  returnType!: string;

  @ApiPropertyOptional({ description: 'Referenced Dispensation ID for patient returns', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  dispensationId?: number;

  @ApiPropertyOptional({ description: 'Supplier ID for supplier returns', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @ApiProperty({ description: 'Return date (YYYY-MM-DD)', example: '2026-10-31' })
  @IsString()
  @IsNotEmpty()
  returnDate!: string;

  @ApiProperty({ description: 'Reason for return', example: 'Doctor adjusted dosage regimen' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({
    description: 'Whether verified SALEABLE items should be added back into inventory balance',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  restockToInventory?: boolean;

  @ApiProperty({ description: 'Items being returned', type: [PharmacyReturnItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Must specify at least one return item.' })
  @ValidateNested({ each: true })
  @Type(() => PharmacyReturnItemDto)
  items!: PharmacyReturnItemDto[];
}
