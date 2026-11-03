import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: any;

  const mockPrisma: any = {
    notificationRecipient: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    notificationPreference: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    notificationTemplate: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    notificationOutbox: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
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
        NotificationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserNotifications', () => {
    it('should query recipients strictly filtered by userId', async () => {
      mockPrisma.notificationRecipient.findMany.mockResolvedValue([
        {
          id: BigInt(10),
          userId: BigInt(1),
          notificationId: BigInt(100),
          isRead: false,
          readAt: null,
          createdAt: new Date(),
          notification: {
            id: BigInt(100),
            eventType: 'APPOINTMENT_CONFIRMED',
            channel: 'IN_APP',
            title: 'Appointment Booked',
            message: 'Your appointment is booked',
            priority: 'NORMAL',
            metadata: {},
            branchId: BigInt(1),
            createdAt: new Date(),
            branch: { id: BigInt(1), name: 'Main Hospital', code: 'MAIN' },
          },
        },
      ]);
      mockPrisma.notificationRecipient.count.mockResolvedValue(1);

      const result = await service.getUserNotifications(BigInt(1), { isRead: 'false', limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].recipientId).toBe('10');
      expect(result.data[0].title).toBe('Appointment Booked');
      expect(mockPrisma.notificationRecipient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: BigInt(1),
            isRead: false,
          }),
        }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should update read status for owned recipient record', async () => {
      mockPrisma.notificationRecipient.findFirst.mockResolvedValue({
        id: BigInt(10),
        userId: BigInt(1),
        isRead: false,
      });
      mockPrisma.notificationRecipient.update.mockResolvedValue({
        id: BigInt(10),
        userId: BigInt(1),
        isRead: true,
        readAt: new Date(),
      });

      const updated = await service.markAsRead(BigInt(1), BigInt(10));
      expect(updated.isRead).toBe(true);
      expect(mockPrisma.notificationRecipient.update).toHaveBeenCalledWith({
        where: { id: BigInt(10) },
        data: expect.objectContaining({ isRead: true }),
      });
    });
  });

  describe('renderTemplateFromDatabase', () => {
    it('should safely escape HTML entities and replace variable placeholders', async () => {
      mockPrisma.notificationTemplate.findUnique.mockResolvedValue({
        id: BigInt(1),
        templateKey: 'PAYMENT_RECEIPT',
        channel: 'EMAIL',
        locale: 'en',
        subject: 'Receipt for {{name}}',
        body: 'Hello {{name}}, you paid {{amount}} for invoice {{inv}}',
      });

      const rendered = await service.renderTemplate(
        'PAYMENT_RECEIPT',
        'EMAIL',
        'en',
        { name: 'Dr. Jane & John', amount: '$100', inv: '<script>alert(1)</script>' },
      );

      expect(rendered.subject).toBe('Receipt for Dr. Jane &amp; John');
      expect(rendered.body).toBe('Hello Dr. Jane &amp; John, you paid $100 for invoice &lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });

  describe('queueNotification - deduplication', () => {
    it('should return existing notification if deduplication key matches', async () => {
      const existingNotification = {
        id: BigInt(100),
        eventType: 'PATIENT_REGISTERED',
        channel: 'IN_APP',
        title: 'Patient registered',
        message: 'Welcome',
        status: 'DELIVERED',
      };
      mockPrisma.notificationOutbox.findUnique.mockResolvedValue({
        id: BigInt(99),
        deduplicationKey: 'dup-123',
        notification: existingNotification,
      });

      const res = await service.queueNotification({
        eventType: 'PATIENT_REGISTERED',
        deduplicationKey: 'dup-123',
        channel: 'IN_APP',
        title: 'Patient registered',
        message: 'Welcome',
        recipients: [{ userId: '5' }],
      });

      expect(res.id).toBe('100');
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('getQueueHealth', () => {
    it('should calculate metrics and report healthy status when dead letter is low', async () => {
      mockPrisma.notificationOutbox.count
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(1) // processing
        .mockResolvedValueOnce(2) // retryable
        .mockResolvedValueOnce(0) // deadLetter
        .mockResolvedValueOnce(100); // delivered

      const health = await service.getQueueHealth();
      expect(health.pendingCount).toBe(5);
      expect(health.deadLetterCount).toBe(0);
      expect(health.status).toBe('HEALTHY');
    });

    it('should report degraded status when dead letter count exceeds 50', async () => {
      mockPrisma.notificationOutbox.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(55) // deadLetter > 50
        .mockResolvedValueOnce(100);

      const health = await service.getQueueHealth();
      expect(health.deadLetterCount).toBe(55);
      expect(health.status).toBe('DEGRADED');
    });
  });
});
