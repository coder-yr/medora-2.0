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

  @ApiPropertyOptional({ description: 'Custom unit selling price in INR (defaults to catalogue or batch price if omitted)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Whether this medicine is an authorized clinical substitution', example: false })
  @IsOptional()
  @IsBoolean()
  isSubstituted?: boolean;

  @ApiPropertyOptional({ description: 'Originally prescribed Medicine ID if substituted', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  originalMedicineId?: number;

  @ApiPropertyOptional({ description: 'Mandatory reason for clinical substitution', example: 'Brand out of stock; bioequivalent generic dispensed with doctor consent' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  substitutionReason?: string;
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

  @ApiPropertyOptional({ description: 'Discount in INR', example: 0.0, default: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ description: 'Sales Tax / VAT in INR', example: 0.0, default: 0.0 })
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

  @ApiPropertyOptional({ description: 'Optional Active Admission ID for inpatient folio posting', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  admissionId?: number;

  @ApiPropertyOptional({ description: 'Hospital branch ID for this dispensation' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @ApiProperty({ description: 'Medications being dispensed', type: [DispenseItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Must dispense at least one medication line.' })
  @ValidateNested({ each: true })
  @Type(() => DispenseItemDto)
  items!: DispenseItemDto[];
}

export class CreateOtcSaleItemDto {
  @ApiPropertyOptional({ description: 'Catalogue Medicine ID (omit if custom/unlisted)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  medicineId?: number;

  @ApiPropertyOptional({ description: 'Custom unlisted medicine name if medicineId is omitted' })
  @IsOptional()
  @IsString()
  customName?: string;

  @ApiPropertyOptional({ description: 'Explicit Batch ID. If omitted, FEFO allocates automatically.', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  batchId?: number;

  @ApiProperty({ description: 'Quantity to sell', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Custom unit selling price in INR' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreateOtcSaleDto {
  @ApiPropertyOptional({ description: 'Optional registered Patient ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  patientId?: number;

  @ApiPropertyOptional({ description: 'Customer / Patient full name for walk-in counter sales', example: 'Pooja Verma' })
  @IsOptional()
  @IsString()
  patientName?: string;

  @ApiPropertyOptional({ description: 'Customer contact phone number', example: '+91 98765 43210' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({ description: 'Sale date (YYYY-MM-DD)', example: '2026-11-24' })
  @IsString()
  @IsNotEmpty()
  saleDate!: string;

  @ApiPropertyOptional({ description: 'Discount in INR', example: 0.0, default: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ description: 'Sales Tax / VAT in INR', example: 0.0, default: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({ description: 'Payment method: cash, card, upi, bank_transfer', example: 'cash' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Pharmacist sale notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Whether to generate Phase 10.5.6 invoice', default: true })
  @IsOptional()
  @IsBoolean()
  generateInvoice?: boolean;

  @ApiPropertyOptional({ description: 'Hospital branch ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @ApiProperty({ description: 'OTC line items', type: [CreateOtcSaleItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Must include at least one medicine item for OTC sale.' })
  @ValidateNested({ each: true })
  @Type(() => CreateOtcSaleItemDto)
  items!: CreateOtcSaleItemDto[];
}
