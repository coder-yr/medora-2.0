import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { BranchAccessGuard } from '../../common/guards/branch-access.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { AuthUser } from '../../common/types/auth-user.interface';
import { FollowUpService } from './follow-up.service';
import {
  CreateFollowUpDto,
  UpdateFollowUpDto,
  CompleteFollowUpDto,
  CancelFollowUpDto,
  QueryFollowUpDto,
} from './dto/follow-up.dto';

@ApiTags('Clinical Follow-ups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, BranchAccessGuard)
@Controller('follow-ups')
export class FollowUpController {
  constructor(private readonly service: FollowUpService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a clinical follow-up for a patient' })
  @ApiResponse({ status: 201, description: 'Follow-up scheduled' })
  @RequirePermissions(HospitalPermission.CONSULTATION_ADD)
  async create(
    @Body() dto: CreateFollowUpDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List and query scheduled clinical follow-ups' })
  @ApiResponse({ status: 200, description: 'Follow-ups list' })
  @RequirePermissions(HospitalPermission.CONSULTATION_VIEW)
  async query(
    @Query() query: QueryFollowUpDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.query(query, user);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming follow-ups for a doctor' })
  @ApiResponse({ status: 200, description: 'Upcoming follow-ups' })
  @RequirePermissions(HospitalPermission.CONSULTATION_VIEW)
  async getUpcoming(
    @Query('doctorId') doctorId: string,
    @Query('days') days?: string,
  ) {
    const docId = BigInt(doctorId);
    const dayCount = days ? parseInt(days, 10) : 7;
    return this.service.getUpcomingFollowUps(docId, dayCount);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve follow-up details by ID' })
  @ApiParam({ name: 'id', description: 'Follow-up ID' })
  @ApiResponse({ status: 200, description: 'Follow-up details' })
  @RequirePermissions(HospitalPermission.CONSULTATION_VIEW)
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findById(BigInt(id), user);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update follow-up schedule, priority or clinical notes' })
  @ApiParam({ name: 'id', description: 'Follow-up ID' })
  @ApiResponse({ status: 200, description: 'Follow-up updated' })
  @RequirePermissions(HospitalPermission.CONSULTATION_ADD)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFollowUpDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(BigInt(id), dto, user);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark follow-up as completed' })
  @ApiParam({ name: 'id', description: 'Follow-up ID' })
  @ApiResponse({ status: 200, description: 'Follow-up completed' })
  @RequirePermissions(HospitalPermission.CONSULTATION_ADD)
  async complete(
    @Param('id') id: string,
    @Body() dto: CompleteFollowUpDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.complete(BigInt(id), user, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel follow-up with cancellation reason' })
  @ApiParam({ name: 'id', description: 'Follow-up ID' })
  @ApiResponse({ status: 200, description: 'Follow-up cancelled' })
  @RequirePermissions(HospitalPermission.CONSULTATION_ADD)
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelFollowUpDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.cancel(BigInt(id), dto, user);
  }
}
