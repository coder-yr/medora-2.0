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
          defaultTimezone: dto.defaultTimezone ? dto.defaultTimezone.trim() : 'Asia/Karachi',
          defaultCurrency: dto.defaultCurrency ? dto.defaultCurrency.trim() : 'PKR',
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
        defaultCurrency: dto.defaultCurrency || 'PKR',
        defaultTimezone: dto.defaultTimezone || 'Asia/Karachi',
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
}
