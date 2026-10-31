import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Patient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { PaginatedPatientsDto, PatientResponseDto } from './dto/patient-response.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientService {
  private readonly logger = new Logger(PatientService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Derives exact completed age in years from birthdate string.
   * If birthdate is null/empty, returns empty string '' (prevents stale or guessed values).
   */
  deriveAge(birthdate?: string | null): string {
    if (!birthdate || typeof birthdate !== 'string' || birthdate.trim() === '') {
      return '';
    }

    const bdate = new Date(birthdate);
    if (isNaN(bdate.getTime())) {
      return '';
    }

    const today = new Date();
    let age = today.getFullYear() - bdate.getFullYear();
    const m = today.getMonth() - bdate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bdate.getDate())) {
      age--;
    }

    return Math.max(0, age).toString();
  }

  /**
   * Normalizes Pakistani CNIC into XXXXX-XXXXXXX-X format.
   */
  formatCnic(cnic?: string | null): string | null {
    if (!cnic || typeof cnic !== 'string') {
      return null;
    }

    const digits = cnic.replace(/\D/g, '');
    if (digits.length === 13) {
      return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
    }

    return cnic.trim() || null;
  }

  /**
   * Generates the next atomic sequential 6-digit patient ID.
   * Derived from a PostgreSQL database sequence, guaranteeing durability across restarts
   * and ensuring that deleting records (including the highest-numbered) never reuses an MRN.
   */
  async nextPatientId(): Promise<string> {
    await this.prisma.$executeRaw`
      CREATE SEQUENCE IF NOT EXISTS patient_mrn_seq START WITH 1;
    `;

    // Align sequence with highest existing 6-digit patient ID if needed
    const maxResult = await this.prisma.$queryRaw<Array<{ max_id: bigint | number | string }>>`
      SELECT COALESCE(MAX(patient_id::bigint), 0) AS max_id 
      FROM patient
      WHERE patient_id ~ '^[0-9]{1,6}$'
    `;
    const maxId = Number(maxResult[0]?.max_id || 0);

    const nextValResult = await this.prisma.$queryRaw<Array<{ next_val: bigint | number | string }>>`
      SELECT nextval('patient_mrn_seq') AS next_val
    `;
    let seqVal = Number(nextValResult[0]?.next_val || 1);

    if (seqVal <= maxId) {
      await this.prisma.$executeRaw`
        SELECT setval('patient_mrn_seq', ${maxId} + 1, false)
      `;
      seqVal = maxId + 1;
    }

    return seqVal.toString().padStart(6, '0');
  }

  /**
   * List patients with single-box search and pagination directly from PostgreSQL.
   */
  async findAll(query: PatientQueryDto): Promise<PaginatedPatientsDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 25));
    const skip = (page - 1) * limit;
    const term = (query.q || '').trim();

    const whereClause = term
      ? {
          OR: [
            { name: { contains: term, mode: 'insensitive' as const } },
            { patientId: { contains: term, mode: 'insensitive' as const } },
            { cnic: { contains: term, mode: 'insensitive' as const } },
            { oldMrn: { contains: term, mode: 'insensitive' as const } },
            { phone: { contains: term, mode: 'insensitive' as const } },
            { email: { contains: term, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.patient.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
      }),
      this.prisma.patient.count({ where: whereClause }),
    ]);

    return {
      items: items.map((p) => this.mapToDto(p)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Find patient by numeric ID or 6-digit patient_id.
   */
  async findById(idOrPatientId: string | number): Promise<PatientResponseDto> {
    const searchKey = String(idOrPatientId).trim();
    const isNumeric = /^\d+$/.test(searchKey);

    let patient: Patient | null = null;

    if (isNumeric) {
      patient = await this.prisma.patient.findFirst({
        where: {
          OR: [{ id: BigInt(searchKey) }, { patientId: searchKey }],
        },
      });
    } else {
      patient = await this.prisma.patient.findFirst({
        where: { patientId: searchKey },
      });
    }

    if (!patient) {
      throw new NotFoundException(`Patient with ID "${searchKey}" not found`);
    }

    return this.mapToDto(patient);
  }

  /**
   * Register a new patient with sequential ID and derived age in PostgreSQL.
   */
  async create(dto: CreatePatientDto, howAdded = 'front desk'): Promise<PatientResponseDto> {
    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException('Patient name is required');
    }

    const patientId = await this.nextPatientId();
    const age = this.deriveAge(dto.birthdate);
    const cnic = this.formatCnic(dto.cnic);
    const now = new Date();
    const addDate = now.toISOString().slice(0, 10);
    const registrationTime = now.toISOString();

    const created = await this.prisma.patient.create({
      data: {
        name: dto.name.trim(),
        patientId,
        fatherName: dto.fatherName?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        birthdate: dto.birthdate?.trim() || null,
        age,
        sex: dto.sex || null,
        bloodGroup: dto.bloodGroup || null,
        attendingDoctor: dto.attendingDoctor?.trim() || null,
        patientTypeId: dto.patientTypeId ? BigInt(dto.patientTypeId) : null,
        cnic,
        guardianRelation: dto.guardianRelation?.trim() || null,
        guardianMrn: dto.guardianMrn?.trim() || null,
        mlc: Boolean(dto.mlc),
        oldMrn: dto.oldMrn?.trim() || null,
        employeeNo: dto.employeeNo?.trim() || null,
        altPhone: dto.altPhone?.trim() || null,
        city: dto.city?.trim() || null,
        branchId: dto.branchId ? BigInt(dto.branchId) : null,
        imageUrl: dto.photoData ? 'patients/webcam_capture.jpg' : null,
        addDate,
        registrationTime,
        ionUserId: '',
        howAdded,
      },
    });

    this.logger.log(`Patient registered: ${created.patientId} - ${created.name}`);
    return this.mapToDto(created);
  }

  /**
   * Update an existing patient record and recalculate age if birthdate changes.
   */
  async update(idOrPatientId: string | number, dto: UpdatePatientDto): Promise<PatientResponseDto> {
    const existing = await this.findById(idOrPatientId);
    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.fatherName !== undefined) updateData.fatherName = dto.fatherName?.trim() || null;
    if (dto.email !== undefined) updateData.email = dto.email?.trim() || null;
    if (dto.phone !== undefined) updateData.phone = dto.phone?.trim() || null;
    if (dto.address !== undefined) updateData.address = dto.address?.trim() || null;
    if (dto.sex !== undefined) updateData.sex = dto.sex || null;
    if (dto.bloodGroup !== undefined) updateData.bloodGroup = dto.bloodGroup || null;
    if (dto.attendingDoctor !== undefined)
      updateData.attendingDoctor = dto.attendingDoctor?.trim() || null;
    if (dto.patientTypeId !== undefined)
      updateData.patientTypeId = dto.patientTypeId ? BigInt(dto.patientTypeId) : null;
    if (dto.guardianRelation !== undefined)
      updateData.guardianRelation = dto.guardianRelation?.trim() || null;
    if (dto.guardianMrn !== undefined) updateData.guardianMrn = dto.guardianMrn?.trim() || null;
    if (dto.mlc !== undefined) updateData.mlc = Boolean(dto.mlc);
    if (dto.oldMrn !== undefined) updateData.oldMrn = dto.oldMrn?.trim() || null;
    if (dto.employeeNo !== undefined) updateData.employeeNo = dto.employeeNo?.trim() || null;
    if (dto.altPhone !== undefined) updateData.altPhone = dto.altPhone?.trim() || null;
    if (dto.city !== undefined) updateData.city = dto.city?.trim() || null;
    if (dto.branchId !== undefined)
      updateData.branchId = dto.branchId ? BigInt(dto.branchId) : null;

    if (dto.cnic !== undefined) {
      updateData.cnic = this.formatCnic(dto.cnic);
    }

    if (dto.birthdate !== undefined) {
      updateData.birthdate = dto.birthdate?.trim() || null;
      updateData.age = this.deriveAge(updateData.birthdate as string);
    }

    const updated = await this.prisma.patient.update({
      where: { id: BigInt(existing.id) },
      data: updateData,
    });

    return this.mapToDto(updated);
  }

  /**
   * Delete a patient record from PostgreSQL with active appointment constraint guard.
   */
  async remove(idOrPatientId: string | number): Promise<{ message: string }> {
    const existing = await this.findById(idOrPatientId);
    const label = `${existing.patientId} ${existing.name}`;

    const appointments = await this.prisma.appointment.findFirst({
      where: { patientId: BigInt(existing.id) },
    });
    if (appointments) {
      throw new BadRequestException(`${label} has appointments on file, so the record stays.`);
    }

    try {
      await this.prisma.patient.delete({
        where: { id: BigInt(existing.id) },
      });
      return { message: `Deleted patient ${label}.` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Database deletion failed: ${message}`);
      throw new BadRequestException(`Could not delete patient ${label}: ${message}`);
    }
  }

  /**
   * Converts a Prisma record to a typed PatientResponseDto.
   */
  private mapToDto(p: Patient): PatientResponseDto {
    return {
      id: p.id ? p.id.toString() : '',
      patientId: p.patientId || '',
      name: p.name || '',
      fatherName: p.fatherName || null,
      email: p.email || null,
      phone: p.phone || null,
      address: p.address || null,
      birthdate: p.birthdate || null,
      age: p.age || '',
      sex: p.sex || null,
      bloodGroup: p.bloodGroup || null,
      cnic: p.cnic || null,
      guardianRelation: p.guardianRelation || null,
      guardianMrn: p.guardianMrn || null,
      mlc: Boolean(p.mlc),
      oldMrn: p.oldMrn || null,
      employeeNo: p.employeeNo || null,
      altPhone: p.altPhone || null,
      city: p.city || null,
      attendingDoctor: p.attendingDoctor || null,
      imageUrl: p.imageUrl || null,
      addDate: p.addDate || null,
      registrationTime: p.registrationTime || null,
      howAdded: p.howAdded || null,
      patientTypeId: p.patientTypeId ? p.patientTypeId.toString() : null,
      branchId: p.branchId ? p.branchId.toString() : null,
      createdAt: p.createdAt ? p.createdAt.toISOString() : null,
      updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
    };
  }
}
