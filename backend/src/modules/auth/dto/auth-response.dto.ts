import { ApiProperty } from '@nestjs/swagger';
import { HospitalRole } from '../../../common/types/auth-user.interface';

export class UserProfileDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'admin@medora.hospital' })
  email!: string;

  @ApiProperty({ example: 'Hospital Administrator' })
  name!: string;

  @ApiProperty({
    example: 'Admin',
    enum: ['Admin', 'Doctor', 'Nurse', 'Accountant', 'Receptionist', 'Pharmacist', 'Laboratorist'],
  })
  group!: HospitalRole;

  @ApiProperty({ example: ['patient_view', 'patient_add'] })
  permissions!: string[];

  @ApiProperty({ example: '1', nullable: true })
  branchId?: string | null;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT Access Token' })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string = 'Bearer';

  @ApiProperty({ example: 86400, description: 'Token expiration in seconds' })
  expiresIn: number = 86400;

  @ApiProperty({ type: () => UserProfileDto })
  user!: UserProfileDto;
}
