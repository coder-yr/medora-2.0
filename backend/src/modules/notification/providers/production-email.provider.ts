import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';
import * as tls from 'tls';
import {
  DeliveryResult,
  INotificationProvider,
  NotificationPayload,
} from './notification-provider.interface';

@Injectable()
export class ProductionEmailProvider implements INotificationProvider {
  readonly channel = 'EMAIL' as const;
  readonly providerName = 'PRODUCTION_EMAIL';
  private readonly logger = new Logger(ProductionEmailProvider.name);

  isConfigured(): boolean {
    return Boolean(
      process.env.RESEND_API_KEY ||
        (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
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
        error: 'Missing recipient email address',
        durationMs: Date.now() - start,
      };
    }

    if (process.env.RESEND_API_KEY) {
      return this.sendViaResend(payload, start);
    }

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      return this.sendViaSmtp(payload, start);
    }

    return {
      success: false,
      provider: this.providerName,
      statusCode: '503',
      isTransientError: false,
      error: 'No production email provider configured (set RESEND_API_KEY or SMTP_* env vars)',
      durationMs: Date.now() - start,
    };
  }

  private async sendViaResend(
    payload: NotificationPayload,
    start: number,
  ): Promise<DeliveryResult> {
    try {
      const from = process.env.SMTP_FROM || 'Medora Clinical <no-reply@medora.health>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [payload.recipientDestination],
          subject: payload.title,
          text: payload.message,
        }),
      });
      const bodyText = await res.text();
      if (!res.ok) {
        const isTransient = res.status === 429 || res.status >= 500;
        return {
          success: false,
          provider: 'RESEND',
          statusCode: String(res.status),
          isTransientError: isTransient,
          error: `Resend API error (${res.status})`,
          rawResponse: bodyText,
          durationMs: Date.now() - start,
        };
      }
      const parsed = JSON.parse(bodyText) as { id?: string };
      return {
        success: true,
        provider: 'RESEND',
        providerMessageId: parsed.id,
        statusCode: String(res.status),
        rawResponse: bodyText,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      this.logger.error(`Resend email dispatch failed: ${err}`);
      return {
        success: false,
        provider: 'RESEND',
        statusCode: '503',
        isTransientError: true,
        error: err instanceof Error ? err.message : 'Network error',
        durationMs: Date.now() - start,
      };
    }
  }

  private sendViaSmtp(
    payload: NotificationPayload,
    start: number,
  ): Promise<DeliveryResult> {
    const host = process.env.SMTP_HOST!;
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS!;
    const from = process.env.SMTP_FROM || user;
    const to = payload.recipientDestination!;

    return new Promise((resolve) => {
      const useTls = port === 465;
      const socket: net.Socket = useTls
        ? tls.connect({ host, port, servername: host })
        : net.connect({ host, port });

      socket.setTimeout(10_000);
      let step = 0;
      let buffer = '';

      const finish = (result: DeliveryResult) => {
        if (!socket.destroyed) socket.destroy();
        resolve(result);
      };

      socket.on('timeout', () => {
        finish({
          success: false,
          provider: 'SMTP',
          statusCode: '408',
          isTransientError: true,
          error: 'SMTP connection timeout',
          durationMs: Date.now() - start,
        });
      });

      socket.on('error', (err) => {
        finish({
          success: false,
          provider: 'SMTP',
          statusCode: '503',
          isTransientError: true,
          error: err.message,
          durationMs: Date.now() - start,
        });
      });

      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        if (!buffer.endsWith('\n')) return;
        const line = buffer.trim();
        buffer = '';

        const code = parseInt(line.slice(0, 3), 10);
        if (code >= 400) {
          finish({
            success: false,
            provider: 'SMTP',
            statusCode: String(code),
            isTransientError: code >= 400 && code < 500,
            error: line,
            durationMs: Date.now() - start,
          });
          return;
        }

        if (step === 0) {
          socket.write(`EHLO medora.local\r\n`);
          step = 1;
        } else if (step === 1) {
          socket.write(`AUTH LOGIN\r\n`);
          step = 2;
        } else if (step === 2) {
          socket.write(`${Buffer.from(user).toString('base64')}\r\n`);
          step = 3;
        } else if (step === 3) {
          socket.write(`${Buffer.from(pass).toString('base64')}\r\n`);
          step = 4;
        } else if (step === 4) {
          socket.write(`MAIL FROM:<${from}>\r\n`);
          step = 5;
        } else if (step === 5) {
          socket.write(`RCPT TO:<${to}>\r\n`);
          step = 6;
        } else if (step === 6) {
          socket.write(`DATA\r\n`);
          step = 7;
        } else if (step === 7) {
          const msg = [
            `From: ${from}`,
            `To: ${to}`,
            `Subject: ${payload.title}`,
            `Content-Type: text/plain; charset=utf-8`,
            '',
            payload.message,
            '.',
          ].join('\r\n');
          socket.write(`${msg}\r\n`);
          step = 8;
        } else if (step === 8) {
          socket.write(`QUIT\r\n`);
          finish({
            success: true,
            provider: 'SMTP',
            providerMessageId: `smtp-${Date.now()}`,
            statusCode: '250',
            rawResponse: line,
            durationMs: Date.now() - start,
          });
        }
      });
    });
  }
}
