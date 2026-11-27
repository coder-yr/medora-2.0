import { IsOptional, IsString, IsIn, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const ANALYTICS_PERIODS = [
  'today',
  'yesterday',
  'last7Days',
  'last30Days',
  'last90Days',
  'custom',
] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const ANALYTICS_GRANULARITIES = ['day', 'week', 'month'] as const;
export type AnalyticsGranularity = (typeof ANALYTICS_GRANULARITIES)[number];

export const ANALYTICS_DOMAINS = [
  'overview',
  'patients',
  'appointments',
  'doctors',
  'finance',
  'laboratory',
  'pharmacy',
  'follow-ups',
  'branches',
] as const;
export type AnalyticsDomain = (typeof ANALYTICS_DOMAINS)[number];

export class AnalyticsFilterDto {
  @ApiPropertyOptional({
    enum: ANALYTICS_PERIODS,
    default: 'last30Days',
    description: 'Predefined date window or custom range',
  })
  @IsOptional()
  @IsIn(ANALYTICS_PERIODS)
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({ description: 'Custom start date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Custom end date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;

  @ApiPropertyOptional({ description: 'Branch ID or "all"' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Doctor ID filter where applicable' })
  @IsOptional()
  @IsString()
  doctorId?: string;

  @ApiPropertyOptional({ enum: ANALYTICS_GRANULARITIES, default: 'day' })
  @IsOptional()
  @IsIn(ANALYTICS_GRANULARITIES)
  granularity?: AnalyticsGranularity;
}

export class AnalyticsExportDto extends AnalyticsFilterDto {
  @ApiPropertyOptional({ enum: ANALYTICS_DOMAINS, default: 'overview' })
  @IsOptional()
  @IsIn(ANALYTICS_DOMAINS)
  domain?: AnalyticsDomain;
}
