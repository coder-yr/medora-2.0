import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateNotificationDto,
  UpdatePreferencesDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  QueryNotificationsDto,
  AdminQueryNotificationsDto,
} from './dto/notification.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // 1. RECIPIENT NOTIFICATION ACCESS & STATE (USER FACING)
  // ===========================================================================

  async getUserNotifications(userId: bigint, query: QueryNotificationsDto) {
    const where: any = {
      userId,
    };

    if (query.isRead !== undefined) {
      where.isRead = query.isRead === 'true' || query.isRead === true;
    }

    if (query.channel) {
      where.notification = {
        channel: query.channel,
      };
    }

    const take = query.limit ? Math.min(Number(query.limit), 100) : 30;
    const skip = query.offset ? Number(query.offset) : 0;

    const [recipients, total] = await Promise.all([
      this.prisma.notificationRecipient.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          notification: {
            include: {
              branch: {
                select: { id: true, name: true, code: true },
              },
            },
          },
        },
      }),
      this.prisma.notificationRecipient.count({ where }),
    ]);

    const items = recipients.map((r) => ({
      recipientId: r.id.toString(),
      notificationId: r.notificationId.toString(),
      uuid: r.notification.uuid,
      eventType: r.notification.eventType,
      channel: r.notification.channel,
      title: r.notification.title,
      message: r.notification.message,
      metadata: r.notification.metadata,
      priority: r.notification.priority,
      isRead: r.isRead,
      readAt: r.readAt,
      createdAt: r.createdAt,
      branch: r.notification.branch
        ? {
            id: r.notification.branch.id.toString(),
            name: r.notification.branch.name,
            code: r.notification.branch.code,
          }
        : null,
    }));

    return {
      data: items,
      total,
      limit: take,
      offset: skip,
    };
  }

  async getUnreadCount(userId: bigint): Promise<{ unreadCount: number }> {
    const count = await this.prisma.notificationRecipient.count({
      where: {
        userId,
        isRead: false,
      },
    });
    return { unreadCount: count };
  }

  async markAsRead(notificationId: bigint, userId: bigint) {
    const recipient = await this.prisma.notificationRecipient.findFirst({
      where: {
        notificationId,
        userId,
      },
    });

    if (!recipient) {
      throw new NotFoundException(
        `Notification #${notificationId} for this user was not found`,
      );
    }

    const updated = await this.prisma.notificationRecipient.update({
      where: { id: recipient.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return this.serializeBigInt(updated);
  }

  async markAllAsRead(userId: bigint) {
    const updated = await this.prisma.notificationRecipient.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updatedCount: updated.count };
  }

  // ===========================================================================
  // 2. USER PREFERENCES
  // ===========================================================================

  async getUserPreferences(userId: bigint) {
    let pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      pref = await this.prisma.notificationPreference.create({
        data: {
          userId,
          inAppEnabled: true,
          emailEnabled: true,
          smsEnabled: true,
          appointmentConsent: true,
          labConsent: true,
          followUpConsent: true,
          billingConsent: true,
          preferredChannel: 'IN_APP',
        },
      });
    }

    return this.serializeBigInt(pref);
  }

  async updateUserPreferences(userId: bigint, dto: UpdatePreferencesDto) {
    const updateData: any = {};
    if (dto.inAppEnabled !== undefined) updateData.inAppEnabled = dto.inAppEnabled;
    if (dto.emailEnabled !== undefined) updateData.emailEnabled = dto.emailEnabled;
    if (dto.smsEnabled !== undefined) updateData.smsEnabled = dto.smsEnabled;
    if (dto.appointmentConsent !== undefined) updateData.appointmentConsent = dto.appointmentConsent;
    if (dto.labConsent !== undefined) updateData.labConsent = dto.labConsent;
    if (dto.followUpConsent !== undefined) updateData.followUpConsent = dto.followUpConsent;
    if (dto.billingConsent !== undefined) updateData.billingConsent = dto.billingConsent;
    if (dto.preferredChannel !== undefined) updateData.preferredChannel = dto.preferredChannel;
    if (dto.consentSource !== undefined) {
      updateData.consentSource = dto.consentSource;
      updateData.consentGivenAt = new Date();
    }
    if (dto.channelOverrides !== undefined) updateData.channelOverrides = dto.channelOverrides;
    if (dto.quietHoursStart !== undefined) updateData.quietHoursStart = dto.quietHoursStart;
    if (dto.quietHoursEnd !== undefined) updateData.quietHoursEnd = dto.quietHoursEnd;

    const pref = await this.prisma.notificationPreference.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData,
      },
    });

    return this.serializeBigInt(pref);
  }

  async getPatientPreferences(patientId: bigint) {
    let pref = await this.prisma.notificationPreference.findUnique({
      where: { patientId },
    });

    if (!pref) {
      pref = await this.prisma.notificationPreference.create({
        data: {
          patientId,
          inAppEnabled: true,
          emailEnabled: true,
          smsEnabled: true,
          appointmentConsent: true,
          labConsent: true,
          followUpConsent: true,
          billingConsent: true,
          preferredChannel: 'IN_APP',
        },
      });
    }

    return this.serializeBigInt(pref);
  }

  async updatePatientPreferences(patientId: bigint, dto: UpdatePreferencesDto) {
    const updateData: any = {};
    if (dto.inAppEnabled !== undefined) updateData.inAppEnabled = dto.inAppEnabled;
    if (dto.emailEnabled !== undefined) updateData.emailEnabled = dto.emailEnabled;
    if (dto.smsEnabled !== undefined) updateData.smsEnabled = dto.smsEnabled;
    if (dto.appointmentConsent !== undefined) updateData.appointmentConsent = dto.appointmentConsent;
    if (dto.labConsent !== undefined) updateData.labConsent = dto.labConsent;
    if (dto.followUpConsent !== undefined) updateData.followUpConsent = dto.followUpConsent;
    if (dto.billingConsent !== undefined) updateData.billingConsent = dto.billingConsent;
    if (dto.preferredChannel !== undefined) updateData.preferredChannel = dto.preferredChannel;
    if (dto.consentSource !== undefined) {
      updateData.consentSource = dto.consentSource;
      updateData.consentGivenAt = new Date();
    }
    if (dto.channelOverrides !== undefined) updateData.channelOverrides = dto.channelOverrides;
    if (dto.quietHoursStart !== undefined) updateData.quietHoursStart = dto.quietHoursStart;
    if (dto.quietHoursEnd !== undefined) updateData.quietHoursEnd = dto.quietHoursEnd;

    const pref = await this.prisma.notificationPreference.upsert({
      where: { patientId },
      update: updateData,
      create: {
        patientId,
        ...updateData,
      },
    });

    return this.serializeBigInt(pref);
  }

  // ===========================================================================
  // 3. TRANSACTIONAL OUTBOX & EVENT INGESTION
  // ===========================================================================

  async queueNotification(dto: CreateNotificationDto, externalTx?: any) {
    const client = externalTx || this.prisma;

    // Deduplication check
    if (dto.deduplicationKey) {
      const existingOutbox = await client.notificationOutbox.findUnique({
        where: { deduplicationKey: dto.deduplicationKey },
        include: { notification: true },
      });

      if (existingOutbox) {
        this.logger.debug(
          `Deduplication hit for key "${dto.deduplicationKey}". Skipping duplicate notification.`,
        );
        return this.serializeBigInt(existingOutbox.notification);
      }
    }

    const branchId = dto.branchId ? BigInt(dto.branchId) : null;
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : new Date();

    const result = await client.$transaction
      ? await (async () => {
          // If already in a transaction, reuse
          return this.persistNotificationWithOutbox(client, dto, branchId, scheduledAt);
        })()
      : await this.prisma.$transaction(async (tx) => {
          return this.persistNotificationWithOutbox(tx, dto, branchId, scheduledAt);
        });

    return this.serializeBigInt(result);
  }

  private async persistNotificationWithOutbox(
    tx: any,
    dto: CreateNotificationDto,
    branchId: bigint | null,
    scheduledAt: Date,
  ) {
    const orgId = dto.organizationId ? BigInt(dto.organizationId) : null;

    // 1. Create Notification Header
    const notification = await tx.notification.create({
      data: {
        eventType: dto.eventType,
        channel: dto.channel,
        title: dto.title.trim(),
        message: dto.message.trim(),
        metadata: dto.metadata || null,
        priority: dto.priority || 'NORMAL',
        status: dto.channel === 'IN_APP' ? 'DELIVERED' : 'PENDING',
        organizationId: orgId,
        branchId,
        scheduledAt,
        sentAt: dto.channel === 'IN_APP' ? new Date() : null,
      },
    });

    // 2. Create Recipients
    const recipientData = dto.recipients.map((r) => ({
      notificationId: notification.id,
      userId: r.userId ? BigInt(r.userId) : null,
      patientId: r.patientId ? BigInt(r.patientId) : null,
      destination: r.destination?.trim() || null,
      recipientName: r.recipientName?.trim() || null,
      isRead: false,
    }));

    if (recipientData.length > 0) {
      await tx.notificationRecipient.createMany({
        data: recipientData,
      });
    }

    // 3. Create Outbox Record
    await tx.notificationOutbox.create({
      data: {
        notificationId: notification.id,
        channel: dto.channel,
        status: dto.channel === 'IN_APP' ? 'DELIVERED' : 'PENDING',
        scheduledAt,
        deliveredAt: dto.channel === 'IN_APP' ? new Date() : null,
        deduplicationKey: dto.deduplicationKey || null,
      },
    });

    return notification;
  }

  // ===========================================================================
  // 4. TEMPLATE RENDERING
  // ===========================================================================

  async renderTemplate(
    templateKey: string,
    channel: 'IN_APP' | 'EMAIL' | 'SMS',
    locale = 'en',
    variables: Record<string, any> = {},
  ): Promise<{ subject: string | null; body: string }> {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: {
        templateKey_channel_locale: {
          templateKey,
          channel,
          locale,
        },
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Template "${templateKey}" for channel ${channel} and locale "${locale}" not found`,
      );
    }

    let renderedSubject = template.subject;
    let renderedBody = template.body;

    for (const [key, value] of Object.entries(variables)) {
      const sanitized = this.escapeHtml(String(value ?? ''));
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      if (renderedSubject) {
        renderedSubject = renderedSubject.replace(placeholder, sanitized);
      }
      renderedBody = renderedBody.replace(placeholder, sanitized);
    }

    return {
      subject: renderedSubject,
      body: renderedBody,
    };
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ===========================================================================
  // 5. ADMINISTRATIVE NOTIFICATION MONITORING & QUEUE HEALTH
  // ===========================================================================

  async getAdminNotifications(
    query: AdminQueryNotificationsDto,
    userBranchId?: bigint | null,
    isGlobalAdmin = false,
  ) {
    const where: any = {};

    if (!isGlobalAdmin && userBranchId) {
      where.branchId = userBranchId;
    } else if (query.branchId) {
      where.branchId = BigInt(query.branchId);
    }

    if (query.channel) where.channel = query.channel;
    if (query.status) where.status = query.status;
    if (query.eventType) where.eventType = query.eventType;

    const take = query.limit ? Math.min(Number(query.limit), 100) : 30;
    const skip = query.offset ? Number(query.offset) : 0;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: { select: { id: true, name: true, code: true } },
          recipients: { select: { id: true, recipientName: true, destination: true, isRead: true } },
          outbox: { select: { id: true, status: true, attempts: true, lastError: true, nextRetryAt: true } },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: this.serializeBigInt(notifications),
      total,
      limit: take,
      offset: skip,
    };
  }

  async getNotificationById(
    id: bigint,
    userBranchId?: bigint | null,
    isGlobalAdmin = false,
  ) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        recipients: true,
        deliveries: { orderBy: { sentAt: 'desc' } },
        outbox: true,
      },
    });

    if (!notification) {
      throw new NotFoundException(`Notification #${id} not found`);
    }

    if (!isGlobalAdmin && userBranchId && notification.branchId && notification.branchId !== userBranchId) {
      throw new ForbiddenException('Cross-branch notification inspection denied');
    }

    return this.serializeBigInt(notification);
  }

  async retryNotification(notificationId: bigint, actorUserId: bigint) {
    const outbox = await this.prisma.notificationOutbox.findUnique({
      where: { notificationId },
      include: { notification: true },
    });

    if (!outbox) {
      throw new NotFoundException(`Outbox record for notification #${notificationId} not found`);
    }

    const updated = await this.prisma.notificationOutbox.update({
      where: { id: outbox.id },
      data: {
        status: 'PENDING',
        attempts: 0,
        nextRetryAt: new Date(),
        lastError: null,
        lastErrorCategory: null,
      },
    });

    this.logger.log(
      `[ADMIN_RETRY] Notification #${notificationId} manually retried by User #${actorUserId}`,
    );

    return this.serializeBigInt(updated);
  }

  async getQueueHealth() {
    const [pending, processing, retryable, deadLetter, delivered] = await Promise.all([
      this.prisma.notificationOutbox.count({ where: { status: 'PENDING' } }),
      this.prisma.notificationOutbox.count({ where: { status: 'PROCESSING' } }),
      this.prisma.notificationOutbox.count({ where: { status: 'RETRYABLE' } }),
      this.prisma.notificationOutbox.count({ where: { status: 'DEAD_LETTER' } }),
      this.prisma.notificationOutbox.count({ where: { status: 'DELIVERED' } }),
    ]);

    const status = deadLetter > 50 ? 'DEGRADED' : 'HEALTHY';

    return {
      status,
      pendingCount: pending,
      processingCount: processing,
      retryableCount: retryable,
      deadLetterCount: deadLetter,
      deliveredTotal: delivered,
      activeProviders: {
        IN_APP: 'OPERATIONAL',
        EMAIL: 'DEV_MOCK_ACTIVE',
        SMS: 'DEV_MOCK_ACTIVE',
      },
      checkedAt: new Date().toISOString(),
    };
  }

  // ===========================================================================
  // 6. TEMPLATE CRUD
  // ===========================================================================

  async listTemplates() {
    const templates = await this.prisma.notificationTemplate.findMany({
      orderBy: { templateKey: 'asc' },
    });
    return this.serializeBigInt(templates);
  }

  async createTemplate(dto: CreateTemplateDto) {
    const existing = await this.prisma.notificationTemplate.findUnique({
      where: {
        templateKey_channel_locale: {
          templateKey: dto.templateKey,
          channel: dto.channel,
          locale: dto.locale || 'en',
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Template "${dto.templateKey}" for channel ${dto.channel} already exists`,
      );
    }

    const tpl = await this.prisma.notificationTemplate.create({
      data: {
        templateKey: dto.templateKey.trim(),
        channel: dto.channel,
        locale: dto.locale || 'en',
        subject: dto.subject?.trim() || null,
        body: dto.body.trim(),
        variables: (dto.variables as any) ?? undefined,
        branchId: dto.branchId ? BigInt(dto.branchId) : null,
      },
    });

    return this.serializeBigInt(tpl);
  }

  async updateTemplate(id: bigint, dto: UpdateTemplateDto) {
    const tpl = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });

    if (!tpl) {
      throw new NotFoundException(`Template #${id} not found`);
    }

    const updateData: any = {
      version: tpl.version + 1,
    };
    if (dto.subject !== undefined) updateData.subject = dto.subject?.trim() || null;
    if (dto.body !== undefined) updateData.body = dto.body.trim();
    if (dto.variables !== undefined) updateData.variables = dto.variables;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await this.prisma.notificationTemplate.update({
      where: { id },
      data: updateData,
    });

    return this.serializeBigInt(updated);
  }

  // ===========================================================================
  // 5. APPOINTMENT REMINDER ENGINE & CLINICAL ESCALATIONS (PHASE 10.5.8)
  // ===========================================================================

  /**
   * Schedules automated 24h and 2h reminders for an appointment
   */
  async scheduleAppointmentReminders(appointmentId: bigint) {
    const apt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: {
          include: { notificationPreferences: true },
        },
        doctor: true,
      },
    });

    if (!apt) {
      this.logger.warn(`Appointment #${appointmentId} not found for reminder scheduling.`);
      return;
    }

    // Suppress reminder if appointment is already completed or cancelled
    if (['completed', 'cancelled', 'no show', 'rescheduled'].includes(apt.status.toLowerCase())) {
      this.logger.debug(`Skipping reminders for appointment #${appointmentId} with status ${apt.status}`);
      return;
    }

    const patient = apt.patient;
    const doctor = apt.doctor;
    if (!patient) return;

    // Check patient consent
    const consent = patient.notificationPreferences?.appointmentConsent ?? true;
    if (!consent) {
      this.logger.debug(`Patient #${patient.id} has opted out of appointment reminders.`);
      return;
    }

    // Parse appointment start datetime
    let startTime: Date;
    try {
      if (apt.sTime && apt.sTime.includes(':')) {
        startTime = new Date(apt.sTime);
      } else {
        startTime = new Date(apt.date);
      }
    } catch {
      startTime = new Date(apt.date);
    }

    if (isNaN(startTime.getTime())) {
      this.logger.warn(`Invalid appointment date/time for appointment #${appointmentId}`);
      return;
    }

    const now = new Date();
    const branchIdStr = apt.branchId ? apt.branchId.toString() : apt.doctor?.branchId ? apt.doctor.branchId.toString() : undefined;
    const channel = (patient.notificationPreferences?.preferredChannel as any) || 'IN_APP';
    const destination = (channel === 'EMAIL' ? patient.email : patient.phone) || undefined;

    // 1. 24-Hour Reminder
    const reminder24h = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
    if (reminder24h > now) {
      await this.queueNotification({
        eventType: 'APPOINTMENT_REMINDER',
        channel,
        title: 'Upcoming Appointment Tomorrow',
        message: `Reminder: You have an appointment scheduled for tomorrow with ${doctor?.name || 'your physician'}.`,
        branchId: branchIdStr,
        priority: 'NORMAL',
        scheduledAt: reminder24h.toISOString(),
        deduplicationKey: `APT-REM-${apt.id}-24H`,
        recipients: [
          {
            patientId: patient.id.toString(),
            destination,
            recipientName: patient.name,
          },
        ],
        metadata: {
          appointmentId: apt.id.toString(),
          doctorId: doctor?.id ? doctor.id.toString() : null,
          interval: '24H',
          date: apt.date,
        },
      });
    }

    // 2. 2-Hour Reminder
    const reminder2h = new Date(startTime.getTime() - 2 * 60 * 60 * 1000);
    if (reminder2h > now) {
      await this.queueNotification({
        eventType: 'APPOINTMENT_REMINDER',
        channel,
        title: 'Appointment in 2 Hours',
        message: `Reminder: Your appointment with ${doctor?.name || 'your physician'} is scheduled in 2 hours.`,
        branchId: branchIdStr,
        priority: 'HIGH',
        scheduledAt: reminder2h.toISOString(),
        deduplicationKey: `APT-REM-${apt.id}-2H`,
        recipients: [
          {
            patientId: patient.id.toString(),
            destination,
            recipientName: patient.name,
          },
        ],
        metadata: {
          appointmentId: apt.id.toString(),
          doctorId: doctor?.id ? doctor.id.toString() : null,
          interval: '2H',
          date: apt.date,
        },
      });
    }
  }

  /**
   * Cancels pending reminders when appointment is cancelled or completed
   */
  async cancelAppointmentReminders(appointmentId: bigint) {
    const keys = [`APT-REM-${appointmentId}-24H`, `APT-REM-${appointmentId}-2H`];

    const updated = await this.prisma.notificationOutbox.updateMany({
      where: {
        deduplicationKey: { in: keys },
        status: { in: ['PENDING', 'RETRYABLE'] },
      },
      data: {
        status: 'CANCELLED',
        lastError: 'Appointment status transitioned to completed or cancelled; reminder suppressed.',
      },
    });

    this.logger.log(`Cancelled ${updated.count} pending reminder(s) for appointment #${appointmentId}`);
  }

  /**
   * Reschedules appointment reminders
   */
  async rescheduleAppointmentReminders(appointmentId: bigint) {
    await this.cancelAppointmentReminders(appointmentId);
    await this.scheduleAppointmentReminders(appointmentId);
  }

  /**
   * Notifies patient that verified lab report is available (respects privacy & consent)
   */
  async triggerLabReportNotification(orderId: bigint, isCorrected = false) {
    const order = await this.prisma.lab.findUnique({
      where: { id: orderId },
      include: {
        patient: { include: { notificationPreferences: true } },
      },
    });

    if (!order || !order.patient) return;

    const consent = order.patient.notificationPreferences?.labConsent ?? true;
    if (!consent) {
      this.logger.debug(`Patient #${order.patient.id} opted out of laboratory notifications.`);
      return;
    }

    const channel = (order.patient.notificationPreferences?.preferredChannel as any) || 'IN_APP';
    const destination = (channel === 'EMAIL' ? order.patient.email : order.patient.phone) || undefined;
    const branchIdStr = order.branchId ? order.branchId.toString() : undefined;
    const orgIdStr = order.organizationId ? order.organizationId.toString() : undefined;

    await this.queueNotification({
      eventType: isCorrected ? 'LAB_REPORT_CORRECTED' : 'LAB_RESULT_AVAILABLE',
      channel,
      title: isCorrected ? 'Corrected Lab Report Available' : 'Lab Test Results Available',
      // Strict clinical privacy: never include test analyte names, values, or abnormal results in preview
      message: `Your laboratory investigation report (Order #${order.orderNumber || order.id}) is now finalized and available in your patient portal.`,
      branchId: branchIdStr,
      organizationId: orgIdStr,
      priority: 'NORMAL',
      deduplicationKey: `LAB-REL-${order.id}-${isCorrected ? 'CORR' : 'INIT'}`,
      recipients: [
        {
          patientId: order.patient.id.toString(),
          destination,
          recipientName: order.patient.name,
        },
      ],
      metadata: {
        orderId: order.id.toString(),
        orderNumber: order.orderNumber,
        isCorrected,
      },
    });
  }

  /**
   * Triggers critical laboratory alert with responsible clinician escalation
   */
  async triggerCriticalResultEscalation(orderId: bigint, criticalFindings: string) {
    const order = await this.prisma.lab.findUnique({
      where: { id: orderId },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Lab order #${orderId} not found.`);
    }

    // 1. Create CriticalLabEscalation entity
    const escalation = await this.prisma.criticalLabEscalation.create({
      data: {
        labOrderId: order.id,
        patientId: order.patientId,
        responsibleClinicianId: order.doctorId,
        criticalFindings: criticalFindings.trim(),
        isAcknowledged: false,
      },
    });

    // 2. Alert responsible doctor via urgent IN_APP notification
    let targetUserId: bigint | null = null;
    if (order.doctor?.email) {
      const user = await this.prisma.user.findFirst({
        where: { email: { equals: order.doctor.email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (user) targetUserId = user.id;
    }

    const branchIdStr = order.branchId ? order.branchId.toString() : undefined;
    const orgIdStr = order.organizationId ? order.organizationId.toString() : undefined;

    await this.queueNotification({
      eventType: 'CRITICAL_LAB_RESULT_ESCALATION',
      channel: 'IN_APP',
      title: 'CRITICAL LAB ALERT: Immediate Evaluation Required',
      message: `Critical value detected for Patient ${order.patientName || order.patient?.name} (Order #${order.orderNumber || order.id}). Findings: ${criticalFindings.slice(0, 150)}. Electronic alert does not replace verbal handoff.`,
      branchId: branchIdStr,
      organizationId: orgIdStr,
      priority: 'URGENT',
      deduplicationKey: `CRIT-ESC-${escalation.id}`,
      recipients: targetUserId
        ? [
            {
              userId: targetUserId.toString(),
              recipientName: order.doctor?.name || undefined,
            },
          ]
        : [],
      metadata: {
        escalationId: escalation.id.toString(),
        labOrderId: order.id.toString(),
        patientId: order.patientId.toString(),
        patientName: order.patientName || order.patient?.name,
        criticalFindings,
      },
    });

    return this.serializeBigInt(escalation);
  }

  /**
   * Clinician acknowledges critical laboratory alert
   */
  async acknowledgeCriticalEscalation(escalationId: bigint, userId: bigint, notes?: string) {
    const escalation = await this.prisma.criticalLabEscalation.findUnique({
      where: { id: escalationId },
    });

    if (!escalation) {
      throw new NotFoundException(`Critical alert escalation #${escalationId} not found.`);
    }

    const updated = await this.prisma.criticalLabEscalation.update({
      where: { id: escalationId },
      data: {
        isAcknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
        acknowledgementNotes: notes?.trim() || null,
      },
      include: {
        patient: { select: { id: true, name: true } },
        responsibleClinician: { select: { id: true, name: true } },
        acknowledgedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return this.serializeBigInt(updated);
  }

  /**
   * Retrieves pending unacknowledged critical alerts for clinician dashboard
   */
  async getPendingCriticalEscalations(branchId?: bigint, doctorId?: bigint) {
    const where: any = {
      isAcknowledged: false,
    };

    if (doctorId) {
      where.responsibleClinicianId = doctorId;
    }

    if (branchId) {
      where.labOrder = { branchId };
    }

    const items = await this.prisma.criticalLabEscalation.findMany({
      where,
      orderBy: { escalatedAt: 'desc' },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        responsibleClinician: { select: { id: true, name: true } },
        labOrder: { select: { id: true, orderNumber: true, status: true } },
      },
    });

    return items.map((i) => this.serializeBigInt(i));
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
