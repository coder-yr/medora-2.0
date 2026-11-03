import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStaffProfileDto,
  DepartmentTransferDto,
  EmploymentType,
  StaffStatus,
} from './dto/staff.dto';
import { StaffService } from './staff.service';

describe('StaffService', () => {
  let service: StaffService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      staffProfile: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      staffDesignation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      staffDepartmentAssignment: {
        create: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      staffEmploymentHistory: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      department: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      hospitalBranch: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      userSession: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. EMPLOYEE NUMBER GENERATION
  // ===========================================================================
  describe('generateEmployeeNumber', () => {
    it('should generate EMP-YYYYMM-0001 when no previous employees exist in month', async () => {
      prisma.staffProfile.findFirst.mockResolvedValue(null);

      const num = await service.generateEmployeeNumber();
      const now = new Date();
      const expectedPrefix = `EMP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-0001`;
      expect(num).toBe(expectedPrefix);
    });

    it('should increment sequence number correctly from highest existing in month', async () => {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      prisma.staffProfile.findFirst.mockResolvedValue({
        employeeNumber: `EMP-${yearMonth}-0042`,
      });

      const num = await service.generateEmployeeNumber();
      expect(num).toBe(`EMP-${yearMonth}-0043`);
    });
  });

  // ===========================================================================
  // 2. STAFF ONBOARDING
  // ===========================================================================
  describe('createStaffProfile', () => {
    const validDto: CreateStaffProfileDto = {
      firstName: 'Florence',
      lastName: 'Nightingale',
      email: 'florence@medora.hospital',
      departmentId: 1,
      designationId: 2,
      employmentType: EmploymentType.FULL_TIME,
      employmentStatus: StaffStatus.ACTIVE,
    };

    it('should successfully onboard a staff profile and record initial assignment and history', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 1n, name: 'Nursing' });
      prisma.staffDesignation.findUnique.mockResolvedValue({ id: 2n, title: 'Head Nurse' });
      prisma.staffProfile.findFirst.mockResolvedValue(null);
      prisma.staffProfile.create.mockResolvedValue({
        id: 10n,
        employeeNumber: 'EMP-202611-0001',
        firstName: 'Florence',
        lastName: 'Nightingale',
        displayName: 'Florence Nightingale',
        employmentStatus: 'ACTIVE',
        departmentId: 1n,
        designationId: 2n,
      });

      const result = await service.createStaffProfile(validDto, 5n);

      expect(prisma.staffProfile.create).toHaveBeenCalled();
      expect(prisma.staffDepartmentAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            staffProfileId: 10n,
            departmentId: 1n,
            isPrimary: true,
            reason: 'Initial onboarding assignment',
            assignedBy: 5n,
          }),
        }),
      );
      expect(prisma.staffEmploymentHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            staffProfileId: 10n,
            eventType: 'ONBOARDED',
            newValue: 'ACTIVE',
            recordedBy: 5n,
          }),
        }),
      );
      expect(result.id).toBe('10');
      expect(result.employeeNumber).toBe('EMP-202611-0001');
    });

    it('should reject onboarding if linked user is already linked to another profile', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 99n, login: 'nurse_user' });
      prisma.staffProfile.findUnique.mockResolvedValue({
        id: 20n,
        employeeNumber: 'EMP-202611-0005',
        displayName: 'Existing Staff',
      });

      await expect(
        service.createStaffProfile({ ...validDto, userId: 99 }, 1n),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject onboarding if department does not exist', async () => {
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(
        service.createStaffProfile(validDto, 1n),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // 3. PROFILE UPDATES
  // ===========================================================================
  describe('updateStaffProfile', () => {
    it('should update contact details and record PROFILE_UPDATED audit history', async () => {
      prisma.staffProfile.findUnique.mockResolvedValue({
        id: 10n,
        firstName: 'Florence',
        lastName: 'Nightingale',
        displayName: 'Florence Nightingale',
        email: 'old@medora.hospital',
      });
      prisma.staffProfile.update.mockResolvedValue({
        id: 10n,
        firstName: 'Florence',
        lastName: 'Nightingale',
        displayName: 'Florence Nightingale',
        email: 'new@medora.hospital',
        phone: '+1-555-0101',
      });

      const result = await service.updateStaffProfile(
        10n,
        { email: 'new@medora.hospital', phone: '+1-555-0101' },
        1n,
      );

      expect(prisma.staffProfile.update).toHaveBeenCalled();
      expect(prisma.staffEmploymentHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            staffProfileId: 10n,
            eventType: 'PROFILE_UPDATED',
          }),
        }),
      );
      expect(result.email).toBe('new@medora.hospital');
    });

    it('should reject staff setting themselves as their own reporting manager', async () => {
      prisma.staffProfile.findUnique.mockResolvedValue({
        id: 10n,
        firstName: 'Florence',
        lastName: 'Nightingale',
      });

      await expect(
        service.updateStaffProfile(10n, { reportingManagerId: 10 }, 1n),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ===========================================================================
  // 4. DEPARTMENT TRANSFERS
  // ===========================================================================
  describe('transferDepartment', () => {
    const transferDto: DepartmentTransferDto = {
      targetDepartmentId: 3,
      reason: 'Promoted to ICU ward coordinator',
      isPrimary: true,
    };

    it('should close old primary assignment, create new assignment, and record DEPARTMENT_TRANSFER history', async () => {
      prisma.staffProfile.findUnique.mockResolvedValue({
        id: 10n,
        departmentId: 1n,
        branchId: 1n,
        department: { id: 1n, name: 'General Ward' },
      });
      prisma.department.findUnique.mockResolvedValue({
        id: 3n,
        name: 'Intensive Care Unit',
      });
      prisma.staffProfile.update.mockResolvedValue({
        id: 10n,
        departmentId: 3n,
        department: { id: 3n, name: 'Intensive Care Unit' },
      });

      const result = await service.transferDepartment(10n, transferDto, 2n);

      expect(prisma.staffDepartmentAssignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            staffProfileId: 10n,
            isPrimary: true,
            effectiveEnd: null,
          },
        }),
      );

      expect(prisma.staffDepartmentAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            staffProfileId: 10n,
            departmentId: 3n,
            isPrimary: true,
            reason: 'Promoted to ICU ward coordinator',
            assignedBy: 2n,
          }),
        }),
      );

      expect(prisma.staffEmploymentHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            staffProfileId: 10n,
            eventType: 'DEPARTMENT_TRANSFER',
            previousValue: 'General Ward',
            newValue: 'Intensive Care Unit',
            comments: 'Promoted to ICU ward coordinator',
            recordedBy: 2n,
          }),
        }),
      );

      expect(result.departmentId).toBe('3');
    });

    it('should throw NotFoundException if target department does not exist', async () => {
      prisma.staffProfile.findUnique.mockResolvedValue({ id: 10n, department: null });
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(
        service.transferDepartment(10n, transferDto, 1n),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // 5. DESIGNATION CHANGES
  // ===========================================================================
  describe('changeDesignation', () => {
    it('should update designation and record DESIGNATION_CHANGE event', async () => {
      prisma.staffProfile.findUnique.mockResolvedValue({
        id: 10n,
        designationId: 1n,
        designation: { id: 1n, title: 'Staff Nurse' },
      });
      prisma.staffDesignation.findUnique.mockResolvedValue({
        id: 5n,
        title: 'Clinical Specialist Nurse',
      });
      prisma.staffProfile.update.mockResolvedValue({
        id: 10n,
        designationId: 5n,
      });

      const result = await service.changeDesignation(
        10n,
        { targetDesignationId: 5, reason: 'Specialist certification completed' },
        3n,
      );

      expect(prisma.staffProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10n },
          data: { designationId: 5n },
        }),
      );
      expect(prisma.staffEmploymentHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            staffProfileId: 10n,
            eventType: 'DESIGNATION_CHANGE',
            previousValue: 'Staff Nurse',
            newValue: 'Clinical Specialist Nurse',
            recordedBy: 3n,
          }),
        }),
      );
      expect(result.designationId).toBe('5');
    });
  });

  // ===========================================================================
  // 6. USER ACCOUNT LINKING & UNLINKING
  // ===========================================================================
  describe('linkUser & unlinkUser', () => {
    it('should successfully link user account and log USER_ACCOUNT_LINKED', async () => {
      prisma.staffProfile.findUnique
        .mockResolvedValueOnce({ id: 10n, userId: null }) // first call for profile check
        .mockResolvedValueOnce(null); // second call for targetUser existing profile check
      prisma.user.findUnique.mockResolvedValue({ id: 44n, login: 'florence_login' });
      prisma.staffProfile.update.mockResolvedValue({
        id: 10n,
        userId: 44n,
        user: { id: 44n, login: 'florence_login' },
      });

      const result = await service.linkUser(10n, { userId: 44 }, 1n);

      expect(prisma.staffProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10n },
          data: { userId: 44n },
        }),
      );
      expect(prisma.staffEmploymentHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'USER_ACCOUNT_LINKED',
            newValue: 'florence_login',
          }),
        }),
      );
      expect(result.userId).toBe('44');
    });

    it('should throw ConflictException if user is already linked to another staff profile', async () => {
      prisma.staffProfile.findUnique
        .mockResolvedValueOnce({ id: 10n, userId: null })
        .mockResolvedValueOnce({
          id: 99n,
          employeeNumber: 'EMP-202611-0099',
          displayName: 'Other Employee',
        });
      prisma.user.findUnique.mockResolvedValue({ id: 44n, login: 'florence_login' });

      await expect(service.linkUser(10n, { userId: 44 }, 1n)).rejects.toThrow(ConflictException);
    });

    it('should successfully unlink user account and log USER_ACCOUNT_UNLINKED', async () => {
      prisma.staffProfile.findUnique.mockResolvedValue({
        id: 10n,
        userId: 44n,
        user: { login: 'florence_login' },
      });
      prisma.staffProfile.update.mockResolvedValue({
        id: 10n,
        userId: null,
      });

      const result = await service.unlinkUser(10n, 1n);

      expect(prisma.staffProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10n },
          data: { userId: null },
        }),
      );
      expect(prisma.staffEmploymentHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'USER_ACCOUNT_UNLINKED',
            previousValue: 'florence_login',
          }),
        }),
      );
      expect(result.userId).toBeNull();
    });
  });

  // ===========================================================================
  // 7. STAFF LIFECYCLE & OFFBOARDING
  // ===========================================================================
  describe('staff lifecycle and offboarding', () => {
    it('should transition status to ON_LEAVE and record STATUS_CHANGE', async () => {
      prisma.staffProfile.findUnique.mockResolvedValue({
        id: 10n,
        employmentStatus: 'ACTIVE',
      });
      prisma.staffProfile.update.mockResolvedValue({
        id: 10n,
        employmentStatus: 'ON_LEAVE',
      });

      const result = await service.updateStatus(
        10n,
        { status: StaffStatus.ON_LEAVE, reason: 'Approved sabbatical' },
        1n,
      );

      expect(prisma.staffProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10n },
          data: expect.objectContaining({ employmentStatus: StaffStatus.ON_LEAVE }),
        }),
      );
      expect(prisma.staffEmploymentHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'STATUS_CHANGE',
            previousValue: 'ACTIVE',
            newValue: 'ON_LEAVE',
          }),
        }),
      );
      expect(result.employmentStatus).toBe('ON_LEAVE');
    });

    it('should offboard staff, close active assignments, revoke active sessions, and preserve audit', async () => {
      prisma.staffProfile.findUnique.mockResolvedValue({
        id: 10n,
        userId: 44n,
        employmentStatus: 'ACTIVE',
      });
      prisma.staffProfile.update.mockResolvedValue({
        id: 10n,
        employmentStatus: 'TERMINATED',
        offboardingReason: 'Contract end',
      });

      const result = await service.offboardStaff(
        10n,
        { reason: 'Contract end', deactivateUserAccount: true },
        1n,
      );

      // Verify department assignments closed
      expect(prisma.staffDepartmentAssignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { staffProfileId: 10n, effectiveEnd: null },
        }),
      );

      // Verify user sessions revoked
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 44n, isRevoked: false },
        data: { isRevoked: true },
      });

      // Verify offboarded status and event logged
      expect(prisma.staffEmploymentHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'OFFBOARDED',
            newValue: 'TERMINATED',
          }),
        }),
      );

      expect(result.employmentStatus).toBe('TERMINATED');
    });

    it('should reject offboarding an already terminated employee', async () => {
      prisma.staffProfile.findUnique.mockResolvedValue({
        id: 10n,
        employmentStatus: 'TERMINATED',
      });

      await expect(
        service.offboardStaff(10n, { reason: 'Duplicate exit' }, 1n),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
