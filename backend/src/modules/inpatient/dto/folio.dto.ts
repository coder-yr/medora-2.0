import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export const FOLIO_SOURCE_MODULES = [
  'BED',
  'PHARMACY',
  'LABORATORY',
  'RADIOLOGY',
  'SERVICE',
  'PROCEDURE',
  'NURSING',
] as const;

export class PostFolioChargeDto {
  @ApiProperty({ description: 'Originating source module', enum: FOLIO_SOURCE_MODULES, example: 'SERVICE' })
  @IsIn(FOLIO_SOURCE_MODULES)
  @IsNotEmpty()
  sourceModule!: string;

  @ApiPropertyOptional({ description: 'External source record ID (e.g. dispensation ID or order ID)', example: 'SRV-101' })
  @IsOptional()
  @IsString()
  sourceRecordId?: string;

  @ApiPropertyOptional({ description: 'Unique idempotency key to prevent double posting', example: 'SRV-101-20261102' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiProperty({ description: 'Charge Category', example: 'Physiotherapy Session' })
  @IsString()
  @IsNotEmpty()
  chargeCategory!: string;

  @ApiProperty({ description: 'Charge Description', example: 'Post-op chest physiotherapy (30 mins)' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ description: 'Quantity', example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiProperty({ description: 'Unit price', example: 1500.0 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ description: 'Total charge amount (defaults to quantity * unitPrice)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;
}

export class ReverseFolioChargeDto {
  @ApiProperty({ description: 'Mandatory clinical/billing justification for charge reversal', example: 'Service cancelled by attending physician prior to delivery' })
  @IsString()
  @IsNotEmpty()
  reversalReason!: string;
}

export class SettleFolioDto {
  @ApiPropertyOptional({ description: 'Payment amount received towards folio balance', example: 10500.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @ApiPropertyOptional({ description: 'Payment method', example: 'CASH', default: 'CASH' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Settlement remarks / reference', example: 'Settled in full at time of discharge' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
