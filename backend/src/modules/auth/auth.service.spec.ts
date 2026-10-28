import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: any;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeEach(() => {
    mockPrisma = {
      connected: false,
    };
    jwtService = new JwtService({ secret: 'test-secret-min-16-characters-long' });
    configService = new ConfigService();
    service = new AuthService(mockPrisma, jwtService, configService);
  });

  it('should authenticate a valid test staff account in development/test mode', async () => {
    const result = await service.login({
      email: 'doctor.test@medora.hospital',
      password: 'StrongPassword123!',
    });

    expect(result).toBeDefined();
    expect(result.tokenType).toBe('Bearer');
    expect(result.accessToken).toBeDefined();
    expect(result.user.email).toBe('doctor.test@medora.hospital');
    expect(result.user.group).toBe('Doctor');
    expect(result.user.permissions).toContain('patient_view');
  });

  it('should reject invalid credentials with UnauthorizedException', async () => {
    await expect(
      service.login({
        email: 'unknown@external.com',
        password: 'password',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('SEC-01: should NOT grant access to an unauthenticated user claiming ictkashif', async () => {
    await expect(
      service.login({
        email: 'ictkashif@external.com',
        password: 'wrongpassword',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
