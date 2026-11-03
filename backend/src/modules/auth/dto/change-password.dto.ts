import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current user password', example: 'CurrentSecret123!' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({
    description: 'New strong password (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol)',
    example: 'NewSecurePassword2026!',
  })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long.' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/, {
    message: 'New password must contain at least one uppercase letter, one lowercase letter, and one number.',
  })
  newPassword!: string;
}
