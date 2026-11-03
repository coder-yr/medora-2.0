import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { BranchAuthorizationService } from './branch-authorization.service';
import { HospitalPermission } from '../constants/permissions.enum';
import { AuthUser } from '../types/auth-user.interface';

describe('BranchAuthorizationService', () => {
  let service: BranchAuthorizationService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      hospitalBranch: {
        findFirst: jest.fn(),
      },
      userBranchMembership: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    service = new BranchAuthorizationService(mockPrisma);
  });

  const adminUser: AuthUser = {
    id: '1',
    email: 'admin@hospital.com',
    name: 'Admin User',
    group: 'Admin',
    permissions: [],
    branchId: null,
  };

  const doctorUser: AuthUser = {
    id: '2',
    email: 'doctor@hospital.com',
    name: 'Doctor User',
    group: 'Doctor',
    permissions: [],
    branchId: BigInt(1),
  };

  it('identifies global admin correctly', () => {
    expect(service.isGlobalAdmin(adminUser)).toBe(true);
    expect(service.isGlobalAdmin(doctorUser)).toBe(false);

    const userWithPerm: AuthUser = {
      ...doctorUser,
      permissions: [HospitalPermission.BRANCH_VIEW_ALL],
    };
    expect(service.isGlobalAdmin(userWithPerm)).toBe(true);
  });

  it('returns null accessible branches for global admin', async () => {
    const result = await service.resolveAccessibleBranchIds(adminUser);
    expect(result).toBeNull();
  });

  it('resolves accessible branches including home branch and memberships', async () => {
    mockPrisma.userBranchMembership.findMany.mockResolvedValue([
      { branchId: BigInt(2) },
    ]);
    mockPrisma.hospitalBranch.findFirst.mockResolvedValue({ id: BigInt(1), active: true });
    mockPrisma.userBranchMembership.findFirst.mockResolvedValue(null);

    const result = await service.resolveAccessibleBranchIds(doctorUser);
    expect(result).toEqual([BigInt(2), BigInt(1)]);
  });

  it('excludes home branch if explicitly revoked in memberships', async () => {
    mockPrisma.userBranchMembership.findMany.mockResolvedValue([]);
    mockPrisma.hospitalBranch.findFirst.mockResolvedValue({ id: BigInt(1), active: true });
    mockPrisma.userBranchMembership.findFirst.mockResolvedValue({ id: BigInt(99), isActive: false });

    const result = await service.resolveAccessibleBranchIds(doctorUser);
    expect(result).toEqual([]);
  });

  it('assertBranchAccess allows global admin to active branch', async () => {
    mockPrisma.hospitalBranch.findFirst.mockResolvedValue({
      id: BigInt(3),
      name: 'North Clinic',
      active: true,
    });

    const branchId = await service.assertBranchAccess(adminUser, '3');
    expect(branchId).toBe(BigInt(3));
  });

  it('assertBranchAccess rejects inactive branch for global admin', async () => {
    mockPrisma.hospitalBranch.findFirst.mockResolvedValue({
      id: BigInt(3),
      name: 'North Clinic',
      active: false,
    });

    await expect(service.assertBranchAccess(adminUser, '3')).rejects.toThrow(ForbiddenException);
  });

  it('assertBranchAccess denies access if non-admin is not assigned', async () => {
    mockPrisma.userBranchMembership.findMany.mockResolvedValue([]);
    mockPrisma.hospitalBranch.findFirst.mockResolvedValue({ id: BigInt(1), active: true });
    mockPrisma.userBranchMembership.findFirst.mockResolvedValue(null);

    await expect(service.assertBranchAccess(doctorUser, '5')).rejects.toThrow(ForbiddenException);
  });

  it('assertBranchAccess throws BadRequestException on invalid format', async () => {
    await expect(service.assertBranchAccess(doctorUser, 'abc')).rejects.toThrow(BadRequestException);
  });

  it('assertResourceAccess allows global admin or matching branch', async () => {
    await expect(service.assertResourceAccess(adminUser, BigInt(99))).resolves.not.toThrow();

    mockPrisma.userBranchMembership.findMany.mockResolvedValue([{ branchId: BigInt(1) }]);
    await expect(service.assertResourceAccess(doctorUser, BigInt(1))).resolves.not.toThrow();
  });

  it('assertResourceAccess denies access to cross-branch resource', async () => {
    mockPrisma.userBranchMembership.findMany.mockResolvedValue([{ branchId: BigInt(1) }]);
    await expect(service.assertResourceAccess(doctorUser, BigInt(2))).rejects.toThrow(ForbiddenException);
  });
});
