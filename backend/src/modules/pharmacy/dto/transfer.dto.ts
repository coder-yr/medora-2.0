import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateStockTransferDto {
  @ApiProperty({ description: 'Originating hospital branch ID sending the stock', example: 1 })
  @Type(() => Number)
  @IsInt()
  fromBranchId!: number;

  @ApiProperty({ description: 'Destination hospital branch ID receiving the stock', example: 2 })
  @Type(() => Number)
  @IsInt()
  toBranchId!: number;

  @ApiProperty({ description: 'Catalogue Medicine ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  medicineId!: number;

  @ApiProperty({ description: 'Batch ID at source branch to transfer from', example: 1 })
  @Type(() => Number)
  @IsInt()
  batchId!: number;

  @ApiProperty({ description: 'Quantity of units to transfer', example: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Transfer quantity must be at least 1 unit.' })
  quantity!: number;

  @ApiPropertyOptional({ description: 'Clinical or operational reason for inter-branch transfer', example: 'Emergency stock replenishment for Branch 2 ICU' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class QueryStockTransferDto {
  @ApiPropertyOptional({ description: 'Filter by sending or receiving branch ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @ApiPropertyOptional({ description: 'Filter specifically by originating source branch ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fromBranchId?: number;

  @ApiPropertyOptional({ description: 'Filter specifically by destination receiving branch ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  toBranchId?: number;

  @ApiPropertyOptional({ description: 'Filter by medicine ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  medicineId?: number;

  @ApiPropertyOptional({ description: 'Filter by transfer status (PENDING, COMPLETED, CANCELLED)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Records per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
