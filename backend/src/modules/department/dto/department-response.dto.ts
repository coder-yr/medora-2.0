import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DepartmentResponseDto {
  @ApiProperty({ example: '1', description: 'Internal primary key serialized as string' })
  id!: string;

  @ApiProperty({ example: 'Cardiology' })
  name!: string;

  @ApiPropertyOptional({ example: 'Adult and pediatric cardiovascular care', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 4, description: 'Number of active doctors assigned to this department' })
  doctorCount!: number;

  @ApiPropertyOptional({ example: '2026-10-28T12:00:00.000Z', nullable: true })
  createdAt!: string | null;

  @ApiPropertyOptional({ example: '2026-10-28T12:00:00.000Z', nullable: true })
  updatedAt!: string | null;
}

export class DepartmentUpdateResultDto {
  @ApiProperty({ type: DepartmentResponseDto })
  department!: DepartmentResponseDto;

  @ApiProperty({
    example: 2,
    description: 'Number of doctor records whose department string was cascaded',
  })
  movedDoctors!: number;

  @ApiProperty({ example: 'Cardiology updated. 2 doctor record(s) moved with it.' })
  message!: string;
}

export class DepartmentListResponseDto {
  @ApiProperty({ type: [DepartmentResponseDto] })
  departments!: DepartmentResponseDto[];

  @ApiProperty({
    type: [String],
    example: ['Orthopaedics', 'Neurology'],
    description: 'Departments doctors refer to that are not yet on the catalogue list',
  })
  unlisted!: string[];
}

export class DepartmentAdoptResultDto {
  @ApiProperty({ example: 2 })
  adoptedCount!: number;

  @ApiProperty({
    type: [String],
    example: ['Orthopaedics', 'Neurology'],
  })
  adoptedNames!: string[];

  @ApiProperty({ example: 'Added 2 department(s) already in use by doctors.' })
  message!: string;
}
