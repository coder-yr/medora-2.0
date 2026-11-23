import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_ENTITLEMENT_KEY } from '../decorators/entitlement.decorator';
import { AuthUser } from '../types/auth-user.interface';
import { PrismaService } from '../../modules/prisma/prisma.service';

const DEFAULT_MODULES_BY_EDITION: Record<string, string[]> = {
  CLINIC: ['patients', 'appointments', 'consultations', 'prescriptions', 'billing'],
  PROFESSIONAL: ['patients', 'appointments', 'consultations', 'prescriptions', 'pharmacy', 'billing'],
  HOSPITAL: [
    'patients',
    'appointments',
    'consultations',
    'prescriptions',
    'inpatient',
    'laboratory',
    'radiology',
    'pharmacy',
    'billing',
    'staff',
    'departments',
  ],
  ENTERPRISE: [
    'patients',
    'appointments',
    'consultations',
    'prescriptions',
    'inpatient',
    'laboratory',
    'radiology',
    'pharmacy',
    'billing',
    'staff',
    'departments',
    'accounting',
    'telemedicine',
    'multi_branch',
  ],
};

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(
      REQUIRE_ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredModule) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User authentication context is required.');
    }

    // Platform Super Admin bypass for system maintenance
    if (user.isSuperAdmin && user.group === 'SuperAdmin') {
      return true;
    }

    if (!user.organizationId) {
      return true; // Single-tenant standalone default
    }

    const orgId = BigInt(user.organizationId);

    const [orgSettings, org] = await Promise.all([
      this.prisma.organizationSettings.findUnique({
        where: { organizationId: orgId },
      }),
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { edition: true },
      }),
    ]);

    let enabledModules: string[] = [];
    if (orgSettings?.enabledModules && Array.isArray(orgSettings.enabledModules)) {
      enabledModules = orgSettings.enabledModules as string[];
    } else if (org?.edition && DEFAULT_MODULES_BY_EDITION[org.edition]) {
      enabledModules = DEFAULT_MODULES_BY_EDITION[org.edition];
    } else {
      enabledModules = DEFAULT_MODULES_BY_EDITION.HOSPITAL;
    }

    if (!enabledModules.includes(requiredModule)) {
      throw new ForbiddenException(
        `Feature Entitlement Restricted: Module "${requiredModule}" is not enabled for your organization's subscription edition.`,
      );
    }

    return true;
  }
}
