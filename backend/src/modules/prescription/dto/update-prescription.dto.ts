import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PrescriptionItemDto } from './create-prescription.dto';

export class UpdatePrescriptionDto {
  @ApiPropertyOptional({
    description: 'Hospital patient database ID',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  patientId?: number;

  @ApiPropertyOptional({
    description: 'Prescribing doctor database ID',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  doctorId?: number;

  @ApiPropertyOptional({
    description: 'Prescription date in YYYY-MM-DD format',
    example: '2026-10-30',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Reported patient symptoms or clinical presentation',
    example: 'Persistent dry cough and mild fever',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  symptom?: string;

  @ApiPropertyOptional({
    description: 'Doctor medical advice or lifestyle guidance',
    example: 'Increase fluid intake and rest',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  advice?: string;

  @ApiPropertyOptional({
    description: 'Clinical notes or dispensing instructions',
    example: 'Return for review in 5 days',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({
    description: 'Prescription validity timeframe',
    example: '14 days',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  validity?: string;

  @ApiPropertyOptional({
    description: 'Prescription lifecycle state',
    example: 'issued',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  state?: string;

  @ApiPropertyOptional({
    description: 'Differential diagnosis or diagnostic code',
    example: 'Acute Bronchitis',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dd?: string;

  @ApiPropertyOptional({
    description: 'Updated list of medication items wholesale replacing prior prescription lines.',
    type: [PrescriptionItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items?: PrescriptionItemDto[];
}
