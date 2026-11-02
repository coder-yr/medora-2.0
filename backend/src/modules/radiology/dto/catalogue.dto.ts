import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRadiologyCategoryDto {
  @ApiProperty({ description: 'Category name (e.g. Plain Radiography, Computed Tomography, Ultrasonography)' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Imaging modality (xray, ultrasound, ct, mri, mammography, fluoroscopy, other)' })
  @IsString()
  @IsNotEmpty()
  modality!: string;

  @ApiPropertyOptional({ description: 'Description of clinical scope' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Display order priority' })
  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateRadiologyCategoryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  modality?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateRadiologyExamDto {
  @ApiPropertyOptional({ description: 'Procedure code (e.g. RAD-XR-001, auto-generated if omitted)' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ description: 'Exam name (e.g. Chest X-Ray PA View)' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Imaging modality (xray, ultrasound, ct, mri, mammography, fluoroscopy, other)' })
  @IsString()
  @IsNotEmpty()
  modality!: string;

  @ApiPropertyOptional({ description: 'Anatomical region (Chest, Abdomen, Pelvis, Brain, Spine, etc.)' })
  @IsString()
  @IsOptional()
  bodyPart?: string;

  @ApiPropertyOptional({ description: 'Linked RadiologyCategory ID' })
  @IsNumber()
  @IsOptional()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Linked PaymentCategory ID for price list' })
  @IsNumber()
  @IsOptional()
  paymentCategoryId?: number;

  @ApiPropertyOptional({ description: 'Service charge in PKR' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: 'Default boilerplate report template' })
  @IsString()
  @IsOptional()
  reportTemplate?: string;

  @ApiPropertyOptional({ description: 'Patient preparation instructions' })
  @IsString()
  @IsOptional()
  preparationInstructions?: string;

  @ApiPropertyOptional({ description: 'Expected turnaround time in hours', default: 24 })
  @IsInt()
  @Min(1)
  @IsOptional()
  turnaroundHours?: number;

  @ApiPropertyOptional({ description: 'Active status', default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class UpdateRadiologyExamDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  modality?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bodyPart?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  categoryId?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  paymentCategoryId?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reportTemplate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  preparationInstructions?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  turnaroundHours?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
