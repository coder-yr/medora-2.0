import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { DisableMfaDto } from './dto/mfa.dto';

export interface RecoveryCodeRecord {
  hash: string;
  used: boolean;
  usedAt: string | null;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Standard RFC 4648 Base32 Encoder for TOTP secrets
 */
function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Standard RFC 4648 Base32 Decoder for TOTP secrets
 */
function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * RFC 6238 compliant TOTP generator using HMAC-SHA1
 */
export function generateTOTP(secretBase32: string, timeStepOffset = 0): string {
  const timeStep = Math.floor(Date.now() / 1000 / 30) + timeStepOffset;
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(timeStep));
  const key = base32Decode(secretBase32);
  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 1000000).toString().padStart(6, '0');
}

/**
 * RFC 6238 compliant TOTP verifier with standard clock-skew tolerance window (+/- 30s)
 */
export function verifyTOTP(token: string, secretBase32: string, window = 1): boolean {
  const cleanToken = token.trim();
  if (cleanToken.length !== 6) return false;
  for (let offset = -window; offset <= window; offset++) {
    if (generateTOTP(secretBase32, offset) === cleanToken) {
      return true;
    }
  }
  return false;
}

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Derives a cryptographically strong 256-bit key for AES-256-GCM encryption
   */
  private getEncryptionKey(): Buffer {
    const rawKey =
      process.env.MFA_ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      'medora-mfa-aes256-production-protection-key-seed';
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts a plain TOTP secret at rest using AES-256-GCM
   */
  encryptSecret(plainSecret: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainSecret, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypts an AES-256-GCM encrypted TOTP secret from storage
   */
  decryptSecret(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted MFA format');
      }
      const [ivHex, tagHex, dataHex] = parts;
      const key = this.getEncryptionKey();
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      return (
        decipher.update(Buffer.from(dataHex, 'hex'), undefined, 'utf8') +
        decipher.final('utf8')
      );
    } catch (err: any) {
      this.logger.error(`MFA secret decryption error: ${err.message}`);
      throw new InternalServerErrorException(
        'Failed to decrypt two-factor authentication configuration.',
      );
    }
  }

  /**
   * Generates a new TOTP secret and QR code for an authenticated user
   */
  async enroll(userId: bigint, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    const plainSecret = base32Encode(crypto.randomBytes(20));
    const encryptedSecret = this.encryptSecret(plainSecret);

    // Save encrypted secret pending confirmation (isMfaEnabled stays false until confirm)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: encryptedSecret,
      },
    });

    const otpauth = `otpauth://totp/Medora%20Platform:${encodeURIComponent(user.email)}?secret=${plainSecret}&issuer=Medora%20Platform`;

    const qrCodeUrl = await QRCode.toDataURL(otpauth, {
      errorCorrectionLevel: 'M',
      margin: 2,
    });

    // Record audit log
    await this.prisma.platformAuditLog.create({
      data: {
        action: 'MFA_ENROLL_INITIATED',
        targetType: 'USER',
        targetId: String(user.id),
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: user.isSuperAdmin ? 'SuperAdmin' : user.group,
        ipAddress: ip || 'unknown',
        userAgent: userAgent || 'unknown',
        details: { method: 'TOTP_RFC6238' },
      },
    });

    return {
      secret: plainSecret,
      qrCodeUrl,
      issuer: 'Medora Platform',
      account: user.email,
    };
  }

  /**
   * Confirms TOTP setup by verifying first valid code and generating single-use backup recovery codes
   */
  async confirm(userId: bigint, code: string, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA enrollment has not been initiated for this account.');
    }

    const plainSecret = this.decryptSecret(user.mfaSecret);
    const valid = verifyTOTP(code, plainSecret, 1);

    if (!valid) {
      throw new BadRequestException(
        'Invalid verification code. Please check your authenticator clock and try again.',
      );
    }

    // Generate 8 cryptographically random recovery codes
    const plainRecoveryCodes: string[] = [];
    const hashedEntries: RecoveryCodeRecord[] = [];

    for (let i = 0; i < 8; i++) {
      const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
      const rawCode = `${part1}-${part2}`;
      plainRecoveryCodes.push(rawCode);

      const hash = await argon2.hash(rawCode, { type: argon2.argon2id });
      hashedEntries.push({
        hash,
        used: false,
        usedAt: null,
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isMfaEnabled: true,
        mfaRecoveryCodes: hashedEntries as any,
      },
    });

    // Platform audit logging
    await this.prisma.platformAuditLog.create({
      data: {
        action: 'MFA_ACTIVATED',
        targetType: 'USER',
        targetId: String(user.id),
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: user.isSuperAdmin ? 'SuperAdmin' : user.group,
        ipAddress: ip || 'unknown',
        userAgent: userAgent || 'unknown',
        details: { backupCodesCount: 8 },
      },
    });

    return {
      message: 'Multi-factor authentication successfully enabled.',
      recoveryCodes: plainRecoveryCodes,
    };
  }

  /**
   * Verifies TOTP code or single-use recovery code for a user
   */
  async verifyCodeOrRecovery(
    userId: bigint,
    code: string,
    isRecovery: boolean = false,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isMfaEnabled || !user.mfaSecret) {
      return false;
    }

    const trimmedCode = code.trim();

    if (isRecovery) {
      const recoveryRecords = (user.mfaRecoveryCodes as unknown as RecoveryCodeRecord[]) || [];
      for (let i = 0; i < recoveryRecords.length; i++) {
        const item = recoveryRecords[i];
        if (!item.used) {
          const match = await argon2.verify(item.hash, trimmedCode);
          if (match) {
            // Mark code as used (single-use semantics)
            recoveryRecords[i] = {
              ...item,
              used: true,
              usedAt: new Date().toISOString(),
            };

            await this.prisma.user.update({
              where: { id: userId },
              data: { mfaRecoveryCodes: recoveryRecords as any },
            });

            this.logger.warn(`Single-use recovery code consumed for user #${userId}`);
            return true;
          }
        }
      }
      return false;
    }

    // Standard RFC 6238 TOTP verification
    const plainSecret = this.decryptSecret(user.mfaSecret);
    return verifyTOTP(trimmedCode, plainSecret, 1);
  }

  /**
   * Disables MFA after authenticating password and current TOTP/recovery code
   * Invariants: Invalids all active user sessions immediately
   */
  async disable(userId: bigint, dto: DisableMfaDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isMfaEnabled) {
      throw new BadRequestException('MFA is not enabled on this account.');
    }

    // 1. Verify account password
    const passwordValid = await argon2.verify(user.password, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid account password.');
    }

    // 2. Verify MFA code (accepts valid TOTP or recovery code)
    const codeValid =
      (await this.verifyCodeOrRecovery(user.id, dto.code, false)) ||
      (await this.verifyCodeOrRecovery(user.id, dto.code, true));

    if (!codeValid) {
      throw new BadRequestException('Invalid authentication code.');
    }

    // 3. Atomically disable MFA and revoke all active sessions
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          isMfaEnabled: false,
          mfaSecret: null,
          mfaRecoveryCodes: [] as any,
        },
      });

      // Session invalidation requirement
      await tx.userSession.deleteMany({
        where: { userId },
      });
    });

    // Record audit log
    await this.prisma.platformAuditLog.create({
      data: {
        action: 'MFA_DISABLED',
        targetType: 'USER',
        targetId: String(user.id),
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: user.isSuperAdmin ? 'SuperAdmin' : user.group,
        ipAddress: ip || 'unknown',
        userAgent: userAgent || 'unknown',
        details: { sessionsRevoked: true },
      },
    });

    return {
      message: 'Multi-factor authentication disabled and all active sessions revoked.',
    };
  }
}
