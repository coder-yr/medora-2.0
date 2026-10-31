import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PurchaseOrderItemDto {
  @ApiProperty({ description: 'Catalogue Medicine ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  medicineId!: number;

  @ApiProperty({ description: 'Ordered quantity', example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityOrdered!: number;

  @ApiProperty({ description: 'Agreed unit cost in PKR', example: 15.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'Supplier ID', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'Supplier ID is required.' })
  supplierId!: number;

  @ApiProperty({ description: 'Order issuance date (YYYY-MM-DD)', example: '2026-10-31' })
  @IsString()
  @IsNotEmpty()
  orderDate!: string;

  @ApiPropertyOptional({ description: 'Expected delivery date (YYYY-MM-DD)', example: '2026-11-05' })
  @IsOptional()
  @IsString()
  expectedDate?: string;

  @ApiPropertyOptional({ description: 'PO notes or terms' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Order line items', type: [PurchaseOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'A purchase order requires at least one line item.' })
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}

export class GoodsReceiptItemDto {
  @ApiPropertyOptional({ description: 'Optional referenced PurchaseOrderItem ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  purchaseOrderItemId?: number;

  @ApiProperty({ description: 'Catalogue Medicine ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  medicineId!: number;

  @ApiProperty({ description: 'Delivered batch / lot number', example: 'LOT-2026-99' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  batchNumber!: string;

  @ApiPropertyOptional({ description: 'Manufacturing date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  mfgDate?: string;

  @ApiProperty({ description: 'Batch expiration date (YYYY-MM-DD or ISO)', example: '2028-12-31' })
  @IsDateString()
  expiryDate!: string;

  @ApiProperty({ description: 'Received quantity', example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityReceived!: number;

  @ApiProperty({ description: 'Invoiced unit cost in PKR', example: 15.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiPropertyOptional({ description: 'Target patient retail price in PKR' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice?: number;
}

export class CreateGoodsReceiptDto {
  @ApiPropertyOptional({ description: 'Referenced Purchase Order ID (optional for direct supplier delivery)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  purchaseOrderId?: number;

  @ApiProperty({ description: 'Delivering Supplier ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  supplierId!: number;

  @ApiProperty({ description: 'Delivery / Goods receipt date (YYYY-MM-DD)', example: '2026-10-31' })
  @IsString()
  @IsNotEmpty()
  receiptDate!: string;

  @ApiPropertyOptional({ description: 'Supplier Delivery Note / Invoice Number', example: 'INV-SUP-88219' })
  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;

  @ApiPropertyOptional({ description: 'Receiving inspection notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Delivered batch line items', type: [GoodsReceiptItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'A goods receipt note requires at least one received batch item.' })
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptItemDto)
  items!: GoodsReceiptItemDto[];
}
