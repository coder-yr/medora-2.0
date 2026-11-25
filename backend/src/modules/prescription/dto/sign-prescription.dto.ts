import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SignPrescriptionDto {
  @ApiPropertyOptional({
    description: 'Optional clinical sign-off notes or verification remarks',
    example: 'Reviewed and confirmed against patient clinical chart',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  signatureNotes?: string;
}
