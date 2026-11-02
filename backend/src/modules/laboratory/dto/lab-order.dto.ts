import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLabOrderDto {
  @ApiProperty({ description: 'Target Patient ID', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'Patient ID must be an integer.' })
  @Min(1)
  patientId!: number;

  @ApiPropertyOptional({ description: 'Requesting Doctor ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  doctorId?: number;

  @ApiPropertyOptional({ description: 'Associated Appointment ID', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  appointmentId?: number;

  @ApiPropertyOptional({ description: 'Associated Consultation encounter ID', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  consultationId?: number;

  @ApiPropertyOptional({ description: 'Order date (YYYY-MM-DD)', example: '2026-10-31' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Clinical priority',
    enum: ['ROUTINE', 'URGENT', 'STAT'],
    default: 'ROUTINE',
    example: 'ROUTINE',
  })
  @IsOptional()
  @IsIn(['ROUTINE', 'URGENT', 'STAT'])
  priority?: string;

  @ApiPropertyOptional({ description: 'Clinical indications, provisional diagnosis, or notes' })
  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @ApiProperty({
    description: 'Array of LabCategory / Test Catalogue IDs to order',
    example: [1, 2],
    type: [Number],
  })
  @IsArray({ message: 'Tests must be an array of test catalogue IDs.' })
  @ArrayMinSize(1, { message: 'Choose at least one test, or the request asks for nothing.' })
  @Type(() => Number)
  @IsInt({ each: true })
  testIds!: number[];

  @ApiPropertyOptional({
    description: 'Whether to automatically raise a billing invoice in InvoiceModule',
    default: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  generateInvoice?: boolean;
}

export class CancelLabOrderDto {
  @ApiProperty({ description: 'Clinical reason for cancelling the lab order', example: 'Patient declined phlebotomy' })
  @IsNotEmpty({ message: 'Cancellation reason is required.' })
  @IsString()
  @MaxLength(1000)
  reason!: string;
}
