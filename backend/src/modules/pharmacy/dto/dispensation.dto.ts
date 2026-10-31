import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class DispenseItemDto {
  @ApiPropertyOptional({ description: 'Optional referenced PrescriptionMedicine line ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  prescriptionMedicineId?: number;

  @ApiPropertyOptional({ description: 'Catalogue Medicine ID (required if not custom unlisted drug)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  medicineId?: number;

  @ApiPropertyOptional({
    description: 'Explicit Batch ID to consume from. If omitted, FEFO (First Expiry, First Out) allocates automatically.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  batchId?: number;

  @ApiPropertyOptional({ description: 'Custom medication name if medicineId is null', example: 'Special compounded cream' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customName?: string;

  @ApiProperty({ description: 'Quantity to dispense', example: 10 })
  @Type(() => Number)
  @IsInt({ message: 'Dispensed quantity must be an integer.' })
  @Min(1, { message: 'Dispensed quantity must be at least 1.' })
  quantity!: number;

  @ApiPropertyOptional({ description: 'Custom unit selling price in PKR (defaults to catalogue or batch price if omitted)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class DispensePrescriptionDto {
  @ApiPropertyOptional({ description: 'Prescription ID being fulfilled (omit for direct OTC counter sale)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  prescriptionId?: number;

  @ApiPropertyOptional({ description: 'Patient ID (derived from prescription if omitted)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  patientId?: number;

  @ApiPropertyOptional({ description: 'Attending / Prescribing Doctor ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  doctorId?: number;

  @ApiPropertyOptional({ description: 'Patient name for counter walk-in sales if patientId is null', example: 'Walk-in Customer' })
  @IsOptional()
  @IsString()
  patientName?: string;

  @ApiProperty({ description: 'Dispensation date (YYYY-MM-DD)', example: '2026-10-31' })
  @IsString()
  @IsNotEmpty()
  dispenseDate!: string;

  @ApiPropertyOptional({ description: 'Discount in PKR', example: 0.0, default: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ description: 'Sales Tax / VAT in PKR', example: 0.0, default: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({ description: 'Whether to create/link an official hospital Invoice in payment table', default: false })
  @IsOptional()
  @IsBoolean()
  generateInvoice?: boolean;

  @ApiPropertyOptional({ description: 'Pharmacist dispensing notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Medications being dispensed', type: [DispenseItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Must dispense at least one medication line.' })
  @ValidateNested({ each: true })
  @Type(() => DispenseItemDto)
  items!: DispenseItemDto[];
}
