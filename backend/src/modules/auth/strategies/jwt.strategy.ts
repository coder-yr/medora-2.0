import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DEFAULT_ROLE_PERMISSIONS } from '../../../common/constants/permissions.enum';
import { AuthUser, HospitalRole, JwtPayload } from '../../../common/types/auth-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
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

    const role = payload.group as HospitalRole;
    const roleDefaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || [];
    const mergedPermissions = Array.from(new Set([...(payload.permissions || []), ...roleDefaultPerms]));

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      group: payload.group,
      permissions: mergedPermissions,
      branchId: payload.branchId ? BigInt(payload.branchId) : null,
      staffId: payload.staffId ? BigInt(payload.staffId) : null,
      organizationId: payload.organizationId ? BigInt(payload.organizationId) : null,
    };
  }
}
