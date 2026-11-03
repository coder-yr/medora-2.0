import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { AuthUser } from '../../common/types/auth-user.interface';
import { HospitalSettingsService } from './hospital-settings.service';
import {
  CreateBranchDto,
  UpdateBranchDto,
  SetBranchStatusDto,
  UpdateBranchSettingsDto,
  AssignUserBranchDto,
} from './dto/hospital-settings.dto';

@ApiTags('Multi-Branch Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('branches')
export class BranchController {
  constructor(private readonly service: HospitalSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'List all hospital branches' })
  @ApiResponse({ status: 200, description: 'Branches list retrieved' })
  @RequirePermissions(HospitalPermission.BRANCH_VIEW)
  async listBranches(
    @Query('includeInactive') includeInactive?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const isAdmin =
      user?.group === 'Admin' ||
      user?.permissions?.includes(HospitalPermission.BRANCH_VIEW_ALL);
    const allowInactive = isAdmin && includeInactive === 'true';
    return this.service.listBranches(allowInactive);
  }

  @Get('my-branches')
  @ApiOperation({ summary: 'Get branches accessible to current user for navigation switching' })
  @ApiResponse({ status: 200, description: 'Accessible branches retrieved' })
  async getMyBranches(@CurrentUser() user: AuthUser) {
    const isGlobalAdmin =
      user.group === 'Admin' ||
      user.permissions?.includes(HospitalPermission.BRANCH_VIEW_ALL);
    return this.service.getUserAccessibleBranches(BigInt(user.id), isGlobalAdmin);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch details by ID' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiResponse({ status: 200, description: 'Branch details retrieved' })
  @RequirePermissions(HospitalPermission.BRANCH_VIEW)
  async getBranchById(@Param('id') id: string) {
    return this.service.getBranchById(BigInt(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new hospital branch' })
  @ApiResponse({ status: 201, description: 'Branch created with initialized settings' })
  @RequirePermissions(HospitalPermission.BRANCH_CREATE)
  async createBranch(
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createBranch(dto, BigInt(user.id));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update branch profile and contact information' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiResponse({ status: 200, description: 'Branch updated successfully' })
  @RequirePermissions(HospitalPermission.BRANCH_UPDATE)
  async updateBranch(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateBranch(BigInt(id), dto, BigInt(user.id));
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or deactivate a branch' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiResponse({ status: 200, description: 'Branch status changed' })
  @RequirePermissions(HospitalPermission.BRANCH_DEACTIVATE)
  async setBranchStatus(
    @Param('id') id: string,
    @Body() dto: SetBranchStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.setBranchStatus(BigInt(id), dto.active, BigInt(user.id), dto.reason);
  }

  @Get(':id/settings')
  @ApiOperation({ summary: 'Get explicit branch settings' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiResponse({ status: 200, description: 'Branch settings retrieved' })
  @RequirePermissions(HospitalPermission.BRANCH_SETTINGS_VIEW)
  async getBranchSettings(@Param('id') id: string) {
    return this.service.getBranchSettings(BigInt(id));
  }

  @Get(':id/effective-settings')
  @ApiOperation({ summary: 'Resolve effective 3-tier settings for a branch' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiResponse({ status: 200, description: 'Effective merged settings resolved' })
  @RequirePermissions(HospitalPermission.BRANCH_VIEW)
  async getEffectiveSettings(@Param('id') id: string) {
    return this.service.getEffectiveSettings(BigInt(id));
  }

  @Put(':id/settings')
  @ApiOperation({ summary: 'Update operational overrides for a branch' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiResponse({ status: 200, description: 'Branch settings updated' })
  @RequirePermissions(HospitalPermission.BRANCH_SETTINGS_UPDATE)
  async updateBranchSettings(
    @Param('id') id: string,
    @Body() dto: UpdateBranchSettingsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateBranchSettings(BigInt(id), dto, BigInt(user.id), dto.changeReason);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List user assignments for a branch' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiResponse({ status: 200, description: 'Branch members list' })
  @RequirePermissions(HospitalPermission.BRANCH_MEMBERS_VIEW)
  async listBranchMembers(@Param('id') id: string) {
    return this.service.listUserMemberships(BigInt(id));
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a user to this branch' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiResponse({ status: 201, description: 'User branch membership assigned' })
  @RequirePermissions(HospitalPermission.BRANCH_MEMBERS_MANAGE)
  async assignBranchMember(
    @Param('id') id: string,
    @Body() dto: AssignUserBranchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.assignUserBranch(
      { ...dto, branchId: id },
      BigInt(user.id),
    );
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke user membership from this branch' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User branch membership revoked' })
  @RequirePermissions(HospitalPermission.BRANCH_MEMBERS_MANAGE)
  async revokeBranchMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.revokeUserBranch(BigInt(userId), BigInt(id), BigInt(user.id));
  }

  @Post(':id/generate-number/:docType')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate concurrency-safe document number for branch' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiParam({ name: 'docType', enum: ['INVOICE', 'MRN', 'APPOINTMENT', 'ADMISSION'] })
  @ApiResponse({ status: 200, description: 'Generated document number' })
  @RequirePermissions(HospitalPermission.BRANCH_VIEW)
  async generateDocumentNumber(
    @Param('id') id: string,
    @Param('docType') docType: string,
  ) {
    const validTypes = ['INVOICE', 'MRN', 'APPOINTMENT', 'ADMISSION'];
    const normalizedType = docType.toUpperCase();
    if (!validTypes.includes(normalizedType)) {
      throw new BadRequestException(
        `Invalid docType: "${docType}". Must be one of: ${validTypes.join(', ')}`,
      );
    }
    const number = await this.service.generateDocumentNumber(
      BigInt(id),
      normalizedType as any,
    );
    return { documentNumber: number, branchId: id, docType: normalizedType };
  }
}
