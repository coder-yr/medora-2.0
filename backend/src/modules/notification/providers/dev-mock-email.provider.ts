import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
  DeliveryResult,
} from './notification-provider.interface';

@Injectable()
export class DevMockEmailProvider implements INotificationProvider {
  readonly channel: NotificationChannel = 'EMAIL';
  readonly providerName = 'DEV_MOCK_EMAIL';
  private readonly logger = new Logger(DevMockEmailProvider.name);

  // Email format regex
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async send(payload: NotificationPayload): Promise<DeliveryResult> {
    const start = Date.now();
    const destination = payload.recipientDestination?.trim();

    if (!destination || !this.emailRegex.test(destination)) {
      return {
        success: false,
        provider: this.providerName,
        isTransientError: false, // Permanent error
        statusCode: '400_INVALID_EMAIL',
        error: `Malformed or missing email address: "${destination || ''}"`,
        durationMs: Date.now() - start,
      };
    }

    // Simulate transient error trigger for testing if address contains 'timeout'
    if (destination.includes('timeout') || destination.includes('retryable')) {
      return {
        success: false,
        provider: this.providerName,
        isTransientError: true, // Transient error
        statusCode: '504_GATEWAY_TIMEOUT',
        error: 'Simulated SMTP connection timeout to upstream mail exchange',
        durationMs: Date.now() - start,
      };
    }

    this.logger.log(
      `[DEV_MOCK_EMAIL] Simulated email dispatch to ${destination}: "${payload.title}"`,
    );

    return {
      success: true,
      provider: this.providerName,
      providerMessageId: `mock-mail-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      statusCode: '250_QUEUED',
      rawResponse: JSON.stringify({
        status: 'simulated_ok',
        to: destination,
        subject: payload.title,
      }),
      durationMs: Date.now() - start,
    };
  }
}
