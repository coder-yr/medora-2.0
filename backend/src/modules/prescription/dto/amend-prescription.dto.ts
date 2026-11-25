import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AmendPrescriptionDto {
  @ApiProperty({
    description: 'Clinical justification for amending the signed prescription',
    example: 'Dose adjustment required due to hepatic panel results',
  })
  @IsNotEmpty({ message: 'Amendment reason is required.' })
  @IsString()
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Clinical section being amended',
    example: 'MEDICATION_DOSAGE',
    default: 'GENERAL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  amendedSection?: string;

  @ApiPropertyOptional({
    description: 'Previous notes or instructions being superseded',
    example: 'Paracetamol 500mg TDS',
  })
  @IsOptional()
  @IsString()
  previousNotes?: string;

  @ApiProperty({
    description: 'New instructions, dosage, or clinical addendum',
    example: 'Amended to Paracetamol 250mg TDS as tolerated',
  })
  @IsNotEmpty({ message: 'New notes or instructions are required.' })
  @IsString()
  newNotes!: string;
}
