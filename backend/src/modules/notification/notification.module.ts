import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationService } from './notification.service';
import { NotificationOutboxService } from './notification-outbox.service';
import { NotificationController } from './notification.controller';
import { NotificationAdminController, NotificationTemplateAdminController } from './notification-admin.controller';
import { InAppNotificationProvider } from './providers/in-app.provider';
import { DevMockEmailProvider } from './providers/dev-mock-email.provider';
import { DevMockSmsProvider } from './providers/dev-mock-sms.provider';

@Module({
  imports: [PrismaModule],
  controllers: [
    NotificationController,
    NotificationAdminController,
    NotificationTemplateAdminController,
  ],
  providers: [
    NotificationService,
    NotificationOutboxService,
    InAppNotificationProvider,
    DevMockEmailProvider,
    DevMockSmsProvider,
  ],
  exports: [
    NotificationService,
    NotificationOutboxService,
  ],
})
export class NotificationModule {}
