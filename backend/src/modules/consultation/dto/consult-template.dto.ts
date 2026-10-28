import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateConsultTemplateDto {
  @ApiProperty({
    description: 'Template title or descriptive name',
    example: 'Viral Upper Respiratory Infection',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Template name is required.' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Doctor ID for practitioner-specific templates, or null for hospital-wide',
    example: '1',
  })
  @IsOptional()
  doctorId?: string | number;

  @ApiProperty({
    description: 'Template field dictionary (presenting_complaint, history, provisional_diagnosis, diagnosis, plan, treatment, follow_up_notes)',
    example: {
      plan: 'Paracetamol, fluids, review in 3 days',
      provisional_diagnosis: 'Viral fever',
    },
  })
  @IsObject()
  fields!: Record<string, any>;
}
