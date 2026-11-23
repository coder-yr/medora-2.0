import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class SwitchOrganizationDto {
  @ApiProperty({ description: 'Target organization ID to switch workspace context into', example: '2' })
  @IsNotEmpty()
  organizationId!: string | number;
}
