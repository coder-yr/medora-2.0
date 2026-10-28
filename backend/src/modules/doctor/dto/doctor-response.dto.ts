import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DoctorResponseDto {
  @ApiProperty({ example: '1', description: 'Doctor database ID serialized as string' })
  id!: string;

  @ApiProperty({ example: 'Dr Sana Riaz' })
  name!: string;

  @ApiPropertyOptional({ example: 'sana.riaz@medora.hospital', nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ example: '+92 300 1234567', nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'Suite 401, Medical Towers, Islamabad', nullable: true })
  address!: string | null;

  @ApiPropertyOptional({ example: 'Cardiology', nullable: true })
  department!: string | null;

  @ApiPropertyOptional({ example: 'MBBS, FCPS', nullable: true })
  profile!: string | null;

  @ApiPropertyOptional({ example: 'doctors/photo_123.jpg', nullable: true })
  imageUrl!: string | null;

  @ApiPropertyOptional({ example: '5', nullable: true, description: 'Linked Ion/User account ID' })
  ionUserId!: string | null;

  @ApiProperty({
    example: false,
    description: 'True if doctor has an active portal sign-in account',
  })
  hasLogin!: boolean;

  @ApiPropertyOptional({ example: 'sana.riaz', nullable: true })
  loginUsername!: string | null;

  @ApiProperty({ example: 3, description: 'Active upcoming appointments booked for this doctor' })
  upcomingAppointments!: number;

  @ApiPropertyOptional({ example: '1', nullable: true })
  branchId!: string | null;

  @ApiPropertyOptional({ example: '2026-10-28T12:00:00.000Z', nullable: true })
  createdAt!: string | null;

  @ApiPropertyOptional({ example: '2026-10-28T12:00:00.000Z', nullable: true })
  updatedAt!: string | null;
}

export class PaginatedDoctorsDto {
  @ApiProperty({ type: [DoctorResponseDto] })
  items!: DoctorResponseDto[];

  @ApiProperty({
    example: {
      total: 10,
      page: 1,
      limit: 25,
      totalPages: 1,
    },
  })
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
