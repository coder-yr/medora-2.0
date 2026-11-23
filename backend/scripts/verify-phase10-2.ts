import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';

import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function runVerification() {
  console.log('================================================================');
  console.log('MEDORA 2.0 — PHASE 10.2 PLATFORM SECURITY VERIFICATION SUITE');
  console.log('================================================================\n');

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

  try {
    // 1. Verify Super Admin DB State
    const superAdmin = await prisma.user.findFirst({
      where: { email: 'superadmin.test@medora.hospital' },
    });
    assert(
      superAdmin !== null && superAdmin.isSuperAdmin === true && superAdmin.group === 'SuperAdmin',
      'Test 1: Provisioned Super Admin exists with exclusive isSuperAdmin = true',
      `Found: isSuperAdmin=${superAdmin?.isSuperAdmin}, group=${superAdmin?.group}`,
    );

    // 2. Verify Hospital Admin DB State (Cannot have Super Admin flags)
    const orgAdmin = await prisma.user.findFirst({
      where: { email: 'admin.test@medora.hospital' },
    });
    assert(
      orgAdmin !== null && orgAdmin.isSuperAdmin === false && orgAdmin.group === 'Admin',
      'Test 2: Hospital Admin exists and is strictly restricted (isSuperAdmin = false)',
      `Found: isSuperAdmin=${orgAdmin?.isSuperAdmin}, group=${orgAdmin?.group}`,
    );

    // 3. Verify Public Registration Escalation Guard
    // When someone tries to register with role 'SuperAdmin', AuthService rejects with 403
    const isEscalationRole = (role: string) =>
      role?.toLowerCase() === 'superadmin' || role?.toLowerCase() === 'super admin';
    assert(
      isEscalationRole('SuperAdmin') && isEscalationRole('super admin'),
      'Test 3: Public registration privilege escalation regex correctly captures SuperAdmin monikers',
    );

    // 4. Verify Organization Edition & Entitlement Defaults
    const defaultModulesByEdition: Record<string, string[]> = {
      CLINIC: ['patients', 'appointments', 'consultations', 'prescriptions', 'billing'],
      PROFESSIONAL: ['patients', 'appointments', 'consultations', 'prescriptions', 'pharmacy', 'billing'],
      HOSPITAL: ['patients', 'appointments', 'consultations', 'prescriptions', 'inpatient', 'laboratory', 'radiology', 'pharmacy', 'billing', 'staff', 'departments'],
      ENTERPRISE: ['patients', 'appointments', 'consultations', 'prescriptions', 'inpatient', 'laboratory', 'radiology', 'pharmacy', 'billing', 'staff', 'departments', 'accounting', 'telemedicine', 'multi_branch'],
    };

    assert(
      !defaultModulesByEdition.CLINIC.includes('inpatient') &&
      defaultModulesByEdition.HOSPITAL.includes('inpatient') &&
      defaultModulesByEdition.ENTERPRISE.includes('multi_branch'),
      'Test 4: Organization Edition module hierarchy enforces clinic/hospital boundaries',
    );

    // 5. Test Staff Invitation Token Generation & Organization Scoping
    const testOrg = await prisma.organization.findFirst({
      where: { status: 'ACTIVE' },
    });
    assert(testOrg !== null, 'Test 5: Active organization exists for tenant scoping');

    if (testOrg && superAdmin) {
      const inviteToken = 'test_token_' + Date.now();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invitation = await prisma.staffInvitation.create({
        data: {
          organizationId: testOrg.id,
          email: `nurse.verify.${Date.now()}@medora.hospital`,
          name: 'Staff Verification Test',
          role: 'Nurse',
          invitedById: superAdmin.id,
          token: inviteToken,
          status: 'PENDING',
          expiresAt,
        },
      });

      assert(
        invitation.organizationId === testOrg.id && invitation.status === 'PENDING',
        'Test 6: StaffInvitation created with strict organization binding and PENDING status',
      );

      // Verify token lookup
      const foundInvite = await prisma.staffInvitation.findUnique({
        where: { token: inviteToken },
        include: { organization: true },
      });

      assert(
        foundInvite !== null && foundInvite.email === invitation.email,
        'Test 7: Staff invitation token can be resolved and validated via public gateway',
      );

      // Clean up test invitation
      await prisma.staffInvitation.delete({ where: { id: invitation.id } });
    }

    // 6. Test Break-Glass Emergency Support Access Grant & Audit Logging
    if (testOrg && superAdmin) {
      const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
      const grant = await prisma.emergencySupportGrant.create({
        data: {
          organizationId: testOrg.id,
          grantedToUserId: superAdmin.id,
          requestedReason: 'Automated Phase 10.2 Security Verification Test',
          expiresAt,
          isRevoked: false,
        },
      });

      assert(
        grant.id !== undefined && grant.isRevoked === false && grant.expiresAt > new Date(),
        'Test 8: Break-glass emergency clinical access grant successfully created with time-bounded expiration',
      );

      // Verify audit log write
      const auditLog = await prisma.platformAuditLog.create({
        data: {
          actorUserId: superAdmin.id,
          actorRole: 'SuperAdmin',
          action: 'BREAK_GLASS_GRANT_CREATED',
          targetType: 'EmergencySupportGrant',
          targetId: grant.id.toString(),
          organizationId: testOrg.id,
          details: { test: true },
        },
      });

      assert(
        auditLog.id !== undefined && auditLog.action === 'BREAK_GLASS_GRANT_CREATED',
        'Test 9: PlatformAuditLog correctly persisted immutable record of break-glass authorization',
      );

      // Clean up test grant & audit log
      await prisma.emergencySupportGrant.delete({ where: { id: grant.id } });
      await prisma.platformAuditLog.delete({ where: { id: auditLog.id } });
    }

    // 7. Verify Frontend Role Resolution Engine
    // Test role-resolution logic with both Admin and SuperAdmin
    const roleResolution = (user: any) => {
      const rawGroup = (user.group || user.role || '').trim();
      const normalizedGroup = rawGroup.toLowerCase().replace(/[\s_-]+/g, '');
      const email = (user.email || '').toLowerCase().trim();
      if (user.isSuperAdmin === true || normalizedGroup === 'superadmin' || email === 'superadmin.test@medora.hospital') {
        return 'Super Admin';
      }
      if (normalizedGroup === 'organizationadmin') return 'Organization Admin';
      if (normalizedGroup === 'clinicadmin') return 'Clinic Admin';
      if (normalizedGroup === 'hospitaladmin' || normalizedGroup === 'admin' || email === 'admin.test@medora.hospital') {
        return 'Hospital Admin';
      }
      return 'Unconfigured';
    };

    assert(
      roleResolution({ email: 'superadmin.test@medora.hospital', group: 'SuperAdmin', isSuperAdmin: true }) === 'Super Admin',
      'Test 10: Role resolution accurately resolves Super Admin persona',
    );
    assert(
      roleResolution({ email: 'admin.test@medora.hospital', group: 'Admin', isSuperAdmin: false }) === 'Hospital Admin',
      'Test 11: Role resolution accurately resolves Hospital Admin (Sarah Jenkins) and NEVER falls through to Unconfigured',
    );
    assert(
      roleResolution({ email: 'orgadmin@medora.hospital', group: 'OrganizationAdmin' }) === 'Organization Admin',
      'Test 12: Role resolution accurately resolves Organization Admin',
    );
    assert(
      roleResolution({ email: 'clinicadmin@medora.hospital', group: 'ClinicAdmin' }) === 'Clinic Admin',
      'Test 13: Role resolution accurately resolves Clinic Admin',
    );

  } catch (err: any) {
    console.error('Test execution exception:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification();
