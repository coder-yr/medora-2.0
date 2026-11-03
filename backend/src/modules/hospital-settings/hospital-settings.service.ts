import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateHospitalSettingsDto,
  UpdateBrandingDto,
  CreateBranchDto,
  UpdateBranchDto,
  UpdateBranchSettingsDto,
  AssignUserBranchDto,
  QueryAuditLogsDto,
} from './dto/hospital-settings.dto';

export interface EffectiveHospitalSettings {
  hospitalName: string;
  legalName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  timezone: string;
  currency: string;
  locale: string;
  dateFormat: string;
  timeFormat: string;
  invoicePrefix: string;
  mrnPrefix: string;
  appointmentPrefix: string;
  admissionPrefix: string;
  receiptHeader: string;
  receiptFooter: string;
  invoiceFooter: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  operatingHours: Record<string, any> | null;
}

@Injectable()
export class HospitalSettingsService {
  private readonly logger = new Logger(HospitalSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // 1. HOSPITAL-WIDE SETTINGS & BRANDING
  // ===========================================================================

  async getHospitalSettings() {
    let settings = await this.prisma.hospitalSettings.findFirst({
      include: {
        updatedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!settings) {
      settings = await this.prisma.hospitalSettings.create({
        data: {
          hospitalName: 'Medora Central Hospital',
          legalName: 'Medora Healthcare System (Pvt) Ltd',
          registrationNumber: 'HOSP-KHI-2026-9041',
          taxNumber: 'NTN-4892019-7',
          email: 'info@medora.hospital',
          phone: '+92-21-34930051',
          website: 'https://medora.hospital',
          address: 'Plot 12-C, Stadium Road, Karachi, Pakistan',
          defaultLocale: 'en',
          defaultTimezone: 'Asia/Karachi',
          defaultCurrency: 'PKR',
          dateFormat: 'YYYY-MM-DD',
          timeFormat: 'HH:mm',
          primaryColor: '#0284c7',
          secondaryColor: '#0f172a',
          receiptHeader: 'MEDORA CENTRAL HOSPITAL\nPlot 12-C, Stadium Road, Karachi',
          receiptFooter: 'Thank you for choosing Medora Central Hospital.\nWishing you a speedy recovery.',
          invoiceFooter: 'Payment is due upon receipt. Computer generated invoice.',
        },
        include: {
          updatedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
    }

    return this.serializeBigInt(settings);
  }

  async updateHospitalSettings(
    dto: UpdateHospitalSettingsDto,
    actorUserId: bigint,
    reason?: string,
  ) {
    const current = await this.prisma.hospitalSettings.findFirst();
    if (!current) {
      await this.getHospitalSettings();
    }
    const target = (await this.prisma.hospitalSettings.findFirst())!;

    const updateData: Record<string, any> = {
      hospitalName: dto.hospitalName,
      updatedById: actorUserId,
    };

    if (dto.legalName !== undefined) updateData.legalName = dto.legalName;
    if (dto.registrationNumber !== undefined) updateData.registrationNumber = dto.registrationNumber;
    if (dto.taxNumber !== undefined) updateData.taxNumber = dto.taxNumber;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.alternatePhone !== undefined) updateData.alternatePhone = dto.alternatePhone;
    if (dto.website !== undefined) updateData.website = dto.website;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.defaultLocale !== undefined) updateData.defaultLocale = dto.defaultLocale;
    if (dto.defaultTimezone !== undefined) updateData.defaultTimezone = dto.defaultTimezone;
    if (dto.defaultCurrency !== undefined) updateData.defaultCurrency = dto.defaultCurrency;
    if (dto.dateFormat !== undefined) updateData.dateFormat = dto.dateFormat;
    if (dto.timeFormat !== undefined) updateData.timeFormat = dto.timeFormat;
    if (dto.receiptHeader !== undefined) updateData.receiptHeader = dto.receiptHeader;
    if (dto.receiptFooter !== undefined) updateData.receiptFooter = dto.receiptFooter;
    if (dto.invoiceFooter !== undefined) updateData.invoiceFooter = dto.invoiceFooter;

    // Record audit entries for modified keys
    const auditEntries: Array<{
      actorUserId: bigint;
      scope: string;
      settingKey: string;
      previousValue: string | null;
      newValue: string | null;
      changeReason: string | null;
    }> = [];

    const effectiveReason = reason || dto.changeReason || 'Hospital settings updated';

    for (const [key, newVal] of Object.entries(updateData)) {
      if (key === 'updatedById') continue;
      const prevVal = (target as any)[key];
      if (String(prevVal ?? '') !== String(newVal ?? '')) {
        auditEntries.push({
          actorUserId,
          scope: 'HOSPITAL',
          settingKey: key,
          previousValue: prevVal !== null && prevVal !== undefined ? String(prevVal) : null,
          newValue: newVal !== null && newVal !== undefined ? String(newVal) : null,
          changeReason: effectiveReason,
        });
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.hospitalSettings.update({
        where: { id: target.id },
        data: updateData,
        include: {
          updatedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      if (auditEntries.length > 0) {
        await tx.configurationAuditLog.createMany({
          data: auditEntries,
        });
      }

      return res;
    });

    return this.serializeBigInt(updated);
  }

  async updateBranding(
    dto: UpdateBrandingDto,
    actorUserId: bigint,
    reason?: string,
  ) {
    const current = (await this.prisma.hospitalSettings.findFirst())!;
    const effectiveReason = reason || dto.changeReason || 'Branding assets updated';

    const updateData: Record<string, any> = {
      updatedById: actorUserId,
    };

    if (dto.logoUrl !== undefined) updateData.logoUrl = dto.logoUrl;
    if (dto.faviconUrl !== undefined) updateData.faviconUrl = dto.faviconUrl;
    if (dto.primaryColor !== undefined) updateData.primaryColor = dto.primaryColor;
    if (dto.secondaryColor !== undefined) updateData.secondaryColor = dto.secondaryColor;

    const auditEntries: Array<{
      actorUserId: bigint;
      scope: string;
      settingKey: string;
      previousValue: string | null;
      newValue: string | null;
      changeReason: string | null;
    }> = [];

    for (const [key, newVal] of Object.entries(updateData)) {
      if (key === 'updatedById') continue;
      const prevVal = (current as any)[key];
      if (String(prevVal ?? '') !== String(newVal ?? '')) {
        auditEntries.push({
          actorUserId,
          scope: 'HOSPITAL',
          settingKey: `branding.${key}`,
          previousValue: prevVal !== null && prevVal !== undefined ? String(prevVal) : null,
          newValue: newVal !== null && newVal !== undefined ? String(newVal) : null,
          changeReason: effectiveReason,
        });
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.hospitalSettings.update({
        where: { id: current.id },
        data: updateData,
        include: {
          updatedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      if (auditEntries.length > 0) {
        await tx.configurationAuditLog.createMany({
          data: auditEntries,
        });
      }

      return res;
    });

    return this.serializeBigInt(updated);
  }

  // ===========================================================================
  // 2. MULTI-BRANCH MANAGEMENT & LIFECYCLE
  // ===========================================================================

  async listBranches(includeInactive = false) {
    const where: any = { deletedAt: null };
    if (!includeInactive) {
      where.active = true;
    }

    const branches = await this.prisma.hospitalBranch.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        settings: true,
        _count: {
          select: {
            userMemberships: { where: { isActive: true } },
            patients: true,
          },
        },
      },
    });

    return this.serializeBigInt(branches);
  }

  async getBranchById(id: bigint) {
    const branch = await this.prisma.hospitalBranch.findFirst({
      where: { id, deletedAt: null },
      include: {
        settings: true,
        _count: {
          select: {
            userMemberships: { where: { isActive: true } },
            patients: true,
            invoices: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException(`Branch #${id} not found`);
    }

    return this.serializeBigInt(branch);
  }

  async createBranch(dto: CreateBranchDto, actorUserId: bigint) {
    const normalizedCode = dto.code.trim().toUpperCase();

    const existing = await this.prisma.hospitalBranch.findFirst({
      where: { code: normalizedCode, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException(`Branch code "${normalizedCode}" is already in use`);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const branch = await tx.hospitalBranch.create({
        data: {
          name: dto.name.trim(),
          code: normalizedCode,
          address: dto.address?.trim() || null,
          phone: dto.phone?.trim() || null,
          active: dto.active ?? true,
        },
      });

      // Default branch settings with branch-specific prefixes
      await tx.branchSettings.create({
        data: {
          branchId: branch.id,
          invoicePrefix: `INV-${normalizedCode}-`,
          mrnPrefix: `MRN-${normalizedCode}-`,
          appointmentPrefix: `APT-${normalizedCode}-`,
          admissionPrefix: `ADM-${normalizedCode}-`,
          operatingHours: { weekdays: '08:00 - 20:00', emergency: '24/7' },
          updatedById: actorUserId,
        },
      });

      await tx.configurationAuditLog.create({
        data: {
          actorUserId,
          scope: 'BRANCH',
          branchId: branch.id,
          settingKey: 'branch.create',
          newValue: JSON.stringify({ name: branch.name, code: branch.code }),
          changeReason: `New branch ${branch.code} initialized`,
        },
      });

      return branch;
    });

    return this.getBranchById(created.id);
  }

  async updateBranch(id: bigint, dto: UpdateBranchDto, actorUserId: bigint) {
    const branch = await this.prisma.hospitalBranch.findFirst({
      where: { id, deletedAt: null },
    });

    if (!branch) {
      throw new NotFoundException(`Branch #${id} not found`);
    }

    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.address !== undefined) updateData.address = dto.address.trim() || null;
    if (dto.phone !== undefined) updateData.phone = dto.phone.trim() || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.hospitalBranch.update({
        where: { id },
        data: updateData,
        include: { settings: true },
      });

      await tx.configurationAuditLog.create({
        data: {
          actorUserId,
          scope: 'BRANCH',
          branchId: id,
          settingKey: 'branch.profile',
          previousValue: JSON.stringify({
            name: branch.name,
            address: branch.address,
            phone: branch.phone,
          }),
          newValue: JSON.stringify(updateData),
          changeReason: 'Branch profile updated',
        },
      });

      return res;
    });

    return this.serializeBigInt(updated);
  }

  async setBranchStatus(
    id: bigint,
    active: boolean,
    actorUserId: bigint,
    reason?: string,
  ) {
    const branch = await this.prisma.hospitalBranch.findFirst({
      where: { id, deletedAt: null },
    });

    if (!branch) {
      throw new NotFoundException(`Branch #${id} not found`);
    }

    // Safety check when deactivating: reject if active open shifts exist
    if (!active) {
      const openShift = await this.prisma.cashierShift.findFirst({
        where: { branchId: id, status: 'OPEN' },
      });

      if (openShift) {
        throw new BadRequestException(
          `Cannot deactivate branch "${branch.name}". Open cashier shift #${openShift.id} must be reconciled and closed first.`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.hospitalBranch.update({
        where: { id },
        data: { active },
        include: { settings: true },
      });

      await tx.configurationAuditLog.create({
        data: {
          actorUserId,
          scope: 'BRANCH',
          branchId: id,
          settingKey: 'branch.status',
          previousValue: String(branch.active),
          newValue: String(active),
          changeReason: reason || (active ? 'Branch activated' : 'Branch deactivated'),
        },
      });

      return res;
    });

    return this.serializeBigInt(updated);
  }

  // ===========================================================================
  // 3. BRANCH-SPECIFIC OPERATIONAL SETTINGS & INHERITANCE
  // ===========================================================================

  async getBranchSettings(branchId: bigint) {
    let settings = await this.prisma.branchSettings.findUnique({
      where: { branchId },
      include: {
        branch: { select: { id: true, name: true, code: true, active: true } },
      },
    });

    if (!settings) {
      const branch = await this.prisma.hospitalBranch.findUnique({
        where: { id: branchId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch #${branchId} not found`);
      }

      settings = await this.prisma.branchSettings.create({
        data: {
          branchId,
          invoicePrefix: `INV-${branch.code}-`,
          mrnPrefix: `MRN-${branch.code}-`,
          appointmentPrefix: `APT-${branch.code}-`,
          admissionPrefix: `ADM-${branch.code}-`,
        },
        include: {
          branch: { select: { id: true, name: true, code: true, active: true } },
        },
      });
    }

    return this.serializeBigInt(settings);
  }

  async getEffectiveSettings(branchId: bigint): Promise<EffectiveHospitalSettings> {
    const branch = await this.prisma.hospitalBranch.findUnique({
      where: { id: branchId },
      include: { settings: true },
    });

    if (!branch) {
      throw new NotFoundException(`Branch #${branchId} not found`);
    }

    const hospital = await this.prisma.hospitalSettings.findFirst();
    const branchSettings = branch.settings;

    // 3-Tier Precedence: Branch Override ?? Hospital Default ?? System Fallback
    return {
      hospitalName: hospital?.hospitalName || 'Medora Central Hospital',
      legalName: hospital?.legalName || null,
      registrationNumber: hospital?.registrationNumber || null,
      taxNumber: hospital?.taxNumber || null,
      email: hospital?.email || null,
      phone: branch.phone || hospital?.phone || null,
      website: hospital?.website || null,
      address: branch.address || hospital?.address || null,
      branchId: branch.id.toString(),
      branchName: branch.name,
      branchCode: branch.code,
      timezone: branchSettings?.timezoneOverride || hospital?.defaultTimezone || 'Asia/Karachi',
      currency: branchSettings?.currencyOverride || hospital?.defaultCurrency || 'PKR',
      locale: hospital?.defaultLocale || 'en',
      dateFormat: hospital?.dateFormat || 'YYYY-MM-DD',
      timeFormat: hospital?.timeFormat || 'HH:mm',
      invoicePrefix: branchSettings?.invoicePrefix || `INV-${branch.code}-`,
      mrnPrefix: branchSettings?.mrnPrefix || `MRN-${branch.code}-`,
      appointmentPrefix: branchSettings?.appointmentPrefix || `APT-${branch.code}-`,
      admissionPrefix: branchSettings?.admissionPrefix || `ADM-${branch.code}-`,
      receiptHeader: branchSettings?.receiptHeaderOverride || hospital?.receiptHeader || branch.name,
      receiptFooter:
        branchSettings?.receiptFooterOverride ||
        hospital?.receiptFooter ||
        'Thank you for choosing us.',
      invoiceFooter: hospital?.invoiceFooter || 'Payment is due upon receipt.',
      logoUrl: branchSettings?.logoUrlOverride || hospital?.logoUrl || null,
      primaryColor: branchSettings?.primaryColorOverride || hospital?.primaryColor || '#0284c7',
      secondaryColor: hospital?.secondaryColor || '#0f172a',
      operatingHours: (branchSettings?.operatingHours as Record<string, any>) || null,
    };
  }

  async updateBranchSettings(
    branchId: bigint,
    dto: UpdateBranchSettingsDto,
    actorUserId: bigint,
    reason?: string,
  ) {
    const branch = await this.prisma.hospitalBranch.findUnique({
      where: { id: branchId },
      include: { settings: true },
    });

    if (!branch) {
      throw new NotFoundException(`Branch #${branchId} not found`);
    }

    const current = branch.settings || (await this.getBranchSettings(branchId));

    const updateData: Record<string, any> = {
      updatedById: actorUserId,
    };

    if (dto.operatingHours !== undefined) updateData.operatingHours = dto.operatingHours;
    if (dto.timezoneOverride !== undefined) updateData.timezoneOverride = dto.timezoneOverride || null;
    if (dto.currencyOverride !== undefined) updateData.currencyOverride = dto.currencyOverride || null;
    if (dto.receiptHeaderOverride !== undefined) updateData.receiptHeaderOverride = dto.receiptHeaderOverride || null;
    if (dto.receiptFooterOverride !== undefined) updateData.receiptFooterOverride = dto.receiptFooterOverride || null;
    if (dto.invoicePrefix !== undefined) updateData.invoicePrefix = dto.invoicePrefix || null;
    if (dto.mrnPrefix !== undefined) updateData.mrnPrefix = dto.mrnPrefix || null;
    if (dto.appointmentPrefix !== undefined) updateData.appointmentPrefix = dto.appointmentPrefix || null;
    if (dto.admissionPrefix !== undefined) updateData.admissionPrefix = dto.admissionPrefix || null;
    if (dto.logoUrlOverride !== undefined) updateData.logoUrlOverride = dto.logoUrlOverride || null;
    if (dto.primaryColorOverride !== undefined) updateData.primaryColorOverride = dto.primaryColorOverride || null;

    const effectiveReason = reason || dto.changeReason || `Branch settings updated for ${branch.code}`;

    const auditEntries: Array<{
      actorUserId: bigint;
      scope: string;
      branchId: bigint;
      settingKey: string;
      previousValue: string | null;
      newValue: string | null;
      changeReason: string | null;
    }> = [];

    for (const [key, newVal] of Object.entries(updateData)) {
      if (key === 'updatedById') continue;
      const prevVal = (current as any)[key];
      const serializedPrev = typeof prevVal === 'object' && prevVal !== null ? JSON.stringify(prevVal) : String(prevVal ?? '');
      const serializedNew = typeof newVal === 'object' && newVal !== null ? JSON.stringify(newVal) : String(newVal ?? '');

      if (serializedPrev !== serializedNew) {
        auditEntries.push({
          actorUserId,
          scope: 'BRANCH',
          branchId,
          settingKey: key,
          previousValue: prevVal !== null && prevVal !== undefined ? (typeof prevVal === 'object' ? JSON.stringify(prevVal) : String(prevVal)) : null,
          newValue: newVal !== null && newVal !== undefined ? (typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)) : null,
          changeReason: effectiveReason,
        });
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.branchSettings.upsert({
        where: { branchId },
        update: updateData,
        create: {
          ...updateData,
          branchId,
        },
      });

      if (auditEntries.length > 0) {
        await tx.configurationAuditLog.createMany({
          data: auditEntries,
        });
      }

      return res;
    });

    return this.serializeBigInt(updated);
  }

  // ===========================================================================
  // 4. USER-TO-BRANCH MEMBERSHIP & ACCESS CONTROL
  // ===========================================================================

  async listUserMemberships(branchId?: bigint, userId?: bigint) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (userId) where.userId = userId;

    const memberships = await this.prisma.userBranchMembership.findMany({
      where,
      orderBy: { assignedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            login: true,
            group: true,
          },
        },
        branch: {
          select: { id: true, name: true, code: true, active: true },
        },
        assignedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return this.serializeBigInt(memberships);
  }

  async assignUserBranch(dto: AssignUserBranchDto, actorUserId: bigint) {
    if (!dto.branchId) {
      throw new BadRequestException('Branch ID is required for assignment');
    }
    const userId = BigInt(dto.userId);
    const branchId = BigInt(dto.branchId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User #${userId} not found`);

    const branch = await this.prisma.hospitalBranch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException(`Branch #${branchId} not found`);

    const membership = await this.prisma.$transaction(async (tx) => {
      // If setting as default, clear other default flags for this user
      if (dto.isDefault) {
        await tx.userBranchMembership.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });

        await tx.user.update({
          where: { id: userId },
          data: { branchId },
        });
      }

      const res = await tx.userBranchMembership.upsert({
        where: { userId_branchId: { userId, branchId } },
        update: {
          isActive: true,
          isDefault: dto.isDefault ?? false,
          accessRole: dto.accessRole || null,
          notes: dto.notes || null,
          revokedAt: null,
          revokedById: null,
        },
        create: {
          userId,
          branchId,
          isActive: true,
          isDefault: dto.isDefault ?? false,
          accessRole: dto.accessRole || null,
          notes: dto.notes || null,
          assignedById: actorUserId,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, login: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      });

      await tx.configurationAuditLog.create({
        data: {
          actorUserId,
          scope: 'BRANCH',
          branchId,
          settingKey: 'membership.assigned',
          newValue: JSON.stringify({ userId: userId.toString(), branchCode: branch.code, isDefault: dto.isDefault }),
          changeReason: `User ${user.login} assigned to branch ${branch.code}`,
        },
      });

      return res;
    });

    return this.serializeBigInt(membership);
  }

  async revokeUserBranch(
    userId: bigint,
    branchId: bigint,
    actorUserId: bigint,
    reason?: string,
  ) {
    const membership = await this.prisma.userBranchMembership.findUnique({
      where: { userId_branchId: { userId, branchId } },
      include: {
        user: { select: { login: true, branchId: true } },
        branch: { select: { code: true } },
      },
    });

    if (!membership) {
      throw new NotFoundException('Branch membership assignment not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.userBranchMembership.update({
        where: { userId_branchId: { userId, branchId } },
        data: {
          isActive: false,
          isDefault: false,
          revokedAt: new Date(),
          revokedById: actorUserId,
        },
      });

      // If user's primary branchId was this branch, reassign to another active membership if available
      if (membership.user.branchId === branchId) {
        const nextActive = await tx.userBranchMembership.findFirst({
          where: { userId, branchId: { not: branchId }, isActive: true },
        });

        await tx.user.update({
          where: { id: userId },
          data: { branchId: nextActive ? nextActive.branchId : null },
        });
      }

      await tx.configurationAuditLog.create({
        data: {
          actorUserId,
          scope: 'BRANCH',
          branchId,
          settingKey: 'membership.revoked',
          previousValue: JSON.stringify({ userId: userId.toString(), branchCode: membership.branch.code }),
          changeReason: reason || `User ${membership.user.login} revoked from branch ${membership.branch.code}`,
        },
      });

      return res;
    });

    return this.serializeBigInt(updated);
  }

  async getUserAccessibleBranches(userId: bigint, isGlobalAdmin: boolean) {
    if (isGlobalAdmin) {
      return this.listBranches(false);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { branchId: true },
    });

    const memberships = await this.prisma.userBranchMembership.findMany({
      where: {
        userId,
        isActive: true,
        branch: { active: true, deletedAt: null },
      },
      include: {
        branch: {
          include: {
            settings: true,
          },
        },
      },
    });

    const accessible = memberships.map((m) => ({
      ...m.branch,
      isDefault: m.isDefault || user?.branchId === m.branchId,
    }));

    // If user has home branchId not yet recorded in memberships, include it
    if (user?.branchId && !accessible.some((b) => BigInt(b.id) === user.branchId)) {
      const homeBranch = await this.prisma.hospitalBranch.findFirst({
        where: { id: user.branchId, active: true, deletedAt: null },
        include: { settings: true },
      });
      if (homeBranch) {
        accessible.unshift({
          ...homeBranch,
          isDefault: true,
        } as any);
      }
    }

    return this.serializeBigInt(accessible);
  }

  // ===========================================================================
  // 5. CONCURRENCY-SAFE DOCUMENT NUMBER GENERATION
  // ===========================================================================

  async generateDocumentNumber(
    branchId: bigint,
    docType: 'INVOICE' | 'MRN' | 'APPOINTMENT' | 'ADMISSION',
  ): Promise<string> {
    const year = new Date().getFullYear();

    // Query effective prefix
    const branch = await this.prisma.hospitalBranch.findUnique({
      where: { id: branchId },
      include: { settings: true },
    });

    if (!branch) {
      throw new NotFoundException(`Branch #${branchId} not found`);
    }

    let prefix = '';
    const bs = branch.settings;

    switch (docType) {
      case 'INVOICE':
        prefix = bs?.invoicePrefix || `INV-${branch.code}-`;
        break;
      case 'MRN':
        prefix = bs?.mrnPrefix || `MRN-${branch.code}-`;
        break;
      case 'APPOINTMENT':
        prefix = bs?.appointmentPrefix || `APT-${branch.code}-`;
        break;
      case 'ADMISSION':
        prefix = bs?.admissionPrefix || `ADM-${branch.code}-`;
        break;
    }

    // Atomic increment inside transaction using advisory lock
    const nextSeq = await this.prisma.$transaction(async (tx) => {
      // PostgreSQL advisory transaction lock on hash of (branchId + docType + year)
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        `DOC_SEQ_${branchId}_${docType}_${year}`,
      );

      const updated = await tx.branchDocumentSequence.upsert({
        where: {
          branchId_docType_year: {
            branchId,
            docType,
            year,
          },
        },
        update: {
          sequenceNum: { increment: 1 },
        },
        create: {
          branchId,
          docType,
          year,
          sequenceNum: 1,
        },
      });

      return updated.sequenceNum;
    });

    return `${prefix}${year}-${String(nextSeq).padStart(6, '0')}`;
  }

  // ===========================================================================
  // 6. CONFIGURATION AUDIT LOG QUERYING
  // ===========================================================================

  async getAuditLogs(query: QueryAuditLogsDto) {
    const where: any = {};
    if (query.scope) where.scope = query.scope;
    if (query.branchId) where.branchId = BigInt(query.branchId);
    if (query.settingKey) where.settingKey = { contains: query.settingKey, mode: 'insensitive' };

    const take = query.limit ? Math.min(Number(query.limit), 100) : 50;
    const skip = query.offset ? Number(query.offset) : 0;

    const [logs, total] = await Promise.all([
      this.prisma.configurationAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          actorUser: {
            select: { id: true, firstName: true, lastName: true, login: true, email: true },
          },
          branch: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      this.prisma.configurationAuditLog.count({ where }),
    ]);

    return {
      data: this.serializeBigInt(logs),
      total,
      limit: take,
      offset: skip,
    };
  }

  // ===========================================================================
  // HELPER: BigInt Serializer
  // ===========================================================================

  private serializeBigInt(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (Array.isArray(obj)) return obj.map((item) => this.serializeBigInt(item));
    if (typeof obj === 'object') {
      const copy: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        copy[key] = this.serializeBigInt(value);
      }
      return copy;
    }
    return obj;
  }
}
