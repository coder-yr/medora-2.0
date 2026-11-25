import { ApiProperty } from '@nestjs/swagger';
import { PatientResponseDto } from './patient-response.dto';

export class DuplicateMatchItemDto {
  @ApiProperty({ type: PatientResponseDto })
  patient!: PatientResponseDto;

  @ApiProperty({ example: ['phone', 'cnic'], description: 'Field(s) where the duplicate was detected' })
  matchedOn!: string[];
}

export class DuplicateCheckResponseDto {
  @ApiProperty({ example: true })
  hasMatch!: boolean;

  @ApiProperty({ example: 1 })
  matchCount!: number;

  @ApiProperty({ type: [DuplicateMatchItemDto] })
  matches!: DuplicateMatchItemDto[];
}
