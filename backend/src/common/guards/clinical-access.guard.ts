import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PROTECT_CLINICAL_ACCESS_KEY } from '../decorators/clinical-access.decorator';
import { AuthUser } from '../types/auth-user.interface';
import { PrismaService } from '../../modules/prisma/prisma.service';

@Injectable()
export class ClinicalAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isProtected = this.reflector.getAllAndOverride<boolean>(
      PROTECT_CLINICAL_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isProtected === undefined || isProtected === false) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      params?: Record<string, string>;
      query?: Record<string, string>;
      headers?: Record<string, string>;
      url?: string;
    }>();

    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('User context is required.');
    }

    // Regular clinical staff access is evaluated by RolesGuard and PermissionsGuard
    if (!user.isSuperAdmin) {
      return true;
    }

    // Platform Super Admin Isolation Invariant:
    // Super Admins DO NOT have default read or write access to patient clinical records,
    // consultations, prescriptions, or inpatient folios.
    // Exceptional access requires an active, unexpired Emergency Support Grant and is fully audited.
    const rawTargetOrgId =
      request.params?.orgId ||
      request.params?.organizationId ||
      request.headers?.['x-organization-id'] ||
      user.organizationId;

    let targetOrgIdBigInt: bigint | null = null;
    if (rawTargetOrgId) {
      try {
        targetOrgIdBigInt = BigInt(rawTargetOrgId);
      } catch {
        targetOrgIdBigInt = null;
      }
    }

    const activeGrant = targetOrgIdBigInt
      ? await this.prisma.emergencySupportGrant.findFirst({
          where: {
            grantedToUserId: BigInt(user.id),
            organizationId: targetOrgIdBigInt,
            isRevoked: false,
            expiresAt: { gt: new Date() },
          },
        })
      : null;

    if (!activeGrant) {
      // Audit blocked access attempt
      try {
        await this.prisma.platformAuditLog.create({
          data: {
            actorUserId: BigInt(user.id),
            actorEmail: user.email,
            actorRole: user.group,
            action: 'CLINICAL_ACCESS_BLOCKED',
            targetType: 'Organization',
            targetId: rawTargetOrgId ? String(rawTargetOrgId) : 'UNKNOWN',
            details: {
              reason: 'No active Emergency Support Grant',
              endpoint: request.url || 'clinical-endpoint',
            },
          },
        });
      } catch {}

      throw new ForbiddenException(
        'Super Admin clinical record access restricted. Active emergency support grant required.',
      );
    }

    // Audit successful break-glass access
    try {
      await this.prisma.platformAuditLog.create({
        data: {
          actorUserId: BigInt(user.id),
          actorEmail: user.email,
          actorRole: user.group,
          action: 'CLINICAL_ACCESS_BREAK_GLASS',
          targetType: 'EmergencySupportGrant',
          targetId: activeGrant.id.toString(),
          details: {
            organizationId: targetOrgIdBigInt ? targetOrgIdBigInt.toString() : 'UNKNOWN',
            endpoint: request.url || 'clinical-endpoint',
          },
        },
      });
    } catch {}

    return true;
  }
}
