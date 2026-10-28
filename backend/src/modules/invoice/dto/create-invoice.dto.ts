import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateInvoiceItemDto {
  @ApiPropertyOptional({
    description: 'Payment Category / Billable Service ID from catalogue',
    example: 1,
  })
  @IsOptional()
  payment_category_id?: number | string;

  @ApiPropertyOptional({
    description: 'Service item name (derived from category if omitted)',
    example: 'Consultation - OPD',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({
    description: 'Quantity of service units rendered (must be >= 1)',
    example: 1,
    default: 1,
  })
  @IsInt({ message: 'Quantity must be an integer.' })
  @Min(1, { message: 'Quantity must be at least 1.' })
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Unit price in PKR. If omitted, uses default price from PriceList catalogue.',
    example: 500.0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Unit price must be a valid number.' })
  @Min(0, { message: 'Unit price cannot be negative.' })
  unit_price?: number;

  @ApiPropertyOptional({
    description: 'Optional performing doctor ID for this specific line item',
    example: 1,
  })
  @IsOptional()
  doctor_id?: number | string;
}

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'Patient ID (numeric primary key or formatted MRN)',
    example: '1',
  })
  @IsNotEmpty({ message: 'Patient is required.' })
  patient!: string | number;

  @ApiPropertyOptional({
    description: 'Attending / Performing Doctor ID',
    example: '1',
  })
  @IsOptional()
  doctor?: string | number;

  @ApiPropertyOptional({
    description: 'Referring Doctor ID (if distinct from performing doctor)',
    example: '2',
  })
  @IsOptional()
  referring_doctor?: string | number;

  @ApiProperty({
    description: 'Invoice date (YYYY-MM-DD)',
    example: '2026-10-28',
  })
  @IsNotEmpty({ message: 'Invoice date is required.' })
  @IsString()
  date!: string;

  @ApiPropertyOptional({
    description: 'Total invoice discount amount. Cannot exceed invoice subtotal.',
    example: 50.0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Discount must be a valid number.' })
  @Min(0, { message: 'Discount cannot be negative.' })
  discount?: number;

  @ApiPropertyOptional({
    description: 'Value-added tax / sales tax amount',
    example: 0.0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'VAT must be a valid number.' })
  @Min(0, { message: 'VAT cannot be negative.' })
  vat?: number;

  @ApiPropertyOptional({
    description: 'Clinical / administrative billing remarks',
    example: 'Initial OPD consultation fee and dressing',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @ApiPropertyOptional({
    description: 'Patient category / pricing tier ID (e.g. Regular, Corporate, Welfare)',
    example: 1,
  })
  @IsOptional()
  patient_type_id?: number | string;

  @ApiPropertyOptional({
    description: 'Care setting: opd (outpatient) or ipd (inpatient)',
    enum: ['opd', 'ipd'],
    default: 'opd',
  })
  @IsOptional()
  @IsIn(['opd', 'ipd'], { message: 'care_setting must be either "opd" or "ipd".' })
  care_setting?: 'opd' | 'ipd';

  @ApiProperty({
    description: 'Line items charged on the invoice (at least 1 item required)',
    type: [CreateInvoiceItemDto],
  })
  @IsArray({ message: 'Items must be an array.' })
  @ArrayMinSize(1, { message: 'Add at least one charge, or the invoice is for nothing.' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];
}
