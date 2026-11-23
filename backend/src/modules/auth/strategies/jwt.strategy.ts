import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DEFAULT_ROLE_PERMISSIONS } from '../../../common/constants/permissions.enum';
import { AuthUser, HospitalRole, JwtPayload } from '../../../common/types/auth-user.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('auth.jwtSecret') || 'local-dev-secret';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload.sub || !payload.group) {
      throw new UnauthorizedException('Malformed token claims: missing sub or group');
    }

    // Server-authoritative DB revalidation: Neutralizes stale JWT claims and revoked privileges
    let userIdBigInt: bigint;
    try {
      userIdBigInt = BigInt(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid user ID in token claims');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: userIdBigInt },
      include: {
        organization: true,
        organizationMemberships: {
          where: { isActive: true },
          include: { organization: true },
        },
      },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User account no longer exists or has been deactivated');
    }

    // Check organization suspension status (Super Admin bypasses org suspension for platform recovery)
    const isSuperAdmin = Boolean(dbUser.isSuperAdmin);
    if (!isSuperAdmin && dbUser.organization && dbUser.organization.status === 'SUSPENDED') {
      throw new UnauthorizedException(
        'Organization access is currently suspended. Please contact platform administration.',
      );
    }

    // Check membership revocation: Non-superadmin organization staff must have active membership
    if (!isSuperAdmin && dbUser.organizationId && dbUser.organizationMemberships.length === 0) {
      throw new UnauthorizedException(
        'User organization membership has been revoked or deactivated.',
      );
    }

    // Derive authoritative active organization context
    const activeMembership = dbUser.organizationMemberships.find(
      (m) => String(m.organizationId) === String(dbUser.organizationId),
    ) || dbUser.organizationMemberships[0];

    const orgRole = activeMembership?.accessRole || (isSuperAdmin ? 'SuperAdmin' : null);
    const orgEdition = activeMembership?.organization?.edition || dbUser.organization?.edition || null;
    const orgStatus = activeMembership?.organization?.status || dbUser.organization?.status || null;

    const role = (dbUser.group as HospitalRole) || (payload.group as HospitalRole);
    const roleDefaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || [];
    const mergedPermissions = Array.from(new Set([...(payload.permissions || []), ...roleDefaultPerms]));

    return {
      id: dbUser.id.toString(),
      email: dbUser.email,
      name: `${dbUser.firstName} ${dbUser.lastName}`.trim() || dbUser.email,
      group: role,
      permissions: mergedPermissions,
      branchId: dbUser.branchId ? BigInt(dbUser.branchId) : null,
      staffId: payload.staffId ? BigInt(payload.staffId) : null,
      organizationId: dbUser.organizationId ? BigInt(dbUser.organizationId) : null,
      organizationRole: orgRole,
      organizationEdition: orgEdition,
      organizationStatus: orgStatus,
      isSuperAdmin,
    };
  }
}
