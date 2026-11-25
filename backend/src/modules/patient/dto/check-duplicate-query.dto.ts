import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CheckDuplicateQueryDto {
  @ApiPropertyOptional({ example: '03001234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '35201-1234567-1' })
  @IsOptional()
  @IsString()
  cnic?: string;

  @ApiPropertyOptional({ example: 'Amina Yousaf' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsOptional()
  @IsString()
  birthdate?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  branchId?: string;
}
