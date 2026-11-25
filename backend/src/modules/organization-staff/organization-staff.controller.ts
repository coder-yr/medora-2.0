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
import { OrganizationAdminGuard } from '../../common/guards/organization-admin.guard';
import { RequireOrgAdmin } from '../../common/decorators/require-org-admin.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.interface';
import { OrganizationStaffService } from './organization-staff.service';
import {
  InviteStaffDto,
  UpdateStaffRoleDto,
  UpdateStaffStatusDto,
  AssignStaffBranchesDto,
} from './dto/organization-staff.dto';

@ApiTags('Organization Staff Administration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAdminGuard)
@RequireOrgAdmin()
@Controller('organizations/:orgId/staff')
export class OrganizationStaffController {
  constructor(private readonly service: OrganizationStaffService) {}

  @Get()
  @ApiOperation({ summary: 'List all staff members in the organization' })
  @ApiResponse({ status: 200, description: 'List of staff members' })
  async listStaff(@Param('orgId') orgId: string) {
    return this.service.listStaff(orgId);
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate secure single-use staff invitation' })
  @ApiResponse({ status: 201, description: 'Staff invitation created' })
  async inviteStaff(
    @Param('orgId') orgId: string,
    @Body() dto: InviteStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.inviteStaff(orgId, dto, user.id);
  }

  @Get('invitations')
  @ApiOperation({ summary: 'List all staff invitations for the organization' })
  @ApiResponse({ status: 200, description: 'List of staff invitations' })
  async listInvitations(@Param('orgId') orgId: string) {
    return this.service.listInvitations(orgId);
  }

  @Get('activity')
  @ApiOperation({ summary: 'List organization staff audit activity' })
  @ApiResponse({ status: 200, description: 'Staff activity logs' })
  async getStaffActivity(
    @Param('orgId') orgId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.getOrganizationActivity(
      orgId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Post('invitations/:invitationId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a pending staff invitation' })
  @ApiResponse({ status: 200, description: 'Invitation revoked' })
  async revokeInvitation(
    @Param('orgId') orgId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.revokeInvitation(orgId, invitationId, user.id);
  }

  @Put(':memberId/role')
  @ApiOperation({ summary: 'Update staff member organization role' })
  @ApiResponse({ status: 200, description: 'Staff role updated' })
  async updateRole(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateStaffRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateRole(orgId, memberId, dto, user.id);
  }

  @Put(':memberId/status')
  @ApiOperation({ summary: 'Activate or deactivate staff membership' })
  @ApiResponse({ status: 200, description: 'Staff membership status updated' })
  async updateStatus(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateStaffStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateStatus(orgId, memberId, dto, user.id);
  }

  @Put(':memberId/branches')
  @ApiOperation({ summary: 'Assign authorized branch access to staff member' })
  @ApiResponse({ status: 200, description: 'Branch access assigned' })
  async assignBranches(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() dto: AssignStaffBranchesDto,
  ) {
    return this.service.assignBranches(orgId, memberId, dto);
  }
}
