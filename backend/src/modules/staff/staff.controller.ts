import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  ChangeDesignationDto,
  CreateDesignationDto,
  CreateStaffProfileDto,
  DepartmentTransferDto,
  LinkUserDto,
  OffboardStaffDto,
  StaffQueryDto,
  StaffStatus,
  UpdateStaffProfileDto,
  UpdateStaffStatusDto,
} from './dto/staff.dto';
import { StaffService } from './staff.service';

@ApiTags('Staff & HR Directory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  private getUserId(req: any): bigint | undefined {
    return req.user?.id ? BigInt(req.user.id) : undefined;
  }

  // ===========================================================================
  // 1. DASHBOARD & CATALOGUES
  // ===========================================================================

  @Get('dashboard/metrics')
  @RequirePermissions(HospitalPermission.STAFF_VIEW)
  @ApiOperation({ summary: 'Get staff overview metrics, department breakdown and recent activity' })
  @ApiResponse({ status: 200, description: 'Aggregated HR and directory metrics' })
  async getDashboardMetrics() {
    return this.staffService.getDashboardMetrics();
  }

  @Get('designations')
  @RequirePermissions(HospitalPermission.STAFF_VIEW)
  @ApiOperation({ summary: 'List staff designations catalogue' })
  @ApiResponse({ status: 200, description: 'Array of designation records' })
  async listDesignations(
    @Query('category') category?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const isActive = activeOnly === undefined || activeOnly === 'true' || activeOnly === '1';
    return this.staffService.listDesignations(category, isActive);
  }

  @Post('designations')
  @RequirePermissions(HospitalPermission.STAFF_CREATE)
  @ApiOperation({ summary: 'Create a new staff designation in the catalogue' })
  @ApiResponse({ status: 201, description: 'Created designation' })
  async createDesignation(@Body() dto: CreateDesignationDto) {
    return this.staffService.createDesignation(dto);
  }

  // ===========================================================================
  // 2. STAFF DIRECTORY & SEARCH
  // ===========================================================================

  @Get()
  @RequirePermissions(HospitalPermission.STAFF_VIEW)
  @ApiOperation({ summary: 'List and search non-medical staff directory with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of staff profiles' })
  async findAll(@Query() query: StaffQueryDto) {
    return this.staffService.findAll(query);
  }

  @Post()
  @RequirePermissions(HospitalPermission.STAFF_CREATE)
  @ApiOperation({ summary: 'Onboard a new staff profile with department and designation' })
  @ApiResponse({ status: 201, description: 'Created staff profile with generated employee number' })
  async createStaffProfile(@Body() dto: CreateStaffProfileDto, @Request() req: any) {
    const userId = this.getUserId(req);
    return this.staffService.createStaffProfile(dto, userId);
  }

  @Get(':id')
  @RequirePermissions(HospitalPermission.STAFF_VIEW)
  @ApiOperation({ summary: 'Get full staff profile with assignment history and linked user status' })
  @ApiParam({ name: 'id', description: 'Staff Profile ID' })
  @ApiResponse({ status: 200, description: 'Staff profile details' })
  async findById(@Param('id') id: string) {
    return this.staffService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(HospitalPermission.STAFF_UPDATE)
  @ApiOperation({ summary: 'Update staff contact, personal or qualifications details' })
  @ApiParam({ name: 'id', description: 'Staff Profile ID' })
  @ApiResponse({ status: 200, description: 'Updated staff profile' })
  async updateStaffProfile(
    @Param('id') id: string,
    @Body() dto: UpdateStaffProfileDto,
    @Request() req: any,
  ) {
    const userId = this.getUserId(req);
    return this.staffService.updateStaffProfile(id, dto, userId);
  }

  // ===========================================================================
  // 3. DEPARTMENT TRANSFERS & DESIGNATION CHANGES
  // ===========================================================================

  @Post(':id/transfer-department')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.STAFF_ASSIGN_DEPARTMENT)
  @ApiOperation({ summary: 'Transfer staff to another department with historical audit preservation' })
  @ApiParam({ name: 'id', description: 'Staff Profile ID' })
  @ApiResponse({ status: 200, description: 'Updated staff profile with new department assignment' })
  async transferDepartment(
    @Param('id') id: string,
    @Body() dto: DepartmentTransferDto,
    @Request() req: any,
  ) {
    const userId = this.getUserId(req);
    return this.staffService.transferDepartment(id, dto, userId);
  }

  @Post(':id/change-designation')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.STAFF_CHANGE_DESIGNATION)
  @ApiOperation({ summary: 'Update staff designation/role title with audit log' })
  @ApiParam({ name: 'id', description: 'Staff Profile ID' })
  @ApiResponse({ status: 200, description: 'Updated staff profile' })
  async changeDesignation(
    @Param('id') id: string,
    @Body() dto: ChangeDesignationDto,
    @Request() req: any,
  ) {
    const userId = this.getUserId(req);
    return this.staffService.changeDesignation(id, dto, userId);
  }

  // ===========================================================================
  // 4. USER ACCOUNT LINKING
  // ===========================================================================

  @Post(':id/link-user')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.STAFF_LINK_USER)
  @ApiOperation({ summary: 'Link an existing user login account to a staff profile' })
  @ApiParam({ name: 'id', description: 'Staff Profile ID' })
  @ApiResponse({ status: 200, description: 'Staff profile with linked user' })
  async linkUser(
    @Param('id') id: string,
    @Body() dto: LinkUserDto,
    @Request() req: any,
  ) {
    const userId = this.getUserId(req);
    return this.staffService.linkUser(id, dto, userId);
  }

  @Post(':id/unlink-user')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.STAFF_LINK_USER)
  @ApiOperation({ summary: 'Unlink user account from staff profile' })
  @ApiParam({ name: 'id', description: 'Staff Profile ID' })
  @ApiResponse({ status: 200, description: 'Staff profile unlinked' })
  async unlinkUser(@Param('id') id: string, @Request() req: any) {
    const userId = this.getUserId(req);
    return this.staffService.unlinkUser(id, userId);
  }

  @Get(':id/account-status')
  @RequirePermissions(HospitalPermission.STAFF_VIEW)
  @ApiOperation({ summary: 'Get user account and active session status for a staff profile' })
  @ApiParam({ name: 'id', description: 'Staff Profile ID' })
  @ApiResponse({ status: 200, description: 'Account status and active sessions' })
  async getAccountStatus(@Param('id') id: string) {
    return this.staffService.getAccountStatus(id);
  }

  // ===========================================================================
  // 5. LIFECYCLE & OFFBOARDING
  // ===========================================================================

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.STAFF_UPDATE)
  @ApiOperation({ summary: 'Update staff employment status (ACTIVE, ON_LEAVE, SUSPENDED, INACTIVE)' })
  @ApiParam({ name: 'id', description: 'Staff Profile ID' })
  @ApiResponse({ status: 200, description: 'Staff profile with updated status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStaffStatusDto,
    @Request() req: any,
  ) {
    const userId = this.getUserId(req);
    return this.staffService.updateStatus(id, dto, userId);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.STAFF_DEACTIVATE)
  @ApiOperation({ summary: 'Deactivate staff profile (sets status to INACTIVE)' })
  @ApiParam({ name: 'id', description: 'Staff Profile ID' })
  @ApiResponse({ status: 200, description: 'Deactivated staff profile' })
  async deactivateStaff(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    const userId = this.getUserId(req);
    return this.staffService.updateStatus(
      id,
      { status: StaffStatus.INACTIVE, reason: body?.reason || 'Deactivated by administrator' },
      userId,
    );
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.STAFF_UPDATE)
  @ApiOperation({ summary: 'Reactivate an inactive staff profile (sets status to ACTIVE)' })
  @ApiParam({ name: 'id', description: 'Reactivated staff profile' })
  @ApiResponse({ status: 200, description: 'Reactivated staff profile' })
  async reactivateStaff(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    const userId = this.getUserId(req);
    return this.staffService.updateStatus(
      id,
      { status: StaffStatus.ACTIVE, reason: body?.reason || 'Reactivated by administrator' },
      userId,
    );
  }

  @Post(':id/offboard')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.STAFF_OFFBOARD)
  @ApiOperation({ summary: 'Offboard employee: set TERMINATED, end assignments, revoke active sessions, preserve transactions' })
  @ApiParam({ name: 'id', description: 'Staff Profile ID' })
  @ApiResponse({ status: 200, description: 'Offboarded staff profile' })
  async offboardStaff(
    @Param('id') id: string,
    @Body() dto: OffboardStaffDto,
    @Request() req: any,
  ) {
    const userId = this.getUserId(req);
    return this.staffService.offboardStaff(id, dto, userId);
  }
}
