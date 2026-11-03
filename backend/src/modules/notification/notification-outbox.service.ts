import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InAppNotificationProvider } from './providers/in-app.provider';
import { DevMockEmailProvider } from './providers/dev-mock-email.provider';
import { DevMockSmsProvider } from './providers/dev-mock-sms.provider';
import { INotificationProvider, DeliveryResult } from './providers/notification-provider.interface';

@Injectable()
export class NotificationOutboxService {
  private readonly logger = new Logger(NotificationOutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inAppProvider: InAppNotificationProvider,
    private readonly emailProvider: DevMockEmailProvider,
    private readonly smsProvider: DevMockSmsProvider,
  ) {}

  private getProvider(channel: string): INotificationProvider {
    switch (channel) {
      case 'IN_APP':
        return this.inAppProvider;
      case 'EMAIL':
        return this.emailProvider;
      case 'SMS':
        return this.smsProvider;
      default:
        throw new Error(`Unsupported notification channel: "${channel}"`);
    }
  }

  async processPendingOutbox(batchSize = 25): Promise<{
    processed: number;
    delivered: number;
    failed: number;
    retryable: number;
  }> {
    const now = new Date();

    // 1. Fetch pending or retryable jobs whose scheduled/retry times have passed
    const candidateJobs = await this.prisma.notificationOutbox.findMany({
      where: {
        status: { in: ['PENDING', 'RETRYABLE'] },
        scheduledAt: { lte: now },
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      take: batchSize,
      orderBy: { scheduledAt: 'asc' },
      include: {
        notification: {
          include: {
            recipients: true,
            branch: true,
          },
        },
      },
    });

    if (candidateJobs.length === 0) {
      return { processed: 0, delivered: 0, failed: 0, retryable: 0 };
    }

    let deliveredCount = 0;
    let failedCount = 0;
    let retryableCount = 0;

    for (const job of candidateJobs) {
      // 2. Lock job transition to PROCESSING
      await this.prisma.notificationOutbox.update({
        where: { id: job.id },
        data: {
          status: 'PROCESSING',
          processingStartedAt: new Date(),
        },
      });

      const channel = job.channel;
      const provider = this.getProvider(channel);
      const recipients = job.notification.recipients;

      let allSucceeded = true;
      let lastDeliveryResult: DeliveryResult | null = null;

      // 3. Dispatch to all recipients
      for (const recipient of recipients) {
        // Evaluate recipient preferences if recipient is a registered staff user
        if (recipient.userId) {
          const pref = await this.prisma.notificationPreference.findUnique({
            where: { userId: recipient.userId },
          });

          if (pref) {
            if (channel === 'IN_APP' && !pref.inAppEnabled) continue;
            if (channel === 'EMAIL' && !pref.emailEnabled) continue;
            if (channel === 'SMS' && !pref.smsEnabled) continue;
          }
        }

        try {
          const res = await provider.send({
            recipientDestination: recipient.destination || undefined,
            recipientName: recipient.recipientName || undefined,
            title: job.notification.title,
            message: job.notification.message,
            metadata: (job.notification.metadata as Record<string, any>) || undefined,
          });

          lastDeliveryResult = res;

          // Record immutable delivery attempt log
          await this.prisma.notificationDelivery.create({
            data: {
              notificationId: job.notificationId,
              channel,
              provider: res.provider,
              providerMessageId: res.providerMessageId || null,
              attemptNumber: job.attempts + 1,
              status: res.success
                ? 'SUCCESS'
                : res.isTransientError
                  ? 'TRANSIENT_FAILURE'
                  : 'PERMANENT_FAILURE',
              statusCode: res.statusCode || null,
              responseBody: res.rawResponse || null,
              errorMessage: res.error || null,
              durationMs: res.durationMs || null,
            },
          });

          if (!res.success) {
            allSucceeded = false;
            break; // Stop at first failed recipient in this attempt
          }
        } catch (err: any) {
          allSucceeded = false;
          lastDeliveryResult = {
            success: false,
            provider: provider.providerName,
            isTransientError: true,
            error: err.message || 'Unexpected provider exception',
          };
          break;
        }
      }

      // 4. Update Outbox state based on delivery outcome
      const currentAttempt = job.attempts + 1;

      if (allSucceeded) {
        deliveredCount++;
        await this.prisma.$transaction([
          this.prisma.notificationOutbox.update({
            where: { id: job.id },
            data: {
              status: 'DELIVERED',
              attempts: currentAttempt,
              deliveredAt: new Date(),
              lastError: null,
            },
          }),
          this.prisma.notification.update({
            where: { id: job.notificationId },
            data: {
              status: 'DELIVERED',
              sentAt: new Date(),
            },
          }),
        ]);
      } else {
        const isTransient = lastDeliveryResult?.isTransientError ?? true;
        const reachedMax = currentAttempt >= job.maxAttempts;

        if (isTransient && !reachedMax) {
          retryableCount++;
          // Exponential backoff: 30s, 60s, 120s, 240s... capped at 1 hour
          const backoffSec = Math.min(3600, Math.pow(2, currentAttempt) * 30);
          const nextRetryAt = new Date(Date.now() + backoffSec * 1000);

          await this.prisma.notificationOutbox.update({
            where: { id: job.id },
            data: {
              status: 'RETRYABLE',
              attempts: currentAttempt,
              nextRetryAt,
              lastError: lastDeliveryResult?.error || 'Transient provider delivery error',
              lastErrorCategory: 'TRANSIENT',
            },
          });
        } else {
          // Terminal / Permanent failure or exhausted retries
          failedCount++;
          const errorCategory = !isTransient ? 'PERMANENT' : 'MAX_RETRIES_EXCEEDED';

          await this.prisma.$transaction([
            this.prisma.notificationOutbox.update({
              where: { id: job.id },
              data: {
                status: 'DEAD_LETTER',
                attempts: currentAttempt,
                lastError: lastDeliveryResult?.error || 'Terminal delivery failure',
                lastErrorCategory: errorCategory,
              },
            }),
            this.prisma.notification.update({
              where: { id: job.notificationId },
              data: {
                status: 'FAILED',
              },
            }),
          ]);
        }
      }
    }

    return {
      processed: candidateJobs.length,
      delivered: deliveredCount,
      failed: failedCount,
      retryable: retryableCount,
    };
  }

  async recoverInterruptedJobs(timeoutMinutes = 5): Promise<number> {
    const threshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const stuckJobs = await this.prisma.notificationOutbox.updateMany({
      where: {
        status: 'PROCESSING',
        processingStartedAt: { lt: threshold },
      },
      data: {
        status: 'RETRYABLE',
        nextRetryAt: new Date(),
        lastError: 'Job recovered after interrupted processing (watchdog timeout)',
        lastErrorCategory: 'TIMEOUT',
      },
    });

    if (stuckJobs.count > 0) {
      this.logger.warn(
        `[WATCHDOG] Recovered ${stuckJobs.count} interrupted outbox job(s) back to RETRYABLE`,
      );
    }

    return stuckJobs.count;
  }
}
