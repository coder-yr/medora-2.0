import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class OpenShiftDto {
  @ApiPropertyOptional({ description: 'Branch ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @ApiPropertyOptional({ description: 'Physical cash drawer ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cashDrawerId?: number;

  @ApiPropertyOptional({
    description: 'Initial physical cash float in drawer',
    example: 500.0,
    default: 0.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingCash?: number = 0;

  @ApiPropertyOptional({ description: 'Opening shift notes or remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class DenominationCountDto {
  @ApiProperty({ description: 'Denomination value', example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  denomination!: number;

  @ApiProperty({ description: 'Number of notes/coins', example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  count!: number;
}

export class SubmitCloseDto {
  @ApiProperty({
    description: 'Total physical cash counted in drawer',
    example: 4500.0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countedCash!: number;

  @ApiPropertyOptional({
    description: 'Closing notes or variance explanation',
    example: 'Handed over to evening cashier. Balanced.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  closingNotes?: string;

  @ApiPropertyOptional({
    description: 'Itemized currency denomination breakdown',
    type: [DenominationCountDto],
  })
  @IsOptional()
  denominations?: DenominationCountDto[];
}

export class ApproveShiftDto {
  @ApiPropertyOptional({ description: 'Supervisor sign-off notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RejectShiftDto {
  @ApiProperty({
    description: 'Mandatory clinical/managerial reason for shift rejection',
    example: 'Cash count discrepancy of 500 PKR not explained in notes.',
  })
  @IsString()
  @MaxLength(500)
  rejectionReason!: string;
}

export class CashPayoutDto {
  @ApiProperty({ description: 'Payout amount', example: 250.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    description: 'Reason for cash payout from drawer',
    example: 'Emergency local courier charges for lab blood sample transport',
  })
  @IsString()
  @MaxLength(250)
  reason!: string;

  @ApiPropertyOptional({ description: 'Voucher or receipt reference' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({ description: 'Recipient name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  recipient?: string;
}

export class CashAdjustmentDto {
  @ApiProperty({
    description: 'Adjustment amount (positive for inflow, negative for outflow)',
    example: 100.0,
  })
  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @ApiProperty({
    description: 'Mandatory reason for manual drawer float adjustment',
    example: 'Supervisor float top-up for morning change',
  })
  @IsString()
  @MaxLength(250)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Direction of adjustment',
    enum: ['INFLOW', 'OUTFLOW'],
  })
  @IsOptional()
  @IsEnum(['INFLOW', 'OUTFLOW'])
  direction?: 'INFLOW' | 'OUTFLOW';
}

export class PatientSettlementDto {
  @ApiPropertyOptional({
    description: 'Amount collected from patient across open invoices',
    example: 1500.0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number = 0;

  @ApiProperty({
    description: 'Payment method',
    example: 'Cash',
    enum: ['Cash', 'Bank transfer', 'Card', 'Cheque', 'Online'],
  })
  @IsString()
  method!: string;

  @ApiPropertyOptional({ description: 'Payment reference or transaction ID' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({
    description: 'Write-off balance amount',
    example: 200.0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  writeOff?: number = 0;

  @ApiPropertyOptional({
    description: 'Mandatory explanation if balance is being written off',
    example: 'Zakat / Charity financial hardship approval',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  writeOffReason?: string;
}

export class CashDrawerDto {
  @ApiProperty({ description: 'Drawer name', example: 'OPD Desk 1 Drawer' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Unique drawer code', example: 'DRW-OPD-01' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiPropertyOptional({ description: 'Hospital branch ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @ApiPropertyOptional({ description: 'Assigned cashier user ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assignedCashierId?: number;

  @ApiPropertyOptional({ description: 'Whether active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class CashierQueryDto {
  @ApiPropertyOptional({
    description: 'Shift status filter',
    enum: ['OPEN', 'CLOSING', 'PENDING_APPROVAL', 'CLOSED', 'REJECTED'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Cashier user ID filter' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cashierId?: number;

  @ApiPropertyOptional({ description: 'Branch ID filter' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @ApiPropertyOptional({ description: 'Date range start (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Date range end (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page limit', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}

export class DayBookQueryDto {
  @ApiPropertyOptional({ description: 'From date (YYYY-MM-DD)', example: '2026-11-02' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'To date (YYYY-MM-DD)', example: '2026-11-02' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'Cashier user ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ description: 'Hospital branch ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @ApiPropertyOptional({
    description: 'Patient group filter',
    enum: ['private', 'panel', 'charity', ''],
  })
  @IsOptional()
  @IsString()
  kind?: string;

  @ApiPropertyOptional({
    description: 'Export format: "csv" for CSV download',
    enum: ['csv'],
  })
  @IsOptional()
  @IsString()
  export?: string;
}
