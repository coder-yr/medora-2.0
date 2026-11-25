import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelPrescriptionDto {
  @ApiProperty({
    description: 'Mandatory clinical justification for cancelling the prescription',
    example: 'Adverse allergic reaction suspected or drug therapy discontinued',
  })
  @IsNotEmpty({ message: 'Cancellation reason is required.' })
  @IsString()
  @MaxLength(1000)
  reason!: string;
}
