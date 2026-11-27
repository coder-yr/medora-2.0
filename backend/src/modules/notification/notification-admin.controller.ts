import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SkipBranchCheck } from '../../common/decorators/skip-branch.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { AuthUser } from '../../common/types/auth-user.interface';
import { NotificationService } from './notification.service';
import { NotificationOutboxService } from './notification-outbox.service';
import {
  AdminQueryNotificationsDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  CreateNotificationDto,
} from './dto/notification.dto';

@ApiTags('Notification Administration & Queue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/notifications')
export class NotificationAdminController {
  constructor(
    private readonly service: NotificationService,
    private readonly outboxService: NotificationOutboxService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Administrative inspection of all notifications' })
  @ApiResponse({ status: 200, description: 'Administrative notification list' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_ADMIN_VIEW)
  async getAdminNotifications(
    @CurrentUser() user: AuthUser,
    @Query() query: AdminQueryNotificationsDto,
  ) {
    const isGlobalAdmin =
      user.group === 'Admin' ||
      user.permissions?.includes(HospitalPermission.BRANCH_VIEW_ALL);
    const userBranchId = user.branchId ? BigInt(user.branchId) : null;
    return this.service.getAdminNotifications(query, userBranchId, isGlobalAdmin);
  }

  @Get('queue-health')
  @ApiOperation({ summary: 'Get outbox queue backlog and provider health metrics' })
  @ApiResponse({ status: 200, description: 'Queue health status' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_QUEUE_MONITOR)
  async getQueueHealth() {
    return this.service.getQueueHealth();
  }

  @Get('health')
  @ApiOperation({ summary: 'Get outbox queue backlog and provider health metrics alias' })
  @ApiResponse({ status: 200, description: 'Queue health status' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_QUEUE_MONITOR)
  async getHealthAlias() {
    return this.service.getQueueHealth();
  }

  @Post('process-outbox')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger an immediate outbox processing pass' })
  @ApiResponse({ status: 200, description: 'Outbox processed' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_ADMIN_VIEW)
  async processOutbox(@Query('batchSize') batchSize?: string) {
    const limit = batchSize ? parseInt(batchSize, 10) : 25;
    return this.outboxService.processPendingOutbox(limit);
  }

  @Public()
  @SkipBranchCheck()
  @Post('cron/process-outbox')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Machine-to-machine scheduled outbox cron endpoint (CRON_SECRET authenticated)' })
  @ApiResponse({ status: 200, description: 'Scheduled outbox pass completed or skipped on overlap' })
  async cronProcessOutbox(
    @Headers('authorization') authHeader?: string,
    @Headers('x-cron-secret') cronHeader?: string,
    @Query('batchSize') batchSize?: string,
  ) {
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || expectedSecret.length < 16) {
      throw new UnauthorizedException('CRON_SECRET is not configured on this server.');
    }

    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const provided = cronHeader?.trim() || bearer;
    if (!provided) {
      throw new UnauthorizedException('Missing cron authentication secret.');
    }

    const expectedBuf = Buffer.from(expectedSecret, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new UnauthorizedException('Invalid cron authentication secret.');
    }

    const limit = batchSize ? parseInt(batchSize, 10) : 25;
    return this.outboxService.runScheduledOutboxPass(Number.isFinite(limit) ? limit : 25);
  }

  @Post('recover-stuck')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Watchdog recovery of interrupted processing jobs' })
  @ApiResponse({ status: 200, description: 'Interrupted jobs recovered' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_ADMIN_VIEW)
  async recoverStuck(@Query('timeoutMinutes') timeoutMinutes?: string) {
    const timeout = timeoutMinutes ? parseInt(timeoutMinutes, 10) : 5;
    const count = await this.outboxService.recoverInterruptedJobs(timeout);
    return { recoveredCount: count };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ingest notification event via transactional outbox' })
  @ApiResponse({ status: 201, description: 'Notification queued in outbox' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_ADMIN_VIEW)
  async createNotification(
    @Body() dto: CreateNotificationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const effectiveBranchId = dto.branchId || user.branchId?.toString();
    return this.service.queueNotification({
      ...dto,
      branchId: effectiveBranchId,
    });
  }

  @Post('create-event')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ingest notification event via transactional outbox (alias)' })
  @ApiResponse({ status: 201, description: 'Notification queued in outbox' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_ADMIN_VIEW)
  async createNotificationAlias(
    @Body() dto: CreateNotificationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const effectiveBranchId = dto.branchId || user.branchId?.toString();
    return this.service.queueNotification({
      ...dto,
      branchId: effectiveBranchId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get administrative details of a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification details' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_ADMIN_VIEW)
  async getNotificationById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const isGlobalAdmin =
      user.group === 'Admin' ||
      user.permissions?.includes(HospitalPermission.BRANCH_VIEW_ALL);
    const userBranchId = user.branchId ? BigInt(user.branchId) : null;
    return this.service.getNotificationById(BigInt(id), userBranchId, isGlobalAdmin);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually retry a failed or dead-lettered outbox job' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Outbox job reset for retry' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_RETRY)
  async retryNotification(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.retryNotification(BigInt(id), BigInt(user.id));
  }
}

@ApiTags('Notification Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/notification-templates')
export class NotificationTemplateAdminController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List all notification templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_TEMPLATE_VIEW)
  async listTemplates() {
    return this.service.listTemplates();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new notification template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_TEMPLATE_MANAGE)
  async createTemplate(@Body() dto: CreateTemplateDto) {
    return this.service.createTemplate(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing notification template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_TEMPLATE_MANAGE)
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.service.updateTemplate(BigInt(id), dto);
  }
}
