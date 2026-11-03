import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { DEFAULT_ROLE_PERMISSIONS } from '../../common/constants/permissions.enum';
import { AuthUser, HospitalRole, JwtPayload } from '../../common/types/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { AccountLockoutService } from './account-lockout.service';
import { PasswordResetService } from './password-reset.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly lockoutService: AccountLockoutService = new AccountLockoutService(),
    @Optional() private readonly passwordResetService: PasswordResetService = new PasswordResetService(prisma),
  ) {}

  /**
   * Securely hashes a refresh token using SHA-256. Plaintext tokens are never stored.
   */
  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Verifies credentials against stored password hashes.
   * Supports both modern Argon2id and legacy Laravel bcrypt ($2y$) hashes with transparent upgrade.
   */
  async verifyPassword(
    password: string,
    storedHash: string,
  ): Promise<{ valid: boolean; needsUpgrade: boolean }> {
    if (!storedHash || !password) {
      return { valid: false, needsUpgrade: false };
    }

    // Support legacy Laravel bcrypt hashes ($2y$, $2a$, $2b$)
    if (
      storedHash.startsWith('$2y$') ||
      storedHash.startsWith('$2a$') ||
      storedHash.startsWith('$2b$')
    ) {
      const normalizedHash = storedHash.replace(/^\$2y\$/, '$2a$');
      try {
        const valid = await bcrypt.compare(password, normalizedHash);
        return { valid, needsUpgrade: valid };
      } catch {
        return { valid: false, needsUpgrade: false };
      }
    }

    // Modern Argon2id hashes ($argon2id$, $argon2i$, etc.)
    if (storedHash.startsWith('$argon2')) {
      try {
        const valid = await argon2.verify(storedHash, password);
        return { valid, needsUpgrade: false };
      } catch {
        return { valid: false, needsUpgrade: false };
      }
    }

    return { valid: false, needsUpgrade: false };
  }

  /**
   * Authenticates user credentials strictly against the PostgreSQL database.
   * Enforces brute-force account lockout protections.
   */
  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // 1. Account Lockout Check
    const lockoutStatus = this.lockoutService.isLocked(email);
    if (lockoutStatus.locked) {
      throw new UnauthorizedException(
        `Account is temporarily locked due to consecutive failed attempts. Please try again in ${lockoutStatus.remainingSeconds} seconds.`,
      );
    }

    // 2. Database lookup against users table
    const dbUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          { login: { equals: email, mode: 'insensitive' } },
        ],
      },
    });

    if (!dbUser || !dbUser.password) {
      this.lockoutService.recordFailedAttempt(email, ipAddress);
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Password Verification
    const { valid, needsUpgrade } = await this.verifyPassword(password, dbUser.password);

    if (!valid) {
      const lockRes = this.lockoutService.recordFailedAttempt(email, ipAddress);
      if (lockRes.locked) {
        throw new UnauthorizedException(
          `Account is temporarily locked due to consecutive failed attempts. Please try again in ${lockRes.lockDurationSeconds} seconds.`,
        );
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    // 4. Reset failed attempts upon successful login
    this.lockoutService.recordSuccessfulLogin(email);

    // 5. Transparently upgrade legacy bcrypt hash to Argon2id
    if (needsUpgrade) {
      try {
        const upgradedHash = await argon2.hash(password, { type: argon2.argon2id });
        await this.prisma.user.update({
          where: { id: dbUser.id },
          data: { password: upgradedHash },
        });
        this.logger.log(`Transparently upgraded password hash for user ${dbUser.id} to Argon2id`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to upgrade password hash for user ${dbUser.id}: ${message}`);
      }
    }

    // Derive role and permissions strictly from database-controlled assignments
    const role = (dbUser.group || 'Admin') as HospitalRole;
    const permissions = DEFAULT_ROLE_PERMISSIONS[role] || [];

    const fullName = `${dbUser.firstName} ${dbUser.lastName}`.trim() || dbUser.email;
    const authUser: AuthUser = {
      id: String(dbUser.id),
      email: dbUser.email,
      name: fullName,
      group: role,
      permissions,
      branchId: dbUser.branchId ? BigInt(dbUser.branchId) : null,
    };

    // Generate cryptographically secure refresh token & session record
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashRefreshToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.userSession.create({
      data: {
        userId: dbUser.id,
        refreshTokenHash,
        familyId,
        expiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
      },
    });

    return this.generateAuthResponse(authUser, rawRefreshToken);
  }

  /**
   * Refreshes access token with rotation and reuse detection.
   */
  async refresh(
    refreshTokenDto: RefreshTokenDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const { refreshToken } = refreshTokenDto;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashRefreshToken(refreshToken);
    const session = await this.prisma.userSession.findFirst({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Reuse Detection
    if (session.isRevoked) {
      await this.prisma.userSession.updateMany({
        where: { familyId: session.familyId },
        data: { isRevoked: true },
      });
      this.logger.warn(
        `Security Alert: Refresh token reuse detected for session family ${session.familyId}. Revoked entire family.`,
      );
      throw new UnauthorizedException(
        'Session compromised or token already rotated. Please log in again.',
      );
    }

    // Check expiration
    if (session.expiresAt.getTime() < Date.now()) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException('Refresh token has expired');
    }

    const dbUser = session.user;
    if (!dbUser) {
      throw new UnauthorizedException('User associated with session not found');
    }

    // Token Rotation
    const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
    const newRefreshTokenHash = this.hashRefreshToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.userSession.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
      await tx.userSession.create({
        data: {
          userId: session.userId,
          refreshTokenHash: newRefreshTokenHash,
          familyId: session.familyId,
          expiresAt: newExpiresAt,
          userAgent: userAgent || session.userAgent,
          ipAddress: ipAddress || session.ipAddress,
        },
      });
    });

    const role = (dbUser.group || 'Admin') as HospitalRole;
    const permissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
    const fullName = `${dbUser.firstName} ${dbUser.lastName}`.trim() || dbUser.email;
    const authUser: AuthUser = {
      id: String(dbUser.id),
      email: dbUser.email,
      name: fullName,
      group: role,
      permissions,
      branchId: dbUser.branchId ? BigInt(dbUser.branchId) : null,
    };

    return this.generateAuthResponse(authUser, newRawRefreshToken);
  }

  /**
   * Changes authenticated user's password and revokes all active sessions.
   */
  async changePassword(
    userId: string | bigint,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });

    if (!user || !user.password) {
      throw new NotFoundException('User account not found.');
    }

    const { valid } = await this.verifyPassword(dto.currentPassword, user.password);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password cannot be identical to the current password.');
    }

    const upgradedHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { password: upgradedHash },
      });

      // Revoke all active sessions
      await tx.userSession.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });
    });

    this.logger.log(`User #${user.id} changed password. All active sessions invalidated.`);
    return { message: 'Password changed successfully. All active sessions have been invalidated. Please log in again.' };
  }

  /**
   * Request password reset token.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; rawTokenForTest?: string }> {
    return this.passwordResetService.requestPasswordReset(dto.email);
  }

  /**
   * Reset password with single-use token.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.passwordResetService.resetPassword(dto.token, dto.newPassword);
  }

  /**
   * Revokes the session associated with the provided refresh token.
   */
  async logout(refreshTokenDto: RefreshTokenDto): Promise<{ message: string }> {
    const { refreshToken } = refreshTokenDto;
    if (refreshToken) {
      const tokenHash = this.hashRefreshToken(refreshToken);
      await this.prisma.userSession.updateMany({
        where: { refreshTokenHash: tokenHash },
        data: { isRevoked: true },
      });
    }
    return { message: 'Logged out successfully' };
  }

  /**
   * Generates cryptographically signed JWT and standardized response payload.
   * Short-lived access token: 15 minutes (900 seconds).
   */
  generateAuthResponse(user: AuthUser, refreshToken?: string): AuthResponseDto {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      group: user.group,
      permissions: user.permissions,
      branchId: user.branchId ? String(user.branchId) : null,
      staffId: user.staffId ? String(user.staffId) : null,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        group: user.group,
        permissions: user.permissions,
        branchId: user.branchId ? String(user.branchId) : null,
      },
    };
  }
}
