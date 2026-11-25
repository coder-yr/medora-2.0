import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChartVitalsDto {
  @ApiPropertyOptional({ example: '120/80' })
  bp?: string;

  @ApiPropertyOptional({ example: '72' })
  pulse?: string;

  @ApiPropertyOptional({ example: '16' })
  respiratoryRate?: string;

  @ApiPropertyOptional({ example: '98.6 F' })
  temperature?: string;

  @ApiPropertyOptional({ example: '98%' })
  oxygenSaturation?: string;

  @ApiPropertyOptional({ example: '175 cm' })
  height?: string;

  @ApiPropertyOptional({ example: '70 kg' })
  weight?: string;

  @ApiPropertyOptional({ example: '22.9' })
  bmi?: string;

  @ApiPropertyOptional({ example: '2026-11-23T10:00:00Z' })
  recordedAt?: string;

  @ApiPropertyOptional({ example: 'Nurse Fatima' })
  recordedBy?: string;
}

export class ChartDiagnosisDto {
  @ApiProperty({ example: 'PRIMARY' })
  type!: string;

  @ApiProperty({ example: 'Essential Hypertension' })
  description!: string;

  @ApiPropertyOptional({ example: 'I10' })
  code?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  diagnosedDate?: string;

  @ApiPropertyOptional({ example: 'Dr. Tariq Khan' })
  diagnosedBy?: string;
}

export class PatientClinicalChartDto {
  @ApiProperty({ description: 'Patient demographic and identification data' })
  patient!: {
    id: string;
    patientId: string;
    name: string;
    sex: string | null;
    birthdate: string | null;
    age: number | null;
    phone: string | null;
    bloodGroup: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelation: string | null;
  };

  @ApiProperty({
    example: 'NKDA',
    description: 'Explicit allergy status: NKDA (No Known Drug Allergies), ALLERGIES_RECORDED, or UNKNOWN',
  })
  allergyStatus!: 'NKDA' | 'ALLERGIES_RECORDED' | 'UNKNOWN';

  @ApiPropertyOptional({ example: 'Penicillin: rash and dyspnea' })
  allergies?: string | null;

  @ApiProperty({ description: 'Medical, surgical, and social history records' })
  history!: {
    medicalConditions: Record<string, string> | null;
    surgicalHistory: Record<string, string> | null;
    familyHistory: Record<string, string> | null;
    socialHistory: Record<string, string> | null;
  };

  @ApiPropertyOptional({ type: ChartVitalsDto })
  latestVitals?: ChartVitalsDto | null;

  @ApiProperty({ type: [ChartDiagnosisDto] })
  diagnoses!: ChartDiagnosisDto[];

  @ApiProperty({ description: 'Active and past medication prescriptions' })
  prescriptions!: any[];

  @ApiProperty({ description: 'Previous outpatient consultations and SOAP notes' })
  consultations!: any[];

  @ApiProperty({ description: 'Laboratory test orders and verified results' })
  labResults!: any[];

  @ApiProperty({ description: 'Radiology imaging orders and reports' })
  radiologyReports!: any[];

  @ApiProperty({ description: 'Uploaded clinical documents' })
  documents!: any[];

  @ApiProperty({ description: 'Past clinical appointments' })
  previousAppointments!: any[];
}
