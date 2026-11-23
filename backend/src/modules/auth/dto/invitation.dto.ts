import { IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInvitationDto {
  @ApiProperty({ example: 'a9b2c3d4...' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'MySecurePassword123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Dr. John Doe', required: false })
  @IsString()
  @IsOptional()
  name?: string;
}
