import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelInvoiceDto {
  @ApiProperty({
    description: 'Reason for voiding / cancelling the invoice',
    example: 'Duplicate invoice raised in error by reception.',
  })
  @IsNotEmpty({ message: 'Cancellation reason is mandatory.' })
  @IsString()
  reason!: string;
}
