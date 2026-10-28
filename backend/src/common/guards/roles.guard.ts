import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser, HospitalRole } from '../types/auth-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<HospitalRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();

    if (!user) {
      throw new ForbiddenException('User context missing');
    }

    // Role check
    const hasRole = requiredRoles.includes(user.group);
    if (!hasRole) {
      throw new ForbiddenException(
        `Role "${user.group}" is not authorized for this resource. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
