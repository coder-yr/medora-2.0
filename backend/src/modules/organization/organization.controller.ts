import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipBranchCheck } from '../../common/decorators/skip-branch.decorator';
import { AuthUser } from '../../common/types/auth-user.interface';

@ApiTags('Organizations')
@ApiBearerAuth('JWT')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@SkipBranchCheck() // Organization management operates at the tenant level, above branch boundaries
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'List all healthcare organizations on the platform' })
  async findAll(@Query('type') type?: string, @Query('status') status?: string) {
    return this.organizationService.findAll({ type, status });
  }

  @Get('my-organizations')
  @ApiOperation({ summary: 'List all organizations the authenticated user belongs to' })
  async getMyOrganizations(@CurrentUser() user: AuthUser) {
    return this.organizationService.getUserOrganizations(user.id);
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Doctor')
  @ApiOperation({ summary: 'Get organization details by numeric ID' })
  async findById(@Param('id') id: string) {
    return this.organizationService.findById(id);
  }

  @Post()
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'Provision a new healthcare organization (Clinic, Polyclinic, Hospital)' })
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizationService.create(dto, user.id);
  }

  @Put(':id')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Update organization core properties' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(id, dto);
  }

  @Get(':id/settings')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Get organization settings and branding' })
  async getSettings(@Param('id') id: string) {
    return this.organizationService.getSettings(id);
  }

  @Put(':id/settings')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Update organization settings and branding' })
  async updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationSettingsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizationService.updateSettings(id, dto, user.id);
  }

  @Get(':id/branches')
  @Roles('SuperAdmin', 'Admin', 'Doctor')
  @ApiOperation({ summary: 'List all hospital branches belonging to an organization' })
  async getOrganizationBranches(@Param('id') id: string) {
    return this.organizationService.getOrganizationBranches(id);
  }

  @Get(':id/members')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'List all user memberships belonging to an organization' })
  async getOrganizationMembers(@Param('id') id: string) {
    return this.organizationService.getOrganizationMembers(id);
  }
}
