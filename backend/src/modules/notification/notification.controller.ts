import {
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { SkipBranchCheck } from '../../common/decorators/skip-branch.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { AuthUser } from '../../common/types/auth-user.interface';
import { NotificationService } from './notification.service';
import {
  QueryNotificationsDto,
  UpdatePreferencesDto,
} from './dto/notification.dto';

@ApiTags('Notifications & Messaging')
@ApiBearerAuth()
@SkipBranchCheck()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @ApiOperation({ summary: "Get current user's notification list" })
  @ApiResponse({ status: 200, description: 'Notifications retrieved' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_VIEW)
  async getUserNotifications(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.service.getUserNotifications(BigInt(user.id), query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: "Get current user's unread notifications counter" })
  @ApiResponse({ status: 200, description: 'Unread counter retrieved' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_VIEW)
  async getUnreadCount(@CurrentUser() user: AuthUser) {
    return this.service.getUnreadCount(BigInt(user.id));
  }

  @Get('preferences')
  @ApiOperation({ summary: "Get current user's delivery preferences and quiet hours" })
  @ApiResponse({ status: 200, description: 'Preferences retrieved' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_VIEW)
  async getUserPreferences(@CurrentUser() user: AuthUser) {
    return this.service.getUserPreferences(BigInt(user.id));
  }

  @Put('preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update current user's channel preferences and quiet hours" })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_PREFERENCES_UPDATE)
  async updateUserPreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.service.updateUserPreferences(BigInt(user.id), dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification details by ID' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification details' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_VIEW)
  async getNotificationById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const isGlobalAdmin = user.group === 'Admin';
    const userBranchId = user.branchId ? BigInt(user.branchId) : null;
    return this.service.getNotificationById(BigInt(id), userBranchId, isGlobalAdmin);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark specific notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_MARK_READ)
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.markAsRead(BigInt(id), BigInt(user.id));
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @RequirePermissions(HospitalPermission.NOTIFICATION_MARK_READ)
  async markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.service.markAllAsRead(BigInt(user.id));
  }
}
