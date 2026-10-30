import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PrescriptionQueryDto {
  @ApiPropertyOptional({
    description: 'Filter prescriptions by Patient ID',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  patient?: number;

  @ApiPropertyOptional({
    description: 'Filter prescriptions by Doctor ID',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  doctor?: number;

  @ApiPropertyOptional({
    description: 'Search prescriptions by prescribed drug / medicine name',
    example: 'Amoxil',
  })
  @IsOptional()
  @IsString()
  drug?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of prescriptions per page',
    default: 25,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}
