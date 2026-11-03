import { Test, TestingModule } from '@nestjs/testing';
import { NotificationOutboxService } from './notification-outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { InAppNotificationProvider } from './providers/in-app.provider';
import { DevMockEmailProvider } from './providers/dev-mock-email.provider';
import { DevMockSmsProvider } from './providers/dev-mock-sms.provider';

describe('NotificationOutboxService', () => {
  let service: NotificationOutboxService;
  let prisma: any;
  let inAppProvider: InAppNotificationProvider;
  let emailProvider: DevMockEmailProvider;
  let smsProvider: DevMockSmsProvider;

  const mockPrisma: any = {
    notificationPreference: {
      findUnique: jest.fn(),
    },
    notificationOutbox: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    notification: {
      update: jest.fn(),
    },
    notificationDelivery: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (cb: any) => {
      if (typeof cb === 'function') {
        return cb(mockPrisma);
      }
      return cb;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationOutboxService,
        { provide: PrismaService, useValue: mockPrisma },
        InAppNotificationProvider,
        DevMockEmailProvider,
        DevMockSmsProvider,
      ],
    }).compile();

    service = module.get<NotificationOutboxService>(NotificationOutboxService);
    prisma = module.get<PrismaService>(PrismaService);
    inAppProvider = module.get<InAppNotificationProvider>(InAppNotificationProvider);
    emailProvider = module.get<DevMockEmailProvider>(DevMockEmailProvider);
    smsProvider = module.get<DevMockSmsProvider>(DevMockSmsProvider);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processPendingOutbox', () => {
    it('should process pending outbox items and transition to DELIVERED on success', async () => {
      const mockItem = {
        id: BigInt(1),
        notificationId: BigInt(100),
        channel: 'IN_APP',
        recipientUserId: BigInt(2),
        destination: null,
        recipientName: 'Test Recipient',
        attempts: 0,
        maxAttempts: 5,
        status: 'PENDING',
        notification: {
          id: BigInt(100),
          channel: 'IN_APP',
          title: 'Welcome',
          message: 'Welcome to Medora',
          metadata: {},
          recipients: [
            {
              id: BigInt(10),
              userId: BigInt(2),
              destination: null,
              recipientName: 'Test Recipient',
            },
          ],
        },
      };

      mockPrisma.notificationOutbox.findMany.mockResolvedValue([mockItem]);
      mockPrisma.notificationOutbox.update.mockResolvedValue({ ...mockItem, status: 'DELIVERED' });
      mockPrisma.notification.update.mockResolvedValue({ id: BigInt(100), status: 'DELIVERED' });
      mockPrisma.notificationDelivery.create.mockResolvedValue({ id: BigInt(10) });

      jest.spyOn(inAppProvider, 'send').mockResolvedValue({
        success: true,
        provider: 'IN_APP',
        providerMessageId: 'inapp-123',
      });

      const stats = await service.processPendingOutbox(10);
      expect(stats.delivered).toBe(1);
      expect(mockPrisma.notificationDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUCCESS',
            provider: 'IN_APP',
          }),
        }),
      );
    });

    it('should transition to RETRYABLE with nextRetryAt on transient error when attempts < maxAttempts', async () => {
      const mockItem = {
        id: BigInt(2),
        notificationId: BigInt(101),
        channel: 'SMS',
        recipientUserId: null,
        destination: '+1000000000',
        recipientName: 'Test Patient',
        attempts: 1,
        maxAttempts: 5,
        status: 'PENDING',
        notification: {
          id: BigInt(101),
          channel: 'SMS',
          title: 'SMS Title',
          message: 'SMS content',
          metadata: {},
          recipients: [
            {
              id: BigInt(11),
              userId: null,
              destination: '+1000000000',
              recipientName: 'Test Patient',
            },
          ],
        },
      };

      mockPrisma.notificationOutbox.findMany.mockResolvedValue([mockItem]);
      jest.spyOn(smsProvider, 'send').mockResolvedValue({
        success: false,
        provider: 'DEV_MOCK_SMS',
        error: 'Network Timeout (504)',
        isTransientError: true,
      });

      const stats = await service.processPendingOutbox(10);
      expect(stats.retryable).toBe(1);
      expect(mockPrisma.notificationOutbox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(2) },
          data: expect.objectContaining({
            status: 'RETRYABLE',
            attempts: 2,
            nextRetryAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should transition to DEAD_LETTER on permanent error', async () => {
      const mockItem = {
        id: BigInt(3),
        notificationId: BigInt(102),
        channel: 'EMAIL',
        recipientUserId: null,
        destination: 'invalid-email',
        recipientName: 'Bad Email',
        attempts: 1,
        maxAttempts: 5,
        status: 'PENDING',
        notification: {
          id: BigInt(102),
          channel: 'EMAIL',
          title: 'Hi',
          message: 'Email content',
          metadata: {},
          recipients: [
            {
              id: BigInt(12),
              userId: null,
              destination: 'invalid-email',
              recipientName: 'Bad Email',
            },
          ],
        },
      };

      mockPrisma.notificationOutbox.findMany.mockResolvedValue([mockItem]);
      jest.spyOn(emailProvider, 'send').mockResolvedValue({
        success: false,
        provider: 'DEV_MOCK_EMAIL',
        error: 'Invalid recipient address (400)',
        isTransientError: false,
      });

      const stats = await service.processPendingOutbox(10);
      expect(stats.failed).toBe(1);
      expect(mockPrisma.notificationOutbox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(3) },
          data: expect.objectContaining({
            status: 'DEAD_LETTER',
          }),
        }),
      );
    });
  });

  describe('recoverInterruptedJobs', () => {
    it('should recover jobs stuck in PROCESSING past the watchdog threshold', async () => {
      mockPrisma.notificationOutbox.updateMany.mockResolvedValue({ count: 2 });
      const recovered = await service.recoverInterruptedJobs(5);
      expect(recovered).toBe(2);
      expect(mockPrisma.notificationOutbox.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PROCESSING',
          }),
          data: expect.objectContaining({
            status: 'RETRYABLE',
          }),
        }),
      );
    });
  });
});
