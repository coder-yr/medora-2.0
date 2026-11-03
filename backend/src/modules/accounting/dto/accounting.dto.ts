import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export enum AccountTypeDto {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

export enum NormalBalanceDto {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum AccountingPeriodStatusDto {
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
}

export enum JournalStatusDto {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}

export enum ExpenseStatusDto {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

// ==========================================
// 1. CHART OF ACCOUNTS DTOs
// ==========================================

export class CreateAccountDto {
  @ApiProperty({ description: 'Unique account code (e.g. 1010, 5200)', example: '1010' })
  @IsString()
  @IsNotEmpty()
  accountCode!: string;

  @ApiProperty({ description: 'Account name', example: 'Cash on Hand' })
  @IsString()
  @IsNotEmpty()
  accountName!: string;

  @ApiProperty({ enum: AccountTypeDto, example: AccountTypeDto.ASSET })
  @IsEnum(AccountTypeDto)
  accountType!: AccountTypeDto;

  @ApiProperty({ enum: NormalBalanceDto, example: NormalBalanceDto.DEBIT })
  @IsEnum(NormalBalanceDto)
  normalBalance!: NormalBalanceDto;

  @ApiPropertyOptional({ description: 'Account description or purpose' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Sub-type classification (e.g. Current Asset, Fixed Asset)' })
  @IsString()
  @IsOptional()
  accountSubType?: string;

  @ApiPropertyOptional({ description: 'Parent account ID for hierarchy' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  parentAccountId?: number;

  @ApiPropertyOptional({ description: 'Allow manual journal entry postings', default: true })
  @IsBoolean()
  @IsOptional()
  allowManualPosting?: boolean;

  @ApiPropertyOptional({ description: 'Currency code', default: 'PKR' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Branch ID' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  branchId?: number;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ description: 'Account name' })
  @IsString()
  @IsOptional()
  accountName?: string;

  @ApiPropertyOptional({ description: 'Account description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Parent account ID' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  parentAccountId?: number;

  @ApiPropertyOptional({ description: 'Allow manual postings' })
  @IsBoolean()
  @IsOptional()
  allowManualPosting?: boolean;

  @ApiPropertyOptional({ description: 'Account active flag' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AccountQueryDto {
  @ApiPropertyOptional({ enum: AccountTypeDto })
  @IsEnum(AccountTypeDto)
  @IsOptional()
  accountType?: AccountTypeDto;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search by code or name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page limit', default: 50 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 50;
}

// ==========================================
// 2. ACCOUNTING PERIOD DTOs
// ==========================================

export class CreateAccountingPeriodDto {
  @ApiProperty({ description: 'Period code (e.g. FY2026-M11)', example: 'FY2026-M11' })
  @IsString()
  @IsNotEmpty()
  periodCode!: string;

  @ApiProperty({ description: 'Period name', example: 'November 2026' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Start date (ISO)', example: '2026-11-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'End date (ISO)', example: '2026-11-30' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: 'Branch ID' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  branchId?: number;
}

export class CloseAccountingPeriodDto {
  @ApiPropertyOptional({ description: 'Audit closing notes' })
  @IsString()
  @IsOptional()
  closingNotes?: string;
}

export class ReopenAccountingPeriodDto {
  @ApiProperty({ description: 'Mandatory reason for reopening locked period' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class PeriodQueryDto {
  @ApiPropertyOptional({ enum: AccountingPeriodStatusDto })
  @IsEnum(AccountingPeriodStatusDto)
  @IsOptional()
  status?: AccountingPeriodStatusDto;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}

// ==========================================
// 3. JOURNAL ENTRY DTOs
// ==========================================

export class JournalLineItemDto {
  @ApiProperty({ description: 'Account ID', example: 1 })
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  accountId!: number;

  @ApiProperty({ description: 'Debit amount (Decimal)', default: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  debit: number = 0;

  @ApiProperty({ description: 'Credit amount (Decimal)', default: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  credit: number = 0;

  @ApiPropertyOptional({ description: 'Line item description' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty({ description: 'Accounting date (ISO)', example: '2026-11-03' })
  @IsDateString()
  accountingDate!: string;

  @ApiProperty({ description: 'Journal description / narration', example: 'Biomedical maintenance repair payout' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ description: 'Journal debit and credit lines', type: [JournalLineItemDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineItemDto)
  lines!: JournalLineItemDto[];

  @ApiPropertyOptional({ description: 'Reference type (e.g. INVOICE, EXPENSE, CASH_PAYOUT, MANUAL)' })
  @IsString()
  @IsOptional()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Reference entity ID' })
  @IsString()
  @IsOptional()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Source module', default: 'MANUAL' })
  @IsString()
  @IsOptional()
  sourceModule?: string;

  @ApiPropertyOptional({ description: 'Source reference number' })
  @IsString()
  @IsOptional()
  sourceReference?: string;

  @ApiPropertyOptional({ description: 'Idempotency key to guarantee single execution' })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Immediately post and validate the journal', default: false })
  @IsBoolean()
  @IsOptional()
  postImmediately?: boolean;

  @ApiPropertyOptional({ description: 'Branch ID' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  branchId?: number;
}

export class ReverseJournalEntryDto {
  @ApiProperty({ description: 'Audit reason for reversal', example: 'Correcting erroneous invoice allocation' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ description: 'Optional reversal date (defaults to current date)' })
  @IsDateString()
  @IsOptional()
  reversalDate?: string;
}

export class JournalQueryDto {
  @ApiPropertyOptional({ enum: JournalStatusDto })
  @IsEnum(JournalStatusDto)
  @IsOptional()
  status?: JournalStatusDto;

  @ApiPropertyOptional({ description: 'Start date filter (ISO)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by source module' })
  @IsString()
  @IsOptional()
  sourceModule?: string;

  @ApiPropertyOptional({ description: 'Filter by account ID' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  accountId?: number;

  @ApiPropertyOptional({ description: 'Search by journal number or narration' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}

// ==========================================
// 4. EXPENSE CATEGORY DTOs
// ==========================================

export class CreateExpenseCategoryDto {
  @ApiProperty({ description: 'Category code', example: 'UTIL' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Category name', example: 'Utilities & Telecom' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Mapped Expense Account ID (Chart of Accounts)' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  accountId?: number;
}

export class UpdateExpenseCategoryDto {
  @ApiPropertyOptional({ description: 'Category name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Mapped Account ID' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  accountId?: number;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ==========================================
// 5. EXPENSE DTOs
// ==========================================

export class CreateExpenseDto {
  @ApiProperty({ description: 'Expense category ID', example: 1 })
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  categoryId!: number;

  @ApiProperty({ description: 'Expense description / purpose', example: 'Generator diesel refilling' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ description: 'Expense amount (PKR)', example: 15000.0 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount!: number;

  @ApiProperty({ description: 'Expense date (ISO)', example: '2026-11-03' })
  @IsDateString()
  expenseDate!: string;

  @ApiPropertyOptional({ description: 'Vendor / Payee name', example: 'Pakistan State Oil' })
  @IsString()
  @IsOptional()
  vendorName?: string;

  @ApiPropertyOptional({ description: 'Vendor bill or invoice number', example: 'INV-PSO-8891' })
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @ApiPropertyOptional({ description: 'Payment method', default: 'CASH', example: 'CASH' })
  @IsString()
  @IsOptional()
  paymentMethod?: string = 'CASH';

  @ApiPropertyOptional({ description: 'Branch ID' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  branchId?: number;

  @ApiPropertyOptional({ description: 'Notes or internal remarks' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional({ description: 'Category ID' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Amount' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: 'Expense date' })
  @IsDateString()
  @IsOptional()
  expenseDate?: string;

  @ApiPropertyOptional({ description: 'Vendor name' })
  @IsString()
  @IsOptional()
  vendorName?: string;

  @ApiPropertyOptional({ description: 'Invoice number' })
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @ApiPropertyOptional({ description: 'Payment method' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RejectExpenseDto {
  @ApiProperty({ description: 'Mandatory reason for rejection', example: 'Vendor invoice receipt missing' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class PayExpenseDto {
  @ApiPropertyOptional({ description: 'Payment method override', example: 'CASH' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Disbursement date (ISO)' })
  @IsDateString()
  @IsOptional()
  paidAt?: string;

  @ApiPropertyOptional({ description: 'Cash or Bank Account ID from COA to credit (defaults to 1010/1020)' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  disbursementAccountId?: number;
}

export class ExpenseQueryDto {
  @ApiPropertyOptional({ enum: ExpenseStatusDto })
  @IsEnum(ExpenseStatusDto)
  @IsOptional()
  status?: ExpenseStatusDto;

  @ApiPropertyOptional({ description: 'Category ID filter' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Start date filter (ISO)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Vendor search' })
  @IsString()
  @IsOptional()
  vendorName?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}

// ==========================================
// 6. FINANCIAL REPORTS DTOs
// ==========================================

export class ReportQueryDto {
  @ApiPropertyOptional({ description: 'As of date for Balance Sheet / Trial Balance (ISO)' })
  @IsDateString()
  @IsOptional()
  asOfDate?: string;

  @ApiPropertyOptional({ description: 'Start date for P&L / Ledger / Expense Summary (ISO)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for P&L / Ledger / Expense Summary (ISO)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Branch ID' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  branchId?: number;

  @ApiPropertyOptional({ description: 'Account ID filter for General Ledger' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  accountId?: number;
}

// ==========================================
// 7. LEGACY SINGLE-ENTRY COMPATIBILITY DTOs
// ==========================================

export class CreateLegacyAccountingDto {
  @ApiPropertyOptional({ description: 'Party / Payee / Name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Legacy Sector Name' })
  @IsString()
  @IsOptional()
  sector?: string;

  @ApiProperty({ description: 'Category: income or expense', example: 'income' })
  @IsString()
  @IsNotEmpty()
  category!: 'income' | 'expense';

  @ApiProperty({ description: 'Amount', example: 5000.0 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount!: number;

  @ApiPropertyOptional({ description: 'Date string', example: '03-11-2026' })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Receipt / Voucher number' })
  @IsString()
  @IsOptional()
  receiptNo?: string;
}

export class CreateLegacySectorDto {
  @ApiProperty({ description: 'Sector name', example: 'Pathology Supplies' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Sector type: income or expense', example: 'expense' })
  @IsString()
  @IsNotEmpty()
  type!: 'income' | 'expense';
}

