import { IsOptional, IsString, IsIn, Matches } from 'class-validator';

export class DashboardFilterDto {
  @IsOptional()
  @IsString()
  @IsIn(['today', 'yesterday', 'last7Days', 'last30Days', 'currentMonth', 'previousMonth', 'custom'])
  period?: 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'currentMonth' | 'previousMonth' | 'custom';

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be in YYYY-MM-DD format' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be in YYYY-MM-DD format' })
  endDate?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}

