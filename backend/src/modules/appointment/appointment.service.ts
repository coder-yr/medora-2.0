import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { BranchAuthorizationService } from '../../common/services/branch-authorization.service';
import { AuthUser } from '../../common/types/auth-user.interface';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import {
  AppointmentResponseDto,
  FreeSlotDto,
  PaginatedAppointmentsDto,
} from './dto/appointment-response.dto';
import {
  APPOINTMENT_STATUSES,
  AppointmentPriority,
  AppointmentStatus,
  CreateAppointmentDto,
} from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { WalkInAppointmentDto } from './dto/walk-in-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import {
  OpdQueueResponseDto,
  QueueItemDto,
  QueueSummaryDto,
} from './dto/queue-response.dto';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const PRIORITY_WEIGHT: Record<string, number> = {
  EMERGENCY: 4,
  URGENT: 3,
  VIP: 2,
  NORMAL: 1,
};

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patientService: PatientService,
    private readonly doctorService: DoctorService,
    @Optional() private readonly branchAuth?: BranchAuthorizationService,
    @Optional() private readonly notificationService?: NotificationService,
  ) { }

  /**
   * Book a new appointment with transaction-level double booking and doctor availability guards.
   * Employs PostgreSQL row-level locking (SELECT FOR UPDATE) on the doctor record.
   */
  async create(
    dto: CreateAppointmentDto,
    userId = '',
    user?: AuthUser,
  ): Promise<AppointmentResponseDto> {
    let targetBranchId: bigint | null = null;
    if (dto.branchId) {
      targetBranchId =
        user && this.branchAuth
          ? await this.branchAuth.assertBranchAccess(user, dto.branchId)
          : BigInt(dto.branchId);
    } else if (user?.branchId) {
      targetBranchId = BigInt(user.branchId);
    }
    let patient: { id: string; name: string };
    try {
      patient = await this.patientService.findById(dto.patient);
    } catch {
      throw new BadRequestException('Patient does not exist.');
    }

    let doctor: { id: string; name: string };
    try {
      doctor = await this.doctorService.findById(dto.doctor);
    } catch {
      throw new BadRequestException('Doctor does not exist.');
    }

    const { startStr, endStr, timeSlot, sTimeKey } = this.calculateTimeBounds(
      dto.date,
      dto.start,
      dto.minutes ?? 15,
    );

    const status: AppointmentStatus = dto.status ?? 'scheduled';
    if (!APPOINTMENT_STATUSES.includes(status)) {
      throw new BadRequestException(
        `Status must be one of: ${APPOINTMENT_STATUSES.join(', ')}`,
      );
    }

    const isVideo = Boolean(dto.video);
    const videoRoom = isVideo ? this.generateVideoRoom() : null;

    let tokenNo: number | null = null;
    let tokenNumber: string | null = null;
    let checkedInAt: Date | null = null;
    if (['checked_in', 'waiting', 'arrived'].includes(status)) {
      checkedInAt = new Date();
    }

    return await this.prisma.$transaction(async (tx) => {
      // Slot-keyed PostgreSQL advisory lock (doctor + branch + date + slot) eliminates cross-slot/cross-branch contention
      const slotScopeKey = `apt_slot:${doctor.id}:${targetBranchId ? targetBranchId.toString() : '0'}`;
      const slotTimeKey = `${dto.date}:${timeSlot}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${slotScopeKey}), hashtext(${slotTimeKey}))`;

      if (checkedInAt) {
        const queueKey = `apt_queue:${doctor.id}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${queueKey}), hashtext(${dto.date}))`;
        const maxToken = await tx.appointment.aggregate({
          where: { doctorId: BigInt(doctor.id), date: dto.date },
          _max: { tokenNo: true },
        });
        tokenNo = (maxToken._max.tokenNo || 0) + 1;
        tokenNumber = `Q-${tokenNo.toString().padStart(2, '0')}`;
      }

      // Check doctor schedule availability
      if (!['cancelled', 'no show', 'completed'].includes(status)) {
        await this.assertDoctorBookable(
          tx,
          doctor.id,
          dto.date,
          startStr,
          endStr,
        );
      }

      // Check overlap with existing active bookings for this doctor
      await this.assertNoClash(
        tx,
        doctor.id,
        startStr,
        endStr,
        timeSlot,
        null,
      );

      const created = await tx.appointment.create({
        data: {
          patientId: BigInt(patient.id),
          doctorId: BigInt(doctor.id),
          date: dto.date,
          timeSlot,
          sTime: startStr,
          eTime: endStr,
          sTimeKey,
          status,
          priority: dto.priority || 'NORMAL',
          department: dto.department || (doctor as any).department || null,
          remarks: dto.reason ? `${dto.reason}${dto.remarks ? ' - ' + dto.remarks : ''}` : (dto.remarks ?? ''),
          addDate: new Date().toISOString().split('T')[0],
          registrationTime: new Date().toISOString(),
          checkedInAt,
          tokenNo,
          queueNumber: tokenNo,
          tokenNumber,
          user: userId,
          request: '',
          bp: dto.b_p ?? null,
          pulse: dto.pulse ?? null,
          temperature: dto.temprature ?? null,
          weight: dto.weight ?? null,
          mode: isVideo ? 'video' : 'in_person',
          videoRoom,
          branchId: targetBranchId,
          visitType: dto.visitType ?? 'first_visit',
        },
        include: {
          patient: true,
          doctor: true,
        },
      });

      if (this.notificationService) {
        void this.notificationService.scheduleAppointmentReminders(created.id);
      }

      return this.formatAppointment(created);
    });
  }

  /**
   * Register a walk-in patient directly into the OPD waiting queue with sequential token.
   */
  async createWalkIn(
    dto: WalkInAppointmentDto,
    userId = '',
    user?: AuthUser,
  ): Promise<AppointmentResponseDto> {
    let targetBranchId: bigint | null = null;
    if (dto.branchId) {
      targetBranchId =
        user && this.branchAuth
          ? await this.branchAuth.assertBranchAccess(user, dto.branchId)
          : BigInt(dto.branchId);
    } else if (user?.branchId) {
      targetBranchId = BigInt(user.branchId);
    }

    let patientRecord: { id: string; name: string };
    if (dto.newPatient) {
      // Register patient inline with validation and duplicate guards
      patientRecord = await this.patientService.create(dto.newPatient, userId, user);
    } else if (dto.patient) {
      try {
        patientRecord = await this.patientService.findById(dto.patient);
      } catch {
        throw new BadRequestException('Patient does not exist.');
      }
    } else {
      throw new BadRequestException(
        'Either an existing patient ID or newPatient details must be provided.',
      );
    }

    let doctorRecord: { id: string; name: string; department?: string | null };
    try {
      doctorRecord = await this.doctorService.findById(dto.doctor);
    } catch {
      throw new BadRequestException('Doctor does not exist.');
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes().toString().padStart(2, '0');
    const startTime = `${currentHours}:${currentMinutes}`;
    const { startStr, endStr, timeSlot, sTimeKey } = this.calculateTimeBounds(
      today,
      startTime,
      15,
    );

    const checkedInAt = new Date();

    return await this.prisma.$transaction(async (tx) => {
      // Lock doctor row to safely increment sequential token number
      await tx.$executeRaw`SELECT id FROM doctor WHERE id = ${BigInt(doctorRecord.id)} FOR UPDATE`;

      const maxToken = await tx.appointment.aggregate({
        where: { doctorId: BigInt(doctorRecord.id), date: today },
        _max: { tokenNo: true },
      });
      const tokenNo = (maxToken._max.tokenNo || 0) + 1;
      const tokenNumber = `W-${tokenNo.toString().padStart(2, '0')}`;

      const created = await tx.appointment.create({
        data: {
          patientId: BigInt(patientRecord.id),
          doctorId: BigInt(doctorRecord.id),
          date: today,
          timeSlot,
          sTime: startStr,
          eTime: endStr,
          sTimeKey,
          status: 'waiting',
          priority: dto.priority || 'NORMAL',
          department: dto.department || doctorRecord.department || null,
          remarks: dto.reason
            ? `${dto.reason}${dto.remarks ? ' - ' + dto.remarks : ''}`
            : (dto.remarks ?? ''),
          addDate: today,
          registrationTime: now.toISOString(),
          checkedInAt,
          tokenNo,
          queueNumber: tokenNo,
          tokenNumber,
          user: userId,
          request: '',
          mode: 'in_person',
          branchId: targetBranchId,
          visitType: 'walk_in',
        },
        include: {
          patient: true,
          doctor: true,
        },
      });

      if (this.notificationService) {
        void this.notificationService.scheduleAppointmentReminders(created.id);
      }

      return this.formatAppointment(created);
    });
  }

  /**
   * Check in an appointment, generating queue token if not already assigned and setting status to 'waiting'.
   */
  async checkIn(
    idOrKey: string | number,
    user?: AuthUser,
  ): Promise<AppointmentResponseDto> {
    const idStr = String(idOrKey);
    const existing = await this.findOne(idStr, user);

    if (['cancelled', 'completed', 'no show'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot check in an appointment that is already ${existing.status}.`,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      let tokenNo = existing.tokenNo;
      let tokenNumber = existing.tokenNumber;

      if (!tokenNo) {
        await tx.$executeRaw`SELECT id FROM doctor WHERE id = ${BigInt(existing.doctorId)} FOR UPDATE`;
        const maxToken = await tx.appointment.aggregate({
          where: { doctorId: BigInt(existing.doctorId), date: existing.date },
          _max: { tokenNo: true },
        });
        tokenNo = (maxToken._max.tokenNo || 0) + 1;
        tokenNumber = `Q-${tokenNo.toString().padStart(2, '0')}`;
      }

      const updated = await tx.appointment.update({
        where: { id: BigInt(idStr) },
        data: {
          status: 'waiting',
          checkedInAt: existing.checkedInAt
            ? new Date(existing.checkedInAt)
            : new Date(),
          tokenNo,
          queueNumber: tokenNo,
          tokenNumber,
        },
        include: {
          patient: true,
          doctor: true,
        },
      });

      return this.formatAppointment(updated);
    });
  }

  /**
   * Call a waiting patient into the doctor's consultation room.
   */
  async callPatient(
    idOrKey: string | number,
    user?: AuthUser,
  ): Promise<AppointmentResponseDto> {
    const idStr = String(idOrKey);
    const existing = await this.findOne(idStr, user);

    if (existing.status === 'cancelled' || existing.status === 'completed') {
      throw new BadRequestException(
        `Cannot call an appointment that is ${existing.status}.`,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id: BigInt(idStr) },
      data: {
        status: 'called',
        calledInAt: new Date(),
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (this.notificationService) {
      void this.notificationService.cancelAppointmentReminders(BigInt(idStr));
    }

    return this.formatAppointment(updated);
  }

  /**
   * Mark consultation as started.
   */
  async startConsultation(
    idOrKey: string | number,
    user?: AuthUser,
  ): Promise<AppointmentResponseDto> {
    const idStr = String(idOrKey);
    const existing = await this.findOne(idStr, user);

    if (existing.status === 'cancelled' || existing.status === 'completed') {
      throw new BadRequestException(
        `Cannot start consultation for an appointment that is ${existing.status}.`,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id: BigInt(idStr) },
      data: {
        status: 'in_consultation',
        consultStartedAt: new Date(),
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (this.notificationService) {
      void this.notificationService.cancelAppointmentReminders(BigInt(idStr));
    }

    return this.formatAppointment(updated);
  }

  /**
   * Mark consultation complete and check out patient.
   */
  async completeConsultation(
    idOrKey: string | number,
    user?: AuthUser,
  ): Promise<AppointmentResponseDto> {
    const idStr = String(idOrKey);
    const existing = await this.findOne(idStr, user);

    if (existing.status === 'cancelled') {
      throw new BadRequestException(
        'Cannot complete a cancelled appointment.',
      );
    }

    const now = new Date();
    const updated = await this.prisma.appointment.update({
      where: { id: BigInt(idStr) },
      data: {
        status: 'completed',
        completedAt: now,
        checkedOutAt: now,
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (this.notificationService) {
      void this.notificationService.cancelAppointmentReminders(BigInt(idStr));
    }

    return this.formatAppointment(updated);
  }

  /**
   * Cancel an appointment with a recorded cancellation reason.
   */
  async cancel(
    idOrKey: string | number,
    dto: CancelAppointmentDto,
    userId = '',
    user?: AuthUser,
  ): Promise<AppointmentResponseDto> {
    const idStr = String(idOrKey);
    const existing = await this.findOne(idStr, user);

    if (existing.status === 'completed') {
      throw new BadRequestException(
        'Cannot cancel an already completed appointment.',
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id: BigInt(idStr) },
      data: {
        status: 'cancelled',
        cancellationReason: dto.reason,
        cancelledAt: new Date(),
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (this.notificationService) {
      void this.notificationService.cancelAppointmentReminders(BigInt(idStr));
    }

    return this.formatAppointment(updated);
  }

  /**
   * Reschedule an appointment, marking the original as rescheduled and creating a linked new record.
   */
  async reschedule(
    idOrKey: string | number,
    dto: RescheduleAppointmentDto,
    userId = '',
    user?: AuthUser,
  ): Promise<AppointmentResponseDto> {
    const idStr = String(idOrKey);
    const existing = await this.findOne(idStr, user);

    if (['cancelled', 'completed'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot reschedule an appointment that is already ${existing.status}.`,
      );
    }

    const minutes = dto.minutes ?? 15;
    const { startStr, endStr, timeSlot, sTimeKey } = this.calculateTimeBounds(
      dto.date,
      dto.start,
      minutes,
    );

    return await this.prisma.$transaction(async (tx) => {
      // Slot-keyed advisory lock for target reschedule slot
      const slotScopeKey = `apt_slot:${existing.doctorId}:${existing.branchId ? existing.branchId.toString() : '0'}`;
      const slotTimeKey = `${dto.date}:${timeSlot}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${slotScopeKey}), hashtext(${slotTimeKey}))`;

      // Verify doctor is bookable on new date/time
      await this.assertDoctorBookable(
        tx,
        existing.doctorId,
        dto.date,
        startStr,
        endStr,
      );

      // Verify no clash on new slot (ignore original appointment)
      await this.assertNoClash(
        tx,
        existing.doctorId,
        startStr,
        endStr,
        timeSlot,
        idStr,
      );

      // 1. Mark existing appointment as rescheduled
      await tx.appointment.update({
        where: { id: BigInt(idStr) },
        data: {
          status: 'rescheduled',
          rescheduleReason:
            dto.reason || `Rescheduled to ${dto.date} ${dto.start}`,
        },
      });

      // 2. Create new appointment linked with rescheduledFromId
      const newAppointment = await tx.appointment.create({
        data: {
          patientId: BigInt(existing.patientId),
          doctorId: BigInt(existing.doctorId),
          date: dto.date,
          timeSlot,
          sTime: startStr,
          eTime: endStr,
          sTimeKey,
          status: 'scheduled',
          priority: existing.priority || 'NORMAL',
          department: existing.department || null,
          remarks: dto.reason
            ? `Rescheduled: ${dto.reason}`
            : existing.remarks,
          addDate: new Date().toISOString().split('T')[0],
          registrationTime: new Date().toISOString(),
          user: userId,
          request: '',
          mode: existing.mode,
          videoRoom: existing.mode === 'video' ? this.generateVideoRoom() : null,
          branchId: existing.branchId ? BigInt(existing.branchId) : null,
          visitType: existing.visitType || 'first_visit',
          rescheduledFromId: BigInt(idStr),
          rescheduleReason: dto.reason || null,
        },
        include: {
          patient: true,
          doctor: true,
        },
      });

      if (this.notificationService) {
        void this.notificationService.rescheduleAppointmentReminders(newAppointment.id);
      }

      return this.formatAppointment(newAppointment);
    });
  }

  /**
   * Get operational real-time OPD waiting queue with dynamic positions, wait times and metrics.
   */
  async getOpdQueue(
    branchId?: string | number,
    doctorId?: string | number,
    date?: string,
    user?: AuthUser,
  ): Promise<OpdQueueResponseDto> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const where: Record<string, unknown> = {
      date: targetDate,
      status: { in: ['checked_in', 'waiting', 'called', 'in_consultation'] },
    };

    if (doctorId) {
      where.doctorId = BigInt(doctorId);
    }

    if (branchId && user && this.branchAuth) {
      const authorizedBranchId = await this.branchAuth.assertBranchAccess(
        user,
        branchId,
      );
      where.branchId = authorizedBranchId;
    } else if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      const accessible = await this.branchAuth.resolveAccessibleBranchIds(user);
      where.branchId = { in: accessible || [] };
    }

    const [activeAppointments, completedCount] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          patient: true,
          doctor: true,
        },
      }),
      this.prisma.appointment.count({
        where: {
          date: targetDate,
          status: 'completed',
          ...(doctorId ? { doctorId: BigInt(doctorId) } : {}),
          ...(branchId ? { branchId: BigInt(branchId) } : {}),
        },
      }),
    ]);

    // Sort queue items: Priority (EMERGENCY > URGENT > VIP > NORMAL), then checkedInAt ascending
    const sorted = [...activeAppointments].sort((a, b) => {
      const pA = PRIORITY_WEIGHT[a.priority || 'NORMAL'] || 1;
      const pB = PRIORITY_WEIGHT[b.priority || 'NORMAL'] || 1;
      if (pA !== pB) {
        return pB - pA; // Higher priority first
      }
      const timeA = a.checkedInAt ? new Date(a.checkedInAt).getTime() : 0;
      const timeB = b.checkedInAt ? new Date(b.checkedInAt).getTime() : 0;
      return timeA - timeB;
    });

    const now = Date.now();
    let totalWaitTimeAccumulated = 0;
    let waitingCount = 0;
    let inConsultationCount = 0;

    const queueItems: QueueItemDto[] = sorted.map((item, index) => {
      const checkedInTime = item.checkedInAt
        ? new Date(item.checkedInAt).getTime()
        : now;
      const waitingMinutes = Math.max(
        0,
        Math.round((now - checkedInTime) / 60000),
      );

      if (item.status === 'waiting' || item.status === 'checked_in') {
        waitingCount++;
        totalWaitTimeAccumulated += waitingMinutes;
      } else if (item.status === 'in_consultation') {
        inConsultationCount++;
      }

      return {
        appointmentId: item.id.toString(),
        queuePosition: index + 1,
        tokenNumber:
          item.tokenNumber ||
          `Q-${(item.tokenNo || index + 1).toString().padStart(2, '0')}`,
        priority: item.priority || 'NORMAL',
        status: item.status,
        checkedInAt: item.checkedInAt
          ? item.checkedInAt.toISOString()
          : new Date().toISOString(),
        calledInAt: item.calledInAt ? item.calledInAt.toISOString() : null,
        consultStartedAt: item.consultStartedAt
          ? item.consultStartedAt.toISOString()
          : null,
        waitingMinutes,
        patient: {
          id: item.patient.id.toString(),
          patientId: item.patient.patientId || '',
          name: item.patient.name,
          phone: item.patient.phone || null,
          allergies: item.patient.allergies || null,
        },
        doctor: {
          id: item.doctor.id.toString(),
          name: item.doctor.name,
          department: item.doctor.department || null,
        },
        branchId: item.branchId ? item.branchId.toString() : null,
        visitType: item.visitType || null,
        timeSlot: item.timeSlot || '',
        remarks: item.remarks || null,
      };
    });

    const averageWaitMinutes =
      waitingCount > 0
        ? Math.round(totalWaitTimeAccumulated / waitingCount)
        : 0;

    const summary: QueueSummaryDto = {
      totalWaiting: waitingCount,
      totalInConsultation: inConsultationCount,
      totalCompletedToday: completedCount,
      averageWaitMinutes,
    };

    return {
      summary,
      items: queueItems,
    };
  }

  /**
   * List appointments with day view filtering, doctor/patient scopes, and pagination.
   */
  async findAll(
    query: AppointmentQueryDto,
    user?: AuthUser,
  ): Promise<PaginatedAppointmentsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    // Default to today if date not given, unless explicitly requested as 'all'
    let targetDate: string | undefined;
    if (query.date === 'all') {
      targetDate = undefined;
    } else if (query.date && query.date.trim() !== '') {
      targetDate = query.date.trim();
    } else {
      targetDate = new Date().toISOString().split('T')[0];
    }

    const doctorIdStr = query.doctor ? String(query.doctor) : undefined;
    const patientIdStr = query.patient ? String(query.patient) : undefined;
    const status = query.status?.trim();

    const where: Record<string, unknown> = {};
    if (targetDate) {
      where.date = targetDate;
    }
    if (doctorIdStr) {
      where.doctorId = BigInt(doctorIdStr);
    }
    if (patientIdStr) {
      where.patientId = BigInt(patientIdStr);
    }
    if (status) {
      where.status = status;
    }

    if (query.branchId && user && this.branchAuth) {
      const authorizedBranchId = await this.branchAuth.assertBranchAccess(user, query.branchId);
      where.branchId = authorizedBranchId;
    } else if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      const accessible = await this.branchAuth.resolveAccessibleBranchIds(user);
      where.branchId = { in: accessible || [] };
    }

    const [records, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sTime: 'asc' }, { id: 'asc' }],
        include: {
          patient: true,
          doctor: true,
        },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data: records.map((r) => this.formatAppointment(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single appointment by numeric ID.
   */
  async findOne(idOrKey: string | number, user?: AuthUser): Promise<AppointmentResponseDto> {
    const idStr = String(idOrKey);

    const record = await this.prisma.appointment.findUnique({
      where: { id: BigInt(idStr) },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (!record) {
      throw new NotFoundException(`Appointment #${idStr} not found.`);
    }

    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, record.branchId, 'appointment');
    }

    return this.formatAppointment(record);
  }

  /**
   * Update appointment details with validation, schedule, and branch ownership guards.
   */
  async update(
    idOrKey: string | number,
    dto: UpdateAppointmentDto,
    user?: AuthUser,
  ): Promise<AppointmentResponseDto> {
    const idStr = String(idOrKey);
    const existing = await this.findOne(idStr, user);

    if (user && this.branchAuth) {
      await this.branchAuth.assertResourceAccess(user, existing.branchId, 'appointment');
    }
    if (dto.branchId && user && this.branchAuth) {
      await this.branchAuth.assertBranchAccess(user, dto.branchId);
    }

    const patientId = dto.patient ? String(dto.patient) : existing.patientId;
    const doctorId = dto.doctor ? String(dto.doctor) : existing.doctorId;
    const date = dto.date ?? existing.date;
    const status: AppointmentStatus = dto.status ?? (existing.status as AppointmentStatus);

    if (!APPOINTMENT_STATUSES.includes(status)) {
      throw new BadRequestException(
        `Status must be one of: ${APPOINTMENT_STATUSES.join(', ')}`,
      );
    }

    // Determine times
    const startInput = dto.start ?? existing.sTime.substring(11, 16);
    const minutes = dto.minutes ?? 15;
    const { startStr, endStr, timeSlot, sTimeKey } = this.calculateTimeBounds(
      date,
      startInput,
      minutes,
    );

    const isVideo = dto.video !== undefined ? Boolean(dto.video) : existing.mode === 'video';
    const videoRoom = isVideo ? existing.videoRoom || this.generateVideoRoom() : null;

    return await this.prisma.$transaction(async (tx) => {
      // Lock doctor row
      await tx.$executeRaw`SELECT id FROM doctor WHERE id = ${BigInt(doctorId)} FOR UPDATE`;

      if (!['cancelled', 'no show', 'completed'].includes(status)) {
        await this.assertDoctorBookable(tx, doctorId, date, startStr, endStr);
      }

      await this.assertNoClash(
        tx,
        doctorId,
        startStr,
        endStr,
        timeSlot,
        idStr,
      );

      const updated = await tx.appointment.update({
        where: { id: BigInt(idStr) },
        data: {
          patientId: BigInt(patientId),
          doctorId: BigInt(doctorId),
          date,
          timeSlot,
          sTime: startStr,
          eTime: endStr,
          sTimeKey,
          status,
          remarks: dto.remarks !== undefined ? dto.remarks : undefined,
          bp: dto.b_p !== undefined ? dto.b_p : undefined,
          pulse: dto.pulse !== undefined ? dto.pulse : undefined,
          temperature: dto.temprature !== undefined ? dto.temprature : undefined,
          weight: dto.weight !== undefined ? dto.weight : undefined,
          mode: isVideo ? 'video' : 'in_person',
          videoRoom,
          branchId: dto.branchId ? BigInt(dto.branchId) : undefined,
          visitType: dto.visitType ?? existing.visitType,
        },
        include: {
          patient: true,
          doctor: true,
        },
      });

      return this.formatAppointment(updated);
    });
  }

  /**
   * Delete an appointment record with branch authorization guard.
   */
  async remove(idOrKey: string | number, user?: AuthUser): Promise<{ message: string }> {
    const idStr = String(idOrKey);
    const existing = await this.findOne(idStr, user);

    if (user && this.branchAuth) {
      await this.branchAuth.assertResourceAccess(user, existing.branchId, 'appointment');
    }

    await this.prisma.appointment.delete({
      where: { id: BigInt(idStr) },
    });

    return {
      message: `Appointment #${idStr} on ${existing.date} removed.`,
    };
  }

  /**
   * Calculates free available consultation slots for a doctor on a specific date.
   */
  async getFreeSlots(
    doctorId: string | number,
    date: string,
    branchId?: string | number,
  ): Promise<FreeSlotDto[]> {
    if (!doctorId || !date) {
      return [];
    }
    const docIdNum = Number(doctorId);
    if (!docIdNum || isNaN(docIdNum)) {
      return [];
    }
    const docIdStr = String(docIdNum);
    const [y, m, d] = date.split('-').map(Number);
    const day = new Date(y, (m || 1) - 1, d || 1);
    const weekday = day.getDay(); // 0=Sunday .. 6=Saturday

    // 1. Get weekly doctor slots
    const slotWhere: Record<string, unknown> = {
      doctorId: BigInt(docIdStr),
      weekday,
      active: true,
    };
    if (branchId) {
      slotWhere.OR = [
        { branchId: BigInt(branchId) },
        { branchId: null },
      ];
    }

    let dbSlots = await this.prisma.doctorSlot.findMany({
      where: slotWhere,
      orderBy: { startTime: 'asc' },
    });

    if (dbSlots.length === 0) {
      // Check if this doctor has any custom slots configured across any weekday
      const hasCustomConfig = await this.prisma.doctorSlot.findFirst({
        where: { doctorId: BigInt(docIdStr) },
      });
      if (!hasCustomConfig) {
        // Fallback standard outpatient clinic schedule: 09:00 - 17:00 (15m intervals)
        dbSlots = [
          {
            id: 0n,
            doctorId: BigInt(docIdStr),
            weekday,
            startTime: '09:00',
            endTime: '17:00',
            slotMinutes: 15,
            active: true,
            branchId: null,
            breakStartTime: null,
            breakEndTime: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      } else {
        return [];
      }
    }

    // 2. Get booked appointments for that doctor on that date (not cancelled or no show)
    const bookings = await this.prisma.appointment.findMany({
      where: {
        doctorId: BigInt(docIdStr),
        date,
        status: { notIn: ['cancelled', 'no show'] },
      },
      select: { sTime: true, eTime: true },
    });

    // 3. Get blocks on this date
    const dbBlocks = await this.prisma.slotBlock.findMany({
      where: {
        doctorId: BigInt(docIdStr),
        date: new Date(date),
      },
    });

    const freeSlots: FreeSlotDto[] = [];

    for (const slot of dbSlots) {
      let currentMinutes = this.timeToMinutes(slot.startTime);
      const stopMinutes = this.timeToMinutes(slot.endTime);

      while (currentMinutes + slot.slotMinutes <= stopMinutes) {
        const slotStartStr = this.minutesToTime(currentMinutes);
        const slotEndStr = this.minutesToTime(currentMinutes + slot.slotMinutes);

        // Check if inside break period
        const isDuringBreak =
          slot.breakStartTime &&
          slot.breakEndTime &&
          slotStartStr < slot.breakEndTime &&
          slotEndStr > slot.breakStartTime;

        if (isDuringBreak) {
          currentMinutes += slot.slotMinutes;
          continue;
        }

        const fullStart = `${date} ${slotStartStr}:00`;
        const fullEnd = `${date} ${slotEndStr}:00`;

        // Check if overlaps with any booked appointment
        const isBooked = bookings.some(
          (b) => b.sTime < fullEnd && b.eTime > fullStart,
        );

        // Check if overlaps with any slot block
        const isBlocked = dbBlocks.some((b) => {
          if (!b.startTime || !b.endTime) return true; // whole day
          const blockStart = `${date} ${b.startTime}:00`;
          const blockEnd = `${date} ${b.endTime}:00`;
          return fullStart < blockEnd && fullEnd > blockStart;
        });

        if (!isBooked && !isBlocked) {
          freeSlots.push({
            start: slotStartStr,
            minutes: slot.slotMinutes,
          });
        }

        currentMinutes += slot.slotMinutes;
      }
    }

    return freeSlots;
  }

  // --- Internal Schedule & Conflict Helpers ---

  private async assertNoClash(
    tx: any,
    doctorId: string | number,
    startStr: string,
    endStr: string,
    timeSlot: string,
    ignoreId: string | null,
  ): Promise<void> {
    const clash = await tx.appointment.findFirst({
      where: {
        doctorId: BigInt(doctorId),
        status: { notIn: ['cancelled', 'no show'] },
        ...(ignoreId ? { NOT: { id: BigInt(ignoreId) } } : {}),
        sTime: { lt: endStr },
        eTime: { gt: startStr },
      },
      include: { patient: true },
    });

    if (clash) {
      const patientName = clash.patient?.name || 'another patient';
      throw new BadRequestException(
        `That doctor is already booked ${clash.timeSlot || timeSlot} with ${patientName}.`,
      );
    }
  }

  private async assertDoctorBookable(
    tx: any,
    doctorId: string | number,
    date: string,
    startStr: string,
    endStr: string,
  ): Promise<void> {
    // 1. Check leave / slot blocks
    const block = await tx.slotBlock.findFirst({
      where: {
        doctorId: BigInt(doctorId),
        date: new Date(date),
      },
    });

    if (block) {
      if (!block.startTime || !block.endTime) {
        throw new BadRequestException(
          `The doctor is not available then${block.reason ? ' (' + block.reason + ')' : ''}.`,
        );
      }
      const blockStart = `${date} ${block.startTime}:00`;
      const blockEnd = `${date} ${block.endTime}:00`;
      if (startStr < blockEnd && endStr > blockStart) {
        throw new BadRequestException(
          `The doctor is not available then${block.reason ? ' (' + block.reason + ')' : ''}.`,
        );
      }
    }

    // 2. Check weekly clinic hours and breaks
    const allSlots = await tx.doctorSlot.findMany({
      where: {
        doctorId: BigInt(doctorId),
        active: true,
      },
    });

    if (allSlots.length === 0) {
      // Doctor with no slots configured can be booked at any time
      return;
    }

    const dayOfWeek = new Date(date).getDay();
    const weekdayName = WEEKDAYS[dayOfWeek];
    const daySlots = allSlots.filter((s: { weekday: number }) => s.weekday === dayOfWeek);

    if (daySlots.length === 0) {
      throw new BadRequestException(
        `The doctor has no clinic on ${weekdayName}s.`,
      );
    }

    const startTimeOnly = startStr.substring(11, 16);
    const endTimeOnly = endStr.substring(11, 16);

    const matchingSlot = daySlots.find(
      (s: {
        startTime: string;
        endTime: string;
        breakStartTime?: string | null;
        breakEndTime?: string | null;
      }) => startTimeOnly >= s.startTime && endTimeOnly <= s.endTime,
    );

    if (!matchingSlot) {
      const hours = daySlots
        .map((s: { startTime: string; endTime: string }) => `${s.startTime}-${s.endTime}`)
        .join(', ');
      throw new BadRequestException(
        `Outside the doctor's clinic hours on ${weekdayName} (${hours}).`,
      );
    }

    // Check if slot overlaps with doctor's scheduled break
    if (
      matchingSlot.breakStartTime &&
      matchingSlot.breakEndTime &&
      startTimeOnly < matchingSlot.breakEndTime &&
      endTimeOnly > matchingSlot.breakStartTime
    ) {
      throw new BadRequestException(
        `Doctor is on a scheduled break between ${matchingSlot.breakStartTime} and ${matchingSlot.breakEndTime}.`,
      );
    }
  }

  // --- Utility Functions ---

  private calculateTimeBounds(
    date: string,
    startTime: string,
    minutes: number,
  ) {
    const [hStr, mStr] = startTime.split(':');
    const startMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
    const endMinutes = startMinutes + minutes;

    const endH = Math.floor(endMinutes / 60)
      .toString()
      .padStart(2, '0');
    const endM = (endMinutes % 60).toString().padStart(2, '0');
    const endTime = `${endH}:${endM}`;

    const startStr = `${date} ${startTime}:00`;
    const endStr = `${date} ${endTime}:00`;
    const timeSlot = `${startTime} - ${endTime}`;
    const sTimeKey = `${date.replace(/-/g, '')}${startTime.replace(/:/g, '')}`;

    return { startStr, endStr, timeSlot, sTimeKey };
  }

  private generateVideoRoom(): string {
    return `icthospital-${crypto.randomBytes(12).toString('hex')}`;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map((x) => parseInt(x, 10));
    return h * 60 + m;
  }

  private minutesToTime(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, '0');
    const m = (totalMinutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private formatAppointment(app: any): AppointmentResponseDto {
    const videoUrl =
      app.videoRoom && app.mode === 'video'
        ? `https://meet.jit.si/${encodeURIComponent(app.videoRoom)}`
        : null;

    return {
      id: app.id.toString(),
      patientId: app.patientId.toString(),
      doctorId: app.doctorId.toString(),
      date: app.date,
      timeSlot: app.timeSlot || '',
      sTime: app.sTime,
      eTime: app.eTime,
      sTimeKey: app.sTimeKey || '',
      status: app.status,
      priority: app.priority || 'NORMAL',
      tokenNo: app.tokenNo ?? null,
      queueNumber: app.tokenNo ?? null,
      tokenNumber: app.tokenNumber || null,
      department: app.department || null,
      cancellationReason: app.cancellationReason || null,
      cancelledAt: app.cancelledAt ? app.cancelledAt.toISOString() : null,
      rescheduledFromId: app.rescheduledFromId
        ? app.rescheduledFromId.toString()
        : null,
      rescheduleReason: app.rescheduleReason || null,
      remarks: app.remarks || null,
      mode: app.mode || 'in_person',
      videoRoom: app.videoRoom || null,
      videoUrl,
      branchId: app.branchId ? app.branchId.toString() : null,
      bp: app.bp || null,
      pulse: app.pulse || null,
      temperature: app.temperature || null,
      weight: app.weight || null,
      visitType: app.visitType || null,
      patient: app.patient
        ? {
          id: app.patient.id.toString(),
          patientId: app.patient.patientId || '',
          name: app.patient.name,
          phone: app.patient.phone || null,
        }
        : undefined,
      doctor: app.doctor
        ? {
          id: app.doctor.id.toString(),
          name: app.doctor.name,
          department: app.doctor.department || null,
        }
        : undefined,
      checkedInAt: app.checkedInAt ? app.checkedInAt.toISOString() : null,
      consultStartedAt: app.consultStartedAt
        ? app.consultStartedAt.toISOString()
        : null,
      calledInAt: app.calledInAt ? app.calledInAt.toISOString() : null,
      checkedOutAt: app.checkedOutAt ? app.checkedOutAt.toISOString() : null,
      completedAt: app.completedAt ? app.completedAt.toISOString() : null,
      createdAt: app.createdAt ? app.createdAt.toISOString() : null,
      updatedAt: app.updatedAt ? app.updatedAt.toISOString() : null,
    };
  }
}
