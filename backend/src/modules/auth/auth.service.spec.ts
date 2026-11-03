import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';

describe('AuthService (Security Remediation & Parity)', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let configService: ConfigService;

  let usersStore: any[] = [];
  let sessionsStore: any[] = [];

  const mockPrisma: any = {
    user: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.email) {
          const target = typeof where.email === 'string' ? where.email : where.email?.equals;
          return usersStore.find((u) => u.email.toLowerCase() === (target || '').toLowerCase()) || null;
        }
        if (where?.OR) {
          for (const clause of where.OR) {
            const target = typeof clause.email === 'string' ? clause.email : clause.email?.equals;
            if (target) {
              const found = usersStore.find((u) => u.email.toLowerCase() === target.toLowerCase());
              if (found) return found;
            }
          }
        }
        return null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = usersStore.findIndex((u) => u.id === where.id);
        if (idx !== -1) {
          usersStore[idx] = { ...usersStore[idx], ...data };
          return usersStore[idx];
        }
        return null;
      }),
    },
    userSession: {
      create: jest.fn(async ({ data }: any) => {
        const id = BigInt(sessionsStore.length + 1);
        const session = {
          id,
          uuid: crypto.randomUUID(),
          userId: data.userId,
          refreshTokenHash: data.refreshTokenHash,
          familyId: data.familyId,
          isRevoked: false,
          expiresAt: data.expiresAt,
          userAgent: data.userAgent || null,
          ipAddress: data.ipAddress || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        sessionsStore.push(session);
        return session;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const session = sessionsStore.find((s) => s.refreshTokenHash === where.refreshTokenHash);
        if (!session) return null;
        const user = usersStore.find((u) => u.id === session.userId);
        return {
          ...session,
          user,
        };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = sessionsStore.findIndex((s) => s.id === where.id);
        if (idx !== -1) {
          sessionsStore[idx] = { ...sessionsStore[idx], ...data };
          return sessionsStore[idx];
        }
        return null;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (let i = 0; i < sessionsStore.length; i++) {
          if (
            (where.familyId && sessionsStore[i].familyId === where.familyId) ||
            (where.refreshTokenHash && sessionsStore[i].refreshTokenHash === where.refreshTokenHash)
          ) {
            sessionsStore[i] = { ...sessionsStore[i], ...data };
            count++;
          }
        }
        return { count };
      }),
    },
    $transaction: jest.fn(async (cb: any) => {
      return cb(mockPrisma);
    }),
  };

  beforeEach(async () => {
    jwtService = new JwtService({ secret: 'test-secret-at-least-32-characters-long-key' });
    configService = new ConfigService();
    service = new AuthService(mockPrisma, jwtService, configService);

    // Initial test users
    const argonHash = await argon2.hash('ValidPassword123!', { type: argon2.argon2id });
    // Legacy $2y$12 hash for password '123456'
    const legacyBcryptHash = '$2y$12$.22NRrjN3xK0uqY58YrMdOy98ya62uF6FtyslgbzLGhhDa6JbOj/2';

    usersStore = [
      {
        id: BigInt(1),
        email: 'doctor.test@medora.hospital',
        password: argonHash,
        firstName: 'Doctor',
        lastName: 'Test',
        group: 'Doctor',
        branchId: BigInt(1),
      },
      {
        id: BigInt(2),
        email: 'admin@example.com',
        password: legacyBcryptHash,
        firstName: 'System',
        lastName: 'Admin',
        group: 'Admin',
        branchId: null,
      },
    ];

    sessionsStore = [];
    jest.clearAllMocks();
  });

  describe('Password Verification & Anti-Enumeration', () => {
    it('authenticates valid credentials with Argon2id hash', async () => {
      const result = await service.login({
        email: 'doctor.test@medora.hospital',
        password: 'ValidPassword123!',
      });

      expect(result).toBeDefined();
      expect(result.tokenType).toBe('Bearer');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(900); // 15 mins
      expect(result.user.email).toBe('doctor.test@medora.hospital');
      expect(result.user.group).toBe('Doctor');
      expect(result.user.permissions).toContain('patient_view');

      // Verified session was created
      expect(sessionsStore).toHaveLength(1);
      expect(sessionsStore[0].isRevoked).toBe(false);
    });

    it('rejects wrong password with uniform 401 "Invalid email or password"', async () => {
      await expect(
        service.login({
          email: 'doctor.test@medora.hospital',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));

      // Ensure mockPrisma.user.update was NEVER called (never upgrade hash on failed login)
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects non-existent user with identical uniform 401 error message to prevent email enumeration', async () => {
      await expect(
        service.login({
          email: 'nonexistent@medora.hospital',
          password: 'ValidPassword123!',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('rejects arbitrary @medora.hospital accounts without database records (zero dev backdoor)', async () => {
      await expect(
        service.login({
          email: 'random.nurse@medora.hospital',
          password: 'StrongPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Legacy Bcrypt ($2y$) Transparent Upgrade', () => {
    it('authenticates legacy $2y$ password and transparently upgrades hash to Argon2id in database', async () => {
      const initialHash = usersStore[1].password;
      expect(initialHash.startsWith('$2y$')).toBe(true);

      const result = await service.login({
        email: 'admin@example.com',
        password: '123456',
      });

      expect(result).toBeDefined();
      expect(result.user.email).toBe('admin@example.com');
      expect(result.user.group).toBe('Admin');

      // Verify that user hash was upgraded to Argon2id ($argon2id$)
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
      const updatedUser = usersStore.find((u) => u.email === 'admin@example.com');
      expect(updatedUser.password.startsWith('$argon2id$')).toBe(true);

      // Verify that the newly upgraded hash can authenticate directly
      const nextLogin = await service.login({
        email: 'admin@example.com',
        password: '123456',
      });
      expect(nextLogin).toBeDefined();
    });

    it('does NOT upgrade legacy hash if wrong password is provided', async () => {
      const initialHash = usersStore[1].password;

      await expect(
        service.login({
          email: 'admin@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(usersStore[1].password).toBe(initialHash);
    });
  });

  describe('Refresh Token Rotation & Session Family Revocation', () => {
    it('rotates refresh token, invalidating prior token and returning new active token', async () => {
      // 1. Initial login
      const loginRes = await service.login({
        email: 'doctor.test@medora.hospital',
        password: 'ValidPassword123!',
      });
      const firstRefreshToken = loginRes.refreshToken!;

      // 2. Perform refresh
      const refreshRes = await service.refresh({ refreshToken: firstRefreshToken });
      expect(refreshRes).toBeDefined();
      expect(refreshRes.accessToken).toBeDefined();
      expect(refreshRes.refreshToken).toBeDefined();
      expect(refreshRes.refreshToken).not.toBe(firstRefreshToken);

      // 3. Verify session table status
      expect(sessionsStore).toHaveLength(2);
      expect(sessionsStore[0].isRevoked).toBe(true); // old session revoked
      expect(sessionsStore[1].isRevoked).toBe(false); // new session active
      expect(sessionsStore[0].familyId).toBe(sessionsStore[1].familyId); // same family
    });

    it('detects token reuse and revokes entire session family when revoked token is re-submitted', async () => {
      // 1. Login
      const loginRes = await service.login({
        email: 'doctor.test@medora.hospital',
        password: 'ValidPassword123!',
      });
      const originalToken = loginRes.refreshToken!;

      // 2. Legitimate refresh (originalToken is now invalidated)
      const refreshRes = await service.refresh({ refreshToken: originalToken });
      const currentToken = refreshRes.refreshToken!;

      // 3. Attacker tries to use the consumed originalToken
      await expect(
        service.refresh({ refreshToken: originalToken }),
      ).rejects.toThrow(
        new UnauthorizedException('Session compromised or token already rotated. Please log in again.'),
      );

      // 4. Verify that entire session family (including currentToken) is now REVOKED
      const allSessionsInFamily = sessionsStore.filter(
        (s) => s.familyId === sessionsStore[0].familyId,
      );
      expect(allSessionsInFamily.every((s) => s.isRevoked)).toBe(true);

      // 5. Subsequent attempts with currentToken are now also rejected
      await expect(
        service.refresh({ refreshToken: currentToken }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects expired refresh token', async () => {
      const loginRes = await service.login({
        email: 'doctor.test@medora.hospital',
        password: 'ValidPassword123!',
      });
      const token = loginRes.refreshToken!;

      // Manually backdate expiration in store
      sessionsStore[0].expiresAt = new Date(Date.now() - 1000);

      await expect(
        service.refresh({ refreshToken: token }),
      ).rejects.toThrow(new UnauthorizedException('Refresh token has expired'));
    });

    it('logs out and revokes refresh token session', async () => {
      const loginRes = await service.login({
        email: 'doctor.test@medora.hospital',
        password: 'ValidPassword123!',
      });
      const token = loginRes.refreshToken!;

      const logoutRes = await service.logout({ refreshToken: token });
      expect(logoutRes.message).toBe('Logged out successfully');

      // Verify token is revoked
      expect(sessionsStore[0].isRevoked).toBe(true);

      // Attempting to refresh after logout should fail
      await expect(
        service.refresh({ refreshToken: token }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
