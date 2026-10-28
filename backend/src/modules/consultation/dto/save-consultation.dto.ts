import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SaveConsultationDto {
  @ApiPropertyOptional({
    description: 'Patient primary presenting complaint',
    example: 'Fever for 3 days and sore throat',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  presenting_complaint?: string;

  @ApiPropertyOptional({
    description: 'Detailed clinical history of presenting illness',
    example: 'High grade fever with chills and dry cough since Tuesday',
    maxLength: 10000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  history?: string;

  @ApiPropertyOptional({
    description: 'Provisional or working clinical diagnosis',
    example: 'Viral fever / URTI',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  provisional_diagnosis?: string;

  @ApiPropertyOptional({
    description: 'Final confirmed diagnosis',
    example: 'Acute upper respiratory tract infection',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diagnosis?: string;

  @ApiPropertyOptional({
    description: 'Clinical management and investigation plan',
    example: 'Paracetamol 500mg TDS, oral rehydration, complete blood count',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  plan?: string;

  @ApiPropertyOptional({
    description: 'Treatment prescribed or administered',
    example: 'Tab Paracetamol 500mg 1 tab TDS for 3 days',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  treatment?: string;

  @ApiPropertyOptional({
    description: 'Recommended follow-up appointment date (YYYY-MM-DD)',
    example: '2026-11-05',
  })
  @IsOptional()
  @IsDateString({}, { message: 'follow_up_date must be a valid YYYY-MM-DD date.' })
  follow_up_date?: string;

  @ApiPropertyOptional({
    description: 'Specific follow-up instructions or warning signs',
    example: 'Review SOS if high fever persists > 48 hours or shortness of breath',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  follow_up_notes?: string;

  @ApiPropertyOptional({
    description: 'Known drug or food allergies',
    example: 'Penicillin: rash and facial swelling',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  allergies?: string;

  @ApiPropertyOptional({
    description: 'System-by-system physical examination findings grid',
    example: {
      chest: { status: 'abnormal', note: 'Crepitations right lung base' },
      cvs: { status: 'normal', note: 'S1 S2 heard' },
    },
  })
  @IsOptional()
  @IsObject()
  exam?: Record<string, { status?: string; note?: string }>;

  @ApiPropertyOptional({ description: 'Alias for exam findings' })
  @IsOptional()
  examination?: any;

  @ApiPropertyOptional({
    description: 'Past medical history conditions',
    example: { diabetes: 'Since 2019, on metformin', hypertension: 'Controlled on amlodipine' },
  })
  @IsOptional()
  @IsObject()
  past?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Alias for past medical history' })
  @IsOptional()
  past_history?: any;

  @ApiPropertyOptional({
    description: 'Social and lifestyle history',
    example: { smoking: 'Non-smoker', occupation: 'Teacher' },
  })
  @IsOptional()
  @IsObject()
  social?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Alias for social history' })
  @IsOptional()
  social_history?: any;

  @ApiPropertyOptional({
    description: 'Gynaecology and obstetric section (LMP, gravidity, parity)',
    example: { lmp: '2026-01-01', g: '2', p: '1' },
  })
  @IsOptional()
  @IsObject()
  gynae?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Dental clinic examination and notes',
    example: { tooth_16: 'Caries present, advised restoration' },
  })
  @IsOptional()
  @IsObject()
  dental?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Eye / ophthalmology examination findings',
    example: { re_va: '6/6', le_va: '6/9' },
  })
  @IsOptional()
  @IsObject()
  eye?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Immunization history (vaccine name -> administration date)',
    example: { 'COVID-19': '2022-04-15', 'Hepatitis B': '2018-09-10' },
  })
  @IsOptional()
  @IsObject()
  vaccines?: Record<string, string>;

  // Visit vitals updated simultaneously on the appointment record
  @ApiPropertyOptional({ description: 'Blood pressure reading', example: '120/80' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  b_p?: string;

  @ApiPropertyOptional({ description: 'Pulse rate in bpm', example: '72' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pulse?: string;

  @ApiPropertyOptional({ description: 'Body temperature', example: '98.6 F' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  temprature?: string;

  @ApiPropertyOptional({ description: 'Weight in kg', example: '70' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  weight?: string;

  // Downstream orders (integration points)
  @ApiPropertyOptional({
    description: 'Lab test catalogue IDs requested during this consultation',
    example: [1, 4],
  })
  @IsOptional()
  @IsArray()
  lab_tests?: (number | string)[];

  @ApiPropertyOptional({
    description: 'Radiology examination IDs requested during this consultation',
    example: [2],
  })
  @IsOptional()
  @IsArray()
  radiology_exams?: (number | string)[];

  @ApiPropertyOptional({
    description: 'Urgency flag for ordered radiology exams',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  radiology_urgent?: boolean;

  @ApiPropertyOptional({
    description: 'Encounter action: "save" keeps draft, "complete" finalises consultation and checks out visit',
    enum: ['save', 'complete'],
    default: 'save',
  })
  @IsOptional()
  @IsIn(['save', 'complete'], { message: 'Action must be "save" or "complete".' })
  action?: 'save' | 'complete';

  @ApiPropertyOptional({
    description: 'Optional template name to save this consultation note as a reusable template',
    example: 'Viral Upper Respiratory Infection',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  template_name?: string;
}
