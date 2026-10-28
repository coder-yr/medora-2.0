import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const PAYMENT_METHODS = [
  'Cash',
  'Card',
  'Bank transfer',
  'Cheque',
  'Online',
  'Write-off',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Payment installment amount in PKR. Cannot exceed outstanding balance.',
    example: 300.0,
  })
  @IsNotEmpty({ message: 'Amount is required.' })
  @IsNumber({}, { message: 'Amount must be a valid number.' })
  @Min(0.01, { message: 'Payment amount must be at least 0.01.' })
  amount!: number;

  @ApiPropertyOptional({
    description: 'Tender payment method',
    enum: PAYMENT_METHODS,
    default: 'Cash',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  method?: string;

  @ApiPropertyOptional({
    description: 'Transaction receipt number, cheque number, or bank reference',
    example: 'TXN-984210',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({
    description: 'Payment transaction timestamp or date (YYYY-MM-DD)',
    example: '2026-10-28',
  })
  @IsOptional()
  @IsString()
  date?: string;
}
