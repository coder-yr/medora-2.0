import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const DISCHARGE_CONDITIONS = [
  'RECOVERED',
  'IMPROVED',
  'UNCHANGED',
  'REFERRED',
  'DECEASED',
  'LAMA', // Left Against Medical Advice
] as const;

export class RequestDischargeDto {
  @ApiPropertyOptional({ description: 'Provisional discharge summary / plan', example: 'Patient afebrile for 48h, surgical wound clean' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: 'Condition at discharge request', enum: DISCHARGE_CONDITIONS, default: 'IMPROVED' })
  @IsOptional()
  @IsIn(DISCHARGE_CONDITIONS)
  condition?: string;
}

export class CompleteDischargeDto {
  @ApiPropertyOptional({ description: 'Discharge timestamp (defaults to current time)', example: '2026-11-06T12:00:00Z' })
  @IsOptional()
  @IsDateString()
  dischargeDate?: string;

  @ApiProperty({ description: 'Final Discharge Summary and instructions', example: 'Patient discharged in stable condition. Oral antibiotics continued for 5 days. Follow-up OPD in 1 week.' })
  @IsString()
  @IsNotEmpty()
  dischargeSummary!: string;

  @ApiProperty({ description: 'Discharge condition', enum: DISCHARGE_CONDITIONS, example: 'RECOVERED' })
  @IsIn(DISCHARGE_CONDITIONS)
  @IsNotEmpty()
  dischargeCondition!: string;

  @ApiPropertyOptional({ description: 'Create consolidated settlement invoice if folio has outstanding balance', default: true })
  @IsOptional()
  createSettlementInvoice?: boolean;
}
