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

@Injectable()
export class DoctorService {
  private readonly logger = new Logger(DoctorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentService: DepartmentService,
  ) {}

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

    const whereClause = term
      ? {
          OR: [
            { name: { contains: term, mode: 'insensitive' as const } },
            { department: { contains: term, mode: 'insensitive' as const } },
            { phone: { contains: term, mode: 'insensitive' as const } },
            { email: { contains: term, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [doctors, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
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

    return {
      items: doctors.map((d) => this.mapToDto(d, countMap.get(d.id.toString()) || 0)),
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

    const doctorData = {
      name,
      email,
      phone: dto.phone?.trim() || null,
      address: dto.address?.trim() || null,
      department: dto.department?.trim() || null,
      profile: dto.profile?.trim() || null,
      procedureId: dto.procedureId?.trim() || null,
      branchId: dto.branchId && !isNaN(Number(dto.branchId)) ? BigInt(dto.branchId) : null,
      ionUserId,
      imageUrl: null,
      x: '',
      y: '',
    };

    const created = await this.prisma.doctor.create({
      data: doctorData,
    });

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
