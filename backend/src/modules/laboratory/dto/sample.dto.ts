import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CollectSampleDto {
  @ApiPropertyOptional({ description: 'Optional phlebotomy collection notes', example: 'Right antecubital fossa' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ReceiveSampleDto {
  @ApiPropertyOptional({ description: 'Accessioning and temperature check remarks', example: 'Received on ice pack at 4C' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RejectSampleDto {
  @ApiProperty({
    description: 'Specimen rejection reason',
    enum: [
      'HEMOLYZED',
      'CLOTTED',
      'INSUFFICIENT_VOLUME',
      'WRONG_CONTAINER',
      'MISLABELED',
      'LEAKED_IN_TRANSIT',
      'TEMPERATURE_EXCURSION',
      'OTHER',
    ],
    example: 'HEMOLYZED',
  })
  @IsNotEmpty({ message: 'Rejection reason is required.' })
  @IsIn([
    'HEMOLYZED',
    'CLOTTED',
    'INSUFFICIENT_VOLUME',
    'WRONG_CONTAINER',
    'MISLABELED',
    'LEAKED_IN_TRANSIT',
    'TEMPERATURE_EXCURSION',
    'OTHER',
  ])
  reason!: string;

  @ApiPropertyOptional({ description: 'Additional clinical notes or recollection instructions' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
