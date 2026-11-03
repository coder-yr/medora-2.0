import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChangeDesignationDto,
  CreateDesignationDto,
  CreateStaffProfileDto,
  DepartmentTransferDto,
  EmploymentType,
  LinkUserDto,
  OffboardStaffDto,
  StaffQueryDto,
  StaffStatus,
  UpdateStaffProfileDto,
  UpdateStaffStatusDto,
} from './dto/staff.dto';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to format BigInt values for clean JSON output.
   */
  public serializeStaffRecord(record: any): any {
    if (!record) return record;
    if (Array.isArray(record)) {
      return record.map((r) => this.serializeStaffRecord(r));
    }
    if (typeof record === 'object') {
      const serialized: any = {};
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === 'bigint') {
          serialized[key] = value.toString();
        } else if (value instanceof Date) {
          serialized[key] = value.toISOString();
        } else if (value !== null && typeof value === 'object') {
          serialized[key] = this.serializeStaffRecord(value);
        } else {
          serialized[key] = value;
        }
      }
      return serialized;
    }
    return record;
  }

  /**
   * Generate sequential, concurrency-safe employee number: EMP-YYYYMM-XXXX.
   */
  public async generateEmployeeNumber(tx?: any): Promise<string> {
    const client = tx || this.prisma;
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `EMP-${yearMonth}-`;

    const latest = await client.staffProfile.findFirst({
      where: {
        employeeNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        employeeNumber: 'desc',
      },
      select: {
        employeeNumber: true,
      },
    });

    let sequence = 1;
    if (latest?.employeeNumber) {
      const parts = latest.employeeNumber.split('-');
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
          sequence = parsed + 1;
        }
      }
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  // ===========================================================================
  // 1. STAFF ONBOARDING & PROFILE MANAGEMENT
  // ===========================================================================

  /**
   * Create and onboard a new non-medical staff profile.
   * Uses optimistic concurrency retry to safely handle simultaneous employee onboarding.
   */
  async createStaffProfile(dto: CreateStaffProfileDto, recordedByUserId?: bigint): Promise<any> {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        return await this.executeCreateStaffProfile(dto, recordedByUserId);
      } catch (err: any) {
        const isCollision =
          err.code === 'P2002' &&
          (String(err.meta?.target || '').includes('employee_number') ||
            String(err.message || '').includes('employee_number') ||
            String(err.message || '').includes('staff_profile_employee_number_key'));

        if (isCollision && attempt < 5) {
          this.logger.warn(`Concurrency collision on employee number generation (attempt ${attempt}/5). Retrying...`);
          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 80) + 40));
          continue;
        }
        throw err;
      }
    }
  }

  private async executeCreateStaffProfile(dto: CreateStaffProfileDto, recordedByUserId?: bigint): Promise<any> {
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const displayName = dto.displayName?.trim() || `${firstName} ${lastName}`;

    // Verify User account if provided
    let uId: bigint | null = null;
    if (dto.userId) {
      uId = BigInt(dto.userId);
      const user = await this.prisma.user.findUnique({
        where: { id: uId },
      });
      if (!user) {
        throw new NotFoundException(`User account #${dto.userId} does not exist`);
      }

      const existingProfile = await this.prisma.staffProfile.findUnique({
        where: { userId: uId },
      });
      if (existingProfile) {
        throw new ConflictException(
          `User account #${dto.userId} (${user.login}) is already linked to staff profile ${existingProfile.employeeNumber} (${existingProfile.displayName})`,
        );
      }
    }

    // Verify Department if provided
    let deptId: bigint | null = null;
    if (dto.departmentId) {
      deptId = BigInt(dto.departmentId);
      const dept = await this.prisma.department.findUnique({ where: { id: deptId } });
      if (!dept) {
        throw new NotFoundException(`Department #${dto.departmentId} does not exist`);
      }
    }

    // Verify Designation if provided
    let desigId: bigint | null = null;
    if (dto.designationId) {
      desigId = BigInt(dto.designationId);
      const desig = await this.prisma.staffDesignation.findUnique({ where: { id: desigId } });
      if (!desig) {
        throw new NotFoundException(`Staff Designation #${dto.designationId} does not exist`);
      }
    }

    // Verify Branch if provided
    let branchId: bigint | null = null;
    if (dto.branchId) {
      branchId = BigInt(dto.branchId);
      const branch = await this.prisma.hospitalBranch.findUnique({ where: { id: branchId } });
      if (!branch) {
        throw new NotFoundException(`Hospital branch #${dto.branchId} does not exist`);
      }
    }

    // Verify Reporting Manager if provided
    let mgrId: bigint | null = null;
    if (dto.reportingManagerId) {
      mgrId = BigInt(dto.reportingManagerId);
      const mgr = await this.prisma.staffProfile.findUnique({ where: { id: mgrId } });
      if (!mgr) {
        throw new NotFoundException(`Reporting manager staff profile #${dto.reportingManagerId} does not exist`);
      }
    }

    const joiningDate = dto.joiningDate ? new Date(dto.joiningDate) : new Date();
    const effectiveRecorderId = recordedByUserId || 1n;

    const result = await this.prisma.$transaction(async (tx) => {
      // PostgreSQL transaction advisory lock to guarantee strict sequential employee numbering under high concurrency
      try {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('staff_employee_number'))`;
      } catch {
        // Fallback for non-postgres mock environments
      }

      const employeeNumber = await this.generateEmployeeNumber(tx);

      const profile = await tx.staffProfile.create({
        data: {
          employeeNumber,
          userId: uId,
          firstName,
          lastName,
          displayName,
          gender: dto.gender || null,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          nationalId: dto.nationalId?.trim() || null,
          email: dto.email?.trim() || null,
          phone: dto.phone?.trim() || null,
          alternatePhone: dto.alternatePhone?.trim() || null,
          address: dto.address?.trim() || null,
          emergencyContactName: dto.emergencyContactName?.trim() || null,
          emergencyContactPhone: dto.emergencyContactPhone?.trim() || null,
          joiningDate,
          employmentType: dto.employmentType || EmploymentType.FULL_TIME,
          employmentStatus: dto.employmentStatus || StaffStatus.ACTIVE,
          departmentId: deptId,
          designationId: desigId,
          branchId,
          reportingManagerId: mgrId,
          profileImage: dto.profileImage || null,
          qualifications: dto.qualifications || null,
        },
        include: {
          user: { select: { id: true, login: true, email: true, group: true } },
          department: true,
          designation: true,
          branch: true,
        },
      });

      // Record initial primary department assignment if department assigned
      if (deptId) {
        await tx.staffDepartmentAssignment.create({
          data: {
            staffProfileId: profile.id,
            departmentId: deptId,
            branchId,
            isPrimary: true,
            effectiveStart: joiningDate,
            reason: 'Initial onboarding assignment',
            assignedBy: effectiveRecorderId,
          },
        });
      }

      // Record employment history event
      await tx.staffEmploymentHistory.create({
        data: {
          staffProfileId: profile.id,
          eventType: 'ONBOARDED',
          newValue: profile.employmentStatus,
          effectiveDate: joiningDate,
          comments: `Staff onboarded with designation ID ${desigId || 'N/A'} in department ID ${deptId || 'N/A'}`,
          recordedBy: effectiveRecorderId,
        },
      });

      return profile;
    });

    return this.serializeStaffRecord(result);
  }

  /**
   * Update staff profile details (contact, name, address, emergency info).
   * Note: Employee number and assignment history are immutable via this endpoint.
   */
  async updateStaffProfile(
    id: bigint | number | string,
    dto: UpdateStaffProfileDto,
    recordedByUserId?: bigint,
  ): Promise<any> {
    const sId = BigInt(id);
    const existing = await this.prisma.staffProfile.findUnique({
      where: { id: sId },
    });
    if (!existing) {
      throw new NotFoundException(`Staff profile #${id} does not exist`);
    }

    const firstName = dto.firstName !== undefined ? dto.firstName.trim() : existing.firstName;
    const lastName = dto.lastName !== undefined ? dto.lastName.trim() : existing.lastName;
    const displayName =
      dto.displayName !== undefined
        ? dto.displayName.trim()
        : dto.firstName !== undefined || dto.lastName !== undefined
          ? `${firstName} ${lastName}`
          : existing.displayName;

    let mgrId = existing.reportingManagerId;
    if (dto.reportingManagerId !== undefined) {
      if (dto.reportingManagerId) {
        const mId = BigInt(dto.reportingManagerId);
        if (mId === sId) {
          throw new BadRequestException('A staff member cannot be their own reporting manager');
        }
        const mgr = await this.prisma.staffProfile.findUnique({ where: { id: mId } });
        if (!mgr) {
          throw new NotFoundException(`Reporting manager #${dto.reportingManagerId} does not exist`);
        }
        mgrId = mId;
      } else {
        mgrId = null;
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.staffProfile.update({
        where: { id: sId },
        data: {
          firstName,
          lastName,
          displayName,
          gender: dto.gender !== undefined ? dto.gender : existing.gender,
          dateOfBirth: dto.dateOfBirth !== undefined ? (dto.dateOfBirth ? new Date(dto.dateOfBirth) : null) : existing.dateOfBirth,
          nationalId: dto.nationalId !== undefined ? dto.nationalId?.trim() || null : existing.nationalId,
          email: dto.email !== undefined ? dto.email?.trim() || null : existing.email,
          phone: dto.phone !== undefined ? dto.phone?.trim() || null : existing.phone,
          alternatePhone: dto.alternatePhone !== undefined ? dto.alternatePhone?.trim() || null : existing.alternatePhone,
          address: dto.address !== undefined ? dto.address?.trim() || null : existing.address,
          emergencyContactName: dto.emergencyContactName !== undefined ? dto.emergencyContactName?.trim() || null : existing.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone !== undefined ? dto.emergencyContactPhone?.trim() || null : existing.emergencyContactPhone,
          joiningDate: dto.joiningDate !== undefined ? (dto.joiningDate ? new Date(dto.joiningDate) : existing.joiningDate) : existing.joiningDate,
          employmentType: dto.employmentType !== undefined ? dto.employmentType : existing.employmentType,
          reportingManagerId: mgrId,
          profileImage: dto.profileImage !== undefined ? dto.profileImage : existing.profileImage,
          qualifications: dto.qualifications !== undefined ? dto.qualifications : existing.qualifications,
        },
        include: {
          user: { select: { id: true, login: true, email: true, group: true } },
          department: true,
          designation: true,
          branch: true,
        },
      });

      await tx.staffEmploymentHistory.create({
        data: {
          staffProfileId: sId,
          eventType: 'PROFILE_UPDATED',
          comments: 'Staff profile details updated',
          recordedBy: recordedByUserId || 1n,
        },
      });

      return record;
    });

    return this.serializeStaffRecord(updated);
  }

  // ===========================================================================
  // 2. DIRECTORY & SEARCH
  // ===========================================================================

  /**
   * Search and filter staff profiles with pagination.
   */
  async findAll(query: StaffQueryDto): Promise<{ data: any[]; meta: any }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { employeeNumber: { contains: term, mode: 'insensitive' } },
        { displayName: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.departmentId) {
      where.departmentId = BigInt(query.departmentId);
    }

    if (query.designationId) {
      where.designationId = BigInt(query.designationId);
    }

    if (query.category) {
      where.designation = { category: query.category };
    }

    if (query.branchId) {
      where.branchId = BigInt(query.branchId);
    }

    if (query.employmentStatus) {
      where.employmentStatus = query.employmentStatus;
    }

    if (query.employmentType) {
      where.employmentType = query.employmentType;
    }

    if (query.hasUserAccount !== undefined) {
      const hasAccount = query.hasUserAccount === 'true' || query.hasUserAccount === '1';
      if (hasAccount) {
        where.userId = { not: null };
      } else {
        where.userId = null;
      }
    }

    const [total, items] = await Promise.all([
      this.prisma.staffProfile.count({ where }),
      this.prisma.staffProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, login: true, email: true, group: true } },
          department: true,
          designation: true,
          branch: true,
          reportingManager: { select: { id: true, employeeNumber: true, displayName: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: this.serializeStaffRecord(items),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Get complete staff profile with assignment and employment history.
   */
  async findById(id: bigint | number | string): Promise<any> {
    const sId = BigInt(id);
    const profile = await this.prisma.staffProfile.findUnique({
      where: { id: sId },
      include: {
        user: { select: { id: true, login: true, email: true, group: true, createdAt: true } },
        department: true,
        designation: true,
        branch: true,
        reportingManager: { select: { id: true, employeeNumber: true, displayName: true } },
        departmentAssignments: {
          include: {
            department: true,
            branch: true,
            assigner: { select: { id: true, login: true, firstName: true, lastName: true } },
          },
          orderBy: { effectiveStart: 'desc' },
        },
        employmentHistory: {
          include: {
            recorder: { select: { id: true, login: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`Staff profile #${id} does not exist`);
    }

    return this.serializeStaffRecord(profile);
  }

  // ===========================================================================
  // 3. DEPARTMENT ASSIGNMENT & TRANSFERS
  // ===========================================================================

  /**
   * Transfer staff to a new department, preserving historical assignments.
   */
  async transferDepartment(
    id: bigint | number | string,
    dto: DepartmentTransferDto,
    assignedByUserId?: bigint,
  ): Promise<any> {
    const sId = BigInt(id);
    const profile = await this.prisma.staffProfile.findUnique({
      where: { id: sId },
      include: { department: true },
    });
    if (!profile) {
      throw new NotFoundException(`Staff profile #${id} does not exist`);
    }

    const targetDeptId = BigInt(dto.targetDepartmentId);
    const targetDept = await this.prisma.department.findUnique({
      where: { id: targetDeptId },
    });
    if (!targetDept) {
      throw new NotFoundException(`Target department #${dto.targetDepartmentId} does not exist`);
    }

    let branchId = profile.branchId;
    if (dto.branchId) {
      branchId = BigInt(dto.branchId);
      const branch = await this.prisma.hospitalBranch.findUnique({ where: { id: branchId } });
      if (!branch) {
        throw new NotFoundException(`Branch #${dto.branchId} does not exist`);
      }
    }

    const effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : new Date();
    const effectiveAssignerId = assignedByUserId || 1n;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Close current primary assignment if active
      await tx.staffDepartmentAssignment.updateMany({
        where: {
          staffProfileId: sId,
          isPrimary: true,
          effectiveEnd: null,
        },
        data: {
          effectiveEnd: effectiveDate,
        },
      });

      // 2. Create new department assignment
      await tx.staffDepartmentAssignment.create({
        data: {
          staffProfileId: sId,
          departmentId: targetDeptId,
          branchId,
          isPrimary: dto.isPrimary ?? true,
          effectiveStart: effectiveDate,
          reason: dto.reason || 'Department transfer',
          assignedBy: effectiveAssignerId,
        },
      });

      // 3. Update active department pointer on profile
      const updatedProfile = await tx.staffProfile.update({
        where: { id: sId },
        data: {
          departmentId: targetDeptId,
          branchId,
        },
        include: {
          department: true,
          designation: true,
          branch: true,
        },
      });

      // 4. Record auditable employment history event
      await tx.staffEmploymentHistory.create({
        data: {
          staffProfileId: sId,
          eventType: 'DEPARTMENT_TRANSFER',
          previousValue: profile.department?.name || 'Unassigned',
          newValue: targetDept.name,
          effectiveDate,
          comments: dto.reason || 'Department transfer',
          recordedBy: effectiveAssignerId,
        },
      });

      return updatedProfile;
    });

    return this.serializeStaffRecord(result);
  }

  /**
   * Change employee designation (e.g., promotion, grade change).
   */
  async changeDesignation(
    id: bigint | number | string,
    dto: ChangeDesignationDto,
    recordedByUserId?: bigint,
  ): Promise<any> {
    const sId = BigInt(id);
    const profile = await this.prisma.staffProfile.findUnique({
      where: { id: sId },
      include: { designation: true },
    });
    if (!profile) {
      throw new NotFoundException(`Staff profile #${id} does not exist`);
    }

    const targetDesigId = BigInt(dto.targetDesignationId);
    const targetDesig = await this.prisma.staffDesignation.findUnique({
      where: { id: targetDesigId },
    });
    if (!targetDesig) {
      throw new NotFoundException(`Staff designation #${dto.targetDesignationId} does not exist`);
    }

    const effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : new Date();
    const effectiveRecorderId = recordedByUserId || 1n;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.staffProfile.update({
        where: { id: sId },
        data: {
          designationId: targetDesigId,
        },
        include: {
          department: true,
          designation: true,
          branch: true,
        },
      });

      await tx.staffEmploymentHistory.create({
        data: {
          staffProfileId: sId,
          eventType: 'DESIGNATION_CHANGE',
          previousValue: profile.designation?.title || 'None',
          newValue: targetDesig.title,
          effectiveDate,
          comments: dto.reason || 'Designation update',
          recordedBy: effectiveRecorderId,
        },
      });

      return updated;
    });

    return this.serializeStaffRecord(result);
  }

  // ===========================================================================
  // 4. USER ACCOUNT LINKING & UNLINKING
  // ===========================================================================

  /**
   * Link an existing user account to an employee profile.
   * Enforces 1-to-1 relationship.
   */
  async linkUser(id: bigint | number | string, dto: LinkUserDto, recordedByUserId?: bigint): Promise<any> {
    const sId = BigInt(id);
    const profile = await this.prisma.staffProfile.findUnique({
      where: { id: sId },
    });
    if (!profile) {
      throw new NotFoundException(`Staff profile #${id} does not exist`);
    }

    const targetUserId = BigInt(dto.userId);
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException(`User account #${dto.userId} does not exist`);
    }

    // Check if target user is already linked to another staff profile
    const existingStaff = await this.prisma.staffProfile.findUnique({
      where: { userId: targetUserId },
    });
    if (existingStaff && existingStaff.id !== sId) {
      throw new ConflictException(
        `User #${dto.userId} (${targetUser.login}) is already linked to staff profile ${existingStaff.employeeNumber} (${existingStaff.displayName})`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.staffProfile.update({
        where: { id: sId },
        data: {
          userId: targetUserId,
        },
        include: {
          user: { select: { id: true, login: true, email: true, group: true } },
          department: true,
          designation: true,
        },
      });

      await tx.staffEmploymentHistory.create({
        data: {
          staffProfileId: sId,
          eventType: 'USER_ACCOUNT_LINKED',
          newValue: targetUser.login,
          comments: `Linked user account #${targetUser.id} (${targetUser.login}) to employee`,
          recordedBy: recordedByUserId || 1n,
        },
      });

      return updated;
    });

    return this.serializeStaffRecord(result);
  }

  /**
   * Unlink user account from staff profile.
   */
  async unlinkUser(id: bigint | number | string, recordedByUserId?: bigint): Promise<any> {
    const sId = BigInt(id);
    const profile = await this.prisma.staffProfile.findUnique({
      where: { id: sId },
      include: { user: true },
    });
    if (!profile) {
      throw new NotFoundException(`Staff profile #${id} does not exist`);
    }

    if (!profile.userId) {
      return this.serializeStaffRecord(profile);
    }

    const oldLogin = profile.user?.login || profile.userId.toString();

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.staffProfile.update({
        where: { id: sId },
        data: {
          userId: null,
        },
        include: {
          department: true,
          designation: true,
        },
      });

      await tx.staffEmploymentHistory.create({
        data: {
          staffProfileId: sId,
          eventType: 'USER_ACCOUNT_UNLINKED',
          previousValue: oldLogin,
          comments: `Unlinked user account ${oldLogin} from employee`,
          recordedBy: recordedByUserId || 1n,
        },
      });

      return updated;
    });

    return this.serializeStaffRecord(result);
  }

  /**
   * Get user account status and active sessions for a staff member.
   */
  async getAccountStatus(id: bigint | number | string): Promise<any> {
    const sId = BigInt(id);
    const profile = await this.prisma.staffProfile.findUnique({
      where: { id: sId },
      include: {
        user: {
          select: {
            id: true,
            login: true,
            email: true,
            group: true,
            branchId: true,
            createdAt: true,
          },
        },
      },
    });
    if (!profile) {
      throw new NotFoundException(`Staff profile #${id} does not exist`);
    }

    if (!profile.user) {
      return {
        isLinked: false,
        user: null,
        activeSessionsCount: 0,
      };
    }

    const activeSessionsCount = await this.prisma.userSession.count({
      where: {
        userId: profile.user.id,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    return {
      isLinked: true,
      user: {
        id: profile.user.id.toString(),
        login: profile.user.login,
        email: profile.user.email,
        group: profile.user.group,
        branchId: profile.user.branchId ? profile.user.branchId.toString() : null,
        createdAt: profile.user.createdAt ? profile.user.createdAt.toISOString() : null,
      },
      activeSessionsCount,
    };
  }

  // ===========================================================================
  // 5. STAFF LIFECYCLE & OFFBOARDING
  // ===========================================================================

  /**
   * Update staff status (ACTIVE, ON_LEAVE, SUSPENDED, INACTIVE).
   */
  async updateStatus(
    id: bigint | number | string,
    dto: UpdateStaffStatusDto,
    recordedByUserId?: bigint,
  ): Promise<any> {
    const sId = BigInt(id);
    const profile = await this.prisma.staffProfile.findUnique({
      where: { id: sId },
    });
    if (!profile) {
      throw new NotFoundException(`Staff profile #${id} does not exist`);
    }

    if (profile.employmentStatus === StaffStatus.TERMINATED && dto.status !== StaffStatus.ACTIVE) {
      throw new BadRequestException('Cannot change status of a terminated employee without formal reactivation.');
    }

    const previousStatus = profile.employmentStatus;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.staffProfile.update({
        where: { id: sId },
        data: {
          employmentStatus: dto.status,
          offboardedAt: dto.status === StaffStatus.ACTIVE ? null : profile.offboardedAt,
          offboardingReason: dto.status === StaffStatus.ACTIVE ? null : profile.offboardingReason,
        },
        include: {
          department: true,
          designation: true,
          branch: true,
        },
      });

      await tx.staffEmploymentHistory.create({
        data: {
          staffProfileId: sId,
          eventType: 'STATUS_CHANGE',
          previousValue: previousStatus,
          newValue: dto.status,
          comments: dto.reason || `Status updated from ${previousStatus} to ${dto.status}`,
          recordedBy: recordedByUserId || 1n,
        },
      });

      return updated;
    });

    return this.serializeStaffRecord(result);
  }

  /**
   * Offboard employee: updates status to TERMINATED, records exit reason/date,
   * closes active assignments, revokes active auth sessions, preserving all historical transactions.
   */
  async offboardStaff(
    id: bigint | number | string,
    dto: OffboardStaffDto,
    recordedByUserId?: bigint,
  ): Promise<any> {
    const sId = BigInt(id);
    const profile = await this.prisma.staffProfile.findUnique({
      where: { id: sId },
    });
    if (!profile) {
      throw new NotFoundException(`Staff profile #${id} does not exist`);
    }

    if (profile.employmentStatus === StaffStatus.TERMINATED) {
      throw new BadRequestException('Staff member is already offboarded and terminated');
    }

    const exitDate = dto.offboardingDate ? new Date(dto.offboardingDate) : new Date();
    const effectiveRecorderId = recordedByUserId || 1n;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Close current department assignments
      await tx.staffDepartmentAssignment.updateMany({
        where: {
          staffProfileId: sId,
          effectiveEnd: null,
        },
        data: {
          effectiveEnd: exitDate,
        },
      });

      // 2. Mark profile as TERMINATED with exit reason
      const updated = await tx.staffProfile.update({
        where: { id: sId },
        data: {
          employmentStatus: StaffStatus.TERMINATED,
          offboardedAt: exitDate,
          offboardingReason: dto.reason,
        },
        include: {
          department: true,
          designation: true,
          branch: true,
        },
      });

      // 3. Revoke active auth sessions if user account is linked and requested
      if (dto.deactivateUserAccount !== false && profile.userId) {
        await tx.userSession.updateMany({
          where: {
            userId: profile.userId,
            isRevoked: false,
          },
          data: {
            isRevoked: true,
          },
        });
      }

      // 4. Record auditable exit event
      await tx.staffEmploymentHistory.create({
        data: {
          staffProfileId: sId,
          eventType: 'OFFBOARDED',
          previousValue: profile.employmentStatus,
          newValue: StaffStatus.TERMINATED,
          effectiveDate: exitDate,
          comments: `Staff offboarded. Reason: ${dto.reason}`,
          recordedBy: effectiveRecorderId,
        },
      });

      return updated;
    });

    return this.serializeStaffRecord(result);
  }

  // ===========================================================================
  // 6. DESIGNATIONS CATALOGUE
  // ===========================================================================

  /**
   * List staff designations by optional category filter.
   */
  async listDesignations(category?: string, activeOnly = true): Promise<any[]> {
    const where: any = {};
    if (category) {
      where.category = category;
    }
    if (activeOnly) {
      where.isActive = true;
    }

    const designations = await this.prisma.staffDesignation.findMany({
      where,
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });

    return this.serializeStaffRecord(designations);
  }

  /**
   * Create a new staff designation in the hospital catalogue.
   */
  async createDesignation(dto: CreateDesignationDto): Promise<any> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.staffDesignation.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException(`Designation with code '${code}' already exists`);
    }

    const created = await this.prisma.staffDesignation.create({
      data: {
        code,
        title: dto.title.trim(),
        category: dto.category.trim().toUpperCase(),
        description: dto.description?.trim() || null,
        isActive: dto.isActive ?? true,
      },
    });

    return this.serializeStaffRecord(created);
  }

  // ===========================================================================
  // 7. DASHBOARD METRICS
  // ===========================================================================

  /**
   * Get aggregated HR and staff metrics for administrative overview.
   */
  async getDashboardMetrics(): Promise<any> {
    const [
      totalStaff,
      activeStaff,
      onLeaveStaff,
      suspendedStaff,
      inactiveStaff,
      terminatedStaff,
      unlinkedAccounts,
      designations,
      departments,
      recentHistory,
    ] = await Promise.all([
      this.prisma.staffProfile.count(),
      this.prisma.staffProfile.count({ where: { employmentStatus: StaffStatus.ACTIVE } }),
      this.prisma.staffProfile.count({ where: { employmentStatus: StaffStatus.ON_LEAVE } }),
      this.prisma.staffProfile.count({ where: { employmentStatus: StaffStatus.SUSPENDED } }),
      this.prisma.staffProfile.count({ where: { employmentStatus: StaffStatus.INACTIVE } }),
      this.prisma.staffProfile.count({ where: { employmentStatus: StaffStatus.TERMINATED } }),
      this.prisma.staffProfile.count({ where: { userId: null } }),
      this.prisma.staffProfile.groupBy({
        by: ['designationId'],
        _count: { id: true },
      }),
      this.prisma.staffProfile.groupBy({
        by: ['departmentId'],
        _count: { id: true },
      }),
      this.prisma.staffEmploymentHistory.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          staffProfile: { select: { id: true, employeeNumber: true, displayName: true } },
          recorder: { select: { id: true, login: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    // Map department details
    const deptIds = departments.map((d) => d.departmentId).filter(Boolean) as bigint[];
    const deptRecords = await this.prisma.department.findMany({
      where: { id: { in: deptIds } },
      select: { id: true, name: true },
    });
    const deptMap = new Map(deptRecords.map((d) => [d.id.toString(), d.name]));

    const staffByDepartment = departments.map((d) => ({
      departmentId: d.departmentId ? d.departmentId.toString() : 'UNASSIGNED',
      departmentName: d.departmentId ? deptMap.get(d.departmentId.toString()) || 'Unknown' : 'Unassigned',
      count: d._count.id,
    }));

    // Map designation details
    const desigIds = designations.map((d) => d.designationId).filter(Boolean) as bigint[];
    const desigRecords = await this.prisma.staffDesignation.findMany({
      where: { id: { in: desigIds } },
      select: { id: true, title: true, category: true },
    });
    const desigMap = new Map(desigRecords.map((d) => [d.id.toString(), d]));

    const staffByDesignation = designations.map((d) => {
      const info = d.designationId ? desigMap.get(d.designationId.toString()) : null;
      return {
        designationId: d.designationId ? d.designationId.toString() : 'UNASSIGNED',
        title: info?.title || 'Unassigned',
        category: info?.category || 'OTHER',
        count: d._count.id,
      };
    });

    return {
      overview: {
        totalEmployees: totalStaff,
        activeEmployees: activeStaff,
        onLeaveEmployees: onLeaveStaff,
        suspendedEmployees: suspendedStaff,
        inactiveEmployees: inactiveStaff,
        terminatedEmployees: terminatedStaff,
        unlinkedAccounts,
      },
      staffByDepartment,
      staffByDesignation,
      recentChanges: this.serializeStaffRecord(recentHistory),
    };
  }
}
