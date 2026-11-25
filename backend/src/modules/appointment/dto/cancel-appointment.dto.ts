import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelAppointmentDto {
  @ApiProperty({
    description: 'Reason for cancelling the appointment',
    example: 'Patient feeling better, no longer requires in-person visit',
  })
  @IsString()
  @IsNotEmpty({ message: 'Cancellation reason is required.' })
  @MaxLength(500)
  reason!: string;
}
