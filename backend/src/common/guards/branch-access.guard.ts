import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { AuthUser } from '../types/auth-user.interface';
import { HospitalPermission } from '../constants/permissions.enum';

@Injectable()
export class BranchAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user: AuthUser = req.user;

    if (!user) {
      throw new ForbiddenException('User context is missing');
    }

    // 1. Resolve candidate branch ID from Header, Query, Params, or User profile
    const rawHeader = req.headers['x-branch-id'];
    const rawQuery = req.query?.branchId;
    const rawParam = req.params?.branchId;
    const candidateRaw = rawHeader || rawQuery || rawParam;

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
      user.permissions?.includes(HospitalPermission.BRANCH_VIEW_ALL);

    // If no branch is specified and user is Admin, allow through without scoped branch
    if (branchIdBigInt === null) {
      if (isAdmin) {
        req.activeBranchId = null;
        return true;
      }
      throw new ForbiddenException(
        'No operational branch context specified or assigned to user',
      );
    }

    // 2. Fetch branch from database
    const branch = await this.prisma.hospitalBranch.findFirst({
      where: {
        id: branchIdBigInt,
        deletedAt: null,
      },
    });

    if (!branch) {
      throw new NotFoundException(`Hospital branch #${branchIdBigInt} not found`);
    }

    // 3. Check active state
    if (!branch.active) {
      // Inactive branches reject operational access
      throw new ForbiddenException(`Hospital branch "${branch.name}" is inactive`);
    }

    // 4. Verify user access rights
    if (isAdmin) {
      req.activeBranchId = branchIdBigInt;
      req.activeBranch = branch;
      return true;
    }

    // Check user branch memberships
    const hasMembership = await this.prisma.userBranchMembership.findFirst({
      where: {
        userId: BigInt(user.id),
        branchId: branchIdBigInt,
        isActive: true,
      },
    });

    const isHomeBranch =
      user.branchId && BigInt(user.branchId) === branchIdBigInt;

    if (!hasMembership && !isHomeBranch) {
      throw new ForbiddenException(
        `Cross-branch access denied. You are not assigned to branch "${branch.name}" (#${branchIdBigInt}).`,
      );
    }

    req.activeBranchId = branchIdBigInt;
    req.activeBranch = branch;
    return true;
  }
}
