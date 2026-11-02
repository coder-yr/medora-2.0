import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ResultParameterValueDto {
  @ApiProperty({ description: 'Referenced LabTest line item ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  testId!: number;

  @ApiPropertyOptional({ description: 'Referenced LabTestParameter ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parameterId?: number;

  @ApiProperty({ description: 'Parameter Name', example: 'Hemoglobin' })
  @IsNotEmpty({ message: 'Parameter name is required.' })
  @IsString()
  @MaxLength(100)
  parameterName!: string;

  @ApiProperty({ description: 'Numerical or textual test result reading', example: '14.2' })
  @IsString()
  @MaxLength(255)
  value!: string;

  @ApiPropertyOptional({ description: 'Measurement unit snapshot', example: 'g/dL' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unitSnapshot?: string;

  @ApiPropertyOptional({ description: 'Reference range snapshot', example: '13.5 - 17.5 g/dL' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referenceRangeSnapshot?: string;

  @ApiPropertyOptional({
    description: 'Abnormal evaluation flag',
    enum: ['NORMAL', 'HIGH', 'LOW', 'CRITICAL', 'ABNORMAL'],
    default: 'NORMAL',
    example: 'NORMAL',
  })
  @IsOptional()
  @IsIn(['NORMAL', 'HIGH', 'LOW', 'CRITICAL', 'ABNORMAL'])
  abnormalFlag?: string;

  @ApiPropertyOptional({ description: 'Technologist comments or observations' })
  @IsOptional()
  @IsString()
  clinicalComments?: string;
}

export class EnterResultsDto {
  @ApiProperty({
    description: 'Array of parameter readings',
    type: [ResultParameterValueDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Provide at least one parameter result reading.' })
  @ValidateNested({ each: true })
  @Type(() => ResultParameterValueDto)
  parameters!: ResultParameterValueDto[];

  @ApiPropertyOptional({
    description: 'General summary or pathologist impression across this result entry',
  })
  @IsOptional()
  @IsString()
  summary?: string;
}

export class VerifyResultsDto {
  @ApiPropertyOptional({ description: 'Verifier clinical review comments' })
  @IsOptional()
  @IsString()
  comments?: string;
}

export class ApproveReportDto {
  @ApiPropertyOptional({ description: 'Pathologist authorization and clinical signature remarks' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
