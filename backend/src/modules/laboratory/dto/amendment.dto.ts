import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ResultParameterValueDto } from './result.dto';

export class AmendReportDto {
  @ApiProperty({
    description: 'Mandatory clinical justification for amending an approved report',
    example: 'Sample re-run on analyzer secondary module confirmed updated platelet count.',
  })
  @IsNotEmpty({ message: 'Amendment reason is required.' })
  @IsString()
  @MaxLength(1000)
  reason!: string;

  @ApiProperty({
    description: 'Updated parameter readings',
    type: [ResultParameterValueDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Provide at least one updated parameter result reading.' })
  @ValidateNested({ each: true })
  @Type(() => ResultParameterValueDto)
  parameters!: ResultParameterValueDto[];
}
