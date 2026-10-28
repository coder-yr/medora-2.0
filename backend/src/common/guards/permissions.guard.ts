import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthUser } from '../types/auth-user.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();

    if (!user) {
      throw new ForbiddenException('User context is missing');
    }

    // Role-based administrative access:
    // Legitimate System Administrators hold full clinical & system authority.
    // SEC-01 remediation: Zero hardcoded username checks (e.g. 'ictkashif' eliminated).
    if (user.group === 'Admin') {
      return true;
    }

    const userPermissions = new Set(user.permissions || []);
    const missingPermissions = requiredPermissions.filter(
      (permission) => !userPermissions.has(permission),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Insufficient permissions. Missing required grant(s): ${missingPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
