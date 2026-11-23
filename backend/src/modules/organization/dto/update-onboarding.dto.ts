import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOnboardingDto {
  @ApiProperty({ example: 'staff_invitation', required: false })
  @IsString()
  @IsOptional()
  currentStep?: string;

  @ApiProperty({ example: 'staff_invitation', required: false })
  @IsString()
  @IsOptional()
  stepKey?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  completed?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;

  @ApiProperty({ example: {}, required: false })
  @IsObject()
  @IsOptional()
  checklist?: Record<string, any>;
}
