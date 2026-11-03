import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
  DeliveryResult,
} from './notification-provider.interface';

@Injectable()
export class InAppNotificationProvider implements INotificationProvider {
  readonly channel: NotificationChannel = 'IN_APP';
  readonly providerName = 'INTERNAL_IN_APP';
  private readonly logger = new Logger(InAppNotificationProvider.name);

  async send(payload: NotificationPayload): Promise<DeliveryResult> {
    const start = Date.now();
    this.logger.debug(
      `[IN_APP] Delivered in-app alert to recipient: ${payload.recipientName || 'User'}`,
    );

    return {
      success: true,
      provider: this.providerName,
      providerMessageId: `inapp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      statusCode: '200_OK',
      durationMs: Date.now() - start,
    };
  }
}
