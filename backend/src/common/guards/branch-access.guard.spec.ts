import { ExecutionContext, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { BranchAccessGuard } from './branch-access.guard';
import { HospitalPermission } from '../constants/permissions.enum';

describe('BranchAccessGuard', () => {
  let guard: BranchAccessGuard;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      hospitalBranch: {
        findFirst: jest.fn(),
      },
      userBranchMembership: {
        findFirst: jest.fn(),
      },
    };
    guard = new BranchAccessGuard(mockPrisma);
  });

  const createMockContext = (request: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  };

  it('should throw ForbiddenException if user context is missing', async () => {
    const ctx = createMockContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw BadRequestException if branch ID has an invalid format', async () => {
    const ctx = createMockContext({
      user: { id: '1', group: 'Doctor' },
      headers: { 'x-branch-id': 'invalid-number' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
  });

  it('should allow Admin through with null activeBranchId if no branch is specified', async () => {
    const req: any = {
      user: { id: '1', group: 'Admin' },
      headers: {},
    };
    const ctx = createMockContext(req);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req.activeBranchId).toBeNull();
  });

  it('should throw ForbiddenException for non-admin if no branch is specified or assigned', async () => {
    const ctx = createMockContext({
      user: { id: '2', group: 'Doctor' },
      headers: {},
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw NotFoundException if specified branch does not exist', async () => {
    mockPrisma.hospitalBranch.findFirst.mockResolvedValue(null);

    const ctx = createMockContext({
      user: { id: '1', group: 'Admin' },
      headers: { 'x-branch-id': '999' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if branch is inactive', async () => {
    mockPrisma.hospitalBranch.findFirst.mockResolvedValue({
      id: BigInt(2),
      name: 'Old Branch',
      active: false,
    });

    const ctx = createMockContext({
      user: { id: '1', group: 'Admin' },
      headers: { 'x-branch-id': '2' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should allow Admin to access any active branch', async () => {
    const mockBranch = { id: BigInt(1), name: 'Main Campus', active: true };
    mockPrisma.hospitalBranch.findFirst.mockResolvedValue(mockBranch);

    const req: any = {
      user: { id: '1', group: 'Admin' },
      headers: { 'x-branch-id': '1' },
    };
    const ctx = createMockContext(req);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req.activeBranchId).toBe(BigInt(1));
    expect(req.activeBranch).toEqual(mockBranch);
  });

  it('should allow user with active UserBranchMembership', async () => {
    const mockBranch = { id: BigInt(2), name: 'City Clinic', active: true };
    mockPrisma.hospitalBranch.findFirst.mockResolvedValue(mockBranch);
    mockPrisma.userBranchMembership.findFirst.mockResolvedValue({
      id: BigInt(10),
      userId: BigInt(5),
      branchId: BigInt(2),
      isActive: true,
    });

    const req: any = {
      user: { id: '5', group: 'Doctor', branchId: BigInt(1) },
      headers: { 'x-branch-id': '2' },
    };
    const ctx = createMockContext(req);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req.activeBranchId).toBe(BigInt(2));
  });

  it('should deny cross-branch access if user is not assigned to target branch', async () => {
    const mockBranch = { id: BigInt(3), name: 'North Branch', active: true };
    mockPrisma.hospitalBranch.findFirst.mockResolvedValue(mockBranch);
    mockPrisma.userBranchMembership.findFirst.mockResolvedValue(null);

    const req: any = {
      user: { id: '5', group: 'Doctor', branchId: BigInt(1) },
      headers: { 'x-branch-id': '3' },
    };
    const ctx = createMockContext(req);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should allow user with BRANCH_VIEW_ALL permission', async () => {
    const mockBranch = { id: BigInt(3), name: 'North Branch', active: true };
    mockPrisma.hospitalBranch.findFirst.mockResolvedValue(mockBranch);

    const req: any = {
      user: {
        id: '6',
        group: 'Doctor',
        permissions: [HospitalPermission.BRANCH_VIEW_ALL],
      },
      headers: { 'x-branch-id': '3' },
    };
    const ctx = createMockContext(req);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req.activeBranchId).toBe(BigInt(3));
  });
});
