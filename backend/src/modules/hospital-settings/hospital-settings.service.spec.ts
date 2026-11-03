import { Test, TestingModule } from '@nestjs/testing';
import { HospitalSettingsService } from './hospital-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('HospitalSettingsService', () => {
  let service: HospitalSettingsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      hospitalSettings: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      hospitalBranch: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      branchSettings: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      userBranchMembership: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      cashierShift: {
        findFirst: jest.fn(),
      },
      configurationAuditLog: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      branchDocumentSequence: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HospitalSettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<HospitalSettingsService>(HospitalSettingsService);
  });

  describe('Hospital Settings & Branding', () => {
    it('should return existing hospital settings', async () => {
      const mockSettings = {
        id: BigInt(1),
        hospitalName: 'Medora Central Hospital',
        defaultCurrency: 'PKR',
        primaryColor: '#0284c7',
      };
      prisma.hospitalSettings.findFirst.mockResolvedValue(mockSettings);

      const res = await service.getHospitalSettings();
      expect(res.hospitalName).toBe('Medora Central Hospital');
      expect(res.id).toBe('1');
    });

    it('should initialize default hospital settings if none exist', async () => {
      prisma.hospitalSettings.findFirst.mockResolvedValue(null);
      prisma.hospitalSettings.create.mockResolvedValue({
        id: BigInt(1),
        hospitalName: 'Medora Central Hospital',
        defaultCurrency: 'PKR',
      });

      const res = await service.getHospitalSettings();
      expect(res.hospitalName).toBe('Medora Central Hospital');
      expect(prisma.hospitalSettings.create).toHaveBeenCalled();
    });

    it('should update hospital settings and create configuration audit logs', async () => {
      const current = {
        id: BigInt(1),
        hospitalName: 'Medora Central Hospital',
        phone: '+92-21-00000000',
      };
      prisma.hospitalSettings.findFirst.mockResolvedValue(current);
      prisma.hospitalSettings.update.mockResolvedValue({
        ...current,
        phone: '+92-21-99999999',
      });

      const res = await service.updateHospitalSettings(
        { hospitalName: 'Medora Central Hospital', phone: '+92-21-99999999' },
        BigInt(99),
        'Phone updated',
      );

      expect(res.phone).toBe('+92-21-99999999');
      expect(prisma.configurationAuditLog.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            settingKey: 'phone',
            previousValue: '+92-21-00000000',
            newValue: '+92-21-99999999',
          }),
        ]),
      });
    });

    it('should update branding assets and record audit log', async () => {
      const current = {
        id: BigInt(1),
        logoUrl: '/old-logo.png',
        primaryColor: '#0284c7',
      };
      prisma.hospitalSettings.findFirst.mockResolvedValue(current);
      prisma.hospitalSettings.update.mockResolvedValue({
        ...current,
        logoUrl: '/new-logo.png',
      });

      const res = await service.updateBranding(
        { logoUrl: '/new-logo.png' },
        BigInt(99),
        'Branding refresh',
      );

      expect(res.logoUrl).toBe('/new-logo.png');
      expect(prisma.configurationAuditLog.createMany).toHaveBeenCalled();
    });
  });

  describe('Branch Lifecycle & Settings', () => {
    it('should throw ConflictException when creating branch with duplicate code', async () => {
      prisma.hospitalBranch.findFirst.mockResolvedValue({ id: BigInt(1), code: 'MAIN' });

      await expect(
        service.createBranch({ name: 'Duplicate Main', code: 'MAIN' }, BigInt(99)),
      ).rejects.toThrow(ConflictException);
    });

    it('should create branch and auto-initialize branch settings with prefixes', async () => {
      prisma.hospitalBranch.findFirst.mockResolvedValue(null);
      prisma.hospitalBranch.create.mockResolvedValue({
        id: BigInt(2),
        name: 'Clifton Branch',
        code: 'CLIF',
        active: true,
      });

      // Mock getBranchById returned branch
      jest.spyOn(service, 'getBranchById').mockResolvedValue({
        id: '2',
        name: 'Clifton Branch',
        code: 'CLIF',
        active: true,
      } as any);

      await service.createBranch(
        { name: 'Clifton Branch', code: 'CLIF' },
        BigInt(99),
      );

      expect(prisma.branchSettings.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          branchId: BigInt(2),
          invoicePrefix: 'INV-CLIF-',
          mrnPrefix: 'MRN-CLIF-',
          appointmentPrefix: 'APT-CLIF-',
          admissionPrefix: 'ADM-CLIF-',
        }),
      });
    });

    it('should prevent deactivating branch when an open cashier shift exists', async () => {
      prisma.hospitalBranch.findFirst.mockResolvedValue({
        id: BigInt(2),
        name: 'Branch With Shift',
        active: true,
      });
      prisma.cashierShift.findFirst.mockResolvedValue({ id: BigInt(10), status: 'OPEN' });

      await expect(
        service.setBranchStatus(BigInt(2), false, BigInt(99)),
      ).rejects.toThrow(BadRequestException);
    });

    it('should resolve effective settings applying 3-tier precedence', async () => {
      const mockBranch = {
        id: BigInt(1),
        name: 'Clifton Branch',
        code: 'CLIF',
        phone: '+92-21-11111111',
        settings: {
          currencyOverride: 'USD', // Branch override
          invoicePrefix: 'INV-CLIF-CUSTOM-',
          receiptHeaderOverride: null, // Should fall back to hospital
        },
      };
      const mockHospital = {
        hospitalName: 'Medora Central Hospital',
        defaultTimezone: 'Asia/Karachi',
        defaultCurrency: 'PKR',
        receiptHeader: 'Hospital Main Header',
      };

      prisma.hospitalBranch.findUnique.mockResolvedValue(mockBranch);
      prisma.hospitalSettings.findFirst.mockResolvedValue(mockHospital);

      const effective = await service.getEffectiveSettings(BigInt(1));

      // Overridden by branch:
      expect(effective.currency).toBe('USD');
      expect(effective.invoicePrefix).toBe('INV-CLIF-CUSTOM-');
      // Inherited from hospital:
      expect(effective.timezone).toBe('Asia/Karachi');
      expect(effective.receiptHeader).toBe('Hospital Main Header');
    });
  });

  describe('User Branch Membership & Concurrency Numbering', () => {
    it('should assign user branch membership and update home branch if isDefault', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: BigInt(5), login: 'doctor1' });
      prisma.hospitalBranch.findUnique.mockResolvedValue({ id: BigInt(2), code: 'CITY' });
      prisma.userBranchMembership.upsert.mockResolvedValue({
        id: BigInt(1),
        userId: BigInt(5),
        branchId: BigInt(2),
        isDefault: true,
      });

      const res = await service.assignUserBranch(
        { userId: '5', branchId: '2', isDefault: true },
        BigInt(99),
      );

      expect(prisma.userBranchMembership.updateMany).toHaveBeenCalledWith({
        where: { userId: BigInt(5), isDefault: true },
        data: { isDefault: false },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: BigInt(5) },
        data: { branchId: BigInt(2) },
      });
      expect(res.id).toBe('1');
    });

    it('should generate document number atomically using branch prefix and sequence', async () => {
      const mockBranch = {
        id: BigInt(1),
        code: 'MAIN',
        settings: { invoicePrefix: 'INV-MAIN-' },
      };
      prisma.hospitalBranch.findUnique.mockResolvedValue(mockBranch);
      prisma.branchDocumentSequence.upsert.mockResolvedValue({
        sequenceNum: 42,
      });

      const docNum = await service.generateDocumentNumber(BigInt(1), 'INVOICE');
      const year = new Date().getFullYear();

      expect(docNum).toBe(`INV-MAIN-${year}-000042`);
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        `DOC_SEQ_1_INVOICE_${year}`,
      );
    });
  });
});
