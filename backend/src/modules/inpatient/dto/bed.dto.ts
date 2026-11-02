import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export const BED_STATUSES = [
  'AVAILABLE',
  'OCCUPIED',
  'RESERVED',
  'CLEANING',
  'MAINTENANCE',
  'BLOCKED',
] as const;

export type BedStatusType = typeof BED_STATUSES[number];

export class CreateBedDto {
  @ApiProperty({ description: 'Ward / Category ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  categoryId!: number;

  @ApiPropertyOptional({ description: 'Bed Number (unique within ward)', example: 'B-101' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  number?: string;

  @ApiPropertyOptional({ description: 'Bed Number alias', example: 'B-101' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bedNumber?: string;

  @ApiPropertyOptional({ description: 'Daily rate snapshot (optional)', example: 2500 })
  @IsOptional()
  @IsNumber()
  dailyRate?: number;

  @ApiPropertyOptional({ description: 'Description or bed features', example: 'Motorized ICU bed with oxygen supply' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ description: 'Initial status', enum: BED_STATUSES, default: 'AVAILABLE' })
  @IsOptional()
  @IsIn(BED_STATUSES)
  status?: BedStatusType;

  @ApiPropertyOptional({ description: 'Hospital branch ID' })
  @IsOptional()
  @IsNumber()
  branchId?: number;

  @ApiPropertyOptional({ description: 'Active state', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBedDto {
  @ApiPropertyOptional({ description: 'Ward / Category ID' })
  @IsOptional()
  @IsNumber()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Bed Number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  number?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ description: 'Status', enum: BED_STATUSES })
  @IsOptional()
  @IsIn(BED_STATUSES)
  status?: BedStatusType;

  @ApiPropertyOptional({ description: 'Active state' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBedStatusDto {
  @ApiProperty({ description: 'Target bed status', enum: BED_STATUSES, example: 'CLEANING' })
  @IsIn(BED_STATUSES)
  @IsNotEmpty()
  status!: BedStatusType;

  @ApiPropertyOptional({ description: 'Optional maintenance or cleaning notes', example: 'Post-discharge deep sterilization' })
  @IsOptional()
  @IsString()
  notes?: string;
}
