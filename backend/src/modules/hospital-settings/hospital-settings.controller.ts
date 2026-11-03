import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { OptionalBranch } from '../../common/decorators/optional-branch.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { AuthUser } from '../../common/types/auth-user.interface';
import { HospitalSettingsService } from './hospital-settings.service';
import {
  UpdateHospitalSettingsDto,
  UpdateBrandingDto,
  QueryAuditLogsDto,
} from './dto/hospital-settings.dto';

@ApiTags('Hospital Settings & Branding')
@ApiBearerAuth()
@OptionalBranch()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings')
export class HospitalSettingsController {
  constructor(private readonly service: HospitalSettingsService) {}

  @Get('hospital')
  @ApiOperation({ summary: 'Get hospital-wide settings and identity profile' })
  @ApiResponse({ status: 200, description: 'Hospital settings retrieved successfully' })
  @RequirePermissions(HospitalPermission.HOSPITAL_SETTINGS_VIEW)
  async getHospitalSettings() {
    return this.service.getHospitalSettings();
  }

  @Put('hospital')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update hospital-wide profile, locale, and operational defaults' })
  @ApiResponse({ status: 200, description: 'Hospital settings updated with audit trail' })
  @RequirePermissions(HospitalPermission.HOSPITAL_SETTINGS_UPDATE)
  async updateHospitalSettings(
    @Body() dto: UpdateHospitalSettingsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateHospitalSettings(dto, BigInt(user.id), dto.changeReason);
  }

  @Put('branding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update hospital logo, favicon, and brand color palette' })
  @ApiResponse({ status: 200, description: 'Branding assets updated successfully' })
  @RequirePermissions(HospitalPermission.BRANDING_UPDATE)
  async updateBranding(
    @Body() dto: UpdateBrandingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateBranding(dto, BigInt(user.id), dto.changeReason);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Query immutable configuration change audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved' })
  @RequirePermissions(HospitalPermission.HOSPITAL_SETTINGS_VIEW)
  async getAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.service.getAuditLogs(query);
  }
}
