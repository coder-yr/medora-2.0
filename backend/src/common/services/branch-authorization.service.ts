import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { AuthUser } from '../types/auth-user.interface';
import { HospitalPermission } from '../constants/permissions.enum';

@Injectable()
export class BranchAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  isGlobalAdmin(user: AuthUser): boolean {
    if (!user) return false;
    // Strict invariant: Global platform administration requires server-verified isSuperAdmin = true
    return Boolean(
      user.isSuperAdmin === true &&
        (user.group === 'SuperAdmin' ||
          (Array.isArray(user.permissions) && user.permissions.includes('*'))),
    );
  }

  async resolveAccessibleBranchIds(user: AuthUser): Promise<bigint[] | null> {
    if (this.isGlobalAdmin(user)) {
      return null; // Null indicates unrestricted platform-wide access
    }

    const userId = BigInt(user.id);
    const userOrgId = user.organizationId ? BigInt(user.organizationId) : null;

    const memberships = await this.prisma.userBranchMembership.findMany({
      where: {
        userId,
        isActive: true,
        branch: {
          active: true,
          deletedAt: null,
          ...(userOrgId ? { organizationId: userOrgId } : {}),
        },
      },
      select: { branchId: true },
    });

    const branchIds = (memberships || []).map((m) => m.branchId);

    // If user has a home branchId, ensure it belongs to user's organization, not revoked, and active
    if (user.branchId) {
      const homeId = BigInt(user.branchId);
      if (!branchIds.some((id) => id === homeId)) {
        const [homeBranch, revoked] = await Promise.all([
          this.prisma.hospitalBranch.findFirst({
            where: {
              id: homeId,
              active: true,
              deletedAt: null,
              ...(userOrgId ? { organizationId: userOrgId } : {}),
            },
            select: { id: true },
          }),
          this.prisma.userBranchMembership.findFirst({
            where: { userId, branchId: homeId, isActive: false },
            select: { id: true },
          }),
        ]);

        if (homeBranch && !revoked) {
          branchIds.push(homeId);
        }
      }
    }

    return branchIds;
  }

  async assertBranchAccess(
    user: AuthUser,
    targetBranchId: bigint | number | string,
  ): Promise<bigint> {
    let branchIdBigInt: bigint;
    try {
      branchIdBigInt = BigInt(String(targetBranchId).trim());
    } catch {
      throw new BadRequestException(`Invalid branch ID format: "${targetBranchId}"`);
    }

    if (this.isGlobalAdmin(user)) {
      const branch = await this.prisma.hospitalBranch.findFirst({
        where: { id: branchIdBigInt, deletedAt: null },
        select: { id: true, active: true, name: true },
      });
      if (!branch) {
        throw new NotFoundException(`Hospital branch #${branchIdBigInt} not found`);
      }
      if (!branch.active) {
        throw new ForbiddenException(`Hospital branch "${branch.name}" is inactive`);
      }
      return branchIdBigInt;
    }

    // Tenant boundary enforcement
    const branch = await this.prisma.hospitalBranch.findFirst({
      where: { id: branchIdBigInt, deletedAt: null },
      select: { id: true, active: true, name: true, organizationId: true },
    });
    if (!branch) {
      throw new NotFoundException(`Hospital branch #${branchIdBigInt} not found`);
    }

    if (
      user.organizationId &&
      branch.organizationId &&
      branch.organizationId !== BigInt(user.organizationId)
    ) {
      throw new ForbiddenException(
        `Cross-organization access denied. Branch #${branchIdBigInt} belongs to a different organization.`,
      );
    }

    const accessible = await this.resolveAccessibleBranchIds(user);
    if (!accessible || !accessible.some((id) => id === branchIdBigInt)) {
      throw new ForbiddenException(
        `Cross-branch access denied. You are not assigned to branch #${branchIdBigInt}.`,
      );
    }

    return branchIdBigInt;
  }

  async assertResourceAccess(
    user: AuthUser,
    resourceBranchId: bigint | number | string | null | undefined,
    resourceLabel = 'Resource',
  ): Promise<void> {
    if (this.isGlobalAdmin(user)) {
      return;
    }

    if (!resourceBranchId) {
      // Legacy branchless records belong exclusively to Organization #1 (primary host)
      if (user.organizationId && BigInt(user.organizationId) !== 1n) {
        throw new ForbiddenException(
          `Cross-tenant access denied: Unscoped legacy records are not accessible by secondary organizations.`,
        );
      }
      return;
    }

    const branchId = BigInt(resourceBranchId);

    // Verify branch belongs to user's organization
    if (user.organizationId) {
      const branch = await this.prisma.hospitalBranch.findUnique({
        where: { id: branchId },
        select: { organizationId: true },
      });
      if (branch?.organizationId && branch.organizationId !== BigInt(user.organizationId)) {
        throw new ForbiddenException(
          `Cross-tenant access denied: ${resourceLabel} belongs to another organization.`,
        );
      }
    }

    const accessible = await this.resolveAccessibleBranchIds(user);
    if (!accessible || !accessible.some((id) => id === branchId)) {
      throw new ForbiddenException(
        `Access to ${resourceLabel} belonging to branch #${branchId} is denied.`,
      );
    }
  }
}
