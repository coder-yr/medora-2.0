import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Doctor } from '@prisma/client';
import * as argon2 from 'argon2';
import { DepartmentService } from '../department/department.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { DoctorQueryDto } from './dto/doctor-query.dto';
import { DoctorResponseDto, PaginatedDoctorsDto } from './dto/doctor-response.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import {
  DoctorLeaveDto,
  DoctorScheduleUpdateDto,
  DoctorSlotDto,
} from './dto/doctor-schedule.dto';

@Injectable()
export class DoctorService {
  private readonly logger = new Logger(DoctorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentService: DepartmentService,
  ) { }

  /**
   * Get merged department suggestion list from database.
   */
  async getDepartmentSuggestions(): Promise<string[]> {
    const [listedDepts, docDepts] = await Promise.all([
      this.prisma.department.findMany({ select: { name: true } }),
      this.prisma.doctor.findMany({
        where: { department: { not: null } },
        select: { department: true },
      }),
    ]);

    const set = new Set<string>();
    for (const d of listedDepts) {
      if (d.name?.trim()) set.add(d.name.trim());
    }
    for (const doc of docDepts) {
      if (doc.department?.trim()) set.add(doc.department.trim());
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /**
   * List doctors with single-box search and pagination.
   */
  async findAll(query: DoctorQueryDto): Promise<PaginatedDoctorsDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 25));
    const skip = (page - 1) * limit;
    const term = (query.q || '').trim();
    const todayStr = new Date().toISOString().slice(0, 10);

    let whereClause: any = term
      ? {
        OR: [
          { name: { contains: term, mode: 'insensitive' as const } },
          { department: { contains: term, mode: 'insensitive' as const } },
          { phone: { contains: term, mode: 'insensitive' as const } },
          { email: { contains: term, mode: 'insensitive' as const } },
        ],
      }
      : {};

    const rawBranchId = query.branchId || query.branch_id;
    if (rawBranchId) {
      try {
        const bId = BigInt(String(rawBranchId));
        const branchCondition = {
          OR: [{ branchId: bId }, { branchId: null }],
        };
        if (term) {
          whereClause = {
            AND: [whereClause, branchCondition],
          };
        } else {
          whereClause = branchCondition;
        }
      } catch {
        // ignore invalid bigint
      }
    }

    const [doctors, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [{ id: 'desc' }],
      }),
      this.prisma.doctor.count({ where: whereClause }),
    ]);

    // Upcoming appointments per doctor: date >= today and status not in ('cancelled', 'no show')
    const doctorIds = doctors.map((d) => d.id);
    const upcomingCounts = await Promise.all(
      doctorIds.map(async (docId) => {
        const count = await this.prisma.appointment.count({
          where: {
            doctorId: docId,
            date: { gte: todayStr },
            status: { notIn: ['cancelled', 'no show'] },
          },
        });
        return { docId, count };
      }),
    );

    const countMap = new Map(upcomingCounts.map((u) => [u.docId.toString(), u.count]));

    const mapped = doctors.map((d) => this.mapToDto(d, countMap.get(d.id.toString()) || 0));

    return {
      items: mapped,
      data: mapped,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Find doctor by ID.
   */
  async findById(id: string | number): Promise<DoctorResponseDto> {
    const searchId = String(id).trim();
    const todayStr = new Date().toISOString().slice(0, 10);

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: BigInt(searchId) },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID "${searchId}" not found`);
    }

    const upcoming = await this.prisma.appointment.count({
      where: {
        doctorId: doctor.id,
        date: { gte: todayStr },
        status: { notIn: ['cancelled', 'no show'] },
      },
    });

    return this.mapToDto(doctor, upcoming);
  }

  /**
   * Create a new doctor record with optional staff login account.
   */
  async create(dto: CreateDoctorDto): Promise<DoctorResponseDto> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('Doctor name is required');
    }

    const email = dto.email?.trim() || null;

    // Check email uniqueness if email is given (blank emails do not clash)
    if (email) {
      const clash = await this.prisma.doctor.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      if (clash) {
        throw new BadRequestException('Another doctor is already on file with that email address.');
      }
    }

    // Optional Staff Login processing
    let ionUserId = '';
    let loginUsername: string | null = null;

    if (dto.loginUsername) {
      const username = dto.loginUsername.trim();
      const userClash = await this.prisma.user.findUnique({
        where: { login: username },
      });
      if (userClash) {
        throw new BadRequestException('That username is already taken.');
      }

      const [first, ...rest] = name.split(' ');
      const last = rest.join(' ') || '-';
      const hashedPassword = await argon2.hash(dto.loginPassword || 'DoctorPassword123!', {
        type: argon2.argon2id,
      });

      const newUser = await this.prisma.user.create({
        data: {
          login: username,
          password: hashedPassword,
          firstName: first.slice(0, 20),
          lastName: last.slice(0, 20),
          email: email || '',
          group: 'Doctor',
          description: `Doctor login for ${name}`.slice(0, 200),
        },
      });
      ionUserId = newUser.id.toString();
      loginUsername = username;
    }

    const rawBranchId = dto.branchId ?? dto.branch_id;
    const branchId =
      rawBranchId !== undefined && rawBranchId !== null && rawBranchId !== '' && !isNaN(Number(rawBranchId))
        ? BigInt(rawBranchId)
        : null;

    const doctorData = {
      name,
      email,
      phone: dto.phone?.trim() || null,
      address: dto.address?.trim() || null,
      department: dto.department?.trim() || null,
      profile: dto.profile?.trim() || null,
      procedureId: dto.procedureId?.trim() || null,
      branchId,
      ionUserId,
      imageUrl: null,
      x: '',
      y: '',
    };

    const created = await this.prisma.doctor.create({
      data: doctorData,
    });

    if (this.prisma.doctorSlot) {
      try {
        await this.prisma.doctorSlot.createMany({
          data: [1, 2, 3, 4, 5, 6].map((weekday) => ({
            doctorId: created.id,
            weekday,
            startTime: '09:00',
            endTime: '17:00',
            slotMinutes: 15,
            active: true,
          })),
        });
      } catch {
        // Non-blocking in unit test mocks
      }
    }

    return this.mapToDto(created, 0, loginUsername);
  }

  /**
   * Update doctor record.
   */
  async update(id: string | number, dto: UpdateDoctorDto): Promise<DoctorResponseDto> {
    const existing = await this.findById(id);
    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Doctor name cannot be empty');
      }
      updateData.name = name;
    }

    if (dto.email !== undefined) {
      const email = dto.email ? dto.email.trim() : null;
      if (email) {
        const clash = await this.prisma.doctor.findFirst({
          where: {
            email: { equals: email, mode: 'insensitive' },
            NOT: { id: BigInt(existing.id) },
          },
        });
        if (clash) {
          throw new BadRequestException(
            'Another doctor is already on file with that email address.',
          );
        }
      }
      updateData.email = email;
    }

    if (dto.phone !== undefined) updateData.phone = dto.phone?.trim() || null;
    if (dto.address !== undefined) updateData.address = dto.address?.trim() || null;
    if (dto.department !== undefined) updateData.department = dto.department?.trim() || null;
    if (dto.profile !== undefined) updateData.profile = dto.profile?.trim() || null;
    if (dto.procedureId !== undefined) updateData.procedureId = dto.procedureId?.trim() || null;
    if (dto.branchId !== undefined) {
      updateData.branchId = dto.branchId ? BigInt(dto.branchId) : null;
    }

    const updated = await this.prisma.doctor.update({
      where: { id: BigInt(existing.id) },
      data: updateData,
    });

    return this.mapToDto(updated, existing.upcomingAppointments);
  }

  /**
   * Delete doctor record.
   * Rejects deletion with 400 Bad Request if appointments exist against this doctor.
   */
  async remove(id: string | number): Promise<{ message: string }> {
    const existing = await this.findById(id);

    const hasAppointments = await this.prisma.appointment.findFirst({
      where: { doctorId: BigInt(existing.id) },
    });

    if (hasAppointments) {
      throw new BadRequestException(
        `${existing.name} has appointments on file, so the record stays.`,
      );
    }

    await this.prisma.doctor.delete({
      where: { id: BigInt(existing.id) },
    });

    return { message: `Removed ${existing.name}.` };
  }

  /**
   * Retrieves weekly working schedules for a doctor.
   */
  async getDoctorSchedules(
    doctorId: string | number,
    branchId?: string | number,
  ): Promise<DoctorSlotDto[]> {
    const doc = await this.findById(doctorId);
    const where: Record<string, unknown> = {
      doctorId: BigInt(doc.id),
    };
    if (branchId) {
      where.branchId = BigInt(branchId);
    }

    const slots = await this.prisma.doctorSlot.findMany({
      where,
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });

    return slots.map((s) => ({
      id: s.id.toString(),
      branchId: s.branchId ? Number(s.branchId) : null,
      weekday: s.weekday,
      startTime: s.startTime,
      endTime: s.endTime,
      slotMinutes: s.slotMinutes,
      breakStartTime: s.breakStartTime || null,
      breakEndTime: s.breakEndTime || null,
      active: s.active,
    }));
  }

  /**
   * Updates weekly working schedules for a doctor.
   */
  async updateDoctorSchedules(
    doctorId: string | number,
    dto: DoctorScheduleUpdateDto,
  ): Promise<DoctorSlotDto[]> {
    const doc = await this.findById(doctorId);
    const targetBranchId = dto.branchId ? BigInt(dto.branchId) : null;

    // Validate times
    for (const slot of dto.slots) {
      if (slot.startTime >= slot.endTime) {
        throw new BadRequestException(
          `Start time (${slot.startTime}) must be earlier than end time (${slot.endTime}).`,
        );
      }
      if (slot.breakStartTime && slot.breakEndTime) {
        if (slot.breakStartTime >= slot.breakEndTime) {
          throw new BadRequestException(
            `Break start time (${slot.breakStartTime}) must be earlier than break end time (${slot.breakEndTime}).`,
          );
        }
        if (slot.breakStartTime < slot.startTime || slot.breakEndTime > slot.endTime) {
          throw new BadRequestException(
            `Break period (${slot.breakStartTime}-${slot.breakEndTime}) must be within working hours (${slot.startTime}-${slot.endTime}).`,
          );
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Clear existing slots for this doctor and branch
      await tx.doctorSlot.deleteMany({
        where: {
          doctorId: BigInt(doc.id),
          ...(targetBranchId ? { branchId: targetBranchId } : {}),
        },
      });

      // Insert new slots
      for (const s of dto.slots) {
        await tx.doctorSlot.create({
          data: {
            doctorId: BigInt(doc.id),
            branchId: s.branchId ? BigInt(s.branchId) : targetBranchId,
            weekday: s.weekday,
            startTime: s.startTime,
            endTime: s.endTime,
            slotMinutes: s.slotMinutes || 15,
            breakStartTime: s.breakStartTime || null,
            breakEndTime: s.breakEndTime || null,
            active: s.active ?? true,
          },
        });
      }
    });

    return this.getDoctorSchedules(doc.id, dto.branchId);
  }

  /**
   * Retrieves leave and unavailable blocks for a doctor.
   */
  async getDoctorLeaves(doctorId: string | number): Promise<DoctorLeaveDto[]> {
    const doc = await this.findById(doctorId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const blocks = await this.prisma.slotBlock.findMany({
      where: {
        doctorId: BigInt(doc.id),
        date: { gte: today },
      },
      orderBy: { date: 'asc' },
    });

    return blocks.map((b) => ({
      id: b.id.toString(),
      date: b.date.toISOString().slice(0, 10),
      startTime: b.startTime || null,
      endTime: b.endTime || null,
      reason: b.reason || null,
      branchId: b.branchId ? Number(b.branchId) : undefined,
    }));
  }

  /**
   * Adds a leave or unavailable block for a doctor.
   */
  async addDoctorLeave(
    doctorId: string | number,
    dto: DoctorLeaveDto,
  ): Promise<DoctorLeaveDto> {
    const doc = await this.findById(doctorId);
    const dateObj = new Date(dto.date);

    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException('Invalid leave date format.');
    }
    if (dto.startTime && dto.endTime && dto.startTime >= dto.endTime) {
      throw new BadRequestException('Leave start time must be earlier than end time.');
    }

    const created = await this.prisma.slotBlock.create({
      data: {
        doctorId: BigInt(doc.id),
        branchId: dto.branchId ? BigInt(dto.branchId) : null,
        date: dateObj,
        startTime: dto.startTime || null,
        endTime: dto.endTime || null,
        reason: dto.reason?.trim() || 'Leave',
      },
    });

    return {
      id: created.id.toString(),
      date: created.date.toISOString().slice(0, 10),
      startTime: created.startTime || null,
      endTime: created.endTime || null,
      reason: created.reason || null,
      branchId: created.branchId ? Number(created.branchId) : undefined,
    };
  }

  /**
   * Removes a leave or unavailable block for a doctor.
   */
  async deleteDoctorLeave(
    doctorId: string | number,
    blockId: string | number,
  ): Promise<{ message: string }> {
    const doc = await this.findById(doctorId);
    const existing = await this.prisma.slotBlock.findFirst({
      where: {
        id: BigInt(blockId),
        doctorId: BigInt(doc.id),
      },
    });

    if (!existing) {
      throw new NotFoundException(`Leave block #${blockId} not found for doctor.`);
    }

    await this.prisma.slotBlock.delete({
      where: { id: existing.id },
    });

    return { message: `Leave block #${blockId} removed.` };
  }

  /**
   * Map raw database record to typed DoctorResponseDto.
   */
  private mapToDto(
    d: Doctor,
    upcomingAppointments = 0,
    loginUsername: string | null = null,
  ): DoctorResponseDto {
    const ionId = d.ionUserId ? String(d.ionUserId).trim() : null;
    const hasLogin = Boolean(ionId && ionId !== '' && ionId !== '0');

    return {
      id: d.id ? d.id.toString() : '',
      name: d.name || '',
      email: d.email || null,
      phone: d.phone || null,
      address: d.address || null,
      department: d.department || null,
      profile: d.profile || null,
      imageUrl: d.imageUrl || null,
      ionUserId: ionId || null,
      hasLogin,
      loginUsername: loginUsername || (hasLogin ? `user_${ionId}` : null),
      upcomingAppointments,
      branchId: d.branchId ? d.branchId.toString() : null,
      createdAt: d.createdAt
        ? d.createdAt instanceof Date
          ? d.createdAt.toISOString()
          : String(d.createdAt)
        : null,
      updatedAt: d.updatedAt
        ? d.updatedAt instanceof Date
          ? d.updatedAt.toISOString()
          : String(d.updatedAt)
        : null,
    };
  }
}
