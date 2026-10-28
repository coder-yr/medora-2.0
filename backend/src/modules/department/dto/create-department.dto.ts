import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({
    example: 'Cardiology',
    description: 'Unique name of the hospital department or specialty',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Department name is required' })
  @IsString()
  @MaxLength(100, { message: 'Department name cannot exceed 100 characters' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Adult and pediatric cardiovascular diagnostics and surgery',
    description: 'Detailed clinical scope and operational description',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description?: string;
}
