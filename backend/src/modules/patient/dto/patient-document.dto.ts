import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePatientDocumentDto {
  @ApiProperty({ example: 'Lab Report - Blood Test Nov 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional({ example: 'LAB_REPORT' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentType?: string;

  @ApiProperty({ example: 'https://storage.medora.health/patients/doc-123.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileUrl!: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @ApiPropertyOptional({ example: 204800 })
  @IsOptional()
  fileSize?: number;

  @ApiPropertyOptional({ example: 'External laboratory baseline report' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  branchId?: number;
}

export class PatientDocumentResponseDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '1' })
  patientId!: string;

  @ApiPropertyOptional({ example: '1' })
  branchId?: string | null;

  @ApiProperty({ example: 'Lab Report - Blood Test Nov 2026' })
  title!: string;

  @ApiProperty({ example: 'LAB_REPORT' })
  documentType!: string;

  @ApiProperty({ example: 'https://storage.medora.health/patients/doc-123.pdf' })
  fileUrl!: string;

  @ApiPropertyOptional({ example: 204800 })
  fileSize?: number | null;

  @ApiPropertyOptional({ example: 'application/pdf' })
  mimeType?: string | null;

  @ApiPropertyOptional({ example: 'External laboratory baseline report' })
  notes?: string | null;

  @ApiPropertyOptional({ example: 'Dr. Tariq Khan' })
  uploadedByName?: string | null;

  @ApiPropertyOptional()
  createdAt?: string | null;
}
