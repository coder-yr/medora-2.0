import * as dotenv from 'dotenv';
dotenv.config();
import {
  PrismaClient,
  OrganizationType,
  OrganizationEdition,
  OrganizationStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { BranchAuthorizationService } from '../src/common/services/branch-authorization.service';
import { PatientService } from '../src/modules/patient/patient.service';
import { DepartmentService } from '../src/modules/department/department.service';
import { DoctorService } from '../src/modules/doctor/doctor.service';
import { AppointmentService } from '../src/modules/appointment/appointment.service';
import { ConsultationService } from '../src/modules/consultation/consultation.service';
import { PrescriptionService } from '../src/modules/prescription/prescription.service';
import { LaboratoryService } from '../src/modules/laboratory/laboratory.service';
import { PharmacyService } from '../src/modules/pharmacy/pharmacy.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ClinicalAccessGuard } from '../src/common/guards/clinical-access.guard';
import { AuthUser } from '../src/common/types/auth-user.interface';
import { NotificationOutboxService } from '../src/modules/notification/notification-outbox.service';
import { InAppNotificationProvider } from '../src/modules/notification/providers/in-app.provider';
import { DevMockEmailProvider } from '../src/modules/notification/providers/dev-mock-email.provider';
import { DevMockSmsProvider } from '../src/modules/notification/providers/dev-mock-sms.provider';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/medora?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runVerification() {
  console.log('================================================================');
  console.log('MEDORA 2.0 — PHASE 10.4 ADVERSARIAL CROSS-TENANT VALIDATION');
  console.log('Multi-Tenant Isolation, Authorization Hardening & Boundary Audit');
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
    const timestamp = Date.now();

    // -------------------------------------------------------------------------
    // 0. Seed Organizations and Branches
    // -------------------------------------------------------------------------
    console.log('[Step 0] Seeding Multi-Tenant Test Environment...');

    // Organization A (Clinic Tenant)
    const orgA = await prisma.organization.create({
      data: {
        name: `Tenant A Clinic ${timestamp}`,
        code: `CLINIC-A-${timestamp.toString().slice(-4)}`,
        type: OrganizationType.CLINIC,
        edition: OrganizationEdition.CLINIC,
        status: OrganizationStatus.ACTIVE,
      },
    });

    const branchA = await prisma.hospitalBranch.create({
      data: {
        organizationId: orgA.id,
        name: `Apex Main Clinic Branch ${timestamp}`,
        code: `APEX-BR-A-${timestamp.toString().slice(-4)}`,
        active: true,
      },
    });

    // Organization B (Hospital Tenant)
    const orgB = await prisma.organization.create({
      data: {
        name: `Tenant B Hospital ${timestamp}`,
        code: `HOSP-B-${timestamp.toString().slice(-4)}`,
        type: OrganizationType.HOSPITAL,
        edition: OrganizationEdition.HOSPITAL,
        status: OrganizationStatus.ACTIVE,
      },
    });

    const branchB = await prisma.hospitalBranch.create({
      data: {
        organizationId: orgB.id,
        name: `Horizon General Branch ${timestamp}`,
        code: `HORIZON-BR-B-${timestamp.toString().slice(-4)}`,
        active: true,
      },
    });

    // Organization C (Suspended Tenant)
    const orgC = await prisma.organization.create({
      data: {
        name: `Tenant C Suspended ${timestamp}`,
        code: `SUSP-C-${timestamp.toString().slice(-4)}`,
        type: OrganizationType.DIAGNOSTIC_CENTER,
        edition: OrganizationEdition.CLINIC,
        status: OrganizationStatus.SUSPENDED,
      },
    });

    const branchC = await prisma.hospitalBranch.create({
      data: {
        organizationId: orgC.id,
        name: `Suspended Center Branch ${timestamp}`,
        code: `SUSP-BR-C-${timestamp.toString().slice(-4)}`,
        active: true,
      },
    });

    // Seed Staff Users
    const hashedPassword = await argon2.hash('SecureStaffPass123!', { type: argon2.argon2id });

    const userA = await prisma.user.create({
      data: {
        login: `admin.orga.${timestamp}`,
        email: `admin.orga.${timestamp}@medora.hospital`,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'OrgA',
        group: 'OrganizationAdmin',
        organizationId: orgA.id,
        branchId: branchA.id,
      },
    });

    await prisma.userOrganizationMembership.create({
      data: {
        userId: userA.id,
        organizationId: orgA.id,
        accessRole: 'OrganizationAdmin',
        isActive: true,
        isDefault: true,
      },
    });

    await prisma.userBranchMembership.create({
      data: {
        userId: userA.id,
        branchId: branchA.id,
        isActive: true,
      },
    });

    const userB = await prisma.user.create({
      data: {
        login: `admin.orgb.${timestamp}`,
        email: `admin.orgb.${timestamp}@medora.hospital`,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'OrgB',
        group: 'OrganizationAdmin',
        organizationId: orgB.id,
        branchId: branchB.id,
      },
    });

    await prisma.userOrganizationMembership.create({
      data: {
        userId: userB.id,
        organizationId: orgB.id,
        accessRole: 'OrganizationAdmin',
        isActive: true,
        isDefault: true,
      },
    });

    await prisma.userBranchMembership.create({
      data: {
        userId: userB.id,
        branchId: branchB.id,
        isActive: true,
      },
    });

    const userC = await prisma.user.create({
      data: {
        login: `user.orgc.${timestamp}`,
        email: `user.orgc.${timestamp}@medora.hospital`,
        password: hashedPassword,
        firstName: 'User',
        lastName: 'OrgC',
        group: 'OrganizationAdmin',
        organizationId: orgC.id,
        branchId: branchC.id,
      },
    });

    await prisma.userOrganizationMembership.create({
      data: {
        userId: userC.id,
        organizationId: orgC.id,
        accessRole: 'OrganizationAdmin',
        isActive: true,
        isDefault: true,
      },
    });

    let superAdmin = await prisma.user.findFirst({
      where: { isSuperAdmin: true },
    });
    if (!superAdmin) {
      superAdmin = await prisma.user.create({
        data: {
          login: `superadmin.${timestamp}`,
          email: `superadmin.${timestamp}@medora.hospital`,
          password: hashedPassword,
          firstName: 'Super',
          lastName: 'Admin',
          group: 'SuperAdmin',
          isSuperAdmin: true,
        },
      });
    }

    // Auth contexts
    const authUserA: AuthUser = {
      id: userA.id.toString(),
      email: userA.email,
      name: 'Admin OrgA',
      group: 'OrganizationAdmin',
      permissions: ['*'],
      branchId: branchA.id,
      organizationId: orgA.id,
      organizationRole: 'OrganizationAdmin',
      isSuperAdmin: false,
    };

    const authUserB: AuthUser = {
      id: userB.id.toString(),
      email: userB.email,
      name: 'Admin OrgB',
      group: 'OrganizationAdmin',
      permissions: ['*'],
      branchId: branchB.id,
      organizationId: orgB.id,
      organizationRole: 'OrganizationAdmin',
      isSuperAdmin: false,
    };

    const authSuperAdmin: AuthUser = {
      id: superAdmin.id.toString(),
      email: superAdmin.email,
      name: 'Super Admin',
      group: 'SuperAdmin',
      permissions: ['*'],
      isSuperAdmin: true,
    };

    // Instantiate Services
    const branchAuth = new BranchAuthorizationService(prisma as any);
    const patientService = new PatientService(prisma as any, branchAuth);
    const departmentService = new DepartmentService(prisma as any);
    const doctorService = new DoctorService(prisma as any, departmentService);
    const appointmentService = new AppointmentService(prisma as any, patientService, doctorService, branchAuth);
    const consultationService = new ConsultationService(prisma as any, patientService, doctorService, appointmentService, branchAuth);
    const prescriptionService = new PrescriptionService(prisma as any, branchAuth);
    const laboratoryService = new LaboratoryService(prisma as any, branchAuth);
    const pharmacyService = new PharmacyService(prisma as any, branchAuth);

    const mockJwtService: any = {
      sign: () => 'mock-signed-jwt-token',
    };
    const mockPasswordReset: any = {};
    const mockAccountLockout: any = {};
    const authService = new AuthService(
      prisma as any,
      mockJwtService,
      mockPasswordReset,
      mockAccountLockout,
    );

    // Seed Clinical Records in Org A
    const patientA = await prisma.patient.create({
      data: {
        name: `John Doe OrgA ${timestamp}`,
        patientId: `P-${timestamp.toString().slice(-6)}`,
        sex: 'Male',
        age: '40',
        phone: '03001234567',
        branchId: branchA.id,
      },
    });

    const patientB = await prisma.patient.create({
      data: {
        name: `Jane Roe OrgB ${timestamp}`,
        patientId: `P-${(timestamp + 1).toString().slice(-6)}`,
        sex: 'Female',
        age: '35',
        phone: '03007654321',
        branchId: branchB.id,
      },
    });

    // Legacy unassigned patient (branchId = null)
    const patientLegacy = await prisma.patient.create({
      data: {
        name: `Legacy Branchless Patient ${timestamp}`,
        patientId: `P-${(timestamp + 2).toString().slice(-6)}`,
        sex: 'Other',
        age: '50',
        phone: '03009999999',
        branchId: null,
      },
    });

    // Create doctor in Org A
    const doctorA = await prisma.doctor.create({
      data: {
        name: `Dr. Smith OrgA ${timestamp}`,
        email: `dr.smith.${timestamp}@medora.hospital`,
        branchId: branchA.id,
        department: 'Cardiology',
        x: '',
        y: '',
      },
    });

    const appointmentA = await prisma.appointment.create({
      data: {
        patientId: patientA.id,
        doctorId: doctorA.id,
        branchId: branchA.id,
        date: new Date().toISOString().split('T')[0],
        sTime: '10:00',
        eTime: '10:30',
        status: 'CONFIRMED',
      },
    });

    const consultationA = await prisma.consultation.create({
      data: {
        patientId: patientA.id,
        doctorId: doctorA.id,
        appointmentId: appointmentA.id,
        date: new Date(),
        presentingComplaint: 'Chest pain',
        diagnosis: 'Angina',
      },
    });

    const prescriptionA = await prisma.prescription.create({
      data: {
        patientId: patientA.id,
        doctorId: doctorA.id,
        date: new Date().toISOString().split('T')[0],
        medicines: {
          create: [{ name: 'Aspirin', dosage: '100mg', duration: '30 days' }],
        },
      },
    });

    const labOrderA = await prisma.lab.create({
      data: {
        orderNumber: `LAB-${timestamp.toString().slice(-6)}`,
        patientId: patientA.id,
        doctorId: doctorA.id,
        date: new Date().toISOString().split('T')[0],
        status: 'PENDING',
      },
    });

    // Catalog medicine
    let medicine = await prisma.medicine.findFirst();
    if (!medicine) {
      medicine = await prisma.medicine.create({
        data: {
          name: `Amoxicillin ${timestamp}`,
          generic: 'Amoxicillin Trihydrate',
          company: 'MedPharma',
          price: 10.0,
          sPrice: 15.0,
          quantity: 0,
        },
      });
    }

    console.log('✓ Multi-Tenant Test Environment Seeded Successfully.\n');

    // -------------------------------------------------------------------------
    // Vector 1: Cross-Tenant Patient Demographic Read (Org B -> Org A)
    // -------------------------------------------------------------------------
    console.log('[Vector 1] Cross-Tenant Patient Demographic Read...');
    let blockedV1 = false;
    try {
      await patientService.findById(patientA.id.toString(), authUserB);
    } catch (err: any) {
      blockedV1 = err.status === 403 || err.message?.includes('denied');
    }
    assert(blockedV1, 'Org B Admin reading Org A Patient demographics denied with 403 Forbidden');

    // -------------------------------------------------------------------------
    // Vector 2: Cross-Tenant Patient Demographic Update (Org B -> Org A)
    // -------------------------------------------------------------------------
    console.log('[Vector 2] Cross-Tenant Patient Update...');
    let blockedV2 = false;
    try {
      await patientService.update(patientA.id.toString(), { name: 'Compromised Patient Name' }, authUserB);
    } catch (err: any) {
      blockedV2 = err.status === 403 || err.message?.includes('denied');
    }
    assert(blockedV2, 'Org B Admin updating Org A Patient demographics denied with 403 Forbidden');

    // -------------------------------------------------------------------------
    // Vector 3: Cross-Tenant Patient Deletion (Org B -> Org A)
    // -------------------------------------------------------------------------
    console.log('[Vector 3] Cross-Tenant Patient Deletion...');
    let blockedV3 = false;
    try {
      await patientService.remove(patientA.id.toString(), authUserB);
    } catch (err: any) {
      blockedV3 = err.status === 403 || err.message?.includes('denied');
    }
    assert(blockedV3, 'Org B Admin deleting Org A Patient denied with 403 Forbidden');

    // -------------------------------------------------------------------------
    // Vector 4: Patient Directory Tenant Scoping
    // -------------------------------------------------------------------------
    console.log('[Vector 4] Patient Directory Query Quarantine...');
    const listB = await patientService.findAll({}, authUserB);
    const leakedPatientA = listB.items.some((p) => String(p.id) === String(patientA.id));
    const foundPatientB = listB.items.some((p) => String(p.id) === String(patientB.id));
    assert(!leakedPatientA && foundPatientB, 'Patient directory strictly returns Org B patients with 0 Org A records');

    // -------------------------------------------------------------------------
    // Vector 5: Legacy Unassigned Patient Quarantine
    // -------------------------------------------------------------------------
    console.log('[Vector 5] Legacy Unassigned (branchless) Patient Access Control...');
    let blockedV5 = false;
    try {
      await patientService.findById(patientLegacy.id.toString(), authUserB);
    } catch (err: any) {
      blockedV5 = err.status === 403 || err.message?.includes('denied');
    }
    assert(blockedV5, 'Secondary tenant (Org B) access to unscoped legacy records denied with 403 Forbidden');

    // -------------------------------------------------------------------------
    // Vector 6: Pharmacy Batch Compound Unique Key Collision Independence
    // -------------------------------------------------------------------------
    console.log('[Vector 6] Pharmacy Batch Compound Unique Constraint Independence...');
    const sharedBatchNumber = `LOT-SHARED-${timestamp.toString().slice(-4)}`;

    const batchA = await pharmacyService.createBatch(
      {
        medicineId: Number(medicine.id),
        batchNumber: sharedBatchNumber,
        expiryDate: '2028-12-31',
        costPrice: 10.0,
        sellingPrice: 15.0,
        quantity: 100,
        branchId: Number(branchA.id),
      },
      userA.id.toString(),
      authUserA,
    );

    const batchB = await pharmacyService.createBatch(
      {
        medicineId: Number(medicine.id),
        batchNumber: sharedBatchNumber,
        expiryDate: '2028-12-31',
        costPrice: 12.0,
        sellingPrice: 18.0,
        quantity: 50,
        branchId: Number(branchB.id),
      },
      userB.id.toString(),
      authUserB,
    );

    assert(
      Boolean(batchA && batchB && batchA.id !== batchB.id),
      'Org A and Org B successfully registered identical batch number on same medicine without collision',
    );

    // -------------------------------------------------------------------------
    // Vector 7: Cross-Tenant Medicine Batch Read
    // -------------------------------------------------------------------------
    console.log('[Vector 7] Cross-Tenant Medicine Batch Access Control...');
    let blockedV7 = false;
    try {
      await pharmacyService.getBatchById(batchA.id, authUserB);
    } catch (err: any) {
      blockedV7 = err.status === 403 || err.message?.includes('denied');
    }
    assert(blockedV7, 'Org B reading Org A medicine batch by ID denied with 403 Forbidden');

    // -------------------------------------------------------------------------
    // Vector 8: Cross-Tenant Stock Theft via Dispensation
    // -------------------------------------------------------------------------
    console.log('[Vector 8] Cross-Tenant Stock Theft Prevention...');
    let blockedV8 = false;
    try {
      await pharmacyService.dispense(
        {
          items: [
            {
              medicineId: Number(medicine.id),
              batchId: Number(batchA.id), // Trying to dispense Org A batch from Org B
              quantity: 10,
            },
          ],
          dispenseDate: new Date().toISOString().split('T')[0],
          branchId: Number(branchB.id),
        },
        userB.id.toString(),
        authUserB,
      );
    } catch (err: any) {
      blockedV8 = err.status === 403 || err.status === 400 || err.message?.includes('denied');
    }
    assert(blockedV8, 'Org B attempting to dispense Org A inventory batch blocked with 403/400');

    // -------------------------------------------------------------------------
    // Vector 9: Pharmacy Valuation Report Tenant Isolation
    // -------------------------------------------------------------------------
    console.log('[Vector 9] Pharmacy Valuation Report Scoping...');
    const valuationB = await pharmacyService.getValuationReport(authUserB);
    const batchAInValuation = valuationB.breakdown.some((b: any) => b.batchId === batchA.id.toString());
    const batchBInValuation = valuationB.breakdown.some((b: any) => b.batchId === batchB.id.toString());
    assert(
      !batchAInValuation && batchBInValuation,
      'Org B inventory valuation strictly includes only Org B stock (0 Org A inventory included)',
    );

    // -------------------------------------------------------------------------
    // Vector 10: Cross-Tenant Appointment Read
    // -------------------------------------------------------------------------
    console.log('[Vector 10] Cross-Tenant Appointment Access Control...');
    let blockedV10 = false;
    try {
      await appointmentService.findOne(appointmentA.id.toString(), authUserB);
    } catch (err: any) {
      blockedV10 = err.status === 403 || err.message?.includes('denied');
    }
    assert(blockedV10, 'Org B Admin reading Org A Appointment by ID denied with 403 Forbidden');

    // -------------------------------------------------------------------------
    // Vector 11: Cross-Tenant Consultation Read
    // -------------------------------------------------------------------------
    console.log('[Vector 11] Cross-Tenant Consultation Access Control...');
    let blockedV11 = false;
    try {
      await consultationService.findOne(consultationA.id.toString(), authUserB);
    } catch (err: any) {
      blockedV11 = err.status === 403 || err.message?.includes('denied');
    }
    assert(blockedV11, 'Org B Admin reading Org A Consultation by ID denied with 403 Forbidden');

    // -------------------------------------------------------------------------
    // Vector 12: Cross-Tenant Prescription Read
    // -------------------------------------------------------------------------
    console.log('[Vector 12] Cross-Tenant Prescription Access Control...');
    let blockedV12 = false;
    try {
      await prescriptionService.findById(prescriptionA.id, authUserB);
    } catch (err: any) {
      blockedV12 = err.status === 403 || err.message?.includes('denied');
    }
    assert(blockedV12, 'Org B Admin reading Org A Prescription by ID denied with 403 Forbidden');

    // -------------------------------------------------------------------------
    // Vector 13: Cross-Tenant Lab Order Read
    // -------------------------------------------------------------------------
    console.log('[Vector 13] Cross-Tenant Laboratory Order Access Control...');
    let blockedV13 = false;
    try {
      await laboratoryService.getOrderById(Number(labOrderA.id), authUserB);
    } catch (err: any) {
      blockedV13 = err.status === 403 || err.message?.includes('denied');
    }
    assert(blockedV13, 'Org B Admin reading Org A Lab Order by ID denied with 403 Forbidden');

    // -------------------------------------------------------------------------
    // Vector 14: Platform Super Admin Clinical Boundary (Without Break-Glass)
    // -------------------------------------------------------------------------
    console.log('[Vector 14] Super Admin Default Clinical Access Block (Zero-Trust Boundary)...');
    const mockReflector: any = {
      getAllAndOverride: () => true, // ProtectClinicalAccess is TRUE
    };
    const clinicalGuard = new ClinicalAccessGuard(mockReflector, prisma as any);

    const mockExecutionContext = (user: AuthUser, orgId?: string | bigint): any => ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params: { organizationId: orgId ? orgId.toString() : undefined },
          headers: {},
          url: '/api/v1/patients/demographics',
        }),
      }),
    });

    let superAdminBlocked = false;
    try {
      await clinicalGuard.canActivate(mockExecutionContext(authSuperAdmin, orgA.id));
    } catch (err: any) {
      superAdminBlocked = err.status === 403 || err.message?.includes('restricted');
    }

    const blockedAudit = await prisma.platformAuditLog.findFirst({
      where: {
        actorUserId: superAdmin.id,
        action: 'CLINICAL_ACCESS_BLOCKED',
      },
      orderBy: { id: 'desc' },
    });

    assert(
      superAdminBlocked && Boolean(blockedAudit),
      'Super Admin without active Emergency Support Grant denied with 403 and CLINICAL_ACCESS_BLOCKED logged',
    );

    // -------------------------------------------------------------------------
    // Vector 15: Platform Super Admin Clinical Access with Active Break-Glass Grant
    // -------------------------------------------------------------------------
    console.log('[Vector 15] Super Admin Clinical Access with Active Emergency Grant...');
    const emergencyGrant = await prisma.emergencySupportGrant.create({
      data: {
        grantedToUserId: superAdmin.id,
        organizationId: orgA.id,
        authorizedById: userA.id,
        requestedReason: 'Investigating high-priority clinical sync incident',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour grant
        isRevoked: false,
      },
    });

    const superAdminAllowed = await clinicalGuard.canActivate(
      mockExecutionContext(authSuperAdmin, orgA.id),
    );

    const grantAudit = await prisma.platformAuditLog.findFirst({
      where: {
        actorUserId: superAdmin.id,
        action: 'CLINICAL_ACCESS_BREAK_GLASS',
      },
      orderBy: { id: 'desc' },
    });

    assert(
      superAdminAllowed === true && Boolean(grantAudit),
      'Super Admin with active Emergency Support Grant permitted with 200 and CLINICAL_ACCESS_BREAK_GLASS logged',
    );

    // Revoke grant to restore boundary
    await prisma.emergencySupportGrant.update({
      where: { id: emergencyGrant.id },
      data: { isRevoked: true },
    });

    // -------------------------------------------------------------------------
    // Vector 16: Workspace Switching Boundary (No Membership in Target Org)
    // -------------------------------------------------------------------------
    console.log('[Vector 16] Organization Workspace Switch Isolation...');
    let switchBlocked = false;
    try {
      // User B attempts to switch context into Org A where they have no membership
      await authService.switchOrganization(authUserB, orgA.id.toString());
    } catch (err: any) {
      switchBlocked = err.status === 403 || err.message?.includes('active membership');
    }
    assert(
      switchBlocked,
      'Switching workspace into an organization without active membership denied with 403 Forbidden',
    );

    // -------------------------------------------------------------------------
    // Vector 17: Workspace Switching into Suspended Organization
    // -------------------------------------------------------------------------
    console.log('[Vector 17] Suspended Organization Workspace Switch Prevention...');
    let suspendedSwitchBlocked = false;
    try {
      // User C attempts to switch into Org C (which is SUSPENDED)
      await authService.switchOrganization(
        { ...authUserB, id: userC.id.toString(), email: userC.email },
        orgC.id.toString(),
      );
    } catch (err: any) {
      suspendedSwitchBlocked = err.status === 403 || err.message?.includes('suspended');
    }
    assert(
      suspendedSwitchBlocked,
      'Switching workspace into a SUSPENDED organization denied with 403 Forbidden',
    );

    // -------------------------------------------------------------------------
    // Vector 18: Notification Outbox Worker Tenant Quarantine (Suspended Org)
    // -------------------------------------------------------------------------
    console.log('[Vector 18] Background Queue / Outbox Suspension Quarantine...');
    const inAppProvider = new InAppNotificationProvider();
    const emailProvider = new DevMockEmailProvider();
    const smsProvider = new DevMockSmsProvider();
    const outboxService = new NotificationOutboxService(
      prisma as any,
      inAppProvider,
      emailProvider,
      smsProvider,
    );

    // Seed notification job for suspended Org C
    const notifC = await prisma.notification.create({
      data: {
        eventType: 'EMERGENCY_DRILL',
        channel: 'EMAIL',
        title: 'Emergency Drill Alert',
        message: 'Drill scheduled for tomorrow',
        branchId: branchC.id,
        status: 'PENDING',
        recipients: {
          create: [{ destination: userC.email, userId: userC.id }],
        },
      },
    });

    const outboxJobC = await prisma.notificationOutbox.create({
      data: {
        notificationId: notifC.id,
        channel: 'EMAIL',
        status: 'PENDING',
        attempts: 0,
        scheduledAt: new Date(),
      },
    });

    // Run outbox cycle
    await outboxService.processPendingOutbox(10);

    const updatedOutbox = await prisma.notificationOutbox.findUnique({
      where: { id: outboxJobC.id },
    });

    assert(
      Boolean(updatedOutbox?.status === 'FAILED' && updatedOutbox?.lastError?.includes('SUSPENDED')),
      'Background outbox worker correctly pauses and fails dispatches for suspended organizations',
    );

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests} (100% Isolation Score)`);
    console.log('Zero Cross-Tenant Leaks. Complete Multi-Tenant Boundary Verified.');
    console.log('================================================================\n');
  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED WITH EXCEPTION:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runVerification();
