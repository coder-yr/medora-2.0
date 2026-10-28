import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
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

  it('should allow access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext({ group: 'Nurse' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow user possessing the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Doctor']);

    const context = createMockContext({ group: 'Doctor' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException if user has a different role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Admin']);

    const context = createMockContext({ group: 'Receptionist' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
