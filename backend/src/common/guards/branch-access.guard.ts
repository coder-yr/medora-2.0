import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { AuthUser } from '../types/auth-user.interface';
import { HospitalPermission } from '../constants/permissions.enum';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_BRANCH_KEY } from '../decorators/skip-branch.decorator';
import { OPTIONAL_BRANCH_KEY } from '../decorators/optional-branch.decorator';

@Injectable()
export class BranchAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Bypass on public endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. Bypass on non-branch operational routes (e.g., self-profile, branch picker)
    const skipBranch = this.reflector.getAllAndOverride<boolean>(SKIP_BRANCH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipBranch) {
      return true;
    }

    const isOptional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_BRANCH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest();
    const user: AuthUser = req.user;

    if (!user) {
      throw new ForbiddenException('User context is missing');
    }

    // 3. Resolve candidate branch ID from Header, Query, Params, or Body
    const rawHeader = req.headers['x-branch-id'];
    const rawQuery = req.query?.branchId;
    const rawParam = req.params?.branchId;
    const rawBody = req.body?.branchId;
    const candidateRaw = rawHeader || rawQuery || rawParam || rawBody;

    let branchIdBigInt: bigint | null = null;

    if (candidateRaw) {
      try {
        branchIdBigInt = BigInt(String(candidateRaw).trim());
      } catch {
        throw new BadRequestException(`Invalid branch ID format: "${candidateRaw}"`);
      }
    } else if (user.branchId) {
      branchIdBigInt = BigInt(user.branchId);
    }

    const isAdmin =
      user.group === 'Admin' ||
      (Array.isArray(user.permissions) &&
        user.permissions.includes(HospitalPermission.BRANCH_VIEW_ALL));

    // If no branch is specified:
    if (branchIdBigInt === null) {
      if (isAdmin || isOptional) {
        req.activeBranchId = null;
        return true;
      }
      throw new ForbiddenException(
        'No operational branch context specified or assigned to user',
      );
    }

    // 4. Fetch branch from database
    const branch = await this.prisma.hospitalBranch.findFirst({
      where: {
        id: branchIdBigInt,
        deletedAt: null,
      },
    });

    if (!branch) {
      throw new NotFoundException(`Hospital branch #${branchIdBigInt} not found`);
    }

    // 5. Check active state
    if (!branch.active) {
      throw new ForbiddenException(`Hospital branch "${branch.name}" is inactive`);
    }

    // 6. Verify user access rights
    if (isAdmin) {
      req.activeBranchId = branchIdBigInt;
      req.activeBranch = branch;
      return true;
    }

    // Check user branch memberships
    const membership = await this.prisma.userBranchMembership.findFirst({
      where: {
        userId: BigInt(user.id),
        branchId: branchIdBigInt,
      },
    });

    // Explicitly revoked membership blocks access
    if (membership && !membership.isActive) {
      throw new ForbiddenException(
        `Cross-branch access denied. Membership for branch "${branch.name}" has been revoked.`,
      );
    }

    const hasActiveMembership = membership?.isActive === true;
    const isHomeBranch =
      user.branchId && BigInt(user.branchId) === branchIdBigInt;

    if (!hasActiveMembership && !isHomeBranch) {
      throw new ForbiddenException(
        `Cross-branch access denied. You are not assigned to branch "${branch.name}" (#${branchIdBigInt}).`,
      );
    }

    req.activeBranchId = branchIdBigInt;
    req.activeBranch = branch;
    return true;
  }
}
