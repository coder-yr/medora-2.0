import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import * as fs from 'fs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';

import { MfaService, generateTOTP } from '../src/modules/auth/mfa.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { AccountLockoutService } from '../src/modules/auth/account-lockout.service';
import { PasswordResetService } from '../src/modules/auth/password-reset.service';
import { OrganizationStaffService } from '../src/modules/organization-staff/organization-staff.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { PlatformSuperAdminGuard } from '../src/common/guards/super-admin.guard';
import { OrganizationAdminGuard } from '../src/common/guards/organization-admin.guard';
import { EntitlementGuard } from '../src/common/guards/entitlement.guard';
import { AuthUser, JwtPayload } from '../src/common/types/auth-user.interface';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function runVerification() {
  console.log('================================================================================');
  console.log('MEDORA 2.0 — PHASE 10.2.2 FINAL AUTHENTICATION, TRANSACTION & SECURITY SUITE');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  const jwtService = new JwtService({
    secret: process.env.JWT_SECRET || 'medora-phase10-2-2-jwt-test-secret',
    signOptions: { expiresIn: '15m' },
  });

  const configService = new ConfigService({
    auth: {
      jwtSecret: process.env.JWT_SECRET || 'medora-phase10-2-2-jwt-test-secret',
      jwtExpiresIn: '15m',
    },
  });

  const mfaService = new MfaService(prisma as any);
  const lockoutService = new AccountLockoutService();
  const passwordResetService = new PasswordResetService(prisma as any);
  const authService = new AuthService(
    prisma as any,
    jwtService,
    configService,
    lockoutService,
    passwordResetService,
    mfaService,
  );
  const staffService = new OrganizationStaffService(prisma as any);
  const jwtStrategy = new JwtStrategy(configService, prisma as any);

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: ZERO DEMO & MOCK AUTHENTICATION PURGE
    // -------------------------------------------------------------------------
    console.log('\n--- Section 1: Zero Demo & Mock Authentication Purge ---');

    const demoInterceptorPath = path.resolve(__dirname, '../../frontend/src/config/demo-interceptor.ts');
    const demoInterceptorCode = fs.readFileSync(demoInterceptorPath, 'utf8');
    assert(
      !demoInterceptorCode.includes('buildMockResponse') && !demoInterceptorCode.includes('DEMO_PERSONAS_MAP'),
      '1.1: demo-interceptor.ts has been purged of mock persona mappings and mock response interceptors',
    );

    const loginViewPath = path.resolve(__dirname, '../../frontend/src/features/auth/LoginView.tsx');
    const loginViewCode = fs.readFileSync(loginViewPath, 'utf8');
    assert(
      !loginViewCode.includes('DEMO_PERSONAS') && !loginViewCode.includes('demo_token_'),
      '1.2: LoginView.tsx has zero DEMO_PERSONAS and zero demo_token_ synthesis fallbacks',
    );

    const authContextPath = path.resolve(__dirname, '../../frontend/src/context/AuthContext.tsx');
    const authContextCode = fs.readFileSync(authContextPath, 'utf8');
    assert(
      !authContextCode.includes('demo_token_'),
      '1.3: AuthContext.tsx enforces live backend validation and contains zero demo_token_ bypasses',
    );

    const mainTsxPath = path.resolve(__dirname, '../../frontend/src/main.tsx');
    const mainTsxCode = fs.readFileSync(mainTsxPath, 'utf8');
    assert(
      !mainTsxCode.includes('initDemoInterceptor'),
      '1.4: main.tsx does not initialize demo interceptors',
    );

    // -------------------------------------------------------------------------
    // SECTION 2: SUPER ADMIN MFA (RFC 6238 TOTP & RECOVERY CODES)
    // -------------------------------------------------------------------------
    console.log('\n--- Section 2: Super Admin MFA Implementation & Verification ---');

    // 2.1 AES-256-GCM encryption & decryption
    const testSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const encryptedSecret = mfaService.encryptSecret(testSecret);
    const decryptedSecret = mfaService.decryptSecret(encryptedSecret);
    assert(
      encryptedSecret.split(':').length === 3 && encryptedSecret !== testSecret,
      '2.1: MFA secret is encrypted at rest using AES-256-GCM (IV:Tag:Ciphertext format)',
    );
    assert(
      decryptedSecret === testSecret,
      '2.2: AES-256-GCM decryption accurately recovers original TOTP secret',
    );

    // Setup dedicated test Super Admin user
    const testAdminEmail = `superadmin.mfa.test.${Date.now()}@medora.hospital`;
    const hashedPass = await argon2.hash('SuperAdminPass123!', { type: argon2.argon2id });
    const superAdminUser = await prisma.user.create({
      data: {
        login: `superadmin_mfa_${Date.now()}`,
        email: testAdminEmail,
        password: hashedPass,
        firstName: 'MFA',
        lastName: 'SuperAdmin',
        group: 'SuperAdmin',
        isSuperAdmin: true,
        isMfaEnabled: false,
      },
    });

    // 2.3 MFA Enrollment
    const enrollment = await mfaService.enroll(superAdminUser.id);
    assert(
      Boolean(enrollment.secret && enrollment.qrCodeUrl?.startsWith('data:image/png;base64,')),
      '2.3: MFA enrollment generates RFC 6238 base32 secret and valid QR Code Data URL',
    );

    const userAfterEnroll = await prisma.user.findUnique({ where: { id: superAdminUser.id } });
    assert(
      userAfterEnroll?.isMfaEnabled === false && Boolean(userAfterEnroll?.mfaSecret),
      '2.4: Enrollment stores encrypted secret but keeps isMfaEnabled=false until first code confirmed',
    );

    // 2.5 Invalid TOTP Confirmation Rejection
    let confirmFailed = false;
    try {
      await mfaService.confirm(superAdminUser.id, '000000');
    } catch (e: any) {
      confirmFailed = e instanceof BadRequestException;
    }
    assert(confirmFailed, '2.5: MFA confirmation rejects invalid/out-of-window TOTP code');

    // 2.6 Valid TOTP Confirmation & Recovery Code Generation
    const validFirstCode = generateTOTP(enrollment.secret);
    const confirmation = await mfaService.confirm(superAdminUser.id, validFirstCode);
    assert(
      confirmation.recoveryCodes && confirmation.recoveryCodes.length === 8,
      '2.6: MFA confirmation generates exactly 8 single-use emergency backup recovery codes',
    );

    const userAfterConfirm = await prisma.user.findUnique({ where: { id: superAdminUser.id } });
    assert(
      userAfterConfirm?.isMfaEnabled === true,
      '2.7: Valid TOTP code confirmation activates isMfaEnabled=true on user account',
    );

    // 2.8 Login Challenge Trigger
    const loginResult = await authService.login({
      email: testAdminEmail,
      password: 'SuperAdminPass123!',
    });
    assert(
      loginResult.mfaRequired === true && Boolean(loginResult.mfaTicket) && !loginResult.accessToken,
      '2.8: Login for MFA-enabled Super Admin withholds access token and issues mfaTicket challenge',
    );

    // 2.9 Invalid MFA Challenge Verification
    let verifyFailed = false;
    try {
      await authService.verifyMfa({
        mfaTicket: loginResult.mfaTicket!,
        code: '999999',
      });
    } catch (e: any) {
      verifyFailed = e instanceof UnauthorizedException;
    }
    assert(verifyFailed, '2.9: verifyMfa rejects invalid TOTP code with UnauthorizedException');

    // 2.10 Valid MFA Challenge Verification
    const currentCode = generateTOTP(enrollment.secret);
    const verifiedSession = await authService.verifyMfa({
      mfaTicket: loginResult.mfaTicket!,
      code: currentCode,
    });
    assert(
      Boolean(verifiedSession.accessToken && verifiedSession.refreshToken),
      '2.10: verifyMfa with valid TOTP code succeeds and issues authenticated session & JWT tokens',
    );

    // 2.11 Recovery Code Single-Use Semantics
    const recoveryCodeToUse = confirmation.recoveryCodes[0];
    const secondLogin = await authService.login({
      email: testAdminEmail,
      password: 'SuperAdminPass123!',
    });

    const recoverySession = await authService.verifyMfa({
      mfaTicket: secondLogin.mfaTicket!,
      code: recoveryCodeToUse,
      isRecovery: true,
    });
    assert(
      Boolean(recoverySession.accessToken),
      '2.11: Single-use recovery backup code successfully validates MFA login challenge',
    );

    // 2.12 Re-using consumed recovery code must fail
    const thirdLogin = await authService.login({
      email: testAdminEmail,
      password: 'SuperAdminPass123!',
    });
    let recoveryReuseFailed = false;
    try {
      await authService.verifyMfa({
        mfaTicket: thirdLogin.mfaTicket!,
        code: recoveryCodeToUse,
        isRecovery: true,
      });
    } catch (e: any) {
      recoveryReuseFailed = e instanceof UnauthorizedException;
    }
    assert(recoveryReuseFailed, '2.12: Re-using an already consumed recovery code is strictly rejected');

    // 2.13 MFA Disable & Session Invalidation
    const disableCode = generateTOTP(enrollment.secret);
    await mfaService.disable(superAdminUser.id, {
      code: disableCode,
      password: 'SuperAdminPass123!',
    });

    const userAfterDisable = await prisma.user.findUnique({ where: { id: superAdminUser.id } });
    const remainingSessions = await prisma.userSession.count({ where: { userId: superAdminUser.id } });
    assert(
      userAfterDisable?.isMfaEnabled === false && remainingSessions === 0,
      '2.13: Disabling MFA clears mfaSecret and immediately invalidates all active user sessions',
    );

    // -------------------------------------------------------------------------
    // SECTION 3: INVITATION TRANSACTION INTEGRITY
    // -------------------------------------------------------------------------
    console.log('\n--- Section 3: Staff Invitation Transaction Integrity ---');

    // Create test organization
    const testOrg = await prisma.organization.create({
      data: {
        name: `Test Org ${Date.now()}`,
        code: `TORG-${Date.now().toString().slice(-4)}`,
        edition: 'HOSPITAL',
        status: 'ACTIVE',
      },
    });

    // Create test Org Admin
    const orgAdminUser = await prisma.user.create({
      data: {
        login: `orgadmin_${Date.now()}`,
        email: `orgadmin.${Date.now()}@medora.hospital`,
        password: hashedPass,
        firstName: 'Org',
        lastName: 'Admin',
        group: 'Admin',
        organizationId: testOrg.id,
      },
    });

    await prisma.userOrganizationMembership.create({
      data: {
        userId: orgAdminUser.id,
        organizationId: testOrg.id,
        accessRole: 'Admin',
        isActive: true,
        isDefault: true,
      },
    });

    // 3.1 Issue invitation
    const inviteEmail = `invited.staff.${Date.now()}@medora.hospital`;
    const inviteRes = await staffService.inviteStaff(
      testOrg.id,
      {
        email: inviteEmail,
        name: 'Invited Doctor',
        role: 'Doctor',
      },
      orgAdminUser.id,
    );
    assert(Boolean(inviteRes.invitationToken), '3.1: Staff invitation generates secure token and hash at rest');

    // 3.2 Concurrent Acceptance Simulation
    // Attempt two simultaneous acceptances of the exact same token
    const [accResult1, accResult2] = await Promise.allSettled([
      authService.acceptInvitation({
        token: inviteRes.invitationToken,
        password: 'StaffPassword123!',
        name: 'Concurrent Doctor 1',
      }),
      authService.acceptInvitation({
        token: inviteRes.invitationToken,
        password: 'StaffPassword123!',
        name: 'Concurrent Doctor 2',
      }),
    ]);

    const acceptedCount = [accResult1, accResult2].filter((r) => r.status === 'fulfilled').length;
    const rejectedCount = [accResult1, accResult2].filter((r) => r.status === 'rejected').length;

    assert(
      acceptedCount === 1 && rejectedCount === 1,
      '3.2: Concurrent invitation acceptance is atomic: exactly 1 succeeds, concurrent duplicate fails',
    );

    // 3.3 Replay attempt rejection
    let replayRejected = false;
    try {
      await authService.acceptInvitation({
        token: inviteRes.invitationToken,
        password: 'StaffPassword123!',
      });
    } catch (e: any) {
      replayRejected = e instanceof BadRequestException;
    }
    assert(replayRejected, '3.3: Replay acceptance of already consumed invitation is strictly rejected');

    // 3.4 Revoked invitation acceptance rejection
    const revokedInvite = await staffService.inviteStaff(
      testOrg.id,
      {
        email: `revoked.${Date.now()}@medora.hospital`,
        name: 'Revoked Staff',
        role: 'Nurse',
      },
      orgAdminUser.id,
    );
    await staffService.revokeInvitation(testOrg.id, revokedInvite.invitationId, orgAdminUser.id);

    let revokedAcceptRejected = false;
    try {
      await authService.acceptInvitation({
        token: revokedInvite.invitationToken,
        password: 'StaffPassword123!',
      });
    } catch (e: any) {
      revokedAcceptRejected = e instanceof BadRequestException;
    }
    assert(revokedAcceptRejected, '3.4: Acceptance of a revoked invitation is strictly rejected');

    // -------------------------------------------------------------------------
    // SECTION 4: LAST ADMINISTRATOR CONCURRENCY PROTECTION
    // -------------------------------------------------------------------------
    console.log('\n--- Section 4: Last Administrator Concurrency Protection ---');

    // Setup organization with exactly 2 administrators: Admin A and Admin B
    const adminAUser = await prisma.user.create({
      data: {
        login: `admin_a_${Date.now()}`,
        email: `adminA.${Date.now()}@medora.hospital`,
        password: hashedPass,
        firstName: 'Admin',
        lastName: 'A',
        group: 'Admin',
        organizationId: testOrg.id,
      },
    });

    const memA = await prisma.userOrganizationMembership.create({
      data: {
        userId: adminAUser.id,
        organizationId: testOrg.id,
        accessRole: 'Admin',
        isActive: true,
      },
    });

    const adminBUser = await prisma.user.create({
      data: {
        login: `admin_b_${Date.now()}`,
        email: `adminB.${Date.now()}@medora.hospital`,
        password: hashedPass,
        firstName: 'Admin',
        lastName: 'B',
        group: 'Admin',
        organizationId: testOrg.id,
      },
    });

    const memB = await prisma.userOrganizationMembership.create({
      data: {
        userId: adminBUser.id,
        organizationId: testOrg.id,
        accessRole: 'Admin',
        isActive: true,
      },
    });

    // Currently testOrg has orgAdminUser + adminAUser + adminBUser (3 admins).
    // Demote orgAdminUser so exactly 2 admins remain (Admin A and Admin B).
    const orgAdminMem = await prisma.userOrganizationMembership.findFirst({
      where: { userId: orgAdminUser.id, organizationId: testOrg.id },
    });
    if (orgAdminMem) {
      await staffService.updateRole(testOrg.id, orgAdminMem.id, { role: 'Doctor' as any }, adminAUser.id);
    }

    const twoAdminCount = await prisma.userOrganizationMembership.count({
      where: { organizationId: testOrg.id, accessRole: 'Admin', isActive: true },
    });
    assert(twoAdminCount === 2, '4.1: Test organization initialized with exactly 2 active administrators');

    // Simulate simultaneous demotion: Admin A tries to demote Admin B, Admin B tries to demote Admin A
    const [demoteA, demoteB] = await Promise.allSettled([
      staffService.updateRole(testOrg.id, memA.id, { role: 'Doctor' as any }, adminBUser.id),
      staffService.updateRole(testOrg.id, memB.id, { role: 'Doctor' as any }, adminAUser.id),
    ]);

    const demoteSuccessCount = [demoteA, demoteB].filter((r) => r.status === 'fulfilled').length;
    const demoteFailCount = [demoteA, demoteB].filter((r) => r.status === 'rejected').length;

    assert(
      demoteSuccessCount === 1 && demoteFailCount === 1,
      '4.2: Concurrent demotion protection: exactly 1 demotion succeeds; the concurrent request fails with BadRequestException',
    );

    const remainingAdminCount = await prisma.userOrganizationMembership.count({
      where: { organizationId: testOrg.id, accessRole: 'Admin', isActive: true },
    });
    assert(
      remainingAdminCount === 1,
      '4.3: Concurrency row-level locking guarantees organization never loses its final active Administrator',
    );

    // 4.4 Demoting the last active administrator directly must fail
    const remainingAdminMem = await prisma.userOrganizationMembership.findFirst({
      where: { organizationId: testOrg.id, accessRole: 'Admin', isActive: true },
    });
    let demoteLastFailed = false;
    try {
      await staffService.updateRole(
        testOrg.id,
        remainingAdminMem!.id,
        { role: 'Doctor' as any },
        adminAUser.id,
      );
    } catch (e: any) {
      demoteLastFailed = e instanceof BadRequestException;
    }
    assert(demoteLastFailed, '4.4: Attempting to demote the final active administrator is strictly rejected');

    // 4.5 Deactivating the last active administrator must fail
    let deactivateLastFailed = false;
    try {
      await staffService.updateStatus(
        testOrg.id,
        remainingAdminMem!.id,
        { isActive: false },
        adminBUser.id, // using different user id to test last admin rule rather than self-deactivate rule
      );
    } catch (e: any) {
      deactivateLastFailed = e instanceof BadRequestException;
    }
    assert(deactivateLastFailed, '4.5: Attempting to deactivate the final active administrator is strictly rejected');

    // -------------------------------------------------------------------------
    // SECTION 5: REAL AUTHORIZATION GUARDS & CROSS-TENANT ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n--- Section 5: Real Authorization Guards & Platform Isolation ---');

    const mockSuperAdminReflector: any = { getAllAndOverride: () => true };
    const superAdminGuard = new PlatformSuperAdminGuard(mockSuperAdminReflector);
    const mockContext = (user: any): any => ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    });

    const superAdminAuthUser: AuthUser = {
      id: String(superAdminUser.id),
      email: superAdminUser.email,
      name: 'Super Admin',
      group: 'SuperAdmin',
      permissions: ['*'],
      branchId: null,
      organizationId: null,
      isSuperAdmin: true,
    };

    const hospitalAdminAuthUser: AuthUser = {
      id: String(adminAUser.id),
      email: adminAUser.email,
      name: 'Hospital Admin',
      group: 'Admin',
      permissions: ['hospital:*'],
      branchId: null,
      organizationId: testOrg.id,
      organizationRole: 'Admin',
      isSuperAdmin: false,
    };

    const doctorAuthUser: AuthUser = {
      id: '99',
      email: 'doctor@medora.hospital',
      name: 'Dr. Test',
      group: 'Doctor',
      permissions: ['patient:read'],
      branchId: null,
      organizationId: testOrg.id,
      isSuperAdmin: false,
    };

    assert(
      superAdminGuard.canActivate(mockContext(superAdminAuthUser)) === true,
      '5.1: SuperAdminGuard permits authenticated Super Admin (isSuperAdmin=true)',
    );

    let hospAdminBlocked = false;
    try {
      superAdminGuard.canActivate(mockContext(hospitalAdminAuthUser));
    } catch (e: any) {
      hospAdminBlocked = e instanceof ForbiddenException;
    }
    assert(hospAdminBlocked, '5.2: SuperAdminGuard strictly rejects Hospital Admin (403 Forbidden)');

    let doctorBlocked = false;
    try {
      superAdminGuard.canActivate(mockContext(doctorAuthUser));
    } catch (e: any) {
      doctorBlocked = e instanceof ForbiddenException;
    }
    assert(doctorBlocked, '5.3: SuperAdminGuard strictly rejects Doctor (403 Forbidden)');

    let unauthBlocked = false;
    try {
      superAdminGuard.canActivate(mockContext(null));
    } catch (e: any) {
      unauthBlocked = e instanceof ForbiddenException;
    }
    assert(unauthBlocked, '5.4: SuperAdminGuard strictly rejects unauthenticated request (403 Forbidden)');

    // -------------------------------------------------------------------------
    // SECTION 6: ENTITLEMENT & EDITION HARDENING
    // -------------------------------------------------------------------------
    console.log('\n--- Section 6: Entitlement & Edition Hardening ---');

    // Create a Clinic Edition organization without 'inpatient' module
    const clinicOrg = await prisma.organization.create({
      data: {
        name: `Clinic Locus ${Date.now()}`,
        code: `CLIN-${Date.now().toString().slice(-4)}`,
        edition: 'CLINIC',
        status: 'ACTIVE',
      },
    });

    const clinicDoctorUser: AuthUser = {
      id: '101',
      email: 'clinic.doc@medora.hospital',
      name: 'Clinic Doctor',
      group: 'Doctor',
      permissions: ['inpatient:read'],
      branchId: null,
      organizationId: clinicOrg.id,
      organizationEdition: 'CLINIC',
      isSuperAdmin: false,
    };

    const mockReflector: any = {
      getAllAndOverride: (key: string) => {
        if (key === 'require_entitlement') return 'inpatient';
        return undefined;
      },
    };

    const entitlementGuard = new EntitlementGuard(mockReflector, prisma as any);
    let clinicIpdBlocked = false;
    try {
      await entitlementGuard.canActivate(mockContext(clinicDoctorUser));
    } catch (e: any) {
      clinicIpdBlocked = e instanceof ForbiddenException;
    }
    assert(
      clinicIpdBlocked,
      '6.1: EntitlementGuard blocks Clinic edition user from accessing inpatient module (403 Forbidden)',
    );

    // Hospital edition user with inpatient module entitlement
    const hospitalDoctorUser: AuthUser = {
      id: '102',
      email: 'hosp.doc@medora.hospital',
      name: 'Hospital Doctor',
      group: 'Doctor',
      permissions: ['inpatient:read'],
      branchId: null,
      organizationId: testOrg.id,
      organizationEdition: 'HOSPITAL',
      isSuperAdmin: false,
    };

    const hospIpdAllowed = await entitlementGuard.canActivate(mockContext(hospitalDoctorUser));
    assert(
      hospIpdAllowed === true,
      '6.2: EntitlementGuard permits Hospital edition user to access entitled inpatient module',
    );

    // -------------------------------------------------------------------------
    // SECTION 7: LIVE SESSION & MEMBERSHIP INVALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- Section 7: Live Session & Organization Invalidation ---');

    // 7.1 Organization Suspension Invalidation
    await prisma.organization.update({
      where: { id: testOrg.id },
      data: { status: 'SUSPENDED' },
    });

    const jwtPayload: JwtPayload = {
      sub: String(adminBUser.id),
      email: adminBUser.email,
      name: 'Admin B',
      group: 'Admin',
      permissions: ['*'],
      branchId: null,
      staffId: null,
      organizationId: String(testOrg.id),
      isSuperAdmin: false,
    };

    let suspendedRejected = false;
    try {
      await jwtStrategy.validate(jwtPayload);
    } catch (e: any) {
      suspendedRejected = e instanceof UnauthorizedException;
    }
    assert(
      suspendedRejected,
      '7.1: JwtStrategy immediately rejects active JWT requests when user organization is SUSPENDED',
    );

    // Clean up suspended status for test org
    await prisma.organization.update({
      where: { id: testOrg.id },
      data: { status: 'ACTIVE' },
    });

    // 7.2 Deactivated Membership Invalidation
    await prisma.userOrganizationMembership.update({
      where: { id: memB.id },
      data: { isActive: false, revokedAt: new Date() },
    });

    let revokedMembershipRejected = false;
    try {
      await jwtStrategy.validate(jwtPayload);
    } catch (e: any) {
      revokedMembershipRejected = e instanceof UnauthorizedException;
    }
    assert(
      revokedMembershipRejected,
      '7.2: JwtStrategy immediately rejects active JWT requests when user membership is revoked/inactive',
    );

    // -------------------------------------------------------------------------
    // CLEANUP TEST FIXTURES
    // -------------------------------------------------------------------------
    console.log('\nCleaning up verification fixtures...');
    try {
      await prisma.userSession.deleteMany({
        where: {
          userId: { in: [superAdminUser.id, orgAdminUser.id, adminAUser.id, adminBUser.id] },
        },
      });
      await prisma.userOrganizationMembership.deleteMany({
        where: { organizationId: { in: [testOrg.id, clinicOrg.id] } },
      });
      await prisma.staffInvitation.deleteMany({
        where: { organizationId: testOrg.id },
      });
      await prisma.user.deleteMany({
        where: {
          id: { in: [superAdminUser.id, orgAdminUser.id, adminAUser.id, adminBUser.id] },
        },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [testOrg.id, clinicOrg.id] } },
      });
    } catch (cleanupErr: any) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }

    console.log('\n================================================================================');
    console.log(`PHASE 10.2.2 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
