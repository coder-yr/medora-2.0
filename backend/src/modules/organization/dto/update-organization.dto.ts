import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationStatusDto, OrganizationTypeDto } from './create-organization.dto';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ description: 'Organization display name', example: 'Al-Shifa Family Polyclinic' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({
    description: 'Healthcare organization facility type',
    enum: OrganizationTypeDto,
  })
  @IsEnum(OrganizationTypeDto)
  @IsOptional()
  type?: OrganizationTypeDto;

  @ApiPropertyOptional({
    description: 'Subscription / operational status',
    enum: OrganizationStatusDto,
  })
  @IsEnum(OrganizationStatusDto)
  @IsOptional()
  status?: OrganizationStatusDto;
}
