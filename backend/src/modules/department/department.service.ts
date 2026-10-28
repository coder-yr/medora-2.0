import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import {
  DepartmentAdoptResultDto,
  DepartmentListResponseDto,
  DepartmentResponseDto,
  DepartmentUpdateResultDto,
} from './dto/department-response.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentService {
  private readonly logger = new Logger(DepartmentService.name);

  // In-memory fallback stores for offline test and local standalone development
  private memoryDepartments: Map<string, any> = new Map();
  private memoryDoctors: Map<string, any> = new Map();
  private memoryIdCounter = 0;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to seed/mock doctors in memory for offline tests.
   */
  seedMemoryDoctor(id: string, name: string, department: string | null): void {
    this.memoryDoctors.set(id, { id, name, department });
  }

  /**
   * Clear in-memory state for test isolation.
   */
  clearMemoryStore(): void {
    this.memoryDepartments.clear();
    this.memoryDoctors.clear();
    this.memoryIdCounter = 0;
  }

  /**
   * Lists all departments ordered by name, including doctor usage counts and unlisted departments.
   */
  async findAll(): Promise<DepartmentListResponseDto> {
    if (this.prisma.connected) {
      try {
        const [departments, doctors] = await Promise.all([
          this.prisma.department.findMany({
            orderBy: { name: 'asc' },
          }),
          this.prisma.doctor.findMany({
            where: {
              department: { not: null },
            },
            select: { department: true },
          }),
        ]);

        const usageMap = new Map<string, number>();
        const doctorDeptSet = new Set<string>();

        for (const doc of doctors) {
          const dept = doc.department?.trim();
          if (dept) {
            doctorDeptSet.add(dept);
            usageMap.set(dept, (usageMap.get(dept) || 0) + 1);
          }
        }

        const deptNames = new Set(departments.map((d) => d.name));
        const unlisted: string[] = [];
        for (const dept of doctorDeptSet) {
          if (!deptNames.has(dept)) {
            unlisted.push(dept);
          }
        }
        unlisted.sort();

        return {
          departments: departments.map((d) => ({
            id: d.id.toString(),
            name: d.name,
            description: d.description || null,
            doctorCount: usageMap.get(d.name) || 0,
            createdAt: d.createdAt ? d.createdAt.toISOString() : null,
            updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
          })),
          unlisted,
        };
      } catch (err: any) {
        this.logger.warn(
          `Prisma department query failed: ${err.message}. Falling back to memory store.`,
        );
      }
    }

    // In-memory fallback
    const depts = Array.from(this.memoryDepartments.values());
    depts.sort((a, b) => a.name.localeCompare(b.name));

    const usageMap = new Map<string, number>();
    const doctorDeptSet = new Set<string>();

    for (const doc of this.memoryDoctors.values()) {
      const dept = doc.department?.trim();
      if (dept) {
        doctorDeptSet.add(dept);
        usageMap.set(dept, (usageMap.get(dept) || 0) + 1);
      }
    }

    const deptNames = new Set(depts.map((d) => d.name));
    const unlisted: string[] = [];
    for (const dept of doctorDeptSet) {
      if (!deptNames.has(dept)) {
        unlisted.push(dept);
      }
    }
    unlisted.sort();

    return {
      departments: depts.map((d) => ({
        id: d.id.toString(),
        name: d.name,
        description: d.description || null,
        doctorCount: usageMap.get(d.name) || 0,
        createdAt: d.createdAt ? d.createdAt.toISOString() : null,
        updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
      })),
      unlisted,
    };
  }

  /**
   * Find department by numeric ID.
   */
  async findById(id: string | number): Promise<DepartmentResponseDto> {
    const searchId = String(id).trim();

    if (this.prisma.connected) {
      try {
        const d = await this.prisma.department.findUnique({
          where: { id: BigInt(searchId) },
        });

        if (d) {
          const doctorCount = await this.prisma.doctor.count({
            where: { department: d.name },
          });

          return {
            id: d.id.toString(),
            name: d.name,
            description: d.description || null,
            doctorCount,
            createdAt: d.createdAt ? d.createdAt.toISOString() : null,
            updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Prisma findUnique failed: ${err.message}. Falling back to memory store.`);
      }
    }

    const mem = this.memoryDepartments.get(searchId);
    if (mem) {
      const doctorCount = Array.from(this.memoryDoctors.values()).filter(
        (doc) => doc.department === mem.name,
      ).length;

      return {
        id: mem.id.toString(),
        name: mem.name,
        description: mem.description || null,
        doctorCount,
        createdAt: mem.createdAt ? mem.createdAt.toISOString() : null,
        updatedAt: mem.updatedAt ? mem.updatedAt.toISOString() : null,
      };
    }

    throw new NotFoundException(`Department with ID "${searchId}" not found`);
  }

  /**
   * Create a new department with unique name check.
   */
  async create(dto: CreateDepartmentDto): Promise<DepartmentResponseDto> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Department name is required');
    }

    if (this.prisma.connected) {
      try {
        const clash = await this.prisma.department.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } },
        });
        if (clash) {
          throw new BadRequestException('That department is already on the list.');
        }

        const created = await this.prisma.department.create({
          data: {
            name,
            description: dto.description?.trim() || null,
            x: '',
            y: '',
          },
        });

        return {
          id: created.id.toString(),
          name: created.name,
          description: created.description || null,
          doctorCount: 0,
          createdAt: created.createdAt ? created.createdAt.toISOString() : null,
          updatedAt: created.updatedAt ? created.updatedAt.toISOString() : null,
        };
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(`Prisma department create failed: ${err.message}. Saving to memory.`);
      }
    }

    // In-memory create
    for (const d of this.memoryDepartments.values()) {
      if (d.name.toLowerCase() === name.toLowerCase()) {
        throw new BadRequestException('That department is already on the list.');
      }
    }

    this.memoryIdCounter++;
    const now = new Date();
    const memRecord = {
      id: BigInt(this.memoryIdCounter),
      name,
      description: dto.description?.trim() || null,
      x: '',
      y: '',
      createdAt: now,
      updatedAt: now,
    };
    this.memoryDepartments.set(memRecord.id.toString(), memRecord);

    return {
      id: memRecord.id.toString(),
      name: memRecord.name,
      description: memRecord.description,
      doctorCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  /**
   * Update department name and description.
   * If renamed, atomically cascades the rename to all assigned doctor records.
   */
  async update(id: string | number, dto: UpdateDepartmentDto): Promise<DepartmentUpdateResultDto> {
    const existing = await this.findById(id);
    const targetName = dto.name !== undefined ? dto.name.trim() : existing.name;

    if (!targetName) {
      throw new BadRequestException('Department name cannot be empty');
    }

    if (this.prisma.connected) {
      try {
        if (targetName !== existing.name) {
          const clash = await this.prisma.department.findFirst({
            where: {
              name: { equals: targetName, mode: 'insensitive' },
              NOT: { id: BigInt(existing.id) },
            },
          });
          if (clash) {
            throw new BadRequestException('That department is already on the list.');
          }
        }

        const oldName = existing.name;
        const newDescription =
          dto.description !== undefined ? dto.description?.trim() || null : existing.description;

        const [updated, doctorUpdateResult] = await this.prisma.$transaction([
          this.prisma.department.update({
            where: { id: BigInt(existing.id) },
            data: {
              name: targetName,
              description: newDescription,
            },
          }),
          ...(oldName !== targetName
            ? [
                this.prisma.doctor.updateMany({
                  where: { department: oldName },
                  data: { department: targetName },
                }),
              ]
            : []),
        ]);

        const movedDoctors = doctorUpdateResult ? doctorUpdateResult.count : 0;
        let message = `${targetName} updated.`;
        if (movedDoctors > 0) {
          message += ` ${movedDoctors} doctor record(s) moved with it.`;
        }

        const doctorCount = await this.prisma.doctor.count({
          where: { department: targetName },
        });

        return {
          department: {
            id: updated.id.toString(),
            name: updated.name,
            description: updated.description || null,
            doctorCount,
            createdAt: updated.createdAt ? updated.createdAt.toISOString() : null,
            updatedAt: updated.updatedAt ? updated.updatedAt.toISOString() : null,
          },
          movedDoctors,
          message,
        };
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(`Prisma update failed: ${err.message}. Falling back to memory.`);
      }
    }

    // In-memory update
    if (targetName !== existing.name) {
      for (const d of this.memoryDepartments.values()) {
        if (d.name.toLowerCase() === targetName.toLowerCase() && d.id.toString() !== existing.id) {
          throw new BadRequestException('That department is already on the list.');
        }
      }
    }

    const memRecord = this.memoryDepartments.get(existing.id);
    const oldName = existing.name;
    memRecord.name = targetName;
    if (dto.description !== undefined) {
      memRecord.description = dto.description?.trim() || null;
    }
    memRecord.updatedAt = new Date();

    let movedDoctors = 0;
    if (oldName !== targetName) {
      for (const doc of this.memoryDoctors.values()) {
        if (doc.department === oldName) {
          doc.department = targetName;
          movedDoctors++;
        }
      }
    }

    let message = `${targetName} updated.`;
    if (movedDoctors > 0) {
      message += ` ${movedDoctors} doctor record(s) moved with it.`;
    }

    const doctorCount = Array.from(this.memoryDoctors.values()).filter(
      (doc) => doc.department === targetName,
    ).length;

    return {
      department: {
        id: memRecord.id.toString(),
        name: memRecord.name,
        description: memRecord.description,
        doctorCount,
        createdAt: memRecord.createdAt.toISOString(),
        updatedAt: memRecord.updatedAt.toISOString(),
      },
      movedDoctors,
      message,
    };
  }

  /**
   * Delete a department.
   * If doctors currently belong to it, deletion is rejected with 400 Bad Request.
   */
  async remove(id: string | number): Promise<{ message: string }> {
    const existing = await this.findById(id);

    if (this.prisma.connected) {
      try {
        const doctorCount = await this.prisma.doctor.count({
          where: { department: existing.name },
        });

        if (doctorCount > 0) {
          throw new BadRequestException(
            `${existing.name} has ${doctorCount} doctor(s) in it. Move them first, or rename it instead.`,
          );
        }

        await this.prisma.department.delete({
          where: { id: BigInt(existing.id) },
        });

        return { message: `${existing.name} removed.` };
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(`Prisma delete failed: ${err.message}. Falling back to memory.`);
      }
    }

    // In-memory delete
    const doctorCount = Array.from(this.memoryDoctors.values()).filter(
      (doc) => doc.department === existing.name,
    ).length;

    if (doctorCount > 0) {
      throw new BadRequestException(
        `${existing.name} has ${doctorCount} doctor(s) in it. Move them first, or rename it instead.`,
      );
    }

    this.memoryDepartments.delete(existing.id);
    return { message: `${existing.name} removed.` };
  }

  /**
   * Batch-adopts all department names currently used by doctors that are missing from the department list.
   */
  async adopt(): Promise<DepartmentAdoptResultDto> {
    const { unlisted } = await this.findAll();

    if (unlisted.length === 0) {
      return {
        adoptedCount: 0,
        adoptedNames: [],
        message: 'Nothing to adopt, every department in use is already on the list.',
      };
    }

    const adoptedNames: string[] = [];

    for (const name of unlisted) {
      await this.create({ name, description: '' });
      adoptedNames.push(name);
    }

    return {
      adoptedCount: adoptedNames.length,
      adoptedNames,
      message: `Added ${adoptedNames.length} department(s) already in use by doctors.`,
    };
  }
}
