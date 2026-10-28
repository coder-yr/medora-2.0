import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HospitalPermission } from '../constants/permissions.enum';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard (RBAC & SEC-01 Remediation)', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  };

  it('should allow access when no permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext({ group: 'Doctor', permissions: [] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow staff with the required permission grant', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([HospitalPermission.PATIENT_VIEW]);

    const context = createMockContext({
      id: 'doc-1',
      group: 'Doctor',
      permissions: [HospitalPermission.PATIENT_VIEW, HospitalPermission.PRESCRIPTION_ADD],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException if user lacks the required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([HospitalPermission.PATIENT_DELETE]);

    const context = createMockContext({
      id: 'doc-1',
      group: 'Doctor',
      permissions: [HospitalPermission.PATIENT_VIEW],
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('SEC-01: should allow Admin users regardless of username (eliminating hardcoded ictkashif)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([HospitalPermission.PATIENT_DELETE]);

    // Admin user with a standard email/name, proving no dependency on 'ictkashif'
    const context = createMockContext({
      id: 'admin-99',
      group: 'Admin',
      email: 'chief.officer@medora.hospital',
      permissions: [],
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});
