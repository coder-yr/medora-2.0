import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { ProtectClinicalAccess } from '../../common/decorators/clinical-access.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireEntitlement } from '../../common/decorators/entitlement.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { SkipBranchCheck } from '../../common/decorators/skip-branch.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthUser } from '../../common/types/auth-user.interface';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsExportDto,
  AnalyticsFilterDto,
} from './dto/analytics-filter.dto';

@ApiTags('Clinic Analytics & Business Intelligence')
@ApiBearerAuth()
@SkipBranchCheck()
@UseGuards(PermissionsGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ProtectClinicalAccess()
  @RequirePermissions(HospitalPermission.DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Clinic overview dashboard KPIs (cumulative & date-range)' })
  @ApiResponse({ status: 200, description: 'Clinic overview KPIs' })
  async getOverview(
    @CurrentUser() user: AuthUser,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getOverview(user, filter);
  }

  @Get('patients')
  @ProtectClinicalAccess()
  @RequirePermissions(HospitalPermission.DASHBOARD_VIEW)
  @RequireEntitlement('patients')
  @ApiOperation({ summary: 'Aggregate patient registration, demographic & revisit analytics' })
  async getPatientAnalytics(
    @CurrentUser() user: AuthUser,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getPatientAnalytics(user, filter);
  }

  @Get('appointments')
  @ProtectClinicalAccess()
  @RequirePermissions(HospitalPermission.DASHBOARD_VIEW)
  @RequireEntitlement('appointments')
  @ApiOperation({ summary: 'Appointment volume, status, peak hours & no-show analytics' })
  async getAppointmentAnalytics(
    @CurrentUser() user: AuthUser,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getAppointmentAnalytics(user, filter);
  }

  @Get('doctors')
  @ProtectClinicalAccess()
  @RequirePermissions(HospitalPermission.DASHBOARD_VIEW)
  @RequireEntitlement('consultations')
  @ApiOperation({ summary: 'Doctor operational workload & consultation analytics' })
  async getDoctorAnalytics(
    @CurrentUser() user: AuthUser,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getDoctorAnalytics(user, filter);
  }

  @Get('finance')
  @RequirePermissions(HospitalPermission.DASHBOARD_FINANCIAL_VIEW)
  @RequireEntitlement('billing')
  @ApiOperation({ summary: 'Authoritative billing, payment collection, refund & revenue analytics' })
  async getFinanceAnalytics(
    @CurrentUser() user: AuthUser,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getFinanceAnalytics(user, filter);
  }

  @Get('laboratory')
  @ProtectClinicalAccess()
  @RequirePermissions(HospitalPermission.LAB_REPORTS)
  @RequireEntitlement('laboratory')
  @ApiOperation({ summary: 'Laboratory order, turnaround time & sample quality analytics' })
  async getLaboratoryAnalytics(
    @CurrentUser() user: AuthUser,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getLaboratoryAnalytics(user, filter);
  }

  @Get('pharmacy')
  @RequirePermissions(HospitalPermission.PHARMACY_REPORTS)
  @RequireEntitlement('pharmacy')
  @ApiOperation({ summary: 'Pharmacy stock valuation, expiry, dispensing & procurement analytics' })
  async getPharmacyAnalytics(
    @CurrentUser() user: AuthUser,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getPharmacyAnalytics(user, filter);
  }

  @Get('follow-ups')
  @ProtectClinicalAccess()
  @RequirePermissions(HospitalPermission.DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Clinical follow-up completion & notification delivery analytics' })
  async getFollowUpAnalytics(
    @CurrentUser() user: AuthUser,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getFollowUpAnalytics(user, filter);
  }

  @Get('branches')
  @ProtectClinicalAccess()
  @RequirePermissions(HospitalPermission.DASHBOARD_BRANCH_COMPARE)
  @ApiOperation({ summary: 'Authorized branch-wise operational comparison analytics' })
  async getBranchAnalytics(
    @CurrentUser() user: AuthUser,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getBranchAnalytics(user, filter);
  }

  @Get('export')
  @ProtectClinicalAccess()
  @RequirePermissions(HospitalPermission.DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Authorized CSV export for aggregate analytics' })
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsExportDto,
    @Res() res: Response,
  ) {
    const domain = query.domain || 'overview';
    const perms = new Set(user.permissions || []);
    const isAdmin = user.group === 'Admin';

    if (
      domain === 'finance' &&
      !isAdmin &&
      user.group !== 'Accountant' &&
      !perms.has(HospitalPermission.DASHBOARD_FINANCIAL_VIEW) &&
      !perms.has(HospitalPermission.FINANCIAL_REPORTS)
    ) {
      throw new ForbiddenException('Insufficient permissions to export financial analytics.');
    }
    if (
      domain === 'laboratory' &&
      !isAdmin &&
      !perms.has(HospitalPermission.LAB_REPORTS)
    ) {
      throw new ForbiddenException('Insufficient permissions to export laboratory analytics.');
    }
    if (
      domain === 'pharmacy' &&
      !isAdmin &&
      !perms.has(HospitalPermission.PHARMACY_REPORTS)
    ) {
      throw new ForbiddenException('Insufficient permissions to export pharmacy analytics.');
    }
    if (
      domain === 'branches' &&
      !isAdmin &&
      !perms.has(HospitalPermission.DASHBOARD_BRANCH_COMPARE)
    ) {
      throw new ForbiddenException('Insufficient permissions to export branch comparison.');
    }

    const { filename, csv } = await this.analyticsService.exportAnalyticsCsv(
      user,
      domain,
      query,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  }
}
