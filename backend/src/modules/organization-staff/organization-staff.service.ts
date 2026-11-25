import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  InviteStaffDto,
  UpdateStaffRoleDto,
  UpdateStaffStatusDto,
  AssignStaffBranchesDto,
  ALLOWED_STAFF_ROLES,
} from './dto/organization-staff.dto';

@Injectable()
export class OrganizationStaffService {
  private readonly logger = new Logger(OrganizationStaffService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all staff members with memberships in the organization
   */
  async listStaff(orgId: string | bigint) {
    const organizationId = BigInt(orgId);

    const memberships = await this.prisma.userOrganizationMembership.findMany({
      where: { organizationId },
      include: {
        user: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return memberships.map((m) => ({
      membershipId: m.id.toString(),
      userId: m.user.id.toString(),
      email: m.user.email,
      name: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.email,
      accessRole: m.accessRole,
      group: m.user.group,
      isActive: m.isActive,
      isDefault: m.isDefault,
      branchId: m.user.branchId ? m.user.branchId.toString() : null,
      branchName: m.user.branch?.name || null,
      assignedAt: m.assignedAt,
      revokedAt: m.revokedAt,
      notes: m.notes,
    }));
  }

  /**
   * Issues a secure, single-use invitation for a new staff member to join the organization
   */
  async inviteStaff(orgId: string | bigint, dto: InviteStaffDto, inviterId: string | bigint) {
    const organizationId = BigInt(orgId);
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Privilege Escalation Prevention: Never allow Org Admins to invite Super Admin
    if (
      (dto.role as string).toLowerCase() === 'superadmin' ||
      !ALLOWED_STAFF_ROLES.includes(dto.role as any)
    ) {
      throw new ForbiddenException(
        'Organization Administrators cannot assign platform-level Super Admin privileges.',
      );
    }

    // 2. Check if organization capacity limits are reached
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: { select: { users: true } },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization #${orgId} not found.`);
    }

    if (org._count.users >= org.maxUsers) {
      throw new BadRequestException(
        `Organization user limit of ${org.maxUsers} reached for subscription edition "${org.edition}". Upgrade edition to add more staff.`,
      );
    }

    // 3. Prevent duplicate active invitations
    const existingInvitation = await this.prisma.staffInvitation.findFirst({
      where: {
        organizationId,
        email: normalizedEmail,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      throw new ConflictException(
        'An active invitation is already pending for this email address.',
      );
    }

    // 4. Generate cryptographically secure token & record invitation with SHA-256 hash at rest (7 days expiry)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.staffInvitation.create({
      data: {
        organizationId,
        email: normalizedEmail,
        name: dto.name.trim(),
        role: dto.role,
        branchId: dto.branchId ? BigInt(dto.branchId) : null,
        invitedById: BigInt(inviterId),
        token: tokenHash, // Store hash at rest
        status: 'PENDING',
        expiresAt,
      },
    });

    this.logger.log(
      `Staff invitation generated for ${normalizedEmail} with role ${dto.role} in Org #${organizationId}`,
    );

    return {
      invitationId: invitation.id.toString(),
      email: invitation.email,
      name: invitation.name,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      invitationToken: rawToken, // Raw token returned to admin for distribution / verification
    };
  }

  /**
   * Lists all pending/active invitations for the organization
   */
  async listInvitations(orgId: string | bigint) {
    const organizationId = BigInt(orgId);
    const invitations = await this.prisma.staffInvitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => ({
      id: inv.id.toString(),
      email: inv.email,
      name: inv.name,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));
  }

  /**
   * Revokes an existing pending staff invitation
   */
  async revokeInvitation(
    orgId: string | bigint,
    invitationId: string | bigint,
    adminId: string | bigint,
  ) {
    const organizationId = BigInt(orgId);
    const invId = BigInt(invitationId);

    const invitation = await this.prisma.staffInvitation.findUnique({
      where: { id: invId },
    });

    if (!invitation || invitation.organizationId !== organizationId) {
      throw new NotFoundException(`Invitation #${invitationId} not found in this organization.`);
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(`Cannot revoke invitation with status "${invitation.status}".`);
    }

    const updated = await this.prisma.staffInvitation.update({
      where: { id: invId },
      data: { status: 'REVOKED' },
    });

    return {
      invitationId: updated.id.toString(),
      status: updated.status,
      revokedBy: String(adminId),
    };
  }

  /**
   * Updates an existing staff member's organization role
   */
  async updateRole(
    orgId: string | bigint,
    membershipId: string | bigint,
    dto: UpdateStaffRoleDto,
    adminId: string | bigint,
  ) {
    const organizationId = BigInt(orgId);
    const mId = BigInt(membershipId);

    // 1. Privilege Escalation Prevention
    if (
      (dto.role as string).toLowerCase() === 'superadmin' ||
      !ALLOWED_STAFF_ROLES.includes(dto.role as any)
    ) {
      throw new ForbiddenException(
        'Organization Administrators cannot assign platform-level Super Admin privileges.',
      );
    }

    // 2. Atomic Last Active Administrator Protection with Row-level Locking
    const updated = await this.prisma.$transaction(async (tx) => {
      // Row-level lock on the organization record serializes concurrent admin modifications
      await tx.$executeRaw`SELECT id FROM organizations WHERE id = ${organizationId} FOR UPDATE`;

      const currentMembership = await tx.userOrganizationMembership.findUnique({
        where: { id: mId },
        include: { user: true },
      });

      if (!currentMembership || currentMembership.organizationId !== organizationId) {
        throw new NotFoundException(`Membership #${membershipId} not found in this organization.`);
      }

      if (currentMembership.accessRole === 'Admin' && dto.role !== 'Admin') {
        const adminCount = await tx.userOrganizationMembership.count({
          where: {
            organizationId,
            accessRole: 'Admin',
            isActive: true,
          },
        });

        if (adminCount <= 1) {
          throw new BadRequestException(
            'Cannot demote the only active Organization Administrator. Assign another admin first.',
          );
        }
      }

      const mem = await tx.userOrganizationMembership.update({
        where: { id: mId },
        data: { accessRole: dto.role },
      });

      await tx.user.update({
        where: { id: currentMembership.userId },
        data: { group: dto.role as any },
      });

      return { mem, userId: currentMembership.userId };
    });

    return {
      membershipId: updated.mem.id.toString(),
      userId: updated.userId.toString(),
      newRole: updated.mem.accessRole,
    };
  }

  /**
   * Activates or deactivates a staff member's organization membership
   */
  async updateStatus(
    orgId: string | bigint,
    membershipId: string | bigint,
    dto: UpdateStaffStatusDto,
    adminId: string | bigint,
  ) {
    const organizationId = BigInt(orgId);
    const mId = BigInt(membershipId);

    // Atomic Last Active Administrator Protection with Row-level Locking
    const updated = await this.prisma.$transaction(async (tx) => {
      // Row-level lock on the organization record serializes concurrent admin status updates
      await tx.$executeRaw`SELECT id FROM organizations WHERE id = ${organizationId} FOR UPDATE`;

      const currentMembership = await tx.userOrganizationMembership.findUnique({
        where: { id: mId },
      });

      if (!currentMembership || currentMembership.organizationId !== organizationId) {
        throw new NotFoundException(`Membership #${membershipId} not found in this organization.`);
      }

      // Prevent deactivating own administrative membership
      if (currentMembership.userId === BigInt(adminId) && !dto.isActive) {
        throw new BadRequestException('You cannot deactivate your own administrative membership.');
      }

      // Last Active Administrator Protection: Cannot deactivate last active admin
      if (currentMembership.accessRole === 'Admin' && !dto.isActive) {
        const adminCount = await tx.userOrganizationMembership.count({
          where: {
            organizationId,
            accessRole: 'Admin',
            isActive: true,
          },
        });

        if (adminCount <= 1) {
          throw new BadRequestException(
            'Cannot deactivate the only active Organization Administrator. Assign another admin first.',
          );
        }
      }

      return tx.userOrganizationMembership.update({
        where: { id: mId },
        data: {
          isActive: dto.isActive,
          revokedAt: dto.isActive ? null : new Date(),
          revokedById: dto.isActive ? null : BigInt(adminId),
          notes: dto.notes || currentMembership.notes,
        },
      });
    });

    return {
      membershipId: updated.id.toString(),
      isActive: updated.isActive,
      revokedAt: updated.revokedAt,
      notes: updated.notes,
    };
  }

  /**
   * Assigns authorized branches to a staff member
   */
  async assignBranches(
    orgId: string | bigint,
    membershipId: string | bigint,
    dto: AssignStaffBranchesDto,
  ) {
    const organizationId = BigInt(orgId);
    const mId = BigInt(membershipId);

    const membership = await this.prisma.userOrganizationMembership.findUnique({
      where: { id: mId },
      include: { user: true },
    });

    if (!membership || membership.organizationId !== organizationId) {
      throw new NotFoundException(`Membership #${membershipId} not found in this organization.`);
    }

    // Verify all branch IDs belong to this organization (branch isolation invariant)
    const branchIds = dto.branchIds.map((b) => BigInt(b));
    const validBranches = await this.prisma.hospitalBranch.findMany({
      where: {
        id: { in: branchIds },
        organizationId,
      },
    });

    if (validBranches.length !== branchIds.length) {
      throw new BadRequestException(
        'One or more specified branches do not belong to this organization.',
      );
    }

    // Update primary branch to the first branch in the list
    if (branchIds.length > 0) {
      await this.prisma.user.update({
        where: { id: membership.userId },
        data: { branchId: branchIds[0] },
      });

      // Synchronize UserBranchMembership records for each assigned branch
      for (const b of validBranches) {
        await this.prisma.userBranchMembership.upsert({
          where: {
            userId_branchId: {
              userId: membership.userId,
              branchId: b.id,
            },
          },
          create: {
            userId: membership.userId,
            branchId: b.id,
            accessRole: membership.accessRole,
            isActive: true,
            isDefault: b.id === branchIds[0],
          },
          update: {
            isActive: true,
            accessRole: membership.accessRole,
            isDefault: b.id === branchIds[0],
            revokedAt: null,
          },
        });
      }
    }

    return {
      membershipId: membership.id.toString(),
      userId: membership.userId.toString(),
      assignedBranchIds: validBranches.map((b: { id: bigint }) => b.id.toString()),
    };
  }

  /**
   * Retrieves organization-level audit log of staff operations
   */
  async getOrganizationActivity(orgId: string | bigint, limit = 50, offset = 0) {
    const organizationId = BigInt(orgId);

    const [total, logs] = await Promise.all([
      this.prisma.platformAuditLog.count({
        where: {
          targetType: 'Organization',
          targetId: organizationId.toString(),
        },
      }),
      this.prisma.platformAuditLog.findMany({
        where: {
          targetType: 'Organization',
          targetId: organizationId.toString(),
        },
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
        details: log.details,
        createdAt: log.createdAt,
      })),
    };
  }
}
