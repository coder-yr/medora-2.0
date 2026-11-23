import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class VerifyMfaDto {
  @ApiProperty({ description: 'Short-lived MFA challenge ticket received from login' })
  @IsNotEmpty()
  @IsString()
  mfaTicket!: string;

  @ApiProperty({ example: '123456', description: '6-digit TOTP code or 8-10 character recovery code' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ example: false, required: false, description: 'True if code is an emergency recovery backup code' })
  @IsOptional()
  @IsBoolean()
  isRecovery?: boolean;
}

export class ConfirmMfaDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code from authenticator app' })
  @IsNotEmpty()
  @IsString()
  code!: string;
}

export class DisableMfaDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code or recovery code to confirm identity' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'Current account password for authorization' })
  @IsNotEmpty()
  @IsString()
  password!: string;
}
