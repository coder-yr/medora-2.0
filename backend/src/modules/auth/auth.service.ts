import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
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
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { AccountLockoutService } from './account-lockout.service';
import { PasswordResetService } from './password-reset.service';
import { MfaService } from './mfa.service';
import { VerifyMfaDto, DisableMfaDto } from './dto/mfa.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly lockoutService: AccountLockoutService = new AccountLockoutService(),
    @Optional() private readonly passwordResetService: PasswordResetService = new PasswordResetService(prisma),
    @Optional() private readonly mfaService: MfaService = new MfaService(prisma),
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

    // 2. Database lookup against users table with organization context
    const dbUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          { login: { equals: email, mode: 'insensitive' } },
        ],
      },
      include: {
        organization: true,
        organizationMemberships: {
          where: { isActive: true },
          include: { organization: true },
        },
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

    // 3b. Organization Suspension Enforcement (Super Admin bypasses for platform governance)
    const isSuperAdmin = Boolean(dbUser.isSuperAdmin);
    if (!isSuperAdmin && dbUser.organization && dbUser.organization.status === 'SUSPENDED') {
      throw new ForbiddenException(
        'Organization access is currently suspended. Please contact platform administration.',
      );
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

    // Derive role and permissions strictly from database-controlled assignments (no fallback to Admin)
    const validRoles: HospitalRole[] = [
      'SuperAdmin',
      'Admin',
      'OrganizationAdmin',
      'ClinicAdmin',
      'Doctor',
      'Nurse',
      'Accountant',
      'Receptionist',
      'Pharmacist',
      'Laboratorist',
      'Radiologist',
      'Cashier',
      'HR',
    ];
    const rawGroup = dbUser.group ? (dbUser.group.trim() as HospitalRole) : null;
    const isKnown = Boolean(rawGroup && validRoles.includes(rawGroup!));
    const role: HospitalRole = isKnown ? rawGroup! : ('Unconfigured' as any);
    const permissions = isKnown ? DEFAULT_ROLE_PERMISSIONS[role] || [] : [];

    // Derive active organization context
    const memberships = dbUser.organizationMemberships || [];
    const activeMembership = memberships.find(
      (m) => String(m.organizationId) === String(dbUser.organizationId),
    ) || memberships[0];

    const orgRole = activeMembership?.accessRole || (isSuperAdmin ? 'SuperAdmin' : null);
    const orgEdition = activeMembership?.organization?.edition || dbUser.organization?.edition || null;
    const orgStatus = activeMembership?.organization?.status || dbUser.organization?.status || null;
    const organizations = memberships.map((m) => ({
      id: m.organizationId.toString(),
      name: m.organization?.name || 'Organization',
      role: m.accessRole || 'Staff',
      edition: m.organization?.edition || 'HOSPITAL',
      status: m.organization?.status || 'ACTIVE',
      isDefault: m.isDefault,
    }));

    const fullName = `${dbUser.firstName} ${dbUser.lastName}`.trim() || dbUser.email;
    const authUser: AuthUser = {
      id: String(dbUser.id),
      email: dbUser.email,
      name: fullName,
      group: role,
      permissions,
      branchId: dbUser.branchId ? BigInt(dbUser.branchId) : null,
      organizationId: dbUser.organizationId ? BigInt(dbUser.organizationId) : null,
      organizationRole: orgRole,
      organizationEdition: orgEdition,
      organizationStatus: orgStatus,
      isSuperAdmin,
    };

    // Platform Super Admin / User Multi-Factor Authentication Challenge
    if (dbUser.isMfaEnabled) {
      const mfaTicket = this.jwtService.sign(
        {
          sub: String(dbUser.id),
          email: dbUser.email,
          purpose: 'mfa_challenge',
        },
        { expiresIn: '5m' },
      );

      return {
        accessToken: '',
        tokenType: 'Bearer',
        expiresIn: 300,
        mfaRequired: true,
        mfaTicket,
        user: {
          id: String(dbUser.id),
          email: dbUser.email,
          name: fullName,
          group: role,
          role,
          permissions: [],
          branchId: dbUser.branchId ? String(dbUser.branchId) : null,
          organizationId: dbUser.organizationId ? String(dbUser.organizationId) : null,
          organizationRole: orgRole,
          organizationEdition: orgEdition,
          organizationStatus: orgStatus,
          isSuperAdmin,
        },
      };
    }

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

    return this.generateAuthResponse(authUser, rawRefreshToken, {
      organizationRole: orgRole,
      organizationEdition: orgEdition,
      organizationStatus: orgStatus,
      organizations,
    });
  }

  /**
   * Registers a new clinical or administrative staff member, securely hashes their password,
   * assigns proper role-based permissions, and issues an authenticated session.
   */
  async register(
    registerDto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const { email, password, name, role, branchId } = registerDto;
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Conflict check: prevent duplicate accounts by email or login
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: normalizedEmail, mode: 'insensitive' } },
          { login: { equals: normalizedEmail, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      throw new ConflictException('A staff account with this email address already exists.');
    }

    // 1b. Privilege Escalation Prevention (Phase 10.2 Security Invariant)
    // Super Admin privileges can NEVER be registered publicly or through user-supplied input.
    if (
      role?.toLowerCase() === 'superadmin' ||
      role?.toLowerCase() === 'super admin' ||
      (registerDto as any).isSuperAdmin === true
    ) {
      throw new ForbiddenException(
        'Super Administrator privileges cannot be registered publicly. Platform owners are provisioned via secure bootstrap procedures only.',
      );
    }

    // 2. Hash password using Argon2id
    const hashedPassword = await argon2.hash(password, { type: argon2.argon2id });

    // 3. Parse first and last name
    const nameParts = (name || '').trim().split(' ');
    const firstName = nameParts[0] || 'Staff';
    const lastName = nameParts.slice(1).join(' ') || (role || 'Member');

    // 4. Determine role & permissions
    const assignedRole = (role || 'Doctor') as HospitalRole;
    const permissions = DEFAULT_ROLE_PERMISSIONS[assignedRole] || [];

    // 5. Derive unique login handle
    const rawLogin = normalizedEmail.split('@')[0].replace(/[^a-z0-9._-]/g, '') || 'staff';
    let finalLogin = rawLogin;
    const clash = await this.prisma.user.findUnique({ where: { login: finalLogin } });
    if (clash) {
      finalLogin = `${rawLogin}_${Date.now().toString().slice(-4)}`;
    }

    // 6. Persist user in database
    const createdUser = await this.prisma.user.create({
      data: {
        login: finalLogin,
        email: normalizedEmail,
        password: hashedPassword,
        firstName: firstName.slice(0, 50),
        lastName: lastName.slice(0, 50),
        group: assignedRole,
        description: `${assignedRole} staff registration for ${name}`,
        branchId: branchId ? BigInt(branchId) : 1n,
      },
    });

    const fullName = `${createdUser.firstName} ${createdUser.lastName}`.trim() || createdUser.email;

    // 6b. Automatically link or create Doctor profile if registered as Doctor
    if (assignedRole === 'Doctor' && (this.prisma as any).doctor) {
      try {
        const existingDoc = await (this.prisma as any).doctor.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (existingDoc) {
          await (this.prisma as any).doctor.update({
            where: { id: existingDoc.id },
            data: {
              ionUserId: createdUser.id.toString(),
              branchId: createdUser.branchId,
            },
          });
        } else {
          await (this.prisma as any).doctor.create({
            data: {
              name: fullName.startsWith('Dr') ? fullName : `Dr. ${fullName}`,
              email: normalizedEmail,
              ionUserId: createdUser.id.toString(),
              branchId: createdUser.branchId,
              department: 'General Practice',
              x: '',
              y: '',
            },
          });
        }
      } catch (docErr) {
        this.logger.warn(`Failed to auto-create doctor record during registration: ${docErr}`);
      }
    }

    const authUser: AuthUser = {
      id: String(createdUser.id),
      email: createdUser.email,
      name: fullName,
      group: assignedRole,
      permissions,
      branchId: createdUser.branchId ? BigInt(createdUser.branchId) : null,
    };

    // 7. Generate refresh token & session record
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashRefreshToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.userSession.create({
      data: {
        userId: createdUser.id,
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
      include: {
        user: {
          include: {
            organization: true,
            organizationMemberships: {
              where: { isActive: true },
              include: { organization: true },
            },
          },
        },
      },
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

    // Organization Suspension Enforcement (Super Admin bypasses for recovery)
    const isSuperAdmin = Boolean(dbUser.isSuperAdmin);
    if (!isSuperAdmin && dbUser.organization && dbUser.organization.status === 'SUSPENDED') {
      throw new ForbiddenException(
        'Organization access is currently suspended. Token refresh rejected.',
      );
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

    const validRoles: HospitalRole[] = [
      'SuperAdmin',
      'Admin',
      'OrganizationAdmin',
      'ClinicAdmin',
      'Doctor',
      'Nurse',
      'Accountant',
      'Receptionist',
      'Pharmacist',
      'Laboratorist',
      'Radiologist',
      'Cashier',
      'HR',
    ];
    const rawGroup = dbUser.group ? (dbUser.group.trim() as HospitalRole) : null;
    const isKnown = Boolean(rawGroup && validRoles.includes(rawGroup!));
    const role: HospitalRole = isKnown ? rawGroup! : ('Unconfigured' as any);
    const permissions = isKnown ? DEFAULT_ROLE_PERMISSIONS[role] || [] : [];

    const activeMembership = dbUser.organizationMemberships?.find(
      (m) => String(m.organizationId) === String(dbUser.organizationId),
    ) || dbUser.organizationMemberships?.[0];

    const orgRole = activeMembership?.accessRole || (isSuperAdmin ? 'SuperAdmin' : null);
    const orgEdition = activeMembership?.organization?.edition || dbUser.organization?.edition || null;
    const orgStatus = activeMembership?.organization?.status || dbUser.organization?.status || null;
    const organizations = (dbUser.organizationMemberships || []).map((m) => ({
      id: m.organizationId.toString(),
      name: m.organization.name,
      role: m.accessRole || 'Staff',
      edition: m.organization.edition,
      status: m.organization.status,
      isDefault: m.isDefault,
    }));

    const fullName = `${dbUser.firstName} ${dbUser.lastName}`.trim() || dbUser.email;
    const authUser: AuthUser = {
      id: String(dbUser.id),
      email: dbUser.email,
      name: fullName,
      group: role,
      permissions,
      branchId: dbUser.branchId ? BigInt(dbUser.branchId) : null,
      organizationId: dbUser.organizationId ? BigInt(dbUser.organizationId) : null,
      organizationRole: orgRole,
      organizationEdition: orgEdition,
      organizationStatus: orgStatus,
      isSuperAdmin,
    };

    return this.generateAuthResponse(authUser, newRawRefreshToken, {
      organizationRole: orgRole,
      organizationEdition: orgEdition,
      organizationStatus: orgStatus,
      organizations,
    });
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
   * Switches the active workspace organization for a user with multi-organization memberships.
   * Validates target organization status, active membership, authoritative role, and issues
   * a fresh scoped JWT access token and session.
   */
  async switchOrganization(
    user: AuthUser,
    targetOrgId: string | number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const orgIdBigInt = BigInt(targetOrgId);

    const targetOrg = await this.prisma.organization.findUnique({
      where: { id: orgIdBigInt },
    });
    if (!targetOrg) {
      throw new NotFoundException(`Organization #${targetOrgId} not found.`);
    }
    if (targetOrg.status === 'SUSPENDED') {
      throw new ForbiddenException(`Organization "${targetOrg.name}" is currently suspended.`);
    }

    const membership = await this.prisma.userOrganizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: BigInt(user.id),
          organizationId: orgIdBigInt,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenException(
        'You do not have an active membership in the target organization.',
      );
    }

    const allMemberships = await this.prisma.userOrganizationMembership.findMany({
      where: { userId: BigInt(user.id), isActive: true },
      include: { organization: true },
    });
    const organizations = allMemberships.map((m) => ({
      id: m.organizationId.toString(),
      name: m.organization.name,
      role: m.accessRole || 'Staff',
      edition: m.organization.edition,
      status: m.organization.status,
      isDefault: m.organizationId === orgIdBigInt,
    }));

    const branchMembership = await this.prisma.userBranchMembership.findFirst({
      where: {
        userId: BigInt(user.id),
        isActive: true,
        branch: {
          organizationId: orgIdBigInt,
          active: true,
          deletedAt: null,
        },
      },
      select: { branchId: true },
    });

    let targetBranchId: bigint | null = branchMembership?.branchId || null;
    if (!targetBranchId) {
      const firstBranch = await this.prisma.hospitalBranch.findFirst({
        where: { organizationId: orgIdBigInt, active: true, deletedAt: null },
        select: { id: true },
      });
      if (firstBranch) {
        targetBranchId = firstBranch.id;
      }
    }

    const validRoles: HospitalRole[] = [
      'SuperAdmin',
      'Admin',
      'OrganizationAdmin',
      'ClinicAdmin',
      'Doctor',
      'Nurse',
      'Accountant',
      'Receptionist',
      'Pharmacist',
      'Laboratorist',
      'Radiologist',
      'Cashier',
      'HR',
    ];
    const orgRole = membership.accessRole || 'Staff';
    const mappedRole: HospitalRole = validRoles.includes(orgRole as HospitalRole)
      ? (orgRole as HospitalRole)
      : user.isSuperAdmin
        ? 'SuperAdmin'
        : 'Doctor';
    const permissions = DEFAULT_ROLE_PERMISSIONS[mappedRole] || [];

    await this.prisma.user.update({
      where: { id: BigInt(user.id) },
      data: {
        organizationId: orgIdBigInt,
        branchId: targetBranchId,
        group: mappedRole,
      },
    });

    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashRefreshToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.userSession.create({
      data: {
        userId: BigInt(user.id),
        refreshTokenHash,
        familyId,
        expiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
      },
    });

    const updatedAuthUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      group: mappedRole,
      permissions,
      branchId: targetBranchId,
      organizationId: orgIdBigInt,
      organizationRole: orgRole,
      organizationEdition: membership.organization.edition,
      organizationStatus: membership.organization.status,
      isSuperAdmin: user.isSuperAdmin,
    };

    return this.generateAuthResponse(updatedAuthUser, rawRefreshToken, {
      organizationRole: orgRole,
      organizationEdition: membership.organization.edition,
      organizationStatus: membership.organization.status,
      organizations,
    });
  }

  /**
   * Generates cryptographically signed JWT and standardized response payload.
   * Short-lived access token: 15 minutes (900 seconds).
   */
  generateAuthResponse(
    user: AuthUser,
    refreshToken?: string,
    extraOrgContext?: {
      organizationRole?: string | null;
      organizationEdition?: string | null;
      organizationStatus?: string | null;
      organizations?: Array<{
        id: string;
        name: string;
        role: string;
        edition: string;
        status: string;
        isDefault: boolean;
      }>;
    },
  ): AuthResponseDto {
    const orgRole = user.organizationRole || extraOrgContext?.organizationRole || null;
    const orgEdition = user.organizationEdition || extraOrgContext?.organizationEdition || null;
    const orgStatus = user.organizationStatus || extraOrgContext?.organizationStatus || null;

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      group: user.group,
      permissions: user.permissions,
      branchId: user.branchId ? String(user.branchId) : null,
      staffId: user.staffId ? String(user.staffId) : null,
      organizationId: user.organizationId ? String(user.organizationId) : null,
      organizationRole: orgRole,
      organizationEdition: orgEdition,
      isSuperAdmin: Boolean(user.isSuperAdmin),
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
        role: user.group,
        permissions: user.permissions,
        branchId: user.branchId ? String(user.branchId) : null,
        organizationId: user.organizationId ? String(user.organizationId) : null,
        organizationRole: orgRole,
        organizationEdition: orgEdition,
        organizationStatus: orgStatus,
        organizations: extraOrgContext?.organizations || [],
        isSuperAdmin: Boolean(user.isSuperAdmin),
      },
    };
  }

  /**
   * Validates an organization staff invitation token using secure hash lookup
   */
  async validateInvitation(token: string) {
    const raw = token.trim();
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');

    const invitation = await this.prisma.staffInvitation.findFirst({
      where: {
        OR: [{ token: tokenHash }, { token: raw }],
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
            edition: true,
            status: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation token is invalid or has expired.');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(`This invitation has already been ${invitation.status.toLowerCase()}.`);
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('This invitation token has expired.');
    }

    return {
      organizationName: invitation.organization.name,
      organizationCode: invitation.organization.code,
      email: invitation.email,
      name: invitation.name,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Accepts an invitation, sets password, creates/links user account & membership, and returns auth session.
   * Enforces atomic single-use status transition and Argon2id password hashing.
   */
  async acceptInvitation(dto: { token: string; password: string; name?: string }) {
    const raw = dto.token.trim();
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');

    const invitation = await this.prisma.staffInvitation.findFirst({
      where: {
        OR: [{ token: tokenHash }, { token: raw }],
      },
      include: { organization: true },
    });

    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired invitation token.');
    }

    const hashedPassword = await argon2.hash(dto.password, { type: argon2.argon2id });
    const normalizedEmail = invitation.email.toLowerCase().trim();

    const role = invitation.role as HospitalRole;
    const permissions = DEFAULT_ROLE_PERMISSIONS[role] || [];

    const dbUser = await this.prisma.$transaction(async (tx) => {
      // Atomic status transition guarantees single-use token semantics even under concurrent requests
      const updateRes = await tx.staffInvitation.updateMany({
        where: { id: invitation.id, status: 'PENDING' },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      if (updateRes.count === 0) {
        throw new BadRequestException('Invitation has already been accepted or revoked.');
      }

      let existingUser = await tx.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      });

      if (!existingUser) {
        const displayName = dto.name || invitation.name || 'Staff Member';
        const nameParts = displayName.trim().split(' ');
        const firstName = nameParts[0] || 'Staff';
        const lastName = nameParts.slice(1).join(' ') || role;
        const baseLogin = normalizedEmail.split('@')[0].replace(/[^a-z0-9._-]/g, '').slice(0, 30) || 'staff';
        const loginSuffix = crypto.randomBytes(3).toString('hex');
        const login = `${baseLogin}_${loginSuffix}`;

        existingUser = await tx.user.create({
          data: {
            login,
            email: normalizedEmail,
            password: hashedPassword,
            firstName: firstName.slice(0, 50),
            lastName: lastName.slice(0, 50),
            group: role,
            isSuperAdmin: false, // Prevents privilege escalation
            organizationId: invitation.organizationId,
            branchId: invitation.branchId || null,
          },
        });
      } else {
        await tx.user.update({
          where: { id: existingUser.id },
          data: { password: hashedPassword },
        });
      }

      // Upsert organization membership
      await tx.userOrganizationMembership.upsert({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: invitation.organizationId,
          },
        },
        create: {
          userId: existingUser.id,
          organizationId: invitation.organizationId,
          accessRole: role,
          isActive: true,
          isDefault: true,
          assignedById: invitation.invitedById,
        },
        update: {
          accessRole: role,
          isActive: true,
          revokedAt: null,
        },
      });

      return existingUser;
    });

    const fullName = `${dbUser.firstName} ${dbUser.lastName}`.trim() || dbUser.email;
    const authUser: AuthUser = {
      id: String(dbUser.id),
      email: dbUser.email,
      name: fullName,
      group: role,
      permissions,
      branchId: dbUser.branchId ? BigInt(dbUser.branchId) : null,
      organizationId: dbUser.organizationId ? BigInt(dbUser.organizationId) : null,
      organizationRole: role,
      organizationEdition: invitation.organization?.edition || null,
      organizationStatus: invitation.organization?.status || null,
      isSuperAdmin: false,
    };

    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.userSession.create({
      data: {
        userId: dbUser.id,
        refreshTokenHash,
        familyId: crypto.randomUUID(),
        expiresAt,
      },
    });

    return this.generateAuthResponse(authUser, rawRefreshToken, {
      organizationRole: role,
      organizationEdition: invitation.organization?.edition || null,
      organizationStatus: invitation.organization?.status || null,
      organizations: [
        {
          id: invitation.organization.id.toString(),
          name: invitation.organization.name,
          role,
          edition: invitation.organization.edition,
          status: invitation.organization.status,
          isDefault: true,
        },
      ],
    });
  }

  /**
   * Verifies an MFA challenge for a logging-in user and issues authentication session
   */
  async verifyMfa(
    dto: VerifyMfaDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.mfaTicket);
    } catch {
      throw new UnauthorizedException(
        'MFA challenge ticket has expired or is invalid. Please sign in again.',
      );
    }

    if (payload.purpose !== 'mfa_challenge' || !payload.sub) {
      throw new UnauthorizedException('Invalid MFA challenge ticket.');
    }

    const userId = BigInt(payload.sub);
    const isValid = await this.mfaService.verifyCodeOrRecovery(
      userId,
      dto.code,
      Boolean(dto.isRecovery),
    );

    if (!isValid) {
      throw new UnauthorizedException(
        'Invalid authentication code or recovery key. Please check your authenticator app and try again.',
      );
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        organizationMemberships: {
          include: { organization: true },
        },
      },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User account no longer exists.');
    }

    const isSuperAdmin = Boolean(dbUser.isSuperAdmin);
    const validRoles: HospitalRole[] = [
      'SuperAdmin',
      'Admin',
      'OrganizationAdmin',
      'ClinicAdmin',
      'Doctor',
      'Nurse',
      'Accountant',
      'Receptionist',
      'Pharmacist',
      'Laboratorist',
      'Radiologist',
      'Cashier',
      'HR',
    ];
    const rawGroup = dbUser.group ? (dbUser.group.trim() as HospitalRole) : null;
    const isKnown = Boolean(rawGroup && validRoles.includes(rawGroup!));
    const role: HospitalRole = isKnown ? rawGroup! : ('Unconfigured' as any);
    const permissions = isKnown ? DEFAULT_ROLE_PERMISSIONS[role] || [] : [];

    const activeMembership =
      dbUser.organizationMemberships.find(
        (m) => String(m.organizationId) === String(dbUser.organizationId),
      ) || dbUser.organizationMemberships[0];

    const orgRole = activeMembership?.accessRole || (isSuperAdmin ? 'SuperAdmin' : null);
    const orgEdition =
      activeMembership?.organization?.edition || dbUser.organization?.edition || null;
    const orgStatus =
      activeMembership?.organization?.status || dbUser.organization?.status || null;
    const organizations = dbUser.organizationMemberships.map((m) => ({
      id: m.organizationId.toString(),
      name: m.organization.name,
      role: m.accessRole || 'Staff',
      edition: m.organization.edition,
      status: m.organization.status,
      isDefault: m.isDefault,
    }));

    const fullName = `${dbUser.firstName} ${dbUser.lastName}`.trim() || dbUser.email;
    const authUser: AuthUser = {
      id: String(dbUser.id),
      email: dbUser.email,
      name: fullName,
      group: role,
      permissions,
      branchId: dbUser.branchId ? BigInt(dbUser.branchId) : null,
      organizationId: dbUser.organizationId ? BigInt(dbUser.organizationId) : null,
      organizationRole: orgRole,
      organizationEdition: orgEdition,
      organizationStatus: orgStatus,
      isSuperAdmin,
    };

    // Platform audit logging
    await this.prisma.platformAuditLog.create({
      data: {
        action: 'MFA_CHALLENGE_SUCCESS',
        targetType: 'USER',
        targetId: String(dbUser.id),
        actorUserId: dbUser.id,
        actorEmail: dbUser.email,
        actorRole: isSuperAdmin ? 'SuperAdmin' : role,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        details: { method: dto.isRecovery ? 'RECOVERY_CODE' : 'TOTP' },
      },
    });

    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashRefreshToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

    return this.generateAuthResponse(authUser, rawRefreshToken, {
      organizationRole: orgRole,
      organizationEdition: orgEdition,
      organizationStatus: orgStatus,
      organizations,
    });
  }

  async enrollMfa(userId: string | bigint, ip?: string, userAgent?: string) {
    return this.mfaService.enroll(BigInt(userId), ip, userAgent);
  }

  async confirmMfa(userId: string | bigint, code: string, ip?: string, userAgent?: string) {
    return this.mfaService.confirm(BigInt(userId), code, ip, userAgent);
  }

  async disableMfa(userId: string | bigint, dto: DisableMfaDto, ip?: string, userAgent?: string) {
    return this.mfaService.disable(BigInt(userId), dto, ip, userAgent);
  }
}
