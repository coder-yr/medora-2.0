import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoicePatientSummaryDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '000001' })
  patientId!: string;

  @ApiProperty({ example: 'Amina Yousaf' })
  name!: string;

  @ApiPropertyOptional({ example: '+923001234567' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Sector G-9, Islamabad' })
  address?: string | null;
}

export class InvoiceDoctorSummaryDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Dr Nadia Aslam' })
  name!: string;

  @ApiPropertyOptional({ example: 'Cardiology' })
  department?: string | null;
}

export class InvoiceItemResponseDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '1' })
  paymentId!: string;

  @ApiPropertyOptional({ example: '1' })
  paymentCategoryId?: string | null;

  @ApiProperty({ example: 'Consultation - OPD' })
  name!: string;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: '500.00' })
  unitPrice!: string;

  @ApiProperty({ example: '500.00' })
  lineTotal!: string;

  @ApiPropertyOptional({ example: '1' })
  doctorId?: string | null;
}

export class InvoicePaymentResponseDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '1' })
  paymentId!: string;

  @ApiProperty({ example: '300.00' })
  amount!: string;

  @ApiPropertyOptional({ example: 'Cash' })
  method?: string | null;

  @ApiPropertyOptional({ example: 'TXN-00129' })
  reference?: string | null;

  @ApiPropertyOptional({ example: '2026-10-28 10:15:00' })
  paidAt?: string | null;

  @ApiPropertyOptional({ example: '1' })
  receivedBy?: string | null;

  @ApiPropertyOptional()
  createdAt?: string | null;
}

export class InvoiceResponseDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: '1' })
  patientId!: string;

  @ApiPropertyOptional({ example: '1' })
  doctorId?: string | null;

  @ApiPropertyOptional({ example: '2' })
  referringDoctorId?: string | null;

  @ApiProperty({ example: '2026-10-28' })
  date!: string;

  @ApiProperty({ example: '500.00', description: 'Subtotal before discount and tax' })
  subtotal!: string;

  @ApiProperty({ example: '50.00' })
  discount!: string;

  @ApiProperty({ example: '0.00' })
  vat!: string;

  @ApiProperty({ example: '450.00', description: 'Net gross total (subtotal - discount + vat)' })
  grossTotal!: string;

  @ApiProperty({ example: '300.00', description: 'Cumulative amount paid' })
  paid!: string;

  @ApiProperty({ example: '150.00', description: 'Current outstanding balance owed' })
  balance!: string;

  @ApiProperty({ example: 'part paid', enum: ['unpaid', 'part paid', 'paid'] })
  status!: string;

  @ApiPropertyOptional({ example: 'OPD visit consultation' })
  remarks?: string | null;

  @ApiProperty({ example: 'opd' })
  careSetting!: string;

  @ApiPropertyOptional({ type: () => InvoicePatientSummaryDto })
  patient?: InvoicePatientSummaryDto;

  @ApiPropertyOptional({ type: () => InvoiceDoctorSummaryDto })
  doctor?: InvoiceDoctorSummaryDto | null;

  @ApiProperty({ type: [InvoiceItemResponseDto] })
  items!: InvoiceItemResponseDto[];

  @ApiProperty({ type: [InvoicePaymentResponseDto] })
  payments!: InvoicePaymentResponseDto[];

  @ApiPropertyOptional()
  createdAt?: string | null;

  @ApiPropertyOptional()
  updatedAt?: string | null;
}

export class PaginatedInvoicesDto {
  @ApiProperty({ type: [InvoiceResponseDto] })
  data!: InvoiceResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;

  @ApiProperty({ example: '15000.00', description: 'Total balance owed across matched invoices' })
  totalOwed!: string;
}
