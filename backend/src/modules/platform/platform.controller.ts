import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../../common/guards/super-admin.guard';
import { RequireSuperAdmin } from '../../common/decorators/require-super-admin.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.interface';
import { PlatformService } from './platform.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationStatusDto,
  UpdateOrganizationEditionDto,
  UpdateOrganizationEntitlementsDto,
  AssignOrganizationAdminDto,
  RequestBreakGlassDto,
  QueryRegistrationsDto,
  ApproveRegistrationDto,
  RejectRegistrationDto,
} from './dto/platform.dto';

@ApiTags('Platform Governance & Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
@RequireSuperAdmin()
@Controller('platform')
export class PlatformController {
  constructor(private readonly service: PlatformService) {}

  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations on the platform with metrics (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all organizations' })
  async listOrganizations() {
    return this.service.listOrganizations();
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: 'Get detailed organization profile and branch directory' })
  @ApiResponse({ status: 200, description: 'Organization configuration profile' })
  async getOrganization(@Param('id') id: string) {
    return this.service.getOrganization(id);
  }

  @Post('organizations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Provision new organization, primary branch, and Org Admin' })
  @ApiResponse({ status: 201, description: 'Organization successfully provisioned' })
  async provisionOrganization(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.provisionOrganization(dto, user.id);
  }

  @Put('organizations/:id/status')
  @ApiOperation({ summary: 'Suspend or reactivate an organization' })
  @ApiResponse({ status: 200, description: 'Organization status updated' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateStatus(id, dto, user.id);
  }

  @Put('organizations/:id/edition')
  @ApiOperation({ summary: 'Change organization edition (CLINIC, PROFESSIONAL, HOSPITAL, ENTERPRISE)' })
  @ApiResponse({ status: 200, description: 'Organization edition updated' })
  async updateEdition(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationEditionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateEdition(id, dto, user.id);
  }

  @Put('organizations/:id/entitlements')
  @ApiOperation({ summary: 'Enable or disable organization module entitlements' })
  @ApiResponse({ status: 200, description: 'Entitlements updated' })
  async updateEntitlements(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationEntitlementsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateEntitlements(id, dto, user.id);
  }

  @Post('organizations/:id/assign-admin')
  @ApiOperation({ summary: 'Assign or provision Organization Administrator' })
  @ApiResponse({ status: 200, description: 'Organization Admin assigned' })
  async assignAdmin(
    @Param('id') id: string,
    @Body() dto: AssignOrganizationAdminDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.assignAdmin(id, dto, user.id);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Query platform-wide security audit trail' })
  @ApiResponse({ status: 200, description: 'Platform audit logs' })
  async getAuditLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.getAuditLogs(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get consolidated platform aggregate metrics' })
  @ApiResponse({ status: 200, description: 'Platform metrics' })
  async getPlatformAnalytics() {
    return this.service.getPlatformAnalytics();
  }

  @Post('break-glass')
  @ApiOperation({ summary: 'Request time-limited emergency support access to an organization' })
  @ApiResponse({ status: 201, description: 'Emergency grant created' })
  async requestBreakGlass(
    @Body() dto: RequestBreakGlassDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.requestBreakGlassSupport(user.id, dto);
  }

  @Post('break-glass/:grantId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an active emergency break-glass support grant early' })
  @ApiResponse({ status: 200, description: 'Emergency grant revoked' })
  async revokeBreakGlass(
    @Param('grantId') grantId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.revokeBreakGlassSupport(user.id, grantId);
  }

  // ==========================================
  // Organization Registrations & Approvals
  // ==========================================

  @Get('registrations')
  @ApiOperation({ summary: 'List organization registrations with search and filtering (Super Admin)' })
  @ApiResponse({ status: 200, description: 'List of organization registrations' })
  async listRegistrations(@Query() query: QueryRegistrationsDto) {
    return this.service.listRegistrations(query);
  }

  @Get('registrations/:id')
  @ApiOperation({ summary: 'Get single organization registration details' })
  @ApiResponse({ status: 200, description: 'Organization registration details' })
  async getRegistration(@Param('id') id: string) {
    return this.service.getRegistration(id);
  }

  @Post('registrations/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve registration and provision organization, settings, branch, onboarding, and admin invitation' })
  @ApiResponse({ status: 200, description: 'Registration approved and tenant provisioned' })
  async approveRegistration(
    @Param('id') id: string,
    @Body() dto: ApproveRegistrationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.approveRegistration(id, dto, user.id);
  }

  @Post('registrations/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject registration with mandatory explanation' })
  @ApiResponse({ status: 200, description: 'Registration rejected' })
  async rejectRegistration(
    @Param('id') id: string,
    @Body() dto: RejectRegistrationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.rejectRegistration(id, dto, user.id);
  }

  @Post('registrations/:id/retry-provisioning')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Idempotently retry provisioning for an approved registration' })
  @ApiResponse({ status: 200, description: 'Provisioning retried' })
  async retryProvisioning(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.retryProvisioning(id, user.id);
  }
}
