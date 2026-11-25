import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AmendConsultationDto {
  @ApiProperty({
    description: 'Mandatory clinical justification or reason for amending the signed consultation record',
    example: 'Patient contacted clinic regarding mild nausea after taking first antibiotic dose; adjusted dosage plan',
  })
  @IsString()
  @IsNotEmpty({ message: 'Amendment reason is required.' })
  @MaxLength(1000)
  reason!: string;

  @ApiProperty({
    description: 'Clinical section being amended (e.g. SOAP_PLAN, DIAGNOSIS, TREATMENT, GENERAL)',
    example: 'SOAP_PLAN',
  })
  @IsString()
  @IsNotEmpty({ message: 'Amended section identifier is required.' })
  @MaxLength(50)
  amendedSection!: string;

  @ApiProperty({
    description: 'The updated clinical notes or addendum content',
    example: 'Addendum: Switched from Amoxicillin 500mg to Cefixime 400mg OD due to reported gastrointestinal distress.',
  })
  @IsString()
  @IsNotEmpty({ message: 'New notes or addendum text is required.' })
  @MaxLength(10000)
  newNotes!: string;

  @ApiPropertyOptional({
    description: 'Previous note content for differential tracking',
  })
  @IsOptional()
  @IsString()
  previousNotes?: string;
}
