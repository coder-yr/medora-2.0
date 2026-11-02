import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordArrivalDto {
  @ApiPropertyOptional({ description: 'Optional arrival triage notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class StartExaminationDto {
  @ApiPropertyOptional({ description: 'Assigned Technologist ID' })
  @IsNumber()
  @IsOptional()
  technologistId?: number;

  @ApiPropertyOptional({ description: 'Specific imaging equipment or room' })
  @IsString()
  @IsOptional()
  equipmentRoom?: string;
}

export class CompleteExaminationDto {
  @ApiPropertyOptional({ description: 'Technologist ID who completed scanning' })
  @IsNumber()
  @IsOptional()
  technologistId?: number;

  @ApiPropertyOptional({ description: 'Technical notes or protocol deviations' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Acquired image count' })
  @IsNumber()
  @IsOptional()
  imageCount?: number;
}

export class SaveReportDraftDto {
  @ApiPropertyOptional({ description: 'Radiological narrative report' })
  @IsString()
  @IsOptional()
  report?: string;

  @ApiPropertyOptional({ description: 'Radiological findings' })
  @IsString()
  @IsOptional()
  findings?: string;

  @ApiPropertyOptional({ description: 'Impression or provisional diagnostic conclusion' })
  @IsString()
  @IsOptional()
  impression?: string;

  @ApiPropertyOptional({ description: 'Follow-up or clinical recommendations' })
  @IsString()
  @IsOptional()
  recommendations?: string;
}

export class SubmitReportDto {
  @ApiPropertyOptional({ description: 'Radiological narrative report' })
  @IsString()
  @IsOptional()
  report?: string;

  @ApiPropertyOptional({ description: 'Detailed radiological observations' })
  @IsString()
  @IsOptional()
  findings?: string;

  @ApiProperty({ description: 'Diagnostic conclusion / impression (mandatory for formal report)' })
  @IsString()
  @IsNotEmpty({ message: 'A report needs an impression.' })
  impression!: string;

  @ApiPropertyOptional({ description: 'Clinical recommendations' })
  @IsString()
  @IsOptional()
  recommendations?: string;
}

export class VerifyReportDto {
  @ApiPropertyOptional({ description: 'Quality validation notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ApproveReportDto {
  @ApiPropertyOptional({ description: 'Consultant pathologist/radiologist release notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateRadiologyAmendmentDto {
  @ApiProperty({ description: 'Mandatory clinical justification for amending authorized report' })
  @IsString()
  @IsNotEmpty({ message: 'Amendment reason is required' })
  reason!: string;

  @ApiPropertyOptional({ description: 'Revised radiological findings' })
  @IsString()
  @IsOptional()
  findings?: string;

  @ApiPropertyOptional({ description: 'Revised diagnostic impression' })
  @IsString()
  @IsOptional()
  impression?: string;

  @ApiPropertyOptional({ description: 'Revised recommendations' })
  @IsString()
  @IsOptional()
  recommendations?: string;
}
