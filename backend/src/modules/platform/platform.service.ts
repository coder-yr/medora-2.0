import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationStatusDto,
  UpdateOrganizationEditionDto,
  UpdateOrganizationEntitlementsDto,
  AssignOrganizationAdminDto,
  RequestBreakGlassDto,
  QueryRegistrationsDto,
  ApproveRegistrationDto,
  RejectRegistrationDto,
} from './dto/platform.dto';
import { OrganizationEdition, OrganizationStatus, RegistrationStatus } from '@prisma/client';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a platform-level security audit entry
   */
  private async logPlatformAction(params: {
    actorUserId?: bigint;
    actorEmail?: string;
    actorRole?: string;
    organizationId?: bigint;
    action: string;
    targetType: string;
    targetId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
  }) {
    try {
      await this.prisma.platformAuditLog.create({
        data: {
          actorUserId: params.actorUserId || null,
          actorEmail: params.actorEmail || null,
          actorRole: params.actorRole || 'SuperAdmin',
          organizationId: params.organizationId || null,
          action: params.action,
          targetType: params.targetType,
          targetId: params.targetId || null,
          details: params.details || {},
          ipAddress: params.ipAddress || null,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to write platform audit log: ${err.message}`);
    }
  }

  /**
   * Retrieves all organizations on the platform with operational metrics
   */
  async listOrganizations() {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            branches: true,
            users: true,
          },
        },
        settings: true,
      },
    });

    return orgs.map((org) => ({
      id: org.id.toString(),
      name: org.name,
      code: org.code,
      status: org.status,
      edition: org.edition,
      subscriptionTier: org.subscriptionTier,
      maxBranches: org.maxBranches,
      maxUsers: org.maxUsers,
      subscriptionExpiresAt: org.subscriptionExpiresAt,
      branchCount: org._count.branches,
      userCount: org._count.users,
      enabledModules: (org.settings?.enabledModules as string[]) || [],
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    }));
  }

  /**
   * Retrieves a single organization by ID with administrators and active branches
   */
  async getOrganization(id: string | bigint) {
    const orgId = BigInt(id);
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        branches: {
          select: {
            id: true,
            name: true,
            code: true,
            active: true,
          },
        },
        userMemberships: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                group: true,
              },
            },
          },
        },
        settings: true,
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization #${id} not found.`);
    }

    const admins = org.userMemberships
      .filter((m) => ['Admin', 'OrganizationAdmin', 'ClinicAdmin'].includes(m.accessRole || ''))
      .map((m) => ({
        membershipId: m.id.toString(),
        userId: m.user.id.toString(),
        name: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim(),
        email: m.user.email,
        accessRole: m.accessRole,
        assignedAt: m.assignedAt,
      }));

    return {
      id: org.id.toString(),
      name: org.name,
      code: org.code,
      status: org.status,
      edition: org.edition,
      subscriptionTier: org.subscriptionTier,
      maxBranches: org.maxBranches,
      maxUsers: org.maxUsers,
      subscriptionExpiresAt: org.subscriptionExpiresAt,
      branches: org.branches.map((b) => ({
        id: b.id.toString(),
        name: b.name,
        code: b.code,
        active: b.active,
      })),
      admins,
      enabledModules: (org.settings?.enabledModules as string[]) || [],
      settings: org.settings,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  /**
   * Provisions a new organization, default branch, initial Org Admin, and subscription configuration
   */
  async provisionOrganization(dto: CreateOrganizationDto, superAdminId: string | bigint) {
    const normalizedCode = dto.code.trim().toUpperCase();
    const adminEmail = dto.adminEmail.trim().toLowerCase();

    // 1. Conflict checks
    const [existingOrg, existingUser] = await Promise.all([
      this.prisma.organization.findFirst({
        where: {
          code: normalizedCode,
        },
      }),
      this.prisma.user.findFirst({
        where: { email: { equals: adminEmail, mode: 'insensitive' } },
      }),
    ]);

    if (existingOrg) {
      throw new ConflictException('An organization with this code already exists.');
    }
    if (existingUser) {
      throw new ConflictException('A user account with this administrator email already exists.');
    }

    // 2. Hash administrator password
    const hashedPassword = await argon2.hash(dto.adminPassword, { type: argon2.argon2id });

    // 3. Determine default modules based on edition
    const edition = dto.edition || OrganizationEdition.HOSPITAL;
    const defaultModulesByEdition: Record<OrganizationEdition, string[]> = {
      CLINIC: ['patients', 'appointments', 'consultations', 'prescriptions', 'billing'],
      PROFESSIONAL: ['patients', 'appointments', 'consultations', 'prescriptions', 'pharmacy', 'billing'],
      HOSPITAL: ['patients', 'appointments', 'consultations', 'prescriptions', 'inpatient', 'laboratory', 'radiology', 'pharmacy', 'billing', 'staff', 'departments'],
      ENTERPRISE: ['patients', 'appointments', 'consultations', 'prescriptions', 'inpatient', 'laboratory', 'radiology', 'pharmacy', 'billing', 'staff', 'departments', 'accounting', 'telemedicine', 'multi_branch'],
    };

    const enabledModules = defaultModulesByEdition[edition] || defaultModulesByEdition.HOSPITAL;

    // 4. Transactional provision
    const result = await this.prisma.$transaction(async (tx) => {
      // Create Organization
      const org = await tx.organization.create({
        data: {
          name: dto.name.trim(),
          code: normalizedCode,
          status: OrganizationStatus.ACTIVE,
          edition,
          subscriptionTier: dto.subscriptionTier || 'PROFESSIONAL',
          maxBranches: dto.maxBranches || 3,
          maxUsers: dto.maxUsers || 25,
        },
      });

      // Create Settings
      await tx.organizationSettings.create({
        data: {
          organizationId: org.id,
          enabledModules,
          defaultTimezone: 'Asia/Kolkata',
          defaultCurrency: 'INR',
        },
      });

      // Create Primary Branch
      const branch = await tx.hospitalBranch.create({
        data: {
          organizationId: org.id,
          name: `${dto.name.trim()} - Main Center`,
          code: `${normalizedCode}-01`,
          active: true,
        },
      });

      // Create Organization Admin (strictly NOT SuperAdmin)
      const nameParts = dto.adminName.trim().split(' ');
      const firstName = nameParts[0] || 'Org';
      const lastName = nameParts.slice(1).join(' ') || 'Admin';

      const user = await tx.user.create({
        data: {
          login: adminEmail.split('@')[0].replace(/[^a-z0-9._-]/g, '') || 'admin',
          email: adminEmail,
          password: hashedPassword,
          firstName: firstName.slice(0, 50),
          lastName: lastName.slice(0, 50),
          group: 'Admin',
          isSuperAdmin: false, // Invariant: Organization Admins NEVER become globally privileged
          organizationId: org.id,
          branchId: branch.id,
          description: `Initial Organization Administrator for ${dto.name}`,
        },
      });

      // Bind Membership
      await tx.userOrganizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          accessRole: 'Admin',
          isDefault: true,
          isActive: true,
          assignedById: BigInt(superAdminId),
        },
      });

      return { org, branch, user };
    });

    // 5. Audit Log
    await this.logPlatformAction({
      actorUserId: BigInt(superAdminId),
      action: 'ORGANIZATION_PROVISIONED',
      targetType: 'Organization',
      targetId: result.org.id.toString(),
      details: {
        name: result.org.name,
        code: result.org.code,
        edition: result.org.edition,
        adminUserId: result.user.id.toString(),
        adminEmail: result.user.email,
      },
    });

    return {
      organizationId: result.org.id.toString(),
      name: result.org.name,
      code: result.org.code,
      edition: result.org.edition,
      branchId: result.branch.id.toString(),
      adminId: result.user.id.toString(),
      adminEmail: result.user.email,
    };
  }

  /**
   * Suspends or reactivates an organization
   */
  async updateStatus(
    id: string | bigint,
    dto: UpdateOrganizationStatusDto,
    superAdminId: string | bigint,
  ) {
    const orgId = BigInt(id);
    const existing = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!existing) {
      throw new NotFoundException(`Organization #${id} not found.`);
    }

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: { status: dto.status },
    });

    await this.logPlatformAction({
      actorUserId: BigInt(superAdminId),
      action: `ORGANIZATION_STATUS_${dto.status}`,
      targetType: 'Organization',
      targetId: orgId.toString(),
      details: {
        previousStatus: existing.status,
        newStatus: dto.status,
        reason: dto.reason || 'Super Admin operational modification',
      },
    });

    return {
      id: updated.id.toString(),
      status: updated.status,
    };
  }

  /**
   * Updates organization edition and capacity limits
   */
  async updateEdition(
    id: string | bigint,
    dto: UpdateOrganizationEditionDto,
    superAdminId: string | bigint,
  ) {
    const orgId = BigInt(id);
    const existing = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!existing) {
      throw new NotFoundException(`Organization #${id} not found.`);
    }

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        edition: dto.edition,
        ...(dto.maxBranches ? { maxBranches: dto.maxBranches } : {}),
        ...(dto.maxUsers ? { maxUsers: dto.maxUsers } : {}),
      },
    });

    await this.logPlatformAction({
      actorUserId: BigInt(superAdminId),
      action: 'ORGANIZATION_EDITION_UPDATED',
      targetType: 'Organization',
      targetId: orgId.toString(),
      details: {
        previousEdition: existing.edition,
        newEdition: dto.edition,
        maxBranches: updated.maxBranches,
        maxUsers: updated.maxUsers,
      },
    });

    return {
      id: updated.id.toString(),
      edition: updated.edition,
      maxBranches: updated.maxBranches,
      maxUsers: updated.maxUsers,
    };
  }

  /**
   * Updates enabled module entitlements for an organization
   */
  async updateEntitlements(
    id: string | bigint,
    dto: UpdateOrganizationEntitlementsDto,
    superAdminId: string | bigint,
  ) {
    const orgId = BigInt(id);
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { settings: true },
    });

    if (!org) {
      throw new NotFoundException(`Organization #${id} not found.`);
    }

    const updatedModules = dto.enabledModules;

    await this.prisma.organizationSettings.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        enabledModules: updatedModules,
      },
      update: {
        enabledModules: updatedModules,
      },
    });

    await this.logPlatformAction({
      actorUserId: BigInt(superAdminId),
      action: 'ORGANIZATION_ENTITLEMENTS_UPDATED',
      targetType: 'Organization',
      targetId: orgId.toString(),
      details: {
        previousModules: org.settings?.enabledModules || [],
        activeModules: updatedModules,
      },
    });

    return {
      organizationId: orgId.toString(),
      activeModules: updatedModules,
    };
  }

  /**
   * Assigns or provisions an Organization Administrator
   */
  async assignAdmin(
    id: string | bigint,
    dto: AssignOrganizationAdminDto,
    superAdminId: string | bigint,
  ) {
    const orgId = BigInt(id);
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { branches: true },
    });

    if (!org) {
      throw new NotFoundException(`Organization #${id} not found.`);
    }

    const email = dto.adminEmail.trim().toLowerCase();
    let user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!user) {
      const hashedPassword = await argon2.hash(dto.adminPassword, { type: argon2.argon2id });
      const nameParts = dto.adminName.trim().split(' ');
      const mainBranchId = org.branches[0]?.id || null;

      user = await this.prisma.user.create({
        data: {
          login: email.split('@')[0].replace(/[^a-z0-9._-]/g, ''),
          email,
          password: hashedPassword,
          firstName: (nameParts[0] || 'Admin').slice(0, 50),
          lastName: (nameParts.slice(1).join(' ') || 'User').slice(0, 50),
          group: 'Admin',
          isSuperAdmin: false,
          organizationId: orgId,
          branchId: mainBranchId,
          description: `Assigned Organization Admin for ${org.name}`,
        },
      });
    }

    // Upsert membership
    const membership = await this.prisma.userOrganizationMembership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: orgId,
        },
      },
      create: {
        userId: user.id,
        organizationId: orgId,
        accessRole: 'Admin',
        isDefault: true,
        isActive: true,
        assignedById: BigInt(superAdminId),
      },
      update: {
        accessRole: 'Admin',
        isActive: true,
        revokedAt: null,
      },
    });

    await this.logPlatformAction({
      actorUserId: BigInt(superAdminId),
      action: 'ORGANIZATION_ADMIN_ASSIGNED',
      targetType: 'Organization',
      targetId: orgId.toString(),
      details: {
        adminUserId: user.id.toString(),
        adminEmail: user.email,
        membershipId: membership.id.toString(),
      },
    });

    return {
      organizationId: orgId.toString(),
      adminId: user.id.toString(),
      adminEmail: user.email,
      membershipId: membership.id.toString(),
    };
  }

  /**
   * Queries platform-wide security audit logs
   */
  async getAuditLogs(limit = 50, offset = 0) {
    const [total, logs] = await Promise.all([
      this.prisma.platformAuditLog.count(),
      this.prisma.platformAuditLog.findMany({
        take: Math.min(limit, 100),
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      limit,
      offset,
      logs: logs.map((log) => ({
        id: log.id.toString(),
        actorUserId: log.actorUserId ? log.actorUserId.toString() : null,
        actorEmail: log.actorEmail,
        actorRole: log.actorRole,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        details: log.details,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      })),
    };
  }

  /**
   * Aggregates platform-wide metrics
   */
  async getPlatformAnalytics() {
    const [
      totalOrganizations,
      activeOrganizations,
      suspendedOrganizations,
      totalBranches,
      totalUsers,
      activeSupportGrants,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: OrganizationStatus.ACTIVE } }),
      this.prisma.organization.count({ where: { status: OrganizationStatus.SUSPENDED } }),
      this.prisma.hospitalBranch.count(),
      this.prisma.user.count(),
      this.prisma.emergencySupportGrant.count({
        where: {
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    return {
      totalOrganizations,
      activeOrganizations,
      suspendedOrganizations,
      totalBranches,
      totalUsers,
      activeSupportGrants,
    };
  }

  /**
   * Requests time-limited Break-Glass Emergency Support Access for platform troubleshooting
   */
  async requestBreakGlassSupport(superAdminId: string | bigint, dto: RequestBreakGlassDto) {
    const orgId = BigInt(dto.organizationId);
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException(`Organization #${dto.organizationId} not found.`);
    }

    const hours = Math.min(Math.max(dto.durationHours || 4, 1), 24);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const grant = await this.prisma.emergencySupportGrant.create({
      data: {
        organizationId: orgId,
        grantedToUserId: BigInt(superAdminId),
        requestedReason: dto.requestedReason.trim(),
        expiresAt,
        isRevoked: false,
      },
    });

    await this.logPlatformAction({
      actorUserId: BigInt(superAdminId),
      action: 'BREAK_GLASS_GRANT_CREATED',
      targetType: 'EmergencySupportGrant',
      targetId: grant.id.toString(),
      details: {
        organizationId: orgId.toString(),
        organizationName: org.name,
        requestedReason: dto.requestedReason,
        durationHours: hours,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      grantId: grant.id.toString(),
      organizationId: orgId.toString(),
      organizationName: org.name,
      expiresAt,
      durationHours: hours,
      message: `Emergency break-glass grant activated until ${expiresAt.toISOString()}. All clinical queries will be explicitly recorded in platform audit logs.`,
    };
  }

  /**
   * Revokes an active break-glass emergency support grant early
   */
  async revokeBreakGlassSupport(superAdminId: string | bigint, grantId: string | bigint) {
    const gId = BigInt(grantId);
    const grant = await this.prisma.emergencySupportGrant.findUnique({ where: { id: gId } });
    if (!grant) {
      throw new NotFoundException(`Support grant #${grantId} not found.`);
    }

    const updated = await this.prisma.emergencySupportGrant.update({
      where: { id: gId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    await this.logPlatformAction({
      actorUserId: BigInt(superAdminId),
      action: 'BREAK_GLASS_GRANT_REVOKED',
      targetType: 'EmergencySupportGrant',
      targetId: gId.toString(),
      details: {
        organizationId: grant.organizationId.toString(),
        revokedEarly: true,
      },
    });

    return {
      grantId: updated.id.toString(),
      isRevoked: true,
      message: 'Emergency break-glass support grant revoked successfully.',
    };
  }

  /**
   * Generates a unique, standardized organization code
   */
  private generateOrganizationCode(name: string): string {
    const clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const prefix = (clean.slice(0, 4) || 'MED').padEnd(3, 'X');
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${prefix}-${suffix}`;
  }

  /**
   * Tailors default onboarding checklist based on product edition
   */
  private getDefaultOnboardingChecklist(edition: OrganizationEdition) {
    const base = {
      profile_setup: {
        step: 1,
        title: 'Verify Organization Profile',
        description: 'Review legal name, contact information, and healthcare license details',
        completed: true,
        completedAt: new Date().toISOString(),
      },
      settings_configured: {
        step: 2,
        title: 'Configure Operations & Currency',
        description: 'Set default operational timezone, currency, and financial tax settings',
        completed: true,
        completedAt: new Date().toISOString(),
      },
      primary_branch: {
        step: 3,
        title: 'Primary Healthcare Facility',
        description: 'Establish main operational branch with local address and contact number',
        completed: true,
        completedAt: new Date().toISOString(),
      },
      staff_invitation: {
        step: 4,
        title: 'Invite Staff & Clinical Team',
        description: 'Add initial doctors, nursing staff, and front desk receptionists',
        completed: false,
      },
    };

    if (edition === OrganizationEdition.CLINIC) {
      return {
        ...base,
        clinical_modules: {
          step: 5,
          title: 'Review Outpatient Consultation Suite',
          description: 'Configure doctor consultation schedules and OPD appointment slots',
          completed: false,
        },
      };
    }

    if (edition === OrganizationEdition.PROFESSIONAL) {
      return {
        ...base,
        pharmacy_setup: {
          step: 5,
          title: 'Configure Pharmacy Inventory & Dispensary',
          description: 'Set up medication catalogue, dispensing points, and pricing policies',
          completed: false,
        },
      };
    }

    if (edition === OrganizationEdition.HOSPITAL) {
      return {
        ...base,
        inpatient_setup: {
          step: 5,
          title: 'Configure Inpatient Wards & Beds',
          description: 'Establish wards, room categories, and acute care bed allocations',
          completed: false,
        },
        diagnostics_setup: {
          step: 6,
          title: 'Configure Laboratory & Radiology Catalogs',
          description: 'Setup pathology test profiles, radiology imaging modalities, and sample collection rules',
          completed: false,
        },
      };
    }

    // ENTERPRISE
    return {
      ...base,
      inpatient_setup: {
        step: 5,
        title: 'Configure Inpatient Wards & Beds',
        description: 'Establish wards, room categories, and acute care bed allocations',
        completed: false,
      },
      diagnostics_setup: {
        step: 6,
        title: 'Configure Laboratory & Radiology Catalogs',
        description: 'Setup pathology test profiles, radiology imaging modalities, and sample collection rules',
        completed: false,
      },
      multi_branch: {
        step: 7,
        title: 'Multi-Branch & Regional Network Setup',
        description: 'Configure distributed regional branches, network routing, and consolidated ledger',
        completed: false,
      },
    };
  }

  /**
   * Super Admin: List all organization registrations with filtering and search
   */
  async listRegistrations(query: QueryRegistrationsDto) {
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.organizationType) {
      where.organizationType = query.organizationType;
    }
    if (query.requestedEdition) {
      where.requestedEdition = query.requestedEdition;
    }

    if (query.search && query.search.trim().length > 0) {
      const s = query.search.trim();
      where.OR = [
        { reference: { contains: s, mode: 'insensitive' } },
        { organizationName: { contains: s, mode: 'insensitive' } },
        { organizationEmail: { contains: s, mode: 'insensitive' } },
        { adminEmail: { contains: s, mode: 'insensitive' } },
        { adminFullName: { contains: s, mode: 'insensitive' } },
      ];
    }

    const registrations = await this.prisma.organizationRegistration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        rejectedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return registrations.map((r) => ({
      id: r.id.toString(),
      reference: r.reference,
      organizationName: r.organizationName,
      organizationType: r.organizationType,
      requestedEdition: r.requestedEdition,
      specialization: r.healthcareSpecialization,
      healthcareSpecialization: r.healthcareSpecialization,
      registrationNumber: r.licenseNumber,
      licenseNumber: r.licenseNumber,
      organizationEmail: r.organizationEmail,
      contactPhone: r.contactPhone,
      country: r.country,
      state: r.state,
      city: r.city,
      address: r.address,
      postalCode: r.postalCode,
      website: r.website,
      adminFullName: r.adminFullName,
      adminEmail: r.adminEmail,
      adminPhone: r.adminPhone,
      adminDesignation: r.adminDesignation,
      status: r.status,
      isEmailVerified: r.isEmailVerified,
      emailVerifiedAt: r.emailVerifiedAt,
      rejectionReason: r.rejectionReason,
      approvedAt: r.approvedAt,
      approvedBy: r.approvedBy
        ? {
            id: r.approvedBy.id.toString(),
            name: `${r.approvedBy.firstName || ''} ${r.approvedBy.lastName || ''}`.trim(),
            email: r.approvedBy.email,
          }
        : null,
      rejectedAt: r.rejectedAt,
      rejectedBy: r.rejectedBy
        ? {
            id: r.rejectedBy.id.toString(),
            name: `${r.rejectedBy.firstName || ''} ${r.rejectedBy.lastName || ''}`.trim(),
            email: r.rejectedBy.email,
          }
        : null,
      organization: r.organization
        ? {
            id: r.organization.id.toString(),
            name: r.organization.name,
            code: r.organization.code,
            status: r.organization.status,
          }
        : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Super Admin: Get single organization registration details
   */
  async getRegistration(idOrReference: string | bigint) {
    let where: any;
    if (typeof idOrReference === 'bigint' || /^\d+$/.test(String(idOrReference))) {
      where = { id: BigInt(idOrReference) };
    } else {
      where = { reference: String(idOrReference).trim() };
    }

    const reg = await this.prisma.organizationRegistration.findFirst({
      where,
      include: {
        organization: {
          include: {
            branches: true,
            settings: true,
            onboarding: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        rejectedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!reg) {
      throw new NotFoundException(`Registration "${idOrReference}" not found.`);
    }

    return {
      id: reg.id.toString(),
      reference: reg.reference,
      organizationName: reg.organizationName,
      organizationType: reg.organizationType,
      requestedEdition: reg.requestedEdition,
      specialization: reg.healthcareSpecialization,
      healthcareSpecialization: reg.healthcareSpecialization,
      registrationNumber: reg.licenseNumber,
      licenseNumber: reg.licenseNumber,
      organizationEmail: reg.organizationEmail,
      contactPhone: reg.contactPhone,
      country: reg.country,
      state: reg.state,
      city: reg.city,
      address: reg.address,
      postalCode: reg.postalCode,
      website: reg.website,
      adminFullName: reg.adminFullName,
      adminEmail: reg.adminEmail,
      adminPhone: reg.adminPhone,
      adminDesignation: reg.adminDesignation,
      status: reg.status,
      isEmailVerified: reg.isEmailVerified,
      emailVerifiedAt: reg.emailVerifiedAt,
      rejectionReason: reg.rejectionReason,
      approvedAt: reg.approvedAt,
      approvedBy: reg.approvedBy
        ? {
            id: reg.approvedBy.id.toString(),
            name: `${reg.approvedBy.firstName || ''} ${reg.approvedBy.lastName || ''}`.trim(),
            email: reg.approvedBy.email,
          }
        : null,
      rejectedAt: reg.rejectedAt,
      rejectedBy: reg.rejectedBy
        ? {
            id: reg.rejectedBy.id.toString(),
            name: `${reg.rejectedBy.firstName || ''} ${reg.rejectedBy.lastName || ''}`.trim(),
            email: reg.rejectedBy.email,
          }
        : null,
      organization: reg.organization
        ? {
            id: reg.organization.id.toString(),
            name: reg.organization.name,
            code: reg.organization.code,
            status: reg.organization.status,
            edition: reg.organization.edition,
            branches: reg.organization.branches.map((b) => ({
              id: b.id.toString(),
              name: b.name,
              code: b.code,
              active: b.active,
            })),
            settings: reg.organization.settings,
            onboarding: reg.organization.onboarding
              ? {
                  id: reg.organization.onboarding.id.toString(),
                  isCompleted: reg.organization.onboarding.isCompleted,
                  currentStep: reg.organization.onboarding.currentStep,
                  checklist: reg.organization.onboarding.checklist,
                }
              : null,
          }
        : null,
      createdAt: reg.createdAt,
      updatedAt: reg.updatedAt,
    };
  }

  /**
   * Super Admin: Approve an organization registration and atomically provision tenant resources
   */
  async approveRegistration(
    id: string | bigint,
    dto: ApproveRegistrationDto,
    superAdminId: string | bigint,
  ) {
    const regId = BigInt(id);
    const registration = await this.prisma.organizationRegistration.findUnique({
      where: { id: regId },
      include: { organization: true },
    });

    if (!registration) {
      throw new NotFoundException(`Registration #${id} not found.`);
    }

    if (registration.status === RegistrationStatus.ACTIVE && registration.organizationId) {
      throw new ConflictException(
        `Registration is already approved and active under Organization #${registration.organizationId}.`,
      );
    }

    if (!registration.isEmailVerified) {
      throw new BadRequestException(
        'Cannot approve registration: Email verification has not been completed by applicant.',
      );
    }

    const edition =
      dto.approvedEdition || registration.requestedEdition || OrganizationEdition.HOSPITAL;

    const defaultModulesByEdition: Record<OrganizationEdition, string[]> = {
      CLINIC: ['patients', 'appointments', 'consultations', 'prescriptions', 'billing'],
      PROFESSIONAL: [
        'patients',
        'appointments',
        'consultations',
        'prescriptions',
        'pharmacy',
        'billing',
      ],
      HOSPITAL: [
        'patients',
        'appointments',
        'consultations',
        'prescriptions',
        'inpatient',
        'laboratory',
        'radiology',
        'pharmacy',
        'billing',
        'staff',
        'departments',
      ],
      ENTERPRISE: [
        'patients',
        'appointments',
        'consultations',
        'prescriptions',
        'inpatient',
        'laboratory',
        'radiology',
        'pharmacy',
        'billing',
        'staff',
        'departments',
        'accounting',
        'telemedicine',
        'multi_branch',
      ],
    };

    const enabledModules =
      dto.approvedModules && dto.approvedModules.length > 0
        ? dto.approvedModules
        : defaultModulesByEdition[edition] || defaultModulesByEdition.HOSPITAL;

    const orgCode = this.generateOrganizationCode(registration.organizationName);
    const rawInvitationToken = crypto.randomBytes(32).toString('hex');
    const invitationTokenHash = crypto
      .createHash('sha256')
      .update(rawInvitationToken)
      .digest('hex');
    const invitationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const checklist = this.getDefaultOnboardingChecklist(edition);

    // Atomically provision resources
    const provisionResult = await this.prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: registration.organizationName,
          code: orgCode,
          type: registration.organizationType,
          status: OrganizationStatus.ACTIVE,
          edition,
          subscriptionTier: dto.subscriptionTier || edition,
          maxBranches: dto.maxBranches || (edition === OrganizationEdition.ENTERPRISE ? 10 : 3),
          maxUsers: dto.maxUsers || (edition === OrganizationEdition.ENTERPRISE ? 100 : 25),
        },
      });

      // 2. Create OrganizationSettings
      const settings = await tx.organizationSettings.create({
        data: {
          organizationId: org.id,
          legalName: registration.organizationName,
          registrationNumber: registration.licenseNumber,
          address: [
            registration.address,
            registration.city,
            registration.state,
            registration.country,
          ]
            .filter(Boolean)
            .join(', '),
          phone: registration.contactPhone,
          email: registration.organizationEmail,
          website: registration.website,
          enabledModules,
          defaultTimezone: 'Asia/Kolkata',
          defaultCurrency: 'INR',
        },
      });

      // 3. Create Default Primary HospitalBranch
      const branch = await tx.hospitalBranch.create({
        data: {
          organizationId: org.id,
          name: `${registration.organizationName} - Main Facility`,
          code: `${orgCode}-01`,
          active: true,
          address: [registration.address, registration.city].filter(Boolean).join(', '),
          phone: registration.contactPhone,
        },
      });

      // 4. Create OrganizationOnboarding Checklist
      const onboarding = await tx.organizationOnboarding.create({
        data: {
          organizationId: org.id,
          isCompleted: false,
          currentStep: 'staff_invitation',
          checklist,
        },
      });

      // 5. Create StaffInvitation for Initial Organization Administrator
      const invitation = await tx.staffInvitation.create({
        data: {
          token: rawInvitationToken,
          email: registration.adminEmail.toLowerCase().trim(),
          name: registration.adminFullName.trim(),
          organizationId: org.id,
          branchId: branch.id,
          role: 'Admin',
          expiresAt: invitationExpiry,
          invitedById: BigInt(superAdminId),
        },
      });

      // 6. Update OrganizationRegistration status
      const updatedReg = await tx.organizationRegistration.update({
        where: { id: regId },
        data: {
          status: RegistrationStatus.ACTIVE,
          approvedEdition: edition,
          organizationId: org.id,
          approvedById: BigInt(superAdminId),
          approvedAt: new Date(),
        },
      });

      return { org, settings, branch, onboarding, invitation, updatedReg };
    });

    // 7. Audit Log
    await this.logPlatformAction({
      actorUserId: BigInt(superAdminId),
      action: 'ORGANIZATION_REGISTRATION_APPROVED_AND_PROVISIONED',
      targetType: 'OrganizationRegistration',
      targetId: regId.toString(),
      organizationId: provisionResult.org.id,
      details: {
        organizationId: provisionResult.org.id.toString(),
        organizationName: provisionResult.org.name,
        code: provisionResult.org.code,
        edition,
        adminEmail: registration.adminEmail,
        reference: registration.reference,
      },
    });

    this.logger.log(
      `Organization Registration ${registration.reference} approved and provisioned as Organization #${provisionResult.org.id} (${provisionResult.org.name}) by Super Admin #${superAdminId}`,
    );

    return {
      success: true,
      message: 'Organization registration approved and fully provisioned.',
      organizationId: provisionResult.org.id.toString(),
      organizationName: provisionResult.org.name,
      organizationCode: provisionResult.org.code,
      reference: registration.reference,
      invitationToken: rawInvitationToken,
      invitationExpiresAt: invitationExpiry,
    };
  }

  /**
   * Super Admin: Reject organization registration with mandatory reason
   */
  async rejectRegistration(
    id: string | bigint,
    dto: RejectRegistrationDto,
    superAdminId: string | bigint,
  ) {
    const regId = BigInt(id);
    const registration = await this.prisma.organizationRegistration.findUnique({
      where: { id: regId },
    });

    if (!registration) {
      throw new NotFoundException(`Registration #${id} not found.`);
    }

    if (registration.status === RegistrationStatus.ACTIVE) {
      throw new ConflictException('Cannot reject an active, provisioned organization registration.');
    }

    const updated = await this.prisma.organizationRegistration.update({
      where: { id: regId },
      data: {
        status: RegistrationStatus.REJECTED,
        rejectionReason: dto.rejectionReason.trim(),
        rejectedById: BigInt(superAdminId),
        rejectedAt: new Date(),
      },
    });

    await this.logPlatformAction({
      actorUserId: BigInt(superAdminId),
      action: 'ORGANIZATION_REGISTRATION_REJECTED',
      targetType: 'OrganizationRegistration',
      targetId: regId.toString(),
      details: {
        reference: registration.reference,
        organizationName: registration.organizationName,
        adminEmail: registration.adminEmail,
        rejectionReason: dto.rejectionReason,
      },
    });

    this.logger.log(
      `Organization Registration ${registration.reference} rejected by Super Admin #${superAdminId}. Reason: ${dto.rejectionReason}`,
    );

    return {
      success: true,
      message: 'Organization registration rejected.',
      reference: updated.reference,
      rejectionReason: updated.rejectionReason,
    };
  }

  /**
   * Super Admin: Idempotently retry failed provisioning for an approved registration
   */
  async retryProvisioning(id: string | bigint, superAdminId: string | bigint) {
    const regId = BigInt(id);
    const registration = await this.prisma.organizationRegistration.findUnique({
      where: { id: regId },
      include: {
        organization: {
          include: {
            branches: true,
            settings: true,
            onboarding: true,
            staffInvitations: true,
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException(`Registration #${id} not found.`);
    }

    if (
      registration.status !== RegistrationStatus.APPROVED &&
      registration.status !== RegistrationStatus.PROVISIONING &&
      registration.status !== RegistrationStatus.PENDING_APPROVAL
    ) {
      // If it's already active and all pieces exist, return idempotently
      if (
        registration.status === RegistrationStatus.ACTIVE &&
        registration.organization &&
        registration.organization.branches.length > 0 &&
        registration.organization.settings &&
        registration.organization.onboarding
      ) {
        return {
          success: true,
          message: 'Organization is already fully provisioned and active.',
          organizationId: registration.organization.id.toString(),
          reference: registration.reference,
        };
      }
    }

    // Delegate to approval workflow with existing parameters
    return this.approveRegistration(
      id,
      { approvedEdition: registration.requestedEdition },
      superAdminId,
    );
  }
}

