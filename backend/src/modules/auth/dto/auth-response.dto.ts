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

  @ApiProperty({ example: '1', nullable: true, required: false })
  organizationId?: string | null;

  @ApiProperty({ example: 'Admin', nullable: true, required: false })
  organizationRole?: string | null;

  @ApiProperty({ example: 'HOSPITAL', nullable: true, required: false })
  organizationEdition?: string | null;

  @ApiProperty({ example: 'ACTIVE', nullable: true, required: false })
  organizationStatus?: string | null;

  @ApiProperty({ type: [Object], required: false })
  organizations?: Array<{
    id: string;
    name: string;
    role: string;
    edition: string;
    status: string;
    isDefault: boolean;
  }>;

  @ApiProperty({ example: false, required: false })
  isSuperAdmin?: boolean;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT Access Token (short-lived, 15m)', required: false })
  accessToken!: string;

  @ApiProperty({ description: 'Opaque cryptographically secure refresh token', required: false })
  refreshToken?: string;

  @ApiProperty({ example: 'Bearer', required: false })
  tokenType: string = 'Bearer';

  @ApiProperty({ example: 900, description: 'Token expiration in seconds (15 minutes)', required: false })
  expiresIn: number = 900;

  @ApiProperty({ type: () => UserProfileDto })
  user!: UserProfileDto;

  @ApiProperty({ example: false, required: false })
  mfaRequired?: boolean;

  @ApiProperty({ example: 'mfa_ticket_jwt_token', required: false })
  mfaTicket?: string;
}
