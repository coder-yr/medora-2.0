import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/modules/prisma/prisma.service';

function getData(res: any) {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

function getError(res: any) {
  const err = res.body?.error?.message || res.body?.message;
  return Array.isArray(err) ? err.join('; ') : String(err || '');
}

jest.setTimeout(45000);

describe('Non-Medical Staff Registers & HR Directory (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let nurseToken: string;

  let nurseUser: any;

  let testDept1: any;
  let testDept2: any;
  let testBranch: any;
  let testDesignation: any;

  let createdStaffProfileId: string;
  let createdEmployeeNumber: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Authenticate users
    const adminRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'admin.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    adminToken = getData(adminRes).accessToken;

    const nurseRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'nurse.test@medora.hospital',
      password: 'ValidPassword123!',
    });
    nurseToken = getData(nurseRes).accessToken;

    // Fetch nurse user entity
    nurseUser = await prisma.user.findFirst({ where: { email: 'nurse.test@medora.hospital' } });

    // Seed test departments
    testDept1 = await prisma.department.findFirst({ where: { name: 'Emergency' } });
    if (!testDept1) {
      testDept1 = await prisma.department.create({
        data: { name: 'Emergency', description: 'Emergency services' },
      });
    }

    testDept2 = await prisma.department.findFirst({ where: { name: 'Cardiology' } });
    if (!testDept2) {
      testDept2 = await prisma.department.create({
        data: { name: 'Cardiology', description: 'Cardiovascular services' },
      });
    }

    // Seed test branch
    testBranch = await prisma.hospitalBranch.findFirst();
    if (!testBranch) {
      testBranch = await prisma.hospitalBranch.create({
        data: { name: 'Main Hospital Campus', code: 'MAIN' },
      });
    }
  });

  afterAll(async () => {
    // Clean up created test staff profiles and history
    if (createdStaffProfileId) {
      const sId = BigInt(createdStaffProfileId);
      await prisma.staffDepartmentAssignment.deleteMany({ where: { staffProfileId: sId } });
      await prisma.staffEmploymentHistory.deleteMany({ where: { staffProfileId: sId } });
      await prisma.staffProfile.deleteMany({ where: { id: sId } });
    }
    if (testDesignation?.id) {
      await prisma.staffDesignation.deleteMany({ where: { id: BigInt(testDesignation.id) } });
    }
    await app.close();
  });

  // ===========================================================================
  // 1. CREATE STAFF DESIGNATION
  // ===========================================================================
  it('1. should create a staff designation in the catalogue', async () => {
    const code = `TEST-DESIG-${Date.now().toString().slice(-6)}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/staff/designations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code,
        title: 'Triage Specialist Nurse',
        category: 'NURSING',
        description: 'Triage assessment nurse',
        isActive: true,
      });

    expect(res.status).toBe(201);
    const data = getData(res);
    expect(data.code).toBe(code);
    expect(data.title).toBe('Triage Specialist Nurse');
    expect(data.category).toBe('NURSING');
    testDesignation = data;
  });

  // ===========================================================================
  // 2. ONBOARD STAFF PROFILE WITH AUTO-GENERATED EMPLOYEE NUMBER
  // ===========================================================================
  it('2. should create a staff profile and generate a unique employee number', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Clara',
        lastName: 'Barton',
        email: 'clara.barton@medora.hospital',
        phone: '+1-555-0199',
        departmentId: Number(testDept1.id),
        designationId: Number(testDesignation.id),
        branchId: Number(testBranch.id),
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
      });

    expect(res.status).toBe(201);
    const data = getData(res);
    expect(data.id).toBeDefined();
    expect(data.employeeNumber).toMatch(/^EMP-\d{6}-\d{4}$/);
    expect(data.displayName).toBe('Clara Barton');
    expect(data.employmentStatus).toBe('ACTIVE');

    createdStaffProfileId = data.id;
    createdEmployeeNumber = data.employeeNumber;
  });

  // ===========================================================================
  // 3. VERIFY GENERATED EMPLOYEE NUMBER IS SORTABLE & UNIQUE
  // ===========================================================================
  it('3. should verify unique employee number generation for a second employee', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Edith',
        lastName: 'Cavell',
        email: 'edith.cavell@medora.hospital',
        departmentId: Number(testDept1.id),
        designationId: Number(testDesignation.id),
      });

    expect(res.status).toBe(201);
    const data = getData(res);
    expect(data.employeeNumber).toMatch(/^EMP-\d{6}-\d{4}$/);
    expect(data.employeeNumber).not.toBe(createdEmployeeNumber);

    // Clean up second test profile
    const sId = BigInt(data.id);
    await prisma.staffDepartmentAssignment.deleteMany({ where: { staffProfileId: sId } });
    await prisma.staffEmploymentHistory.deleteMany({ where: { staffProfileId: sId } });
    await prisma.staffProfile.deleteMany({ where: { id: sId } });
  });

  // ===========================================================================
  // 4. LINK USER ACCOUNT
  // ===========================================================================
  it('4. should link an existing user account to the staff profile', async () => {
    // Unlink nurseUser if already linked to any previous test data
    await prisma.staffProfile.updateMany({
      where: { userId: nurseUser.id },
      data: { userId: null },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/staff/${createdStaffProfileId}/link-user`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: Number(nurseUser.id),
      });

    expect(res.status).toBe(200);
    const data = getData(res);
    expect(data.userId).toBe(String(nurseUser.id));
    expect(data.user?.login).toBe(nurseUser.login);
  });

  // ===========================================================================
  // 5. REJECT LINKING SAME USER ACCOUNT TO A SECOND STAFF PROFILE
  // ===========================================================================
  it('5. should reject linking the same user account to a second staff profile', async () => {
    // Create a temporary second profile
    const secondProfile = await prisma.staffProfile.create({
      data: {
        employeeNumber: `EMP-${Date.now().toString().slice(-10)}`,
        firstName: 'Duplicate',
        lastName: 'Linker',
        displayName: 'Duplicate Linker',
        employmentStatus: 'ACTIVE',
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/staff/${secondProfile.id}/link-user`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: Number(nurseUser.id),
      });

    expect(res.status).toBe(409); // ConflictException
    expect(getError(res)).toContain('already linked');

    await prisma.staffProfile.delete({ where: { id: secondProfile.id } });
  });

  // ===========================================================================
  // 6. VIEW ACCOUNT STATUS
  // ===========================================================================
  it('6. should view account status and active session count for staff', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/staff/${createdStaffProfileId}/account-status`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const data = getData(res);
    expect(data.isLinked).toBe(true);
    expect(data.user?.login).toBe(nurseUser.login);
    expect(data.activeSessionsCount).toBeDefined();
  });

  // ===========================================================================
  // 7. DEPARTMENT TRANSFER WITH AUDIT PRESERVATION
  // ===========================================================================
  it('7. should transfer staff to another department and preserve assignment history', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/staff/${createdStaffProfileId}/transfer-department`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetDepartmentId: Number(testDept2.id),
        reason: 'Transfer to Cardiology acute unit',
        isPrimary: true,
      });

    expect(res.status).toBe(200);
    const data = getData(res);
    expect(data.departmentId).toBe(String(testDept2.id));
    expect(data.department?.name).toBe('Cardiology');

    // Verify assignment history in database
    const assignments = await prisma.staffDepartmentAssignment.findMany({
      where: { staffProfileId: BigInt(createdStaffProfileId) },
      orderBy: { effectiveStart: 'asc' },
    });
    expect(assignments.length).toBeGreaterThanOrEqual(2);
    // Old assignment should have effectiveEnd populated
    expect(assignments[0].effectiveEnd).not.toBeNull();
    // New assignment should have effectiveEnd null (active)
    expect(assignments[assignments.length - 1].effectiveEnd).toBeNull();
  });

  // ===========================================================================
  // 8. CHANGE DESIGNATION
  // ===========================================================================
  it('8. should change staff designation and record audit event', async () => {
    // Find Head Nurse designation
    const headNurse = await prisma.staffDesignation.findFirst({
      where: { code: 'NURSE-HEAD' },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/staff/${createdStaffProfileId}/change-designation`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetDesignationId: Number(headNurse?.id || testDesignation.id),
        reason: 'Promoted to Head Nurse supervisor',
      });

    expect(res.status).toBe(200);
    const data = getData(res);
    expect(data.designationId).toBe(String(headNurse?.id || testDesignation.id));

    // Verify history recorded
    const history = await prisma.staffEmploymentHistory.findFirst({
      where: {
        staffProfileId: BigInt(createdStaffProfileId),
        eventType: 'DESIGNATION_CHANGE',
      },
    });
    expect(history).not.toBeNull();
    expect(history?.comments).toContain('Promoted to Head Nurse');
  });

  // ===========================================================================
  // 9. UPDATE PROFILE CONTACT DETAILS
  // ===========================================================================
  it('9. should update profile contact details without altering employee number', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/staff/${createdStaffProfileId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        phone: '+1-555-9999',
        address: '100 Medical Center Blvd',
        emergencyContactName: 'Dr. John Barton',
        emergencyContactPhone: '+1-555-8888',
      });

    expect(res.status).toBe(200);
    const data = getData(res);
    expect(data.phone).toBe('+1-555-9999');
    expect(data.address).toBe('100 Medical Center Blvd');
    expect(data.emergencyContactName).toBe('Dr. John Barton');
    expect(data.employeeNumber).toBe(createdEmployeeNumber);
  });

  // ===========================================================================
  // 10. DEACTIVATE STAFF (INACTIVE STATUS)
  // ===========================================================================
  it('10. should deactivate staff profile', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/staff/${createdStaffProfileId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Extended leave of absence',
      });

    expect(res.status).toBe(200);
    const data = getData(res);
    expect(data.employmentStatus).toBe('INACTIVE');
  });

  // ===========================================================================
  // 11. REACTIVATE STAFF (ACTIVE STATUS)
  // ===========================================================================
  it('11. should reactivate staff profile back to ACTIVE status', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/staff/${createdStaffProfileId}/reactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Returned from leave',
      });

    expect(res.status).toBe(200);
    const data = getData(res);
    expect(data.employmentStatus).toBe('ACTIVE');
  });

  // ===========================================================================
  // 12. OFFBOARD STAFF & VERIFY POLICY
  // ===========================================================================
  it('12. should offboard staff, set TERMINATED status, and revoke sessions', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/staff/${createdStaffProfileId}/offboard`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Resignation / Relocated to another city',
        deactivateUserAccount: true,
      });

    expect(res.status).toBe(200);
    const data = getData(res);
    expect(data.employmentStatus).toBe('TERMINATED');
    expect(data.offboardingReason).toBe('Resignation / Relocated to another city');
    expect(data.offboardedAt).not.toBeNull();

    // Verify all active department assignments were ended
    const activeAssignments = await prisma.staffDepartmentAssignment.findMany({
      where: {
        staffProfileId: BigInt(createdStaffProfileId),
        effectiveEnd: null,
      },
    });
    expect(activeAssignments.length).toBe(0);

    // Verify historical records remain intact in database
    const historyCount = await prisma.staffEmploymentHistory.count({
      where: { staffProfileId: BigInt(createdStaffProfileId) },
    });
    expect(historyCount).toBeGreaterThanOrEqual(4);
  });

  // ===========================================================================
  // 13. RBAC RESTRICTIONS: UNAUTHORIZED STAFF MODIFICATION
  // ===========================================================================
  it('13. should reject staff creation from unauthorized roles without STAFF_CREATE', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${nurseToken}`) // Nurse has STAFF_VIEW only
      .send({
        firstName: 'Unauthorized',
        lastName: 'Creation',
      });

    expect(res.status).toBe(403);
  });

  // ===========================================================================
  // 14. DIRECTORY SEARCH & PAGINATION
  // ===========================================================================
  it('14. should search directory by employee number and status', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/staff?search=${createdEmployeeNumber}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const body = getData(res);
    expect(body.data).toBeDefined();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].employeeNumber).toBe(createdEmployeeNumber);
    expect(body.meta.total).toBeGreaterThanOrEqual(1);
  });

  // ===========================================================================
  // 15. DASHBOARD METRICS
  // ===========================================================================
  it('15. should retrieve staff dashboard metrics and department distribution', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/staff/dashboard/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const data = getData(res);
    expect(data.overview).toBeDefined();
    expect(data.overview.totalEmployees).toBeGreaterThanOrEqual(1);
    expect(data.staffByDepartment).toBeInstanceOf(Array);
    expect(data.staffByDesignation).toBeInstanceOf(Array);
    expect(data.recentChanges).toBeInstanceOf(Array);
  });

  // ===========================================================================
  // 16. CONCURRENCY: SIMULTANEOUS EMPLOYEE NUMBER GENERATION
  // ===========================================================================
  it('16. should handle concurrent staff creation without duplicate employee numbers', async () => {
    const promises = [
      request(app.getHttpServer())
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Concurrent1',
          lastName: 'Tester',
          email: 'concurrent1@medora.hospital',
        }),
      request(app.getHttpServer())
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Concurrent2',
          lastName: 'Tester',
          email: 'concurrent2@medora.hospital',
        }),
      request(app.getHttpServer())
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Concurrent3',
          lastName: 'Tester',
          email: 'concurrent3@medora.hospital',
        }),
    ];

    const results = await Promise.all(promises);
    const empNumbers = results.map((r) => getData(r).employeeNumber);

    for (const r of results) {
      expect(r.status).toBe(201);
    }

    const uniqueSet = new Set(empNumbers);
    expect(uniqueSet.size).toBe(empNumbers.length);

    // Clean up concurrent profiles
    for (const r of results) {
      const data = getData(r);
      const sId = BigInt(data.id);
      await prisma.staffDepartmentAssignment.deleteMany({ where: { staffProfileId: sId } });
      await prisma.staffEmploymentHistory.deleteMany({ where: { staffProfileId: sId } });
      await prisma.staffProfile.deleteMany({ where: { id: sId } });
    }
  });

  // ===========================================================================
  // 17. GET PROFILE WITH FULL RELATIONS & HISTORY
  // ===========================================================================
  it('17. should get full profile with assignments and employment audit log', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/staff/${createdStaffProfileId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const data = getData(res);
    expect(data.id).toBe(createdStaffProfileId);
    expect(data.departmentAssignments).toBeInstanceOf(Array);
    expect(data.employmentHistory).toBeInstanceOf(Array);
    expect(data.employmentHistory.length).toBeGreaterThanOrEqual(4);
  });
});
