import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// ------------------------------------------------------------- Manufacturer
export class CreateManufacturerDto {
  @ApiProperty({ example: 'GlaxoSmithKline (GSK)', description: 'Manufacturer name' })
  @IsString()
  @IsNotEmpty({ message: 'Manufacturer name is required' })
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'United Kingdom', description: 'Country of origin' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: 'medical@gsk.com', description: 'Contact email' })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+44 20 8047 5000', description: 'Contact phone' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @ApiPropertyOptional({ example: '980 Great West Road, Brentford, Middlesex', description: 'Physical address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: true, description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateManufacturerDto extends PartialType(CreateManufacturerDto) {}

// -------------------------------------------------------------- Dosage Form
export class CreateDosageFormDto {
  @ApiProperty({ example: 'Tablet', description: 'Dosage form name (e.g. Tablet, Syrup, Injection)' })
  @IsString()
  @IsNotEmpty({ message: 'Dosage form name is required' })
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: 'Solid unit dosage form', description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ example: true, description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateDosageFormDto extends PartialType(CreateDosageFormDto) {}

// --------------------------------------------------------- Measurement Unit
export class CreateMeasurementUnitDto {
  @ApiProperty({ example: 'Milligram', description: 'Unit name' })
  @IsString()
  @IsNotEmpty({ message: 'Unit name is required' })
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 'mg', description: 'Unit abbreviation symbol (e.g. mg, ml, g, IU)' })
  @IsString()
  @IsNotEmpty({ message: 'Unit symbol is required' })
  @MaxLength(20)
  symbol!: string;

  @ApiPropertyOptional({ example: true, description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateMeasurementUnitDto extends PartialType(CreateMeasurementUnitDto) {}

// ----------------------------------------------------------------- Supplier
export class CreateSupplierDto {
  @ApiProperty({ example: 'MediCorp Wholesale Distribution', description: 'Supplier entity name' })
  @IsString()
  @IsNotEmpty({ message: 'Supplier name is required' })
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Kashif Mehmood', description: 'Representative contact person' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactPerson?: string;

  @ApiPropertyOptional({ example: 'orders@medicorp.com', description: 'Supplier email' })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ example: '051-2345678', description: 'Contact telephone' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'Plot 45, I-9 Industrial Area, Islamabad', description: 'Warehouse address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: true, description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
