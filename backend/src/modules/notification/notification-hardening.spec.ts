import { UnauthorizedException } from '@nestjs/common';
import { validateEnv } from '../../common/config/env.validation';
import { NotificationAdminController } from './notification-admin.controller';
import { NotificationOutboxService } from './notification-outbox.service';
import { DevMockEmailProvider } from './providers/dev-mock-email.provider';
import { DevMockSmsProvider } from './providers/dev-mock-sms.provider';
import { InAppNotificationProvider } from './providers/in-app.provider';
import { ProductionEmailProvider } from './providers/production-email.provider';
import { ProductionSmsProvider } from './providers/production-sms.provider';

describe('Phase 10.6.1 — Notification Providers, Env Validation & Cron Security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Environment Validation (Production Guards)', () => {
    it('rejects mock notification providers when NODE_ENV=production', () => {
      expect(() =>
        validateEnv({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
          DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
          JWT_SECRET: 'a-very-strong-production-jwt-secret-32chars!',
          NOTIFICATION_PROVIDER_MODE: 'mock',
        }),
      ).toThrow(/Mock notification providers/);
    });

    it('rejects short JWT_SECRET (< 32 chars) in production', () => {
      expect(() =>
        validateEnv({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
          DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
          JWT_SECRET: 'short-secret-16ch',
        }),
      ).toThrow(/at least 32 characters in production/);
    });
  });

  describe('Production Provider Selection & Cron Overlap Guard', () => {
    const makeOutbox = () => {
      const mockPrisma = {
        $queryRawUnsafe: jest.fn(),
        notificationOutbox: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      const service = new NotificationOutboxService(
        mockPrisma as never,
        new InAppNotificationProvider(),
        new DevMockEmailProvider(),
        new DevMockSmsProvider(),
        new ProductionEmailProvider(),
        new ProductionSmsProvider(),
      );
      return { service, mockPrisma };
    };

    it('selects ProductionEmailProvider and ProductionSmsProvider in production (never mock)', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.NOTIFICATION_PROVIDER_MODE;
      const { service } = makeOutbox();
      expect(service.getProvider('EMAIL').providerName).toBe('PRODUCTION_EMAIL');
      expect(service.getProvider('SMS').providerName).toBe('TWILIO_SMS');
    });

    it('throws in production if NOTIFICATION_PROVIDER_MODE=mock', () => {
      process.env.NODE_ENV = 'production';
      process.env.NOTIFICATION_PROVIDER_MODE = 'mock';
      const { service } = makeOutbox();
      expect(() => service.getProvider('EMAIL')).toThrow(/forbidden in production/);
    });

    it('skips overlapping cron execution when pg_try_advisory_lock returns false', async () => {
      const { service, mockPrisma } = makeOutbox();
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ acquired: false }]);
      const res = await service.runScheduledOutboxPass(25);
      expect(res.skipped).toBe(true);
      expect(mockPrisma.notificationOutbox.findMany).not.toHaveBeenCalled();
    });

    it('runs recovery + outbox pass and releases advisory lock when acquired', async () => {
      const { service, mockPrisma } = makeOutbox();
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce([{ pg_advisory_unlock: true }]);
      const res = await service.runScheduledOutboxPass(25);
      expect(res.skipped).toBe(false);
      expect(res.recovered).toBe(0);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cron Endpoint Secret Authentication', () => {
    it('rejects missing or invalid CRON_SECRET and accepts valid Bearer token', async () => {
      process.env.CRON_SECRET = 'super-secure-cron-secret-value-1234';
      const mockOutboxService = {
        runScheduledOutboxPass: jest.fn().mockResolvedValue({ skipped: false, processed: 0 }),
      };
      const controller = new NotificationAdminController(
        {} as never,
        mockOutboxService as never,
      );

      await expect(controller.cronProcessOutbox(undefined, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(
        controller.cronProcessOutbox('Bearer wrong-secret-value-1234567890', undefined),
      ).rejects.toThrow(UnauthorizedException);

      const ok = await controller.cronProcessOutbox(
        'Bearer super-secure-cron-secret-value-1234',
        undefined,
        '20',
      );
      expect(ok.skipped).toBe(false);
      expect(mockOutboxService.runScheduledOutboxPass).toHaveBeenCalledWith(20);
    });
  });
});
