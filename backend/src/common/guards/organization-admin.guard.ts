import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_ORG_ADMIN_KEY } from '../decorators/require-org-admin.decorator';
import { AuthUser } from '../types/auth-user.interface';
import { PrismaService } from '../../modules/prisma/prisma.service';

@Injectable()
export class OrganizationAdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isRequired = this.reflector.getAllAndOverride<boolean>(REQUIRE_ORG_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isRequired === undefined || isRequired === false) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      params?: Record<string, string>;
      body?: Record<string, any>;
      query?: Record<string, string>;
    }>();

    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('User authentication context is required.');
    }

    // 1. Platform Super Admin has oversight access across organizations
    if (user.isSuperAdmin && user.group === 'SuperAdmin') {
      return true;
    }

    // 2. Extract target organization ID from route params, query, or body
    const rawTargetOrgId =
      request.params?.orgId ||
      request.params?.organizationId ||
      request.params?.id ||
      request.query?.organizationId ||
      request.body?.organizationId;

    if (!rawTargetOrgId) {
      // If no specific org ID in path/query/body, scope to user's assigned organization
      if (!user.organizationId) {
        throw new ForbiddenException('User is not assigned to any organization.');
      }
      return this.verifyAdminRole(user);
    }

    const targetOrgId = BigInt(rawTargetOrgId);

    // 3. User's primary organizationId check (BOLA prevention)
    if (user.organizationId && user.organizationId === targetOrgId) {
      return this.verifyAdminRole(user);
    }

    // 4. Multi-organization membership verification via database
    const membership = await this.prisma.userOrganizationMembership.findFirst({
      where: {
        userId: BigInt(user.id),
        organizationId: targetOrgId,
        isActive: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        `Cross-Organization Access Denied: You do not have an active membership in Organization #${targetOrgId}.`,
      );
    }

    const allowedRoles = ['Admin', 'OrganizationAdmin', 'ClinicAdmin', 'SuperAdmin'];
    if (!membership.accessRole || !allowedRoles.includes(membership.accessRole)) {
      throw new ForbiddenException(
        `Insufficient Organization Privileges: Role "${membership.accessRole || 'None'}" cannot perform administrative operations.`,
      );
    }

    return true;
  }

  private verifyAdminRole(user: AuthUser): boolean {
    const allowedGroups = ['Admin', 'OrganizationAdmin', 'ClinicAdmin', 'SuperAdmin'];
    if (allowedGroups.includes(user.group)) {
      return true;
    }
    throw new ForbiddenException(
      `Access Denied: Group "${user.group}" is not authorized as Organization Administrator.`,
    );
  }
}
