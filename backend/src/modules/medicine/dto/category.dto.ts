import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Antibiotics',
    description: 'Category name (Required)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MaxLength(100)
  category!: string;

  @ApiPropertyOptional({
    example: 'Antimicrobial and antibacterial pharmaceutical agents',
    description: 'Category description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Active status (Default true)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
