import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { AuthUser } from '../../common/types/auth-user.interface';
import { DashboardService } from './dashboard.service';
import { DashboardFilterDto } from './dto/dashboard.dto';

@ApiTags('Executive Dashboard & Operational Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Unified executive operational & clinical dashboard' })
  @ApiResponse({ status: 200, description: 'Executive dashboard metrics' })
  @RequirePermissions(HospitalPermission.DASHBOARD_VIEW)
  async getExecutiveOverview(
    @CurrentUser() user: AuthUser,
    @Query() filterDto: DashboardFilterDto,
  ) {
    const isGlobalAdmin =
      user.group === 'Admin' ||
      user.permissions?.includes(HospitalPermission.BRANCH_VIEW_ALL);
    const userBranchId = user.branchId ? BigInt(user.branchId) : null;
    const canViewFinancials =
      user.group === 'Admin' ||
      user.group === 'Accountant' ||
      user.permissions?.includes(HospitalPermission.DASHBOARD_FINANCIAL_VIEW);

    return this.service.getExecutiveOverview(
      filterDto,
      userBranchId,
      isGlobalAdmin,
      canViewFinancials,
    );
  }

  @Get('doctor-workload')
  @ApiOperation({ summary: "Clinical workload metrics for doctor's workbench" })
  @ApiResponse({ status: 200, description: 'Doctor workload metrics' })
  @RequirePermissions(HospitalPermission.DASHBOARD_VIEW)
  async getDoctorWorkload(
    @CurrentUser() user: AuthUser,
    @Query() filterDto: DashboardFilterDto,
  ) {
    const doctorId = BigInt(user.id);
    const userBranchId = user.branchId ? BigInt(user.branchId) : null;
    return this.service.getDoctorWorkload(doctorId, filterDto, userBranchId);
  }

  @Get('branch-comparison')
  @ApiOperation({ summary: 'Cross-branch comparative performance analytics' })
  @ApiResponse({ status: 200, description: 'Branch comparison analytics' })
  @RequirePermissions(HospitalPermission.DASHBOARD_BRANCH_COMPARE)
  async getBranchComparison(
    @CurrentUser() user: AuthUser,
    @Query() filterDto: DashboardFilterDto,
  ) {
    return this.service.getBranchComparison(filterDto, user);
  }

  @Get('operational-alerts')
  @ApiOperation({ summary: 'Real-time actionable operational alerts' })
  @ApiResponse({ status: 200, description: 'Active alerts list' })
  @RequirePermissions(HospitalPermission.DASHBOARD_VIEW)
  async getOperationalAlerts(@CurrentUser() user: AuthUser) {
    const isGlobalAdmin =
      user.group === 'Admin' ||
      user.permissions?.includes(HospitalPermission.BRANCH_VIEW_ALL);
    const userBranchId = user.branchId ? BigInt(user.branchId) : null;
    return this.service.getOperationalAlerts(userBranchId, isGlobalAdmin);
  }
}

