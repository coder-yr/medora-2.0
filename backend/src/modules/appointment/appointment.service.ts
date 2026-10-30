import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import {
  AppointmentResponseDto,
  FreeSlotDto,
  PaginatedAppointmentsDto,
} from './dto/appointment-response.dto';
import {
  APPOINTMENT_STATUSES,
  AppointmentStatus,
  CreateAppointmentDto,
} from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patientService: PatientService,
    private readonly doctorService: DoctorService,
  ) {}

  /**
   * Book a new appointment with transaction-level double booking and doctor availability guards.
   * Employs PostgreSQL row-level locking (SELECT FOR UPDATE) on the doctor record.
   */
  async create(
    dto: CreateAppointmentDto,
    userId = '',
  ): Promise<AppointmentResponseDto> {
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

    return await this.prisma.$transaction(async (tx) => {
      // Lock doctor row to serialize concurrent bookings for the same doctor
      await tx.$executeRaw`SELECT id FROM doctor WHERE id = ${BigInt(doctor.id)} FOR UPDATE`;

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
          remarks: dto.remarks ?? '',
          addDate: new Date().toISOString().split('T')[0],
          registrationTime: new Date().toISOString(),
          user: userId,
          request: '',
          bp: dto.b_p ?? null,
          pulse: dto.pulse ?? null,
          temperature: dto.temprature ?? null,
          weight: dto.weight ?? null,
          mode: isVideo ? 'video' : 'in_person',
          videoRoom,
          branchId: dto.branchId ? BigInt(dto.branchId) : null,
          visitType: dto.visitType ?? 'first_visit',
        },
        include: {
          patient: true,
          doctor: true,
        },
      });

      return this.formatAppointment(created);
    });
  }

  /**
   * List appointments with day view filtering, doctor/patient scopes, and pagination.
   */
  async findAll(query: AppointmentQueryDto): Promise<PaginatedAppointmentsDto> {
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
  async findOne(idOrKey: string | number): Promise<AppointmentResponseDto> {
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

    return this.formatAppointment(record);
  }

  /**
   * Update appointment details with validation and schedule guards.
   */
  async update(
    idOrKey: string | number,
    dto: UpdateAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    const idStr = String(idOrKey);
    const existing = await this.findOne(idStr);

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
   * Delete an appointment record.
   */
  async remove(idOrKey: string | number): Promise<{ message: string }> {
    const idStr = String(idOrKey);
    const existing = await this.findOne(idStr);

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
  ): Promise<FreeSlotDto[]> {
    const docIdStr = String(doctorId);
    const day = new Date(date);
    const weekday = day.getDay(); // 0=Sunday .. 6=Saturday

    // 1. Get weekly doctor slots
    const dbSlots = await this.prisma.doctorSlot.findMany({
      where: {
        doctorId: BigInt(docIdStr),
        weekday,
        active: true,
      },
      orderBy: { startTime: 'asc' },
    });

    if (dbSlots.length === 0) {
      return [];
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

    // 2. Check weekly clinic hours
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

    const fitsInSlot = daySlots.some(
      (s: { startTime: string; endTime: string }) =>
        startTimeOnly >= s.startTime && endTimeOnly <= s.endTime,
    );

    if (!fitsInSlot) {
      const hours = daySlots
        .map((s: { startTime: string; endTime: string }) => `${s.startTime}-${s.endTime}`)
        .join(', ');
      throw new BadRequestException(
        `Outside the doctor's clinic hours on ${weekdayName} (${hours}).`,
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
      consultStartedAt: app.consultStartedAt ? app.consultStartedAt.toISOString() : null,
      calledInAt: app.calledInAt ? app.calledInAt.toISOString() : null,
      checkedOutAt: app.checkedOutAt ? app.checkedOutAt.toISOString() : null,
      completedAt: app.completedAt ? app.completedAt.toISOString() : null,
      createdAt: app.createdAt ? app.createdAt.toISOString() : null,
      updatedAt: app.updatedAt ? app.updatedAt.toISOString() : null,
    };
  }
}
