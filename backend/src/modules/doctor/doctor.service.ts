import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { DepartmentService } from '../department/department.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { DoctorQueryDto } from './dto/doctor-query.dto';
import { DoctorResponseDto, PaginatedDoctorsDto } from './dto/doctor-response.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorService {
  private readonly logger = new Logger(DoctorService.name);

  // In-memory fallback repository for offline test and local standalone development
  private memoryDoctors: Map<string, any> = new Map();
  private memoryAppointments: Map<string, any> = new Map();
  private memoryUsers: Map<string, any> = new Map();
  private memoryIdCounter = 0;
  private memoryApptIdCounter = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentService: DepartmentService,
  ) {}

  /**
   * Helper to seed appointments for testing deletion protection.
   */
  seedMemoryAppointment(doctorId: string, status = 'scheduled', date?: string): string {
    this.memoryApptIdCounter++;
    const id = this.memoryApptIdCounter.toString();
    const apptDate = date || new Date().toISOString().slice(0, 10);
    this.memoryAppointments.set(id, {
      id,
      doctorId,
      status,
      date: apptDate,
    });
    return id;
  }

  /**
   * Clear in-memory state for test isolation.
   */
  clearMemoryStore(): void {
    this.memoryDoctors.clear();
    this.memoryAppointments.clear();
    this.memoryUsers.clear();
    this.memoryIdCounter = 0;
    this.memoryApptIdCounter = 0;
  }

  /**
   * Get merged department suggestion list.
   */
  async getDepartmentSuggestions(): Promise<string[]> {
    if (this.prisma.connected) {
      try {
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
      } catch (err: any) {
        this.logger.warn(
          `Failed to fetch suggestions from DB: ${err.message}. Falling back to memory.`,
        );
      }
    }

    // In-memory suggestion
    const listRes = await this.departmentService.findAll();
    const set = new Set<string>(listRes.departments.map((d) => d.name));
    for (const doc of this.memoryDoctors.values()) {
      if (doc.department?.trim()) {
        set.add(doc.department.trim());
      }
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

    if (this.prisma.connected) {
      try {
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
      } catch (err: any) {
        this.logger.warn(`Prisma doctor search failed: ${err.message}. Falling back to memory.`);
      }
    }

    // In-memory list
    const all = Array.from(this.memoryDoctors.values());
    const filtered = term
      ? all.filter((d) => {
          const s =
            `${d.name} ${d.department || ''} ${d.phone || ''} ${d.email || ''}`.toLowerCase();
          return s.includes(term.toLowerCase());
        })
      : all;

    filtered.sort((a, b) => a.name.localeCompare(b.name));
    const paginated = filtered.slice(skip, skip + limit);

    return {
      items: paginated.map((d) => {
        const upcoming = Array.from(this.memoryAppointments.values()).filter(
          (a) =>
            a.doctorId === d.id.toString() &&
            a.date >= todayStr &&
            !['cancelled', 'no show'].includes(a.status),
        ).length;
        return this.mapToDto(d, upcoming);
      }),
      meta: {
        total: filtered.length,
        page,
        limit,
        totalPages: Math.ceil(filtered.length / limit) || 1,
      },
    };
  }

  /**
   * Find doctor by ID.
   */
  async findById(id: string | number): Promise<DoctorResponseDto> {
    const searchId = String(id).trim();
    const todayStr = new Date().toISOString().slice(0, 10);

    if (this.prisma.connected) {
      try {
        const doctor = await this.prisma.doctor.findUnique({
          where: { id: BigInt(searchId) },
        });

        if (doctor) {
          const upcoming = await this.prisma.appointment.count({
            where: {
              doctorId: doctor.id,
              date: { gte: todayStr },
              status: { notIn: ['cancelled', 'no show'] },
            },
          });
          return this.mapToDto(doctor, upcoming);
        }
      } catch (err: any) {
        this.logger.warn(
          `Prisma findUnique doctor failed: ${err.message}. Falling back to memory.`,
        );
      }
    }

    const mem = this.memoryDoctors.get(searchId);
    if (mem) {
      const upcoming = Array.from(this.memoryAppointments.values()).filter(
        (a) =>
          a.doctorId === mem.id.toString() &&
          a.date >= todayStr &&
          !['cancelled', 'no show'].includes(a.status),
      ).length;
      return this.mapToDto(mem, upcoming);
    }

    throw new NotFoundException(`Doctor with ID "${searchId}" not found`);
  }

  /**
   * Create a new doctor record with optional login account.
   */
  async create(dto: CreateDoctorDto): Promise<DoctorResponseDto> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('Doctor name is required');
    }

    const email = dto.email?.trim() || null;

    // Check email uniqueness if email is given (blank emails do not clash)
    if (email) {
      if (this.prisma.connected) {
        try {
          const clash = await this.prisma.doctor.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
          });
          if (clash) {
            throw new BadRequestException(
              'Another doctor is already on file with that email address.',
            );
          }
        } catch (err: any) {
          if (err instanceof BadRequestException) throw err;
          this.logger.warn(`Prisma email clash check failed: ${err.message}`);
        }
      }

      for (const d of this.memoryDoctors.values()) {
        if (d.email && d.email.toLowerCase() === email.toLowerCase()) {
          throw new BadRequestException(
            'Another doctor is already on file with that email address.',
          );
        }
      }
    }

    // Optional Staff Login processing
    let ionUserId = '';
    let loginUsername: string | null = null;

    if (dto.loginUsername) {
      const username = dto.loginUsername.trim();
      if (this.prisma.connected) {
        try {
          const userClash = await this.prisma.user.findUnique({
            where: { login: username },
          });
          if (userClash) {
            throw new BadRequestException('That username is already taken.');
          }

          const [first, ...rest] = name.split(' ');
          const last = rest.join(' ') || '-';
          const hashedPassword = crypto
            .createHash('sha256')
            .update(dto.loginPassword || 'DoctorPassword123!')
            .digest('hex');

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
        } catch (err: any) {
          if (err instanceof BadRequestException) throw err;
          this.logger.warn(`Failed to create doctor login: ${err.message}`);
        }
      } else {
        for (const u of this.memoryUsers.values()) {
          if (u.login.toLowerCase() === username.toLowerCase()) {
            throw new BadRequestException('That username is already taken.');
          }
        }
        const userId = (this.memoryUsers.size + 1).toString();
        this.memoryUsers.set(userId, {
          id: userId,
          login: username,
          group: 'Doctor',
        });
        ionUserId = userId;
        loginUsername = username;
      }
    }

    const doctorData = {
      name,
      email,
      phone: dto.phone?.trim() || null,
      address: dto.address?.trim() || null,
      department: dto.department?.trim() || null,
      profile: dto.profile?.trim() || null,
      procedureId: dto.procedureId?.trim() || null,
      branchId: dto.branchId ? BigInt(dto.branchId) : null,
      ionUserId,
      imageUrl: null,
      x: '',
      y: '',
    };

    if (this.prisma.connected) {
      try {
        const created = await this.prisma.doctor.create({
          data: doctorData,
        });

        // Also update memory representation in departmentService for usage counts
        this.departmentService.seedMemoryDoctor(
          created.id.toString(),
          created.name,
          created.department,
        );

        return this.mapToDto(created, 0, loginUsername);
      } catch (err: any) {
        this.logger.warn(`Failed to persist doctor in database: ${err.message}. Saving to memory.`);
      }
    }

    // In-memory store
    this.memoryIdCounter++;
    const now = new Date();
    const inMemRecord = {
      ...doctorData,
      id: BigInt(this.memoryIdCounter),
      createdAt: now,
      updatedAt: now,
    };
    this.memoryDoctors.set(inMemRecord.id.toString(), inMemRecord);

    // Keep department usage counts in sync
    this.departmentService.seedMemoryDoctor(
      inMemRecord.id.toString(),
      inMemRecord.name,
      inMemRecord.department,
    );

    return this.mapToDto(inMemRecord, 0, loginUsername);
  }

  /**
   * Update doctor record.
   */
  async update(id: string | number, dto: UpdateDoctorDto): Promise<DoctorResponseDto> {
    const existing = await this.findById(id);
    const updateData: any = {};

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
        if (this.prisma.connected) {
          try {
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
          } catch (err: any) {
            if (err instanceof BadRequestException) throw err;
            this.logger.warn(`Prisma email clash check failed: ${err.message}`);
          }
        }

        for (const d of this.memoryDoctors.values()) {
          if (
            d.email &&
            d.email.toLowerCase() === email.toLowerCase() &&
            d.id.toString() !== existing.id
          ) {
            throw new BadRequestException(
              'Another doctor is already on file with that email address.',
            );
          }
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

    if (this.prisma.connected) {
      try {
        const updated = await this.prisma.doctor.update({
          where: { id: BigInt(existing.id) },
          data: updateData,
        });

        // Sync department service memory
        this.departmentService.seedMemoryDoctor(
          updated.id.toString(),
          updated.name,
          updated.department,
        );

        return this.mapToDto(updated, existing.upcomingAppointments);
      } catch (err: any) {
        this.logger.warn(`Failed to update doctor in database: ${err.message}. Using memory.`);
      }
    }

    // In-memory update
    const memRecord = this.memoryDoctors.get(existing.id);
    Object.assign(memRecord, updateData, { updatedAt: new Date() });

    // Sync department service memory
    this.departmentService.seedMemoryDoctor(
      memRecord.id.toString(),
      memRecord.name,
      memRecord.department,
    );

    return this.mapToDto(memRecord, existing.upcomingAppointments);
  }

  /**
   * Delete doctor record.
   * Rejects deletion with 400 Bad Request if appointments exist against this doctor.
   */
  async remove(id: string | number): Promise<{ message: string }> {
    const existing = await this.findById(id);

    if (this.prisma.connected) {
      try {
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

        this.departmentService.seedMemoryDoctor(existing.id, existing.name, null);

        return { message: `Removed ${existing.name}.` };
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(`Failed to delete doctor in DB: ${err.message}. Using memory.`);
      }
    }

    // In-memory delete check
    const hasAppointments = Array.from(this.memoryAppointments.values()).some(
      (a) => a.doctorId === existing.id,
    );

    if (hasAppointments) {
      throw new BadRequestException(
        `${existing.name} has appointments on file, so the record stays.`,
      );
    }

    this.memoryDoctors.delete(existing.id);
    this.departmentService.seedMemoryDoctor(existing.id, existing.name, null);

    return { message: `Removed ${existing.name}.` };
  }

  /**
   * Map raw database or memory record to typed DoctorResponseDto.
   */
  private mapToDto(
    d: any,
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
