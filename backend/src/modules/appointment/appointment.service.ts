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

interface MemoryAppointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  timeSlot: string;
  sTime: string;
  eTime: string;
  sTimeKey: string;
  status: AppointmentStatus;
  remarks: string;
  mode: string;
  videoRoom: string | null;
  branchId: string | null;
  bp: string | null;
  pulse: string | null;
  temperature: string | null;
  weight: string | null;
  visitType: string | null;
  tokenNo: number | null;
  queueNumber: number | null;
  tokenNumber: string | null;
  paymentId: string | null;
  checkedInAt: Date | null;
  consultStartedAt: Date | null;
  calledInAt: Date | null;
  checkedOutAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MemorySlot {
  id: string;
  doctorId: string;
  weekday: number;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  slotMinutes: number;
  active: boolean;
}

interface MemoryBlock {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  // In-memory fallback stores for test isolation and offline resilience
  private memoryAppointments: Map<string, MemoryAppointment> = new Map();
  private memorySlots: Map<string, MemorySlot> = new Map();
  private memoryBlocks: Map<string, MemoryBlock> = new Map();
  private nextId = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly patientService: PatientService,
    private readonly doctorService: DoctorService,
  ) {}

  /**
   * Book a new appointment with transaction-level double booking and doctor availability guards.
   */
  async create(
    dto: CreateAppointmentDto,
    userId = '',
  ): Promise<AppointmentResponseDto> {
    let patient: any;
    try {
      patient = await this.patientService.findById(dto.patient);
    } catch {
      throw new BadRequestException('Patient does not exist.');
    }

    let doctor: any;
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

    if (this.prisma.connected) {
      try {
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
      } catch (err: any) {
        if (err instanceof BadRequestException) {
          throw err;
        }
        this.logger.warn(
          `Prisma appointment create failed: ${err.message}. Using fallback.`,
        );
      }
    }

    // In-memory fallback
    if (!['cancelled', 'no show', 'completed'].includes(status)) {
      this.assertDoctorBookableMemory(
        doctor.id,
        dto.date,
        startStr,
        endStr,
      );
    }
    this.assertNoClashMemory(doctor.id, startStr, endStr, timeSlot, null);

    const idStr = (this.nextId++).toString();
    const memoryRecord: MemoryAppointment = {
      id: idStr,
      patientId: patient.id,
      doctorId: doctor.id,
      date: dto.date,
      timeSlot,
      sTime: startStr,
      eTime: endStr,
      sTimeKey,
      status,
      remarks: dto.remarks ?? '',
      mode: isVideo ? 'video' : 'in_person',
      videoRoom,
      branchId: dto.branchId ? String(dto.branchId) : null,
      bp: dto.b_p ?? null,
      pulse: dto.pulse ?? null,
      temperature: dto.temprature ?? null,
      weight: dto.weight ?? null,
      visitType: dto.visitType ?? 'first_visit',
      tokenNo: null,
      queueNumber: null,
      tokenNumber: null,
      paymentId: null,
      checkedInAt: null,
      consultStartedAt: null,
      calledInAt: null,
      checkedOutAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.memoryAppointments.set(idStr, memoryRecord);

    return this.formatMemoryAppointment(memoryRecord, patient, doctor);
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

    if (this.prisma.connected) {
      try {
        const where: any = {};
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
      } catch (err: any) {
        this.logger.warn(`Prisma findAll appointments failed: ${err.message}.`);
      }
    }

    // In-memory fallback
    let matches = Array.from(this.memoryAppointments.values());

    if (targetDate) {
      matches = matches.filter((a) => a.date === targetDate);
    }
    if (doctorIdStr) {
      matches = matches.filter((a) => a.doctorId === doctorIdStr);
    }
    if (patientIdStr) {
      matches = matches.filter((a) => a.patientId === patientIdStr);
    }
    if (status) {
      matches = matches.filter((a) => a.status === status);
    }

    matches.sort((a, b) => a.sTime.localeCompare(b.sTime));

    const total = matches.length;
    const paged = matches.slice(skip, skip + limit);

    const data = await Promise.all(
      paged.map(async (m) => {
        const p = await this.patientService.findById(m.patientId);
        const d = await this.doctorService.findById(m.doctorId);
        return this.formatMemoryAppointment(m, p, d);
      }),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single appointment by ID.
   */
  async findOne(idOrKey: string | number): Promise<AppointmentResponseDto> {
    const idStr = String(idOrKey);

    if (this.prisma.connected) {
      try {
        const appointment = await this.prisma.appointment.findUnique({
          where: { id: BigInt(idStr) },
          include: {
            patient: true,
            doctor: true,
          },
        });
        if (appointment) {
          return this.formatAppointment(appointment);
        }
      } catch (err: any) {
        this.logger.warn(`Prisma findUnique appointment failed: ${err.message}.`);
      }
    }

    const memory = this.memoryAppointments.get(idStr);
    if (!memory) {
      throw new NotFoundException(`Appointment #${idStr} not found.`);
    }

    const p = await this.patientService.findById(memory.patientId);
    const d = await this.doctorService.findById(memory.doctorId);
    return this.formatMemoryAppointment(memory, p, d);
  }

  /**
   * Update appointment fields, rescheduling and status transitions.
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
    const status: AppointmentStatus = (dto.status as any) ?? existing.status;

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
    const videoRoom = isVideo
      ? existing.videoRoom || this.generateVideoRoom()
      : null;

    if (this.prisma.connected) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT id FROM doctor WHERE id = ${BigInt(doctorId)} FOR UPDATE`;

          if (!['cancelled', 'no show', 'completed'].includes(status)) {
            await this.assertDoctorBookable(
              tx,
              doctorId,
              date,
              startStr,
              endStr,
            );
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
              remarks: dto.remarks !== undefined ? dto.remarks : existing.remarks,
              bp: dto.b_p !== undefined ? dto.b_p : existing.bp,
              pulse: dto.pulse !== undefined ? dto.pulse : existing.pulse,
              temperature:
                dto.temprature !== undefined
                  ? dto.temprature
                  : existing.temperature,
              weight: dto.weight !== undefined ? dto.weight : existing.weight,
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
      } catch (err: any) {
        if (err instanceof BadRequestException) {
          throw err;
        }
        this.logger.warn(`Prisma update appointment failed: ${err.message}.`);
      }
    }

    // In-memory update
    if (!['cancelled', 'no show', 'completed'].includes(status)) {
      this.assertDoctorBookableMemory(doctorId, date, startStr, endStr);
    }
    this.assertNoClashMemory(doctorId, startStr, endStr, timeSlot, idStr);

    const memory = this.memoryAppointments.get(idStr);
    if (!memory) {
      throw new NotFoundException(`Appointment #${idStr} not found.`);
    }

    memory.patientId = patientId;
    memory.doctorId = doctorId;
    memory.date = date;
    memory.timeSlot = timeSlot;
    memory.sTime = startStr;
    memory.eTime = endStr;
    memory.sTimeKey = sTimeKey;
    memory.status = status;
    if (dto.remarks !== undefined) memory.remarks = dto.remarks ?? '';
    if (dto.b_p !== undefined) memory.bp = dto.b_p ?? null;
    if (dto.pulse !== undefined) memory.pulse = dto.pulse ?? null;
    if (dto.temprature !== undefined) memory.temperature = dto.temprature ?? null;
    if (dto.weight !== undefined) memory.weight = dto.weight ?? null;
    memory.mode = isVideo ? 'video' : 'in_person';
    memory.videoRoom = videoRoom;
    if (dto.visitType !== undefined) memory.visitType = dto.visitType ?? null;
    memory.updatedAt = new Date();

    const p = await this.patientService.findById(patientId);
    const d = await this.doctorService.findById(doctorId);
    return this.formatMemoryAppointment(memory, p, d);
  }

  /**
   * Delete an appointment record.
   */
  async remove(idOrKey: string | number): Promise<{ message: string }> {
    const idStr = String(idOrKey);
    const existing = await this.findOne(idStr);

    if (this.prisma.connected) {
      try {
        await this.prisma.appointment.delete({
          where: { id: BigInt(idStr) },
        });
        return {
          message: `Appointment #${idStr} on ${existing.date} removed.`,
        };
      } catch (err: any) {
        this.logger.warn(`Prisma delete appointment failed: ${err.message}.`);
      }
    }

    this.memoryAppointments.delete(idStr);
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
    let slots: MemorySlot[] = [];
    if (this.prisma.connected) {
      try {
        const dbSlots = await this.prisma.doctorSlot.findMany({
          where: {
            doctorId: BigInt(docIdStr),
            weekday,
            active: true,
          },
          orderBy: { startTime: 'asc' },
        });
        slots = dbSlots.map((s) => ({
          id: s.id.toString(),
          doctorId: s.doctorId.toString(),
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
          slotMinutes: s.slotMinutes,
          active: s.active,
        }));
      } catch (err: any) {
        this.logger.warn(`Prisma freeSlots lookup failed: ${err.message}.`);
      }
    }

    if (slots.length === 0) {
      slots = Array.from(this.memorySlots.values()).filter(
        (s) => s.doctorId === docIdStr && s.weekday === weekday && s.active,
      );
    }

    if (slots.length === 0) {
      return [];
    }

    // 2. Get booked appointments for that doctor on that date (not cancelled or no show)
    let bookedTimes: { sTime: string; eTime: string }[] = [];
    if (this.prisma.connected) {
      try {
        const bookings = await this.prisma.appointment.findMany({
          where: {
            doctorId: BigInt(docIdStr),
            date,
            status: { notIn: ['cancelled', 'no show'] },
          },
          select: { sTime: true, eTime: true },
        });
        bookedTimes = bookings;
      } catch (err: any) {
        this.logger.warn(`Prisma booked times lookup failed: ${err.message}.`);
      }
    }

    if (bookedTimes.length === 0) {
      bookedTimes = Array.from(this.memoryAppointments.values())
        .filter(
          (a) =>
            a.doctorId === docIdStr &&
            a.date === date &&
            !['cancelled', 'no show'].includes(a.status),
        )
        .map((a) => ({ sTime: a.sTime, eTime: a.eTime }));
    }

    // 3. Get blocks on this date
    let blocks: MemoryBlock[] = [];
    if (this.prisma.connected) {
      try {
        const dbBlocks = await this.prisma.slotBlock.findMany({
          where: {
            doctorId: BigInt(docIdStr),
            date: new Date(date),
          },
        });
        blocks = dbBlocks.map((b) => ({
          id: b.id.toString(),
          doctorId: b.doctorId.toString(),
          date,
          startTime: b.startTime,
          endTime: b.endTime,
          reason: b.reason,
        }));
      } catch (err: any) {
        this.logger.warn(`Prisma slotBlock lookup failed: ${err.message}.`);
      }
    }

    if (blocks.length === 0) {
      blocks = Array.from(this.memoryBlocks.values()).filter(
        (b) => b.doctorId === docIdStr && b.date === date,
      );
    }

    const freeSlots: FreeSlotDto[] = [];

    for (const slot of slots) {
      let currentMinutes = this.timeToMinutes(slot.startTime);
      const stopMinutes = this.timeToMinutes(slot.endTime);

      while (currentMinutes + slot.slotMinutes <= stopMinutes) {
        const slotStartStr = this.minutesToTime(currentMinutes);
        const slotEndStr = this.minutesToTime(currentMinutes + slot.slotMinutes);

        const fullStart = `${date} ${slotStartStr}:00`;
        const fullEnd = `${date} ${slotEndStr}:00`;

        // Check if overlaps with any booked appointment
        const isBooked = bookedTimes.some(
          (b) => b.sTime < fullEnd && b.eTime > fullStart,
        );

        // Check if overlaps with any slot block
        const isBlocked = blocks.some((b) => {
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

  private assertNoClashMemory(
    doctorId: string,
    startStr: string,
    endStr: string,
    timeSlot: string,
    ignoreId: string | null,
  ): void {
    for (const [id, a] of this.memoryAppointments.entries()) {
      if (ignoreId && id === ignoreId) continue;
      if (a.doctorId !== doctorId) continue;
      if (['cancelled', 'no show'].includes(a.status)) continue;

      // Overlap: existing.s_time < new.e_time AND existing.e_time > new.s_time
      if (a.sTime < endStr && a.eTime > startStr) {
        throw new BadRequestException(
          `That doctor is already booked ${a.timeSlot || timeSlot} with another patient.`,
        );
      }
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
    const daySlots = allSlots.filter((s: any) => s.weekday === dayOfWeek);

    if (daySlots.length === 0) {
      throw new BadRequestException(
        `The doctor has no clinic on ${weekdayName}s.`,
      );
    }

    const startTimeOnly = startStr.substring(11, 16);
    const endTimeOnly = endStr.substring(11, 16);

    const fitsInSlot = daySlots.some(
      (s: any) => startTimeOnly >= s.startTime && endTimeOnly <= s.endTime,
    );

    if (!fitsInSlot) {
      const hours = daySlots
        .map((s: any) => `${s.startTime}-${s.endTime}`)
        .join(', ');
      throw new BadRequestException(
        `Outside the doctor's clinic hours on ${weekdayName} (${hours}).`,
      );
    }
  }

  private assertDoctorBookableMemory(
    doctorId: string,
    date: string,
    startStr: string,
    endStr: string,
  ): void {
    // 1. Check blocks
    for (const b of this.memoryBlocks.values()) {
      if (b.doctorId === doctorId && b.date === date) {
        if (!b.startTime || !b.endTime) {
          throw new BadRequestException(
            `The doctor is not available then${b.reason ? ' (' + b.reason + ')' : ''}.`,
          );
        }
        const bStart = `${date} ${b.startTime}:00`;
        const bEnd = `${date} ${b.endTime}:00`;
        if (startStr < bEnd && endStr > bStart) {
          throw new BadRequestException(
            `The doctor is not available then${b.reason ? ' (' + b.reason + ')' : ''}.`,
          );
        }
      }
    }

    // 2. Check slots
    const allSlots = Array.from(this.memorySlots.values()).filter(
      (s) => s.doctorId === doctorId && s.active,
    );
    if (allSlots.length === 0) {
      return;
    }

    const dayOfWeek = new Date(date).getDay();
    const weekdayName = WEEKDAYS[dayOfWeek];
    const daySlots = allSlots.filter((s) => s.weekday === dayOfWeek);

    if (daySlots.length === 0) {
      throw new BadRequestException(
        `The doctor has no clinic on ${weekdayName}s.`,
      );
    }

    const startTimeOnly = startStr.substring(11, 16);
    const endTimeOnly = endStr.substring(11, 16);

    const fits = daySlots.some(
      (s) => startTimeOnly >= s.startTime && endTimeOnly <= s.endTime,
    );
    if (!fits) {
      const hours = daySlots
        .map((s) => `${s.startTime}-${s.endTime}`)
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
      createdAt: app.createdAt ? app.createdAt.toISOString() : null,
      updatedAt: app.updatedAt ? app.updatedAt.toISOString() : null,
    };
  }

  private formatMemoryAppointment(
    m: MemoryAppointment,
    patient?: any,
    doctor?: any,
  ): AppointmentResponseDto {
    const videoUrl =
      m.videoRoom && m.mode === 'video'
        ? `https://meet.jit.si/${encodeURIComponent(m.videoRoom)}`
        : null;

    return {
      id: m.id,
      patientId: m.patientId,
      doctorId: m.doctorId,
      date: m.date,
      timeSlot: m.timeSlot,
      sTime: m.sTime,
      eTime: m.eTime,
      sTimeKey: m.sTimeKey,
      status: m.status,
      remarks: m.remarks || null,
      mode: m.mode,
      videoRoom: m.videoRoom,
      videoUrl,
      branchId: m.branchId,
      bp: m.bp,
      pulse: m.pulse,
      temperature: m.temperature,
      weight: m.weight,
      visitType: m.visitType,
      patient: patient
        ? {
            id: patient.id,
            patientId: patient.patientId || '',
            name: patient.name,
            phone: patient.phone || null,
          }
        : undefined,
      doctor: doctor
        ? {
            id: doctor.id,
            name: doctor.name,
            department: doctor.department || null,
          }
        : undefined,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  // --- Test Helpers ---

  /** Add in-memory slots for testing */
  addTestSlot(slot: Omit<MemorySlot, 'id'>): MemorySlot {
    const id = (this.nextId++).toString();
    const record: MemorySlot = { id, ...slot };
    this.memorySlots.set(id, record);
    return record;
  }

  /** Add in-memory block for testing */
  addTestBlock(block: Omit<MemoryBlock, 'id'>): MemoryBlock {
    const id = (this.nextId++).toString();
    const record: MemoryBlock = { id, ...block };
    this.memoryBlocks.set(id, record);
    return record;
  }

  /** Clear in-memory state for test isolation */
  clearMemory(): void {
    this.memoryAppointments.clear();
    this.memorySlots.clear();
    this.memoryBlocks.clear();
  }
}
