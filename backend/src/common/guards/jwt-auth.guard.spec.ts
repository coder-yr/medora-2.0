import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  const createMockContext = (): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as any;
  };

  it('should allow access immediately if route is marked @Public()', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });
});
