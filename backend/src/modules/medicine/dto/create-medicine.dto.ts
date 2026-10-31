import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMedicineDto {
  @ApiProperty({
    example: 'Amoxicillin 500mg',
    description: 'Commercial brand / product name (Required)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Medicine brand name is required' })
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: 'Amoxicillin',
    description: 'Generic salt / active pharmaceutical ingredient',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  generic?: string;

  @ApiPropertyOptional({
    example: 'GSK',
    description: 'Pharmaceutical company / manufacturer name (Legacy string)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  company?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Category ID referencing medicine_category.id',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Manufacturer ID referencing manufacturer.id',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  manufacturerId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Dosage form ID referencing dosage_form.id (e.g. Tablet, Syrup)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dosageFormId?: number;

  @ApiPropertyOptional({
    example: '500',
    description: 'Active ingredient strength (e.g. 500, 850, 120)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  strength?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Measurement unit ID referencing measurement_unit.id (e.g. mg, ml)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Preferred Supplier ID referencing supplier.id',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  supplierId?: number;

  @ApiPropertyOptional({
    example: '10x10 Tablets',
    description: 'Pack size or packaging format description (Legacy box field)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  box?: string;

  @ApiPropertyOptional({
    example: 8.0,
    description: 'Cost / acquisition price paid by hospital (Legacy price)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Cost price must be non-negative' })
  price?: number;

  @ApiPropertyOptional({
    example: 12.0,
    description: 'Retail selling price charged to patients (Legacy s_price)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Sale price must be non-negative' })
  sPrice?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'On-hand stock quantity count (Default 0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Quantity must be non-negative' })
  quantity?: number;

  @ApiPropertyOptional({
    example: 'Take with food. Mild GI upset may occur.',
    description: 'Side effects, indications, or clinical advisories',
  })
  @IsOptional()
  @IsString()
  effects?: string;

  @ApiPropertyOptional({
    example: '2028-12-31',
    description: 'Catalogue expiry date string (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  expiryDate?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Active status in hospital catalogue (Default true)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
