import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
  DeliveryResult,
} from './notification-provider.interface';

@Injectable()
export class DevMockSmsProvider implements INotificationProvider {
  readonly channel: NotificationChannel = 'SMS';
  readonly providerName = 'DEV_MOCK_SMS';
  private readonly logger = new Logger(DevMockSmsProvider.name);

  // Default country code: 92 (Pakistan)
  private readonly defaultCountryCode = '92';

  normalisePhone(phone?: string): string | null {
    if (!phone) return null;
    let clean = phone.trim().replace(/[\s\-\(\)\.]/g, '');
    if (clean.startsWith('+')) {
      clean = clean.substring(1);
    } else if (clean.startsWith('0')) {
      clean = this.defaultCountryCode + clean.substring(1);
    }

    const digitsOnly = clean.replace(/\D/g, '');
    return digitsOnly.length >= 10 && digitsOnly.length <= 15 ? digitsOnly : null;
  }

  async send(payload: NotificationPayload): Promise<DeliveryResult> {
    const start = Date.now();
    const rawDestination = payload.recipientDestination?.trim();
    const normalised = this.normalisePhone(rawDestination);

    if (!normalised) {
      return {
        success: false,
        provider: this.providerName,
        isTransientError: false, // Permanent error
        statusCode: '400_INVALID_PHONE',
        error: `Invalid or unroutable phone number: "${rawDestination || ''}"`,
        durationMs: Date.now() - start,
      };
    }

    // Simulate transient error for testing when destination includes 'timeout' or '9999999999'
    if (rawDestination?.includes('timeout') || normalised.endsWith('999999')) {
      return {
        success: false,
        provider: this.providerName,
        isTransientError: true, // Transient error
        statusCode: '503_SERVICE_UNAVAILABLE',
        error: 'Simulated telecom gateway temporary congestion / timeout',
        durationMs: Date.now() - start,
      };
    }

    // Redacted phone for secure logging (e.g. 92300*****12)
    const redactedPhone =
      normalised.length > 6
        ? `${normalised.substring(0, 5)}*****${normalised.substring(normalised.length - 2)}`
        : '*****';

    this.logger.log(
      `[DEV_MOCK_SMS] Simulated SMS dispatch to ${redactedPhone}: "${payload.message.substring(0, 40)}..."`,
    );

    return {
      success: true,
      provider: this.providerName,
      providerMessageId: `mock-sms-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      statusCode: '200_SUBMITTED',
      rawResponse: JSON.stringify({
        status: 'simulated_accepted',
        destination: redactedPhone,
        chars: payload.message.length,
      }),
      durationMs: Date.now() - start,
    };
  }
}
