import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_SUPER_ADMIN_KEY } from '../decorators/require-super-admin.decorator';
import { AuthUser } from '../types/auth-user.interface';

@Injectable()
export class PlatformSuperAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isRequired = this.reflector.getAllAndOverride<boolean>(REQUIRE_SUPER_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If route doesn't explicitly require super admin, pass through
    if (isRequired === undefined || isRequired === false) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User authentication context is required.');
    }

    // Invariant: Super Admin requires BOTH isSuperAdmin === true and group === 'SuperAdmin'
    // Frontend-supplied headers or roles can never bypass this guard.
    if (!user.isSuperAdmin || user.group !== 'SuperAdmin') {
      throw new ForbiddenException(
        'Access Denied: Exclusive Platform Super Administrator authority required.',
      );
    }

    return true;
  }
}
