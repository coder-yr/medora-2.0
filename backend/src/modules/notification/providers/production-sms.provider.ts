import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryResult,
  INotificationProvider,
  NotificationPayload,
} from './notification-provider.interface';

@Injectable()
export class ProductionSmsProvider implements INotificationProvider {
  readonly channel = 'SMS' as const;
  readonly providerName = 'TWILIO_SMS';
  private readonly logger = new Logger(ProductionSmsProvider.name);

  isConfigured(): boolean {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_NUMBER,
    );
  }

  async send(payload: NotificationPayload): Promise<DeliveryResult> {
    const start = Date.now();
    if (!payload.recipientDestination) {
      return {
        success: false,
        provider: this.providerName,
        statusCode: '400',
        isTransientError: false,
        error: 'Missing recipient phone number',
        durationMs: Date.now() - start,
      };
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!sid || !token || !from) {
      return {
        success: false,
        provider: this.providerName,
        statusCode: '503',
        isTransientError: false,
        error: 'Twilio SMS credentials are not configured',
        durationMs: Date.now() - start,
      };
    }

    try {
      const authHeader = Buffer.from(`${sid}:${token}`).toString('base64');
      const form = new URLSearchParams({
        To: payload.recipientDestination,
        From: from,
        Body: `${payload.title}: ${payload.message}`.slice(0, 1500),
      });

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        },
      );

      const rawResponse = await res.text();
      if (!res.ok) {
        const isTransient = res.status === 429 || res.status >= 500;
        return {
          success: false,
          provider: this.providerName,
          statusCode: String(res.status),
          isTransientError: isTransient,
          error: `Twilio API error (${res.status})`,
          rawResponse,
          durationMs: Date.now() - start,
        };
      }

      const parsed = JSON.parse(rawResponse) as { sid?: string };
      return {
        success: true,
        provider: this.providerName,
        providerMessageId: parsed.sid,
        statusCode: String(res.status),
        rawResponse,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      this.logger.error(`Twilio SMS dispatch failed: ${err}`);
      return {
        success: false,
        provider: this.providerName,
        statusCode: '503',
        isTransientError: true,
        error: err instanceof Error ? err.message : 'Network error',
        durationMs: Date.now() - start,
      };
    }
  }
}
