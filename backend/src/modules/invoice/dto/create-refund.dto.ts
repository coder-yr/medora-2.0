import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateRefundDto {
  @ApiProperty({
    description: 'Refund amount in INR. Cannot exceed cumulative refundable payments.',
    example: 100.0,
  })
  @IsNotEmpty({ message: 'Refund amount is required.' })
  @IsNumber({}, { message: 'Refund amount must be a number.' })
  @Min(0.01, { message: 'Refund amount must be at least 0.01.' })
  amount!: number;

  @ApiProperty({
    description: 'Mandatory clinical or administrative reason for the refund',
    example: 'Patient opted out of test procedure before sample collection.',
  })
  @IsNotEmpty({ message: 'Refund reason is mandatory.' })
  @IsString()
  reason!: string;

  @ApiPropertyOptional({
    description: 'Optional ID of the specific InvoicePayment receipt being refunded',
    example: '1',
  })
  @IsOptional()
  invoice_payment_id?: string | number;

  @ApiPropertyOptional({
    description: 'Refund disbursement method (Cash, UPI, Bank transfer, Card, Original Method)',
    example: 'Cash',
    default: 'Cash',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  method?: string;
}
