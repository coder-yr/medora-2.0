import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class TransferBedDto {
  @ApiPropertyOptional({ description: 'Target destination bed ID', example: 5 })
  @IsOptional()
  @IsNumber()
  targetBedId?: number;

  @ApiPropertyOptional({ description: 'Target destination bed ID alias', example: 5 })
  @IsOptional()
  @IsNumber()
  destinationBedId?: number;

  @ApiPropertyOptional({ description: 'Clinical or operational reason for bed transfer', example: 'Patient condition deteriorated, transferred to ICU' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @ApiPropertyOptional({ description: 'Transfer reason alias', example: 'Patient condition deteriorated, transferred to ICU' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  transferReason?: string;

  @ApiPropertyOptional({ description: 'Effective transfer timestamp (defaults to current time)', example: '2026-11-02T14:30:00Z' })
  @IsOptional()
  @IsDateString()
  transferDate?: string;
}
