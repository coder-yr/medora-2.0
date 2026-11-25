import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AuthUser } from '../../common/types/auth-user.interface';
import {
  CreateFollowUpDto,
  UpdateFollowUpDto,
  CompleteFollowUpDto,
  CancelFollowUpDto,
  QueryFollowUpDto,
  FollowUpStatus,
} from './dto/follow-up.dto';

@Injectable()
export class FollowUpService {
  private readonly logger = new Logger(FollowUpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Generates a unique, sequential follow-up number: FOL-YYYYMMDD-XXXX
   */
  private async generateFollowUpNumber(): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().split('T')[0].replace(/-/g, '');
    const prefix = `FOL-${datePrefix}-`;

    const count = await this.prisma.followUp.count({
      where: {
        followUpNumber: { startsWith: prefix },
      },
    });

    const sequence = (count + 1).toString().padStart(4, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Creates a new clinical follow-up record and schedules automated reminder if configured
   */
  async create(dto: CreateFollowUpDto, user: AuthUser) {
    const orgId = user.organizationId ? BigInt(user.organizationId) : null;
    if (!orgId) {
      throw new BadRequestException('User does not have an active organization context.');
    }

    const branchId = dto.branchId ? BigInt(dto.branchId) : user.branchId ? BigInt(user.branchId) : null;
    if (!branchId) {
      throw new BadRequestException('Hospital branch is required to schedule a follow-up.');
    }

    const patientId = BigInt(dto.patientId);
    const doctorId = BigInt(dto.doctorId);
    const consultationId = dto.consultationId ? BigInt(dto.consultationId) : null;

    // Validate patient exists
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: { notificationPreferences: true },
    });
    if (!patient) {
      throw new NotFoundException(`Patient #${dto.patientId} not found.`);
    }

    // Validate doctor exists
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor #${dto.doctorId} not found.`);
    }

    const followUpNumber = await this.generateFollowUpNumber();
    const dueDateObj = new Date(dto.dueDate);

    // Calculate reminder time (default 24h prior to due date)
    const reminderScheduledAt = new Date(dueDateObj);
    reminderScheduledAt.setDate(reminderScheduledAt.getDate() - 1);
    reminderScheduledAt.setHours(9, 0, 0, 0); // 9:00 AM day before

    const followUp = await this.prisma.followUp.create({
      data: {
        followUpNumber,
        organizationId: orgId,
        branchId,
        patientId,
        doctorId,
        consultationId,
        dueDate: dueDateObj,
        dueTime: dto.dueTime || null,
        reason: dto.reason.trim(),
        priority: dto.priority || 'ROUTINE',
        status: FollowUpStatus.SCHEDULED,
        clinicalNotes: dto.clinicalNotes?.trim() || null,
        reminderPreference: dto.reminderPreference || 'IN_APP',
        reminderScheduledAt: dto.reminderPreference !== 'NONE' ? reminderScheduledAt : null,
      },
      include: {
        patient: { select: { id: true, name: true, phone: true, email: true } },
        doctor: { select: { id: true, name: true, department: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    // If communication consent allows, queue notification
    const consent = patient.notificationPreferences?.followUpConsent ?? true;
    if (dto.reminderPreference !== 'NONE' && consent) {
      const channel = dto.reminderPreference || 'IN_APP';
      await this.notificationService.queueNotification({
        eventType: 'PATIENT_FOLLOWUP_REMINDER',
        channel: channel as any,
        title: 'Follow-up Consultation Reminder',
        message: `Reminder: You have a scheduled clinical follow-up on ${dto.dueDate} with ${doctor.name}.`,
        branchId: branchId.toString(),
        organizationId: orgId.toString(),
        priority: dto.priority === 'CRITICAL' ? 'URGENT' : 'NORMAL',
        scheduledAt: reminderScheduledAt.toISOString(),
        deduplicationKey: `FOL-REM-${followUp.id}-24H`,
        recipients: [
          {
            patientId: patient.id.toString(),
            destination: (channel === 'EMAIL' ? patient.email : patient.phone) || undefined,
            recipientName: patient.name,
          },
        ],
        metadata: {
          followUpId: followUp.id.toString(),
          followUpNumber: followUp.followUpNumber,
          doctorId: doctor.id.toString(),
          doctorName: doctor.name,
          dueDate: dto.dueDate,
        },
      });
    }

    return this.serializeBigInt(followUp);
  }

  /**
   * Query follow-up records with role and tenant scoping
   */
  async query(query: QueryFollowUpDto, user: AuthUser) {
    const orgId = user.organizationId ? BigInt(user.organizationId) : null;
    const where: any = {};

    if (orgId) {
      where.organizationId = orgId;
    }

    if (query.branchId) {
      where.branchId = BigInt(query.branchId);
    } else if (user.branchId && user.group !== 'Admin' && user.group !== 'SuperAdmin') {
      where.branchId = BigInt(user.branchId);
    }

    if (query.patientId) {
      where.patientId = BigInt(query.patientId);
    }

    if (query.doctorId) {
      where.doctorId = BigInt(query.doctorId);
    } else if (user.group === 'Doctor') {
      // Find doctor profile for current user
      const doc = await this.prisma.doctor.findFirst({
        where: { email: { equals: user.email, mode: 'insensitive' } },
      });
      if (doc) {
        where.doctorId = doc.id;
      }
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.startDate || query.endDate) {
      where.dueDate = {};
      if (query.startDate) where.dueDate.gte = new Date(query.startDate);
      if (query.endDate) where.dueDate.lte = new Date(query.endDate);
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.followUp.findMany({
        where,
        take: limit,
        skip,
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
        include: {
          patient: { select: { id: true, name: true, phone: true, email: true } },
          doctor: { select: { id: true, name: true, department: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.followUp.count({ where }),
    ]);

    return {
      data: items.map((i) => this.serializeBigInt(i)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single follow-up details by ID
   */
  async findById(id: bigint, user: AuthUser) {
    const followUp = await this.prisma.followUp.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, phone: true, email: true, sex: true, age: true } },
        doctor: { select: { id: true, name: true, department: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
        consultation: {
          select: {
            id: true,
            date: true,
            diagnosis: true,
            soapAssessment: true,
            soapPlan: true,
          },
        },
      },
    });

    if (!followUp) {
      throw new NotFoundException(`Follow-up #${id} not found.`);
    }

    // Tenant check
    if (user.organizationId && followUp.organizationId !== BigInt(user.organizationId)) {
      throw new ForbiddenException('Cross-tenant access to follow-up record denied.');
    }

    return this.serializeBigInt(followUp);
  }

  /**
   * Updates follow-up schedule, priority, or notes
   */
  async update(id: bigint, dto: UpdateFollowUpDto, user: AuthUser) {
    const existing = await this.prisma.followUp.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Follow-up #${id} not found.`);
    }

    if (user.organizationId && existing.organizationId !== BigInt(user.organizationId)) {
      throw new ForbiddenException('Cross-tenant update to follow-up record denied.');
    }

    if (['COMPLETED', 'CANCELLED'].includes(existing.status)) {
      throw new BadRequestException(`Cannot update a ${existing.status.toLowerCase()} follow-up.`);
    }

    const data: any = {};
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    if (dto.dueTime !== undefined) data.dueTime = dto.dueTime;
    if (dto.reason) data.reason = dto.reason.trim();
    if (dto.priority) data.priority = dto.priority;
    if (dto.clinicalNotes !== undefined) data.clinicalNotes = dto.clinicalNotes?.trim() || null;
    if (dto.reminderPreference) data.reminderPreference = dto.reminderPreference;

    // Reschedule reminder if date changed
    if (dto.dueDate) {
      const newReminder = new Date(dto.dueDate);
      newReminder.setDate(newReminder.getDate() - 1);
      newReminder.setHours(9, 0, 0, 0);
      data.reminderScheduledAt = newReminder;
    }

    const updated = await this.prisma.followUp.update({
      where: { id },
      data,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        doctor: { select: { id: true, name: true, department: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    return this.serializeBigInt(updated);
  }

  /**
   * Mark follow-up as completed (e.g. consultation attended)
   */
  async complete(id: bigint, user: AuthUser, dto?: CompleteFollowUpDto) {
    const existing = await this.prisma.followUp.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Follow-up #${id} not found.`);
    }

    if (user.organizationId && existing.organizationId !== BigInt(user.organizationId)) {
      throw new ForbiddenException('Cross-tenant access to follow-up record denied.');
    }

    if (existing.status === 'COMPLETED') {
      return this.serializeBigInt(existing);
    }

    const updated = await this.prisma.followUp.update({
      where: { id },
      data: {
        status: FollowUpStatus.COMPLETED,
        completedAt: new Date(),
        clinicalNotes: dto?.notes ? `${existing.clinicalNotes || ''}\n[Completion Note]: ${dto.notes.trim()}`.trim() : existing.clinicalNotes,
      },
    });

    return this.serializeBigInt(updated);
  }

  /**
   * Cancel follow-up with clinical cancellation reason
   */
  async cancel(id: bigint, dto: CancelFollowUpDto, user: AuthUser) {
    const existing = await this.prisma.followUp.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Follow-up #${id} not found.`);
    }

    if (user.organizationId && existing.organizationId !== BigInt(user.organizationId)) {
      throw new ForbiddenException('Cross-tenant access to follow-up record denied.');
    }

    if (existing.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel an already completed follow-up.');
    }

    const updated = await this.prisma.followUp.update({
      where: { id },
      data: {
        status: FollowUpStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: dto.reason.trim(),
      },
    });

    return this.serializeBigInt(updated);
  }

  /**
   * Quick summary of upcoming follow-ups for doctor dashboard
   */
  async getUpcomingFollowUps(doctorId: bigint, days = 7) {
    const now = new Date();
    const end = new Date();
    end.setDate(now.getDate() + days);

    const items = await this.prisma.followUp.findMany({
      where: {
        doctorId,
        status: { in: ['SCHEDULED', 'REMINDER_PENDING', 'REMINDER_SENT'] },
        dueDate: {
          gte: now,
          lte: end,
        },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
      },
    });

    return items.map((i) => this.serializeBigInt(i));
  }

  private serializeBigInt(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (Array.isArray(obj)) return obj.map((item) => this.serializeBigInt(item));
    if (typeof obj === 'object') {
      const res: any = {};
      for (const [key, value] of Object.entries(obj)) {
        res[key] = this.serializeBigInt(value);
      }
      return res;
    }
    return obj;
  }
}
