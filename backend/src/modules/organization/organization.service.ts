import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrganizationDto,
  OrganizationStatusDto,
  OrganizationTypeDto,
} from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all organizations in the platform, filtered optionally by status or type.
   */
  async findAll(query?: { type?: string; status?: string }) {
    const where: any = { deletedAt: null };
    if (query?.type) where.type = query.type;
    if (query?.status) where.status = query.status;

    const orgs = await this.prisma.organization.findMany({
      where,
      include: {
        settings: true,
        _count: {
          select: {
            branches: true,
            users: true,
            userMemberships: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return orgs.map((o) => this.mapOrganization(o));
  }

  /**
   * Retrieves an organization by internal numeric ID.
   */
  async findById(id: bigint | string) {
    const orgId = typeof id === 'bigint' ? id : BigInt(id);
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      include: {
        settings: true,
        branches: {
          where: { deletedAt: null },
          select: { id: true, code: true, name: true, active: true },
        },
        _count: {
          select: { users: true, userMemberships: true },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization #${id} not found.`);
    }

    return this.mapOrganization(org);
  }

  /**
   * Retrieves an organization by unique alphanumeric code or URL slug.
   */
  async findByCode(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const org = await this.prisma.organization.findFirst({
      where: { code: normalizedCode, deletedAt: null },
      include: {
        settings: true,
        branches: {
          where: { deletedAt: null },
          select: { id: true, code: true, name: true, active: true },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization with code "${code}" not found.`);
    }

    return this.mapOrganization(org);
  }

  /**
   * Creates a new independent healthcare organization (Clinic, Polyclinic, Hospital, etc.).
   * Enforces code/slug uniqueness and auto-provisions organization settings.
   */
  async create(dto: CreateOrganizationDto, creatorUserId?: bigint | string) {
    const normalizedCode = dto.code.trim().toUpperCase();

    // 1. Conflict check on unique organization code
    const existing = await this.prisma.organization.findUnique({
      where: { code: normalizedCode },
    });

    if (existing) {
      throw new ConflictException(
        `Organization code "${normalizedCode}" is already registered. Please choose a unique code.`,
      );
    }

    const type = (dto.type || OrganizationTypeDto.HOSPITAL) as any;
    const status = (dto.status || OrganizationStatusDto.ACTIVE) as any;

    const createdOrg = await this.prisma.$transaction(async (tx) => {
      // 2. Create Organization record
      const org = await tx.organization.create({
        data: {
          name: dto.name.trim(),
          code: normalizedCode,
          type,
          status,
        },
      });

      // 3. Auto-provision default organization settings
      await tx.organizationSettings.create({
        data: {
          organizationId: org.id,
          legalName: dto.legalName ? dto.legalName.trim() : dto.name.trim(),
          defaultLocale: 'en',
          defaultTimezone: dto.defaultTimezone ? dto.defaultTimezone.trim() : 'Asia/Kolkata',
          defaultCurrency: dto.defaultCurrency ? dto.defaultCurrency.trim() : 'INR',
          dateFormat: 'YYYY-MM-DD',
          timeFormat: 'HH:mm',
          primaryColor: '#0284c7',
          secondaryColor: '#0f172a',
          updatedById: creatorUserId ? BigInt(creatorUserId) : null,
        },
      });

      // 4. If creator provided, link user organization membership as default
      if (creatorUserId) {
        const userId = typeof creatorUserId === 'bigint' ? creatorUserId : BigInt(creatorUserId);
        await tx.userOrganizationMembership.upsert({
          where: {
            userId_organizationId: {
              userId,
              organizationId: org.id,
            },
          },
          create: {
            userId,
            organizationId: org.id,
            isDefault: true,
            isActive: true,
            accessRole: 'OrganizationAdmin',
          },
          update: {
            isActive: true,
          },
        });
      }

      this.logger.log(`Created organization #${org.id} [${org.code}] "${org.name}"`);
      return org;
    });

    return this.findById(createdOrg.id);
  }

  /**
   * Updates organization core profile (name, type, status).
   */
  async update(id: bigint | string, dto: UpdateOrganizationDto) {
    const orgId = typeof id === 'bigint' ? id : BigInt(id);
    await this.findById(orgId); // Throws 404 if missing

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data,
      include: { settings: true },
    });

    return this.mapOrganization(updated);
  }

  /**
   * Retrieves organization settings by organization ID.
   */
  async getSettings(organizationId: bigint | string) {
    const orgId = typeof organizationId === 'bigint' ? organizationId : BigInt(organizationId);
    const settings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });

    if (!settings) {
      throw new NotFoundException(`Settings for organization #${organizationId} not found.`);
    }

    return {
      id: String(settings.id),
      organizationId: String(settings.organizationId),
      legalName: settings.legalName,
      registrationNumber: settings.registrationNumber,
      taxNumber: settings.taxNumber,
      email: settings.email,
      phone: settings.phone,
      website: settings.website,
      address: settings.address,
      defaultLocale: settings.defaultLocale,
      defaultTimezone: settings.defaultTimezone,
      defaultCurrency: settings.defaultCurrency,
      dateFormat: settings.dateFormat,
      timeFormat: settings.timeFormat,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      primaryColor: settings.primaryColor,
      secondaryColor: settings.secondaryColor,
      receiptHeader: settings.receiptHeader,
      receiptFooter: settings.receiptFooter,
      invoiceFooter: settings.invoiceFooter,
      enabledModules: settings.enabledModules,
    };
  }

  /**
   * Updates organization settings.
   */
  async updateSettings(
    organizationId: bigint | string,
    dto: UpdateOrganizationSettingsDto,
    userId?: bigint | string,
  ) {
    const orgId = typeof organizationId === 'bigint' ? organizationId : BigInt(organizationId);
    await this.findById(orgId);

    const updated = await this.prisma.organizationSettings.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        legalName: dto.legalName,
        registrationNumber: dto.registrationNumber,
        taxNumber: dto.taxNumber,
        email: dto.email,
        phone: dto.phone,
        website: dto.website,
        address: dto.address,
        defaultCurrency: dto.defaultCurrency || 'INR',
        defaultTimezone: dto.defaultTimezone || 'Asia/Kolkata',
        primaryColor: dto.primaryColor || '#0284c7',
        secondaryColor: dto.secondaryColor || '#0f172a',
        receiptHeader: dto.receiptHeader,
        receiptFooter: dto.receiptFooter,
        invoiceFooter: dto.invoiceFooter,
        updatedById: userId ? BigInt(userId) : null,
      },
      update: {
        ...dto,
        updatedById: userId ? BigInt(userId) : null,
      },
    });

    return this.getSettings(orgId);
  }

  /**
   * Retrieves all organizations a user belongs to via UserOrganizationMembership.
   */
  async getUserOrganizations(userId: bigint | string) {
    const uId = typeof userId === 'bigint' ? userId : BigInt(userId);
    const memberships = await this.prisma.userOrganizationMembership.findMany({
      where: { userId: uId, isActive: true },
      include: {
        organization: {
          include: { settings: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });

    return memberships.map((m) => ({
      membershipId: String(m.id),
      isDefault: m.isDefault,
      accessRole: m.accessRole,
      assignedAt: m.assignedAt,
      organization: this.mapOrganization(m.organization),
    }));
  }

  /**
   * Retrieves all branches belonging to an organization.
   */
  async getOrganizationBranches(organizationId: bigint | string) {
    const orgId = typeof organizationId === 'bigint' ? organizationId : BigInt(organizationId);
    await this.findById(orgId);

    const branches = await this.prisma.hospitalBranch.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { id: 'asc' },
    });

    return branches.map((b) => ({
      id: String(b.id),
      organizationId: b.organizationId ? String(b.organizationId) : null,
      code: b.code,
      name: b.name,
      address: b.address,
      phone: b.phone,
      active: b.active,
      createdAt: b.createdAt,
    }));
  }

  /**
   * Retrieves active user memberships for an organization.
   */
  async getOrganizationMembers(organizationId: bigint | string) {
    const orgId = typeof organizationId === 'bigint' ? organizationId : BigInt(organizationId);
    await this.findById(orgId);

    const memberships = await this.prisma.userOrganizationMembership.findMany({
      where: { organizationId: orgId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            group: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return memberships.map((m) => ({
      id: String(m.id),
      userId: String(m.userId),
      organizationId: String(m.organizationId),
      isDefault: m.isDefault,
      isActive: m.isActive,
      accessRole: m.accessRole,
      assignedAt: m.assignedAt,
      user: m.user
        ? {
            id: String(m.user.id),
            email: m.user.email,
            name: `${m.user.firstName} ${m.user.lastName}`.trim(),
            group: m.user.group,
          }
        : null,
    }));
  }

  private mapOrganization(org: any) {
    return {
      id: String(org.id),
      name: org.name,
      code: org.code,
      type: org.type,
      status: org.status,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      settings: org.settings
        ? {
            legalName: org.settings.legalName,
            email: org.settings.email,
            phone: org.settings.phone,
            defaultCurrency: org.settings.defaultCurrency,
            defaultTimezone: org.settings.defaultTimezone,
            primaryColor: org.settings.primaryColor,
            logoUrl: org.settings.logoUrl,
          }
        : null,
      branches: org.branches ? org.branches.map((b: any) => ({ ...b, id: String(b.id) })) : undefined,
      branchCount: org._count?.branches,
      userCount: org._count?.users,
    };
  }

  /**
   * Retrieves or initializes onboarding state for an organization
   */
  async getOnboarding(id: bigint | string) {
    const orgId = typeof id === 'bigint' ? id : BigInt(id);

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { onboarding: true },
    });

    if (!org) {
      throw new NotFoundException(`Organization #${id} not found.`);
    }

    if (org.onboarding) {
      return {
        id: org.onboarding.id.toString(),
        organizationId: orgId.toString(),
        isCompleted: org.onboarding.isCompleted,
        completedAt: org.onboarding.completedAt,
        completedById: org.onboarding.completedById ? org.onboarding.completedById.toString() : null,
        currentStep: org.onboarding.currentStep,
        checklist: org.onboarding.checklist,
        createdAt: org.onboarding.createdAt,
        updatedAt: org.onboarding.updatedAt,
      };
    }

    // Default initialization if none exists
    const defaultChecklist = {
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
      clinical_modules: {
        step: 5,
        title: 'Review Subscribed Clinical Modules',
        description: 'Explore available clinical modules and consultation workflows',
        completed: false,
      },
    };

    const onboarding = await this.prisma.organizationOnboarding.create({
      data: {
        organizationId: orgId,
        isCompleted: false,
        currentStep: 'staff_invitation',
        checklist: defaultChecklist,
      },
    });

    return {
      id: onboarding.id.toString(),
      organizationId: orgId.toString(),
      isCompleted: onboarding.isCompleted,
      completedAt: onboarding.completedAt,
      completedById: null,
      currentStep: onboarding.currentStep,
      checklist: onboarding.checklist,
      createdAt: onboarding.createdAt,
      updatedAt: onboarding.updatedAt,
    };
  }

  /**
   * Updates onboarding progress, checklist items, or completes onboarding
   */
  async updateOnboarding(id: bigint | string, dto: UpdateOnboardingDto, userId: bigint | string) {
    const orgId = typeof id === 'bigint' ? id : BigInt(id);
    const uId = typeof userId === 'bigint' ? userId : BigInt(userId);

    const existing = await this.getOnboarding(orgId);
    let currentChecklist: Record<string, any> = (existing.checklist as Record<string, any>) || {};

    if (dto.checklist) {
      currentChecklist = { ...currentChecklist, ...dto.checklist };
    }

    if (dto.stepKey && dto.stepKey in currentChecklist) {
      currentChecklist[dto.stepKey] = {
        ...currentChecklist[dto.stepKey],
        completed: dto.completed !== undefined ? dto.completed : true,
        completedAt: dto.completed !== false ? new Date().toISOString() : null,
      };
    }

    // Check if all steps in checklist are completed
    const allStepsDone = Object.values(currentChecklist).every(
      (item: any) => typeof item === 'object' && item.completed === true,
    );

    const isFinished = dto.isCompleted !== undefined ? dto.isCompleted : allStepsDone;

    const updated = await this.prisma.organizationOnboarding.update({
      where: { organizationId: orgId },
      data: {
        currentStep: dto.currentStep || existing.currentStep,
        checklist: currentChecklist,
        isCompleted: isFinished,
        completedAt: isFinished ? (existing.completedAt || new Date()) : null,
        completedById: isFinished ? (existing.completedById ? BigInt(existing.completedById) : uId) : null,
      },
    });

    return {
      id: updated.id.toString(),
      organizationId: orgId.toString(),
      isCompleted: updated.isCompleted,
      completedAt: updated.completedAt,
      completedById: updated.completedById ? updated.completedById.toString() : null,
      currentStep: updated.currentStep,
      checklist: updated.checklist,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
