import { Test, TestingModule } from '@nestjs/testing';
import { FollowUpService } from './follow-up.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { FollowUpPriority, FollowUpStatus, ReminderPreference } from './dto/follow-up.dto';
import { AuthUser } from '../../common/types/auth-user.interface';

describe('FollowUpService (Phase 10.5.8)', () => {
  let service: FollowUpService;
  let prisma: any;
  let notificationService: any;

  const mockUser: AuthUser = {
    id: '1',
    email: 'doctor@hospital.com',
    name: 'Dr. Jane Doe',
    group: 'Doctor',
    permissions: ['consultation_view', 'consultation_add'],
    branchId: BigInt(25),
    organizationId: BigInt(21),
  };

  const mockPrisma = {
    followUp: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
    },
    doctor: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockNotificationService = {
    queueNotification: jest.fn().mockResolvedValue({ id: '1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowUpService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<FollowUpService>(FollowUpService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a follow-up and queue reminder notification', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({
        id: BigInt(10),
        name: 'Rahul Sharma',
        phone: '9876543210',
        email: 'rahul@example.com',
        notificationPreferences: { followUpConsent: true },
      });

      mockPrisma.doctor.findUnique.mockResolvedValue({
        id: BigInt(5),
        name: 'Dr. Jane Doe',
        department: 'Cardiology',
      });

      const mockCreated = {
        id: BigInt(1),
        uuid: 'fu-uuid-1',
        followUpNumber: 'FOL-20261125-0001',
        organizationId: BigInt(21),
        branchId: BigInt(25),
        patientId: BigInt(10),
        doctorId: BigInt(5),
        dueDate: new Date('2026-12-05'),
        reason: 'Post-op cardiac evaluation',
        priority: FollowUpPriority.ROUTINE,
        status: FollowUpStatus.SCHEDULED,
        reminderPreference: ReminderPreference.IN_APP,
      };

      mockPrisma.followUp.create.mockResolvedValue(mockCreated);

      const result = await service.create(
        {
          patientId: '10',
          doctorId: '5',
          branchId: '25',
          dueDate: '2026-12-05',
          reason: 'Post-op cardiac evaluation',
          priority: FollowUpPriority.ROUTINE,
          reminderPreference: ReminderPreference.IN_APP,
        },
        mockUser,
      );

      expect(mockPrisma.followUp.create).toHaveBeenCalled();
      expect(mockNotificationService.queueNotification).toHaveBeenCalled();
      expect(result.followUpNumber).toBe('FOL-20261125-0001');
    });
  });

  describe('complete', () => {
    it('should transition status to COMPLETED and record completedAt', async () => {
      const existing = {
        id: BigInt(1),
        organizationId: BigInt(21),
        status: FollowUpStatus.SCHEDULED,
        clinicalNotes: 'Initial notes',
      };
      mockPrisma.followUp.findUnique.mockResolvedValue(existing);
      mockPrisma.followUp.update.mockResolvedValue({
        ...existing,
        status: FollowUpStatus.COMPLETED,
        completedAt: new Date(),
      });

      const result = await service.complete(BigInt(1), mockUser, { notes: 'Patient condition stable' });
      expect(mockPrisma.followUp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(1) },
          data: expect.objectContaining({
            status: FollowUpStatus.COMPLETED,
          }),
        }),
      );
      expect(result.status).toBe(FollowUpStatus.COMPLETED);
    });
  });

  describe('cancel', () => {
    it('should transition status to CANCELLED and record reason', async () => {
      const existing = {
        id: BigInt(1),
        organizationId: BigInt(21),
        status: FollowUpStatus.SCHEDULED,
      };
      mockPrisma.followUp.findUnique.mockResolvedValue(existing);
      mockPrisma.followUp.update.mockResolvedValue({
        ...existing,
        status: FollowUpStatus.CANCELLED,
        cancellationReason: 'Patient moved to another city',
      });

      const result = await service.cancel(BigInt(1), { reason: 'Patient moved to another city' }, mockUser);
      expect(result.status).toBe(FollowUpStatus.CANCELLED);
      expect(result.cancellationReason).toBe('Patient moved to another city');
    });
  });
});
