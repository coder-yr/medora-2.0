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

  @ApiProperty({
    example: 'Admin',
    enum: ['Admin', 'Doctor', 'Nurse', 'Accountant', 'Receptionist', 'Pharmacist', 'Laboratorist'],
    description: 'Resolved staff role moniker for client workspace rendering',
  })
  role!: HospitalRole;

  @ApiProperty({ example: ['patient_view', 'patient_add'] })
  permissions!: string[];

  @ApiProperty({ example: '1', nullable: true })
  branchId?: string | null;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT Access Token (short-lived, 15m)' })
  accessToken!: string;

  @ApiProperty({ description: 'Opaque cryptographically secure refresh token', required: false })
  refreshToken?: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string = 'Bearer';

  @ApiProperty({ example: 900, description: 'Token expiration in seconds (15 minutes)' })
  expiresIn: number = 900;

  @ApiProperty({ type: () => UserProfileDto })
  user!: UserProfileDto;
}
