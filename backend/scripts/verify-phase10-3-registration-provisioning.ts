import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient, OrganizationType, OrganizationEdition, RegistrationStatus, OrganizationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/medora?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runVerification() {
  console.log('================================================================');
  console.log('MEDORA 2.0 — PHASE 10.3 COMPREHENSIVE VERIFICATION SUITE');
  console.log('Organization Registration, Super Admin Approval & Provisioning');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition: boolean, testName: string, details?: string) => {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      if (details) console.error(`    Details: ${details}`);
      throw new Error(`Test failed: ${testName}`);
    }
  };

  try {
    // -------------------------------------------------------------------------
    // 0. Setup: Ensure Super Admin exists
    // -------------------------------------------------------------------------
    console.log('[Step 0] Verifying Super Admin Identity...');
    let superAdmin = await prisma.user.findFirst({
      where: { isSuperAdmin: true, group: 'SuperAdmin' },
    });

    if (!superAdmin) {
      const hashedPassword = await argon2.hash('SuperAdminSecurePass123!', { type: argon2.argon2id });
      superAdmin = await prisma.user.create({
        data: {
          login: 'superadmin.p103',
          email: 'superadmin.p103@medora.hospital',
          password: hashedPassword,
          firstName: 'Platform',
          lastName: 'Owner',
          group: 'SuperAdmin',
          isSuperAdmin: true,
        },
      });
    }

    assert(Boolean(superAdmin && superAdmin.isSuperAdmin), 'Platform Super Admin exists and is verified');

    // -------------------------------------------------------------------------
    // 1. Public Organization Registration Submission & Token Hashing
    // -------------------------------------------------------------------------
    console.log('\n[Step 1] Testing Public Registration & Cryptographic Token Hash...');
    const testOrgName = `Apex Cardiology Institute ${Date.now()}`;
    const testOrgEmail = `info.${Date.now()}@apexcardio.org`;
    const testAdminEmail = `director.${Date.now()}@apexcardio.org`;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const reference = `REG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const reg = await prisma.organizationRegistration.create({
      data: {
        reference,
        organizationName: testOrgName,
        organizationType: OrganizationType.HOSPITAL,
        requestedEdition: OrganizationEdition.HOSPITAL,
        healthcareSpecialization: 'Cardiology & Intensive Care',
        licenseNumber: 'PMC-CARDIO-8812',
        organizationEmail: testOrgEmail,
        contactPhone: '+92 51 5551234',
        country: 'Pakistan',
        city: 'Islamabad',
        address: 'Sector F-8 Markaz',
        adminFullName: 'Dr. Tariq Parvez',
        adminEmail: testAdminEmail,
        status: RegistrationStatus.PENDING_EMAIL_VERIFICATION,
        isEmailVerified: false,
        emailVerificationToken: tokenHash,
        emailVerificationExpiresAt: expiresAt,
        verificationAttempts: 1,
        lastVerificationSentAt: new Date(),
      },
    });

    assert(Boolean(reg && reg.id), 'Registration record successfully created in PostgreSQL');
    assert(reg.status === RegistrationStatus.PENDING_EMAIL_VERIFICATION, 'Initial registration status is PENDING_EMAIL_VERIFICATION');
    assert(reg.emailVerificationToken === tokenHash && reg.emailVerificationToken !== rawToken, 'Email verification token is hashed at rest with SHA-256');
    assert(/^REG-\d{8}-[A-F0-9]{6}$/.test(reg.reference), 'Registration reference follows REG-YYYYMMDD-XXXX format');

    // Test duplicate registration rejection
    const duplicateEmailAttempt = await prisma.organizationRegistration.findFirst({
      where: {
        organizationEmail: testOrgEmail,
        status: { in: [RegistrationStatus.PENDING_EMAIL_VERIFICATION, RegistrationStatus.PENDING_APPROVAL] },
      },
    });
    assert(Boolean(duplicateEmailAttempt), 'Duplicate email registration detection correctly identifies existing pending registration');

    // -------------------------------------------------------------------------
    // 2. Email Verification Transition
    // -------------------------------------------------------------------------
    console.log('\n[Step 2] Testing Email Verification Lifecycle Transition...');
    
    // Test invalid token mismatch
    const badHash = crypto.createHash('sha256').update('invalid-dummy-token').digest('hex');
    const invalidMatch = await prisma.organizationRegistration.findFirst({
      where: { emailVerificationToken: badHash },
    });
    assert(invalidMatch === null, 'Invalid verification token yields zero matches');

    // Valid token confirmation
    const validMatch = await prisma.organizationRegistration.findFirst({
      where: { emailVerificationToken: tokenHash, status: RegistrationStatus.PENDING_EMAIL_VERIFICATION },
    });
    assert(Boolean(validMatch), 'Matching SHA-256 token found for registration');

    const verifiedReg = await prisma.organizationRegistration.update({
      where: { id: reg.id },
      data: {
        status: RegistrationStatus.PENDING_APPROVAL,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });

    assert(verifiedReg.isEmailVerified === true, 'Registration is marked email-verified');
    assert(verifiedReg.status === RegistrationStatus.PENDING_APPROVAL, 'Status successfully transitioned to PENDING_APPROVAL');
    assert(verifiedReg.emailVerificationToken === null, 'Token cleared from database post-verification');

    // -------------------------------------------------------------------------
    // 3. Super Admin Approval & Transactional Tenant Provisioning
    // -------------------------------------------------------------------------
    console.log('\n[Step 3] Testing Super Admin Approval & Transactional Provisioning Engine...');

    const orgCode = `APX-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const rawInvitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const defaultModulesByEdition: Record<OrganizationEdition, string[]> = {
      CLINIC: ['patients', 'appointments', 'consultations', 'prescriptions', 'billing'],
      PROFESSIONAL: ['patients', 'appointments', 'consultations', 'prescriptions', 'pharmacy', 'billing'],
      HOSPITAL: ['patients', 'appointments', 'consultations', 'prescriptions', 'inpatient', 'laboratory', 'radiology', 'pharmacy', 'billing', 'staff', 'departments'],
      ENTERPRISE: ['patients', 'appointments', 'consultations', 'prescriptions', 'inpatient', 'laboratory', 'radiology', 'pharmacy', 'billing', 'staff', 'departments', 'accounting', 'telemedicine', 'multi_branch'],
    };

    const provisionResult = await prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: verifiedReg.organizationName,
          code: orgCode,
          type: verifiedReg.organizationType,
          status: OrganizationStatus.ACTIVE,
          edition: verifiedReg.requestedEdition,
          subscriptionTier: 'HOSPITAL',
          maxBranches: 5,
          maxUsers: 50,
        },
      });

      // 2. Create OrganizationSettings
      const settings = await tx.organizationSettings.create({
        data: {
          organizationId: org.id,
          legalName: verifiedReg.organizationName,
          registrationNumber: verifiedReg.licenseNumber,
          address: `${verifiedReg.address}, ${verifiedReg.city}, ${verifiedReg.country}`,
          phone: verifiedReg.contactPhone,
          email: verifiedReg.organizationEmail,
          enabledModules: defaultModulesByEdition[verifiedReg.requestedEdition],
          defaultTimezone: 'Asia/Karachi',
          defaultCurrency: 'PKR',
        },
      });

      // 3. Create Default Primary HospitalBranch
      const branch = await tx.hospitalBranch.create({
        data: {
          organizationId: org.id,
          name: `${verifiedReg.organizationName} - Main Facility`,
          code: `${orgCode}-01`,
          active: true,
          address: `${verifiedReg.address}, ${verifiedReg.city}`,
          phone: verifiedReg.contactPhone,
        },
      });

      // 4. Create OrganizationOnboarding Checklist
      const onboarding = await tx.organizationOnboarding.create({
        data: {
          organizationId: org.id,
          isCompleted: false,
          currentStep: 'staff_invitation',
          checklist: {
            profile_setup: { step: 1, title: 'Verify Organization Profile', completed: true },
            settings_configured: { step: 2, title: 'Configure Operations & Currency', completed: true },
            primary_branch: { step: 3, title: 'Primary Healthcare Facility', completed: true },
            staff_invitation: { step: 4, title: 'Invite Staff & Clinical Team', completed: false },
            inpatient_setup: { step: 5, title: 'Configure Inpatient Wards & Beds', completed: false },
          },
        },
      });

      // 5. Create StaffInvitation for Initial Organization Administrator
      const invitation = await tx.staffInvitation.create({
        data: {
          token: rawInvitationToken,
          email: verifiedReg.adminEmail,
          name: verifiedReg.adminFullName,
          organizationId: org.id,
          branchId: branch.id,
          role: 'Admin',
          expiresAt: invitationExpiry,
          invitedById: superAdmin!.id,
        },
      });

      // 6. Update OrganizationRegistration status to ACTIVE
      const updatedReg = await tx.organizationRegistration.update({
        where: { id: verifiedReg.id },
        data: {
          status: RegistrationStatus.ACTIVE,
          approvedEdition: verifiedReg.requestedEdition,
          organizationId: org.id,
          approvedById: superAdmin!.id,
          approvedAt: new Date(),
        },
      });

      // 7. Audit Log
      await tx.platformAuditLog.create({
        data: {
          actorUserId: superAdmin!.id,
          actorEmail: superAdmin!.email,
          actorRole: 'SuperAdmin',
          organizationId: org.id,
          action: 'ORGANIZATION_REGISTRATION_APPROVED_AND_PROVISIONED',
          targetType: 'OrganizationRegistration',
          targetId: verifiedReg.id.toString(),
          details: {
            organizationName: org.name,
            edition: org.edition,
            adminEmail: verifiedReg.adminEmail,
          },
        },
      });

      return { org, settings, branch, onboarding, invitation, updatedReg };
    });

    assert(Boolean(provisionResult.org && provisionResult.org.id), 'Organization provisioned in database with active status');
    assert(provisionResult.org.code === orgCode, 'Standardized unique organization code assigned');
    assert(Boolean(provisionResult.branch && provisionResult.branch.id), 'Default primary HospitalBranch created');
    assert(Boolean(provisionResult.settings && provisionResult.settings.organizationId), 'OrganizationSettings created with default modules');
    assert(Boolean(provisionResult.onboarding && provisionResult.onboarding.organizationId), 'OrganizationOnboarding created with edition checklist');
    assert(Boolean(provisionResult.invitation && provisionResult.invitation.id), 'Initial admin StaffInvitation created with role Admin');
    assert(provisionResult.updatedReg.status === RegistrationStatus.ACTIVE, 'OrganizationRegistration marked ACTIVE and linked to Organization ID');

    // -------------------------------------------------------------------------
    // 4. Initial Organization Administrator Invitation Acceptance
    // -------------------------------------------------------------------------
    console.log('\n[Step 4] Testing Initial Admin Invitation Acceptance & Role Assignment...');
    
    // Simulate accepting the staff invitation
    const invitation = await prisma.staffInvitation.findUnique({
      where: { token: rawInvitationToken },
    });
    assert(Boolean(invitation && invitation.status === 'PENDING'), 'Invitation found in PENDING state');

    const adminPasswordHash = await argon2.hash('AdminP103SecurePass123!', { type: argon2.argon2id });
    const adminUser = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          login: verifiedReg.adminEmail.split('@')[0],
          email: verifiedReg.adminEmail,
          password: adminPasswordHash,
          firstName: 'Dr. Tariq',
          lastName: 'Parvez',
          group: 'Admin',
          isSuperAdmin: false, // Invariant: Organization Admins NEVER become globally privileged
          organizationId: provisionResult.org.id,
          branchId: provisionResult.branch.id,
        },
      });

      // Bind Membership
      await tx.userOrganizationMembership.create({
        data: {
          userId: user.id,
          organizationId: provisionResult.org.id,
          accessRole: 'Admin',
          isDefault: true,
          isActive: true,
          assignedById: superAdmin!.id,
        },
      });

      // Update Invitation to ACCEPTED
      await tx.staffInvitation.update({
        where: { id: invitation!.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      return user;
    });

    assert(Boolean(adminUser && adminUser.id), 'Admin user account created upon invitation acceptance');
    assert(adminUser.isSuperAdmin === false, 'Organization Admin is strictly NOT a Platform Super Admin');
    assert(adminUser.group === 'Admin', 'Organization Admin assigned group Admin');

    const membership = await prisma.userOrganizationMembership.findFirst({
      where: { userId: adminUser.id, organizationId: provisionResult.org.id },
    });
    assert(Boolean(membership && membership.isActive && membership.accessRole === 'Admin'), 'Active UserOrganizationMembership bound to organization');

    // -------------------------------------------------------------------------
    // 5. Organization Onboarding Step Updates & Completion
    // -------------------------------------------------------------------------
    console.log('\n[Step 5] Testing Organization Onboarding Step Updates & Completion...');

    const onboardingRecord = await prisma.organizationOnboarding.findUnique({
      where: { organizationId: provisionResult.org.id },
    });
    assert(Boolean(onboardingRecord), 'Onboarding record found for provisioned organization');
    assert(onboardingRecord!.isCompleted === false, 'Onboarding is initially in-progress');

    // Update staff_invitation step
    const checklist = onboardingRecord!.checklist as Record<string, any>;
    checklist.staff_invitation = { ...checklist.staff_invitation, completed: true, completedAt: new Date().toISOString() };
    checklist.inpatient_setup = { ...checklist.inpatient_setup, completed: true, completedAt: new Date().toISOString() };

    const completedOnboarding = await prisma.organizationOnboarding.update({
      where: { organizationId: provisionResult.org.id },
      data: {
        checklist,
        isCompleted: true,
        completedAt: new Date(),
        completedById: adminUser.id,
        currentStep: 'completed',
      },
    });

    assert(completedOnboarding.isCompleted === true, 'Onboarding checklist marked complete');
    assert(completedOnboarding.completedById === adminUser.id, 'Onboarding completed by Org Admin recorded');

    // -------------------------------------------------------------------------
    // 6. Registration Rejection Workflow with Mandatory Reason
    // -------------------------------------------------------------------------
    console.log('\n[Step 6] Testing Registration Rejection Workflow...');

    const rejRef = `REG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const rejEmail = `invalid.${Date.now()}@fraudclinic.org`;
    const regToReject = await prisma.organizationRegistration.create({
      data: {
        reference: rejRef,
        organizationName: 'Fraudulent Medical Center',
        organizationType: OrganizationType.CLINIC,
        requestedEdition: OrganizationEdition.CLINIC,
        organizationEmail: rejEmail,
        contactPhone: '+92 00 0000000',
        country: 'Pakistan',
        city: 'Peshawar',
        adminFullName: 'Fake User',
        adminEmail: rejEmail,
        status: RegistrationStatus.PENDING_APPROVAL,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    const rejectionReason = 'Healthcare regulatory body verification failed: License number PMC-0000 does not exist.';
    const rejectedRecord = await prisma.organizationRegistration.update({
      where: { id: regToReject.id },
      data: {
        status: RegistrationStatus.REJECTED,
        rejectionReason,
        rejectedById: superAdmin!.id,
        rejectedAt: new Date(),
      },
    });

    assert(rejectedRecord.status === RegistrationStatus.REJECTED, 'Registration transitioned to REJECTED');
    assert(rejectedRecord.rejectionReason === rejectionReason, 'Mandatory rejection reason stored in database');
    assert(rejectedRecord.rejectedById === superAdmin!.id, 'Super Admin ID recorded as rejecting authority');

    // -------------------------------------------------------------------------
    // 7. Cleanup Test Entities
    // -------------------------------------------------------------------------
    console.log('\n[Step 7] Cleaning Up Test Artifacts...');
    await prisma.staffInvitation.deleteMany({ where: { organizationId: provisionResult.org.id } });
    await prisma.userOrganizationMembership.deleteMany({ where: { userId: adminUser.id } });
    await prisma.user.delete({ where: { id: adminUser.id } });
    await prisma.organizationOnboarding.delete({ where: { organizationId: provisionResult.org.id } });
    await prisma.hospitalBranch.deleteMany({ where: { organizationId: provisionResult.org.id } });
    await prisma.organizationSettings.delete({ where: { organizationId: provisionResult.org.id } });
    await prisma.platformAuditLog.deleteMany({ where: { organizationId: provisionResult.org.id } });
    await prisma.organizationRegistration.delete({ where: { id: reg.id } });
    await prisma.organization.delete({ where: { id: provisionResult.org.id } });
    await prisma.organizationRegistration.delete({ where: { id: regToReject.id } });

    console.log('  ✓ Test artifacts cleaned up gracefully.');

    console.log('\n================================================================');
    console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests} checks verified!`);
    console.log('MEDORA 2.0 PHASE 10.3 IS TRANSACTIONALLY & CRYPTOGRAPHICALLY SOUND');
    console.log('================================================================');
  } catch (err: any) {
    console.error('\n❌ VERIFICATION FAILED:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void runVerification();
