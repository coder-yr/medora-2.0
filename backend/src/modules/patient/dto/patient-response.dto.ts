import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PatientResponseDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({
    example: '000001',
    description: '6-digit zero-padded sequential hospital MR number',
  })
  patientId!: string;

  @ApiProperty({ example: 'Amina Yousaf' })
  name!: string;

  @ApiPropertyOptional({ example: 'Muhammad Yousaf' })
  fatherName?: string | null;

  @ApiPropertyOptional({ example: 'amina@example.com' })
  email?: string | null;

  @ApiPropertyOptional({ example: '03001234567' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'House 12, Street 4, Islamabad' })
  address?: string | null;

  @ApiPropertyOptional({ example: '1990-05-15' })
  birthdate?: string | null;

  @ApiPropertyOptional({ example: '34', description: 'Age derived from birthdate' })
  age?: string | null;

  @ApiPropertyOptional({ example: 'female' })
  sex?: string | null;

  @ApiPropertyOptional({ example: 'O+' })
  bloodGroup?: string | null;

  @ApiPropertyOptional({ example: '35201-1234567-1' })
  cnic?: string | null;

  @ApiPropertyOptional({ example: 'Father' })
  guardianRelation?: string | null;

  @ApiPropertyOptional({ example: '000045' })
  guardianMrn?: string | null;

  @ApiProperty({ example: false })
  mlc!: boolean;

  @ApiPropertyOptional({ example: 'OLD-MRN-2022' })
  oldMrn?: string | null;

  @ApiPropertyOptional({ example: 'EMP-9082' })
  employeeNo?: string | null;

  @ApiPropertyOptional({ example: '03119876543' })
  altPhone?: string | null;

  @ApiPropertyOptional({ example: 'Islamabad' })
  city?: string | null;

  @ApiPropertyOptional({ example: 'Dr. Tariq Khan' })
  attendingDoctor?: string | null;

  @ApiPropertyOptional({ example: 'patients/avatar.jpg' })
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: '2026-10-28' })
  addDate?: string | null;

  @ApiPropertyOptional({ example: '2026-10-28T18:00:00.000Z' })
  registrationTime?: string | null;

  @ApiPropertyOptional({ example: 'front desk' })
  howAdded?: string | null;

  @ApiPropertyOptional({ example: '1' })
  patientTypeId?: string | null;

  @ApiPropertyOptional({ example: '1' })
  branchId?: string | null;

  @ApiPropertyOptional()
  createdAt?: string | null;

  @ApiPropertyOptional()
  updatedAt?: string | null;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  limit!: number;

  @ApiProperty({ example: 4 })
  totalPages!: number;
}

export class PaginatedPatientsDto {
  @ApiProperty({ type: [PatientResponseDto] })
  items!: PatientResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
