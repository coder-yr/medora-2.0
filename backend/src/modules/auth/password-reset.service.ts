import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

interface ResetRecord {
  tokenHash: string;
  userId: bigint;
  expiresAt: number;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  readonly TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

  // In-memory token store holding SHA-256 token hashes (never plaintext)
  private readonly resetTokens = new Map<string, ResetRecord>();

  constructor(private readonly prisma: PrismaService) {}

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  async requestPasswordReset(email: string): Promise<{ message: string; rawTokenForTest?: string }> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (!user) {
      // Safe generic message to prevent email enumeration
      return { message: 'If the email exists in our records, password reset instructions have been dispatched.' };
    }

    // Generate cryptographically secure random token (64 hex characters)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = Date.now() + this.TOKEN_EXPIRY_MS;

    this.resetTokens.set(tokenHash, {
      tokenHash,
      userId: user.id,
      expiresAt,
    });

    this.logger.log(`Generated password reset token for user #${user.id} (${normalizedEmail}) - expires in 15 mins`);

    // In a production email-integrated environment, this token is emailed.
    // For test observability in non-prod, expose rawTokenForTest only when NOT in production:
    const isProd = process.env.NODE_ENV === 'production';
    return {
      message: 'If the email exists in our records, password reset instructions have been dispatched.',
      rawTokenForTest: isProd ? undefined : rawToken,
    };
  }

  async resetPassword(token: string, newPass: string): Promise<{ message: string }> {
    if (!token) {
      throw new BadRequestException('Password reset token is required.');
    }

    const tokenHash = this.hashToken(token);
    const record = this.resetTokens.get(tokenHash);

    if (!record || Date.now() > record.expiresAt) {
      if (record) this.resetTokens.delete(tokenHash);
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
    });

    if (!user) {
      this.resetTokens.delete(tokenHash);
      throw new BadRequestException('User account no longer exists.');
    }

    // Hash new password using Argon2id
    const upgradedHash = await argon2.hash(newPass, { type: argon2.argon2id });

    await this.prisma.$transaction(async (tx) => {
      // Update password
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

    // Invalidate reset token immediately (single use)
    this.resetTokens.delete(tokenHash);
    this.logger.log(`Password reset completed and all sessions revoked for user #${user.id}`);

    return { message: 'Password has been reset successfully. Please log in with your new credentials.' };
  }
}
