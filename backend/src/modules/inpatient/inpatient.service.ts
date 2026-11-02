import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWardDto, UpdateWardDto } from './dto/ward.dto';
import { CreateBedDto, UpdateBedDto, UpdateBedStatusDto } from './dto/bed.dto';
import {
  CancelAdmissionDto,
  CreateAdmissionDto,
  UpdateAdmissionDto,
} from './dto/admission.dto';
import { TransferBedDto } from './dto/transfer.dto';
import { CompleteDischargeDto, RequestDischargeDto } from './dto/discharge.dto';
import { PostFolioChargeDto, ReverseFolioChargeDto, SettleFolioDto } from './dto/folio.dto';
import { QueryAdmissionDto, QueryBedDto } from './dto/query.dto';

export function serializeBigInt<T>(data: T): any {
  if (data === undefined || data === null) {
    return data;
  }
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (value && typeof value === 'object' && value.d && value.e !== undefined) {
        return Number(value);
      }
      return value;
    }),
  );
}

@Injectable()
export class InpatientService {
  private readonly logger = new Logger(InpatientService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // 1. DASHBOARD & SUMMARY METRICS
  // ===========================================================================

  async getDashboardMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalBeds,
      occupiedBeds,
      availableBeds,
      cleaningBeds,
      maintenanceBeds,
      reservedBeds,
      activeAdmissions,
      pendingAdmissions,
      pendingDischarges,
      expectedDischargesToday,
      totalWards,
    ] = await Promise.all([
      this.prisma.bed.count({ where: { isActive: true } }),
      this.prisma.bed.count({ where: { isActive: true, status: 'OCCUPIED' } }),
      this.prisma.bed.count({ where: { isActive: true, status: 'AVAILABLE' } }),
      this.prisma.bed.count({ where: { isActive: true, status: 'CLEANING' } }),
      this.prisma.bed.count({ where: { isActive: true, status: 'MAINTENANCE' } }),
      this.prisma.bed.count({ where: { isActive: true, status: 'RESERVED' } }),
      this.prisma.admission.count({
        where: { status: { in: ['ADMITTED', 'TRANSFERRED'] } },
      }),
      this.prisma.admission.count({ where: { status: 'PENDING' } }),
      this.prisma.admission.count({ where: { status: 'DISCHARGE_PENDING' } }),
      this.prisma.admission.count({
        where: {
          status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PENDING'] },
          expectedDischargeDate: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.bedCategory.count({ where: { isActive: true } }),
    ]);

    const occupancyRate =
      totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100 * 10) / 10 : 0;

    return {
      totalBeds,
      occupiedBeds,
      availableBeds,
      cleaningBeds,
      maintenanceBeds,
      reservedBeds,
      activeAdmissions,
      pendingAdmissions,
      pendingDischarges,
      expectedDischargesToday,
      totalWards,
      occupancyRate,
    };
  }

  // ===========================================================================
  // 2. WARD & BED CATALOGUE
  // ===========================================================================

  async getWards() {
    const wards = await this.prisma.bedCategory.findMany({
      orderBy: { category: 'asc' },
      include: {
        _count: {
          select: {
            beds: true,
            admissions: { where: { status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PENDING'] } } },
          },
        },
      },
    });

    const enriched = await Promise.all(
      wards.map(async (w) => {
        const occupied = await this.prisma.bed.count({
          where: { categoryId: w.id, status: 'OCCUPIED', isActive: true },
        });
        const available = await this.prisma.bed.count({
          where: { categoryId: w.id, status: 'AVAILABLE', isActive: true },
        });
        return {
          ...serializeBigInt(w),
          totalBeds: w._count.beds,
          occupiedBeds: occupied,
          availableBeds: available,
          currentPatients: w._count.admissions,
        };
      }),
    );

    return enriched;
  }

  async getWardById(id: number | string) {
    const ward = await this.prisma.bedCategory.findUnique({
      where: { id: BigInt(id) },
      include: {
        beds: { orderBy: { number: 'asc' } },
      },
    });
    if (!ward) {
      throw new NotFoundException(`Ward #${id} not found.`);
    }
    return serializeBigInt(ward);
  }

  async createWard(dto: CreateWardDto) {
    const categoryName = (dto.category || dto.name || '').trim();
    if (!categoryName) {
      throw new BadRequestException('Ward category/name is required.');
    }

    const existing = await this.prisma.bedCategory.findFirst({
      where: { category: { equals: categoryName, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(`Ward with name "${categoryName}" already exists.`);
    }

    const ward = await this.prisma.bedCategory.create({
      data: {
        category: categoryName,
        code: dto.code?.trim() || null,
        description: dto.description?.trim() || null,
        baseRate: dto.baseRate !== undefined ? new Prisma.Decimal(dto.baseRate) : new Prisma.Decimal(0),
        billingUnit: dto.billingUnit || 'DAILY',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
    return serializeBigInt(ward);
  }

  async updateWard(id: number | string, dto: UpdateWardDto) {
    await this.getWardById(id);

    if (dto.category) {
      const existing = await this.prisma.bedCategory.findFirst({
        where: {
          category: { equals: dto.category.trim(), mode: 'insensitive' },
          id: { not: BigInt(id) },
        },
      });
      if (existing) {
        throw new ConflictException(`Ward with name "${dto.category}" already exists.`);
      }
    }

    const updated = await this.prisma.bedCategory.update({
      where: { id: BigInt(id) },
      data: {
        category: dto.category?.trim(),
        code: dto.code !== undefined ? dto.code?.trim() || null : undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        baseRate: dto.baseRate !== undefined ? new Prisma.Decimal(dto.baseRate) : undefined,
        billingUnit: dto.billingUnit || undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
      },
    });
    return serializeBigInt(updated);
  }

  async deleteWard(id: number | string) {
    const ward = await this.getWardById(id);

    const bedsCount = await this.prisma.bed.count({
      where: { categoryId: BigInt(id) },
    });
    if (bedsCount > 0) {
      throw new BadRequestException(
        `Ward "${ward.category}" still has ${bedsCount} bed(s) assigned. Remove or reassign beds before deleting.`,
      );
    }

    await this.prisma.bedCategory.delete({
      where: { id: BigInt(id) },
    });
    return { success: true, message: `Ward "${ward.category}" deleted successfully.` };
  }

  // ===========================================================================
  // 3. BED MANAGEMENT
  // ===========================================================================

  async getBeds(query: QueryBedDto) {
    const where: Prisma.BedWhereInput = {};

    if (query.categoryId) where.categoryId = BigInt(query.categoryId);
    if (query.status) where.status = query.status;
    if (query.branchId) where.branchId = BigInt(query.branchId);

    const beds = await this.prisma.bed.findMany({
      where,
      orderBy: [{ categoryId: 'asc' }, { number: 'asc' }],
      include: {
        category: { select: { id: true, category: true, code: true, baseRate: true } },
        admissions: {
          where: { status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PENDING'] } },
          take: 1,
          include: {
            patient: { select: { id: true, name: true, patientId: true, age: true, sex: true } },
            attendingDoctor: { select: { id: true, name: true } },
          },
        },
      },
    });

    const mapped = beds.map((b) => {
      const activeAdmission = b.admissions[0] || null;
      return {
        ...serializeBigInt(b),
        currentAdmission: activeAdmission ? serializeBigInt(activeAdmission) : null,
      };
    });

    return mapped;
  }

  async getBedById(id: number | string) {
    const bed = await this.prisma.bed.findUnique({
      where: { id: BigInt(id) },
      include: {
        category: true,
        admissions: {
          where: { status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PENDING'] } },
          include: {
            patient: { select: { id: true, name: true, patientId: true, phone: true } },
            attendingDoctor: { select: { id: true, name: true } },
          },
        },
        allocations: {
          take: 5,
          orderBy: { allocatedAt: 'desc' },
          include: {
            admission: { select: { admissionNumber: true, patient: { select: { name: true } } } },
          },
        },
      },
    });
    if (!bed) {
      throw new NotFoundException(`Bed #${id} not found.`);
    }
    return serializeBigInt(bed);
  }

  async createBed(dto: CreateBedDto) {
    await this.getWardById(dto.categoryId);

    const bedNumber = (dto.number || dto.bedNumber || '').trim();
    if (!bedNumber) {
      throw new BadRequestException('Bed number is required.');
    }

    // Bed numbers are unique within a ward category
    const clash = await this.prisma.bed.findFirst({
      where: {
        categoryId: BigInt(dto.categoryId),
        number: { equals: bedNumber, mode: 'insensitive' },
      },
    });
    if (clash) {
      throw new ConflictException(
        `A bed numbered "${bedNumber}" already exists in this ward.`,
      );
    }

    const bed = await this.prisma.bed.create({
      data: {
        categoryId: BigInt(dto.categoryId),
        number: bedNumber,
        description: dto.description?.trim() || null,
        status: dto.status || 'AVAILABLE',
        branchId: dto.branchId ? BigInt(dto.branchId) : null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      include: { category: true },
    });
    return serializeBigInt(bed);
  }

  async updateBed(id: number | string, dto: UpdateBedDto) {
    const existing = await this.getBedById(id);

    const categoryId = dto.categoryId ? BigInt(dto.categoryId) : BigInt(existing.categoryId);

    if (dto.number) {
      const clash = await this.prisma.bed.findFirst({
        where: {
          categoryId,
          number: { equals: dto.number.trim(), mode: 'insensitive' },
          id: { not: BigInt(id) },
        },
      });
      if (clash) {
        throw new ConflictException(
          `A bed numbered "${dto.number}" already exists in this ward.`,
        );
      }
    }

    const updated = await this.prisma.bed.update({
      where: { id: BigInt(id) },
      data: {
        categoryId: dto.categoryId ? BigInt(dto.categoryId) : undefined,
        number: dto.number?.trim(),
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        status: dto.status || undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
      },
      include: { category: true },
    });
    return serializeBigInt(updated);
  }

  async updateBedStatus(id: number | string, dto: UpdateBedStatusDto) {
    const bed = await this.getBedById(id);

    // Check if bed is occupied
    const activeStay = await this.prisma.admission.findFirst({
      where: {
        bedId: BigInt(id),
        status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PENDING'] },
      },
    });

    if (activeStay && dto.status !== 'OCCUPIED') {
      throw new BadRequestException(
        `Bed ${bed.number} currently has an active admission (${activeStay.admissionNumber}). Discharge or transfer the patient before changing status.`,
      );
    }

    const updated = await this.prisma.bed.update({
      where: { id: BigInt(id) },
      data: {
        status: dto.status,
        description: dto.notes ? `${bed.description || ''} | ${dto.notes}`.trim() : undefined,
      },
      include: { category: true },
    });
    return serializeBigInt(updated);
  }

  async deleteBed(id: number | string) {
    const bed = await this.getBedById(id);

    const activeStay = await this.prisma.admission.findFirst({
      where: {
        bedId: BigInt(id),
        status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PENDING'] },
      },
    });

    if (activeStay) {
      throw new BadRequestException(
        `Bed ${bed.number} is currently occupied by admission ${activeStay.admissionNumber}. Discharge the patient first.`,
      );
    }

    await this.prisma.bed.delete({
      where: { id: BigInt(id) },
    });
    return { success: true, message: `Bed ${bed.number} deleted successfully.` };
  }

  async getAvailableBeds(categoryId?: number | string) {
    const where: Prisma.BedWhereInput = {
      isActive: true,
      status: 'AVAILABLE',
    };
    if (categoryId) {
      where.categoryId = BigInt(categoryId);
    }

    const beds = await this.prisma.bed.findMany({
      where,
      orderBy: [{ categoryId: 'asc' }, { number: 'asc' }],
      include: { category: { select: { id: true, category: true, baseRate: true } } },
    });
    return serializeBigInt(beds);
  }

  // ===========================================================================
  // 4. ADMISSION LIFECYCLE & CONCURRENCY PROTECTION
  // ===========================================================================

  async generateAdmissionNumber(): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.admission.count({
      where: {
        admissionNumber: { startsWith: `ADM-${dateStr}` },
      },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `ADM-${dateStr}-${seq}`;
  }

  async generateFolioNumber(): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.inpatientFolio.count({
      where: {
        folioNumber: { startsWith: `FOL-${dateStr}` },
      },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `FOL-${dateStr}-${seq}`;
  }

  /**
   * Concurrency-safe admission with PostgreSQL row-level locks (SELECT ... FOR UPDATE).
   */
  async createAdmission(dto: CreateAdmissionDto, userId?: number | string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: BigInt(dto.patientId) },
    });
    if (!patient) {
      throw new NotFoundException(`Patient #${dto.patientId} not found.`);
    }

    if (dto.attendingDoctorId) {
      const doc = await this.prisma.doctor.findUnique({
        where: { id: BigInt(dto.attendingDoctorId) },
      });
      if (!doc) {
        throw new NotFoundException(`Attending doctor #${dto.attendingDoctorId} not found.`);
      }
    }

    const admissionDate = dto.admissionDate ? new Date(dto.admissionDate) : new Date();

    return await this.prisma.$transaction(async (tx) => {
      // 1. Pessimistic row-level exclusive lock on the target bed
      const lockedBedRows = await tx.$queryRaw<
        Array<{ id: bigint; category: bigint; number: string; status: string; is_active: boolean }>
      >`
        SELECT id, category, number, status, is_active
        FROM bed
        WHERE id = ${BigInt(dto.bedId)}
        FOR UPDATE
      `;

      if (!lockedBedRows || lockedBedRows.length === 0) {
        throw new NotFoundException(`Bed #${dto.bedId} not found.`);
      }

      const lockedBed = lockedBedRows[0];

      if (!lockedBed.is_active) {
        throw new BadRequestException(`Bed ${lockedBed.number} is inactive and cannot accept admissions.`);
      }

      if (lockedBed.status !== 'AVAILABLE') {
        throw new ConflictException(
          `Bed ${lockedBed.number} is currently ${lockedBed.status} and cannot be allocated.`,
        );
      }

      // 2. Prevent double active admission for the same patient
      const activePatientStay = await tx.$queryRaw<Array<{ id: bigint; admission_number: string }>>`
        SELECT id, admission_number
        FROM admissions
        WHERE patient_id = ${BigInt(dto.patientId)}
          AND status IN ('ADMITTED', 'TRANSFERRED', 'DISCHARGE_PENDING')
        FOR UPDATE
      `;

      if (activePatientStay && activePatientStay.length > 0) {
        throw new ConflictException(
          `Patient ${patient.name} is already admitted under admission ${activePatientStay[0].admission_number}. Discharge them before creating a new admission.`,
        );
      }

      // 3. Prevent duplicate active allocation on this bed
      const activeAllocation = await tx.bedAllocationHistory.findFirst({
        where: {
          bedId: lockedBed.id,
          releasedAt: null,
        },
      });
      if (activeAllocation) {
        throw new ConflictException(
          `Bed ${lockedBed.number} already has an active allocation (#${activeAllocation.id}).`,
        );
      }

      // Fetch ward details for rate snapshot
      const ward = await tx.bedCategory.findUnique({
        where: { id: lockedBed.category },
      });
      const rateSnapshot = ward?.baseRate ? Number(ward.baseRate) : 0;

      // 4. Generate unique sequential numbers
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const admCount = await tx.admission.count({
        where: { admissionNumber: { startsWith: `ADM-${dateStr}` } },
      });
      const admissionNumber = `ADM-${dateStr}-${String(admCount + 1).padStart(4, '0')}`;

      const folCount = await tx.inpatientFolio.count({
        where: { folioNumber: { startsWith: `FOL-${dateStr}` } },
      });
      const folioNumber = `FOL-${dateStr}-${String(folCount + 1).padStart(4, '0')}`;

      // 5. Create Admission Header
      const admission = await tx.admission.create({
        data: {
          admissionNumber,
          patientId: BigInt(dto.patientId),
          attendingDoctorId: dto.attendingDoctorId ? BigInt(dto.attendingDoctorId) : null,
          admittingDoctorId: dto.admittingDoctorId ? BigInt(dto.admittingDoctorId) : (userId ? BigInt(userId) : null),
          wardId: lockedBed.category,
          bedId: lockedBed.id,
          admissionDate,
          expectedDischargeDate: dto.expectedDischargeDate ? new Date(dto.expectedDischargeDate) : null,
          admissionType: dto.admissionType || 'ELECTIVE',
          admissionReason: dto.admissionReason?.trim() || null,
          diagnosis: dto.diagnosis?.trim() || null,
          clinicalNotes: dto.clinicalNotes?.trim() || null,
          status: 'ADMITTED',
          branchId: dto.branchId ? BigInt(dto.branchId) : null,
          createdBy: userId ? BigInt(userId) : null,
        },
      });

      // 6. Record Initial Bed Stay in BedAllocationHistory
      await tx.bedAllocationHistory.create({
        data: {
          admissionId: admission.id,
          bedId: lockedBed.id,
          allocatedAt: admissionDate,
          rateSnapshot: new Prisma.Decimal(rateSnapshot),
          transferReason: 'Initial admission allocation',
          allocatedBy: userId ? BigInt(userId) : null,
        },
      });

      // 7. Initialize InpatientFolio
      const folio = await tx.inpatientFolio.create({
        data: {
          folioNumber,
          admissionId: admission.id,
          patientId: BigInt(dto.patientId),
          status: 'OPEN',
          totalCharges: new Prisma.Decimal(0.0),
          totalPaid: new Prisma.Decimal(0.0),
          balance: new Prisma.Decimal(0.0),
        },
      });

      // 8. Update target bed occupancy status
      await tx.bed.update({
        where: { id: lockedBed.id },
        data: { status: 'OCCUPIED' },
      });

      // 9. Legacy table mirror sync for AllotedBed
      await tx.allotedBed.create({
        data: {
          patientId: BigInt(dto.patientId),
          bedId: lockedBed.id,
          aTime: admissionDate.toISOString(),
          dTime: null,
          category: ward?.category || 'Ward',
          description: dto.diagnosis || '',
        },
      });

      return serializeBigInt({
        ...admission,
        folio,
      });
    });
  }

  async findAllAdmissions(query: QueryAdmissionDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AdmissionWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.patientId) where.patientId = BigInt(query.patientId);
    if (query.wardId) where.wardId = BigInt(query.wardId);
    if (query.doctorId) where.attendingDoctorId = BigInt(query.doctorId);

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { admissionNumber: { contains: q, mode: 'insensitive' } },
        { diagnosis: { contains: q, mode: 'insensitive' } },
        { patient: { name: { contains: q, mode: 'insensitive' } } },
        { patient: { patientId: { contains: q, mode: 'insensitive' } } },
        { patient: { phone: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, admissions] = await Promise.all([
      this.prisma.admission.count({ where }),
      this.prisma.admission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { admissionDate: 'desc' },
        include: {
          patient: { select: { id: true, name: true, patientId: true, age: true, sex: true, phone: true } },
          attendingDoctor: { select: { id: true, name: true } },
          ward: { select: { id: true, category: true, baseRate: true } },
          bed: { select: { id: true, number: true, status: true } },
          folio: { select: { id: true, folioNumber: true, status: true, totalCharges: true, totalPaid: true, balance: true } },
        },
      }),
    ]);

    return {
      items: serializeBigInt(admissions),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAdmissionById(id: number | string) {
    const admission = await this.prisma.admission.findUnique({
      where: { id: BigInt(id) },
      include: {
        patient: true,
        attendingDoctor: { select: { id: true, name: true, phone: true, department: true } },
        admittingDoctor: { select: { id: true, name: true } },
        ward: true,
        bed: true,
        allocations: {
          orderBy: { allocatedAt: 'asc' },
          include: {
            bed: { include: { category: true } },
          },
        },
        folio: {
          include: {
            items: { orderBy: { postedAt: 'desc' } },
            finalInvoice: true,
          },
        },
        pharmacyDispensations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
        labOrders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { tests: true },
        },
        radiologyOrders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!admission) {
      throw new NotFoundException(`Admission #${id} not found.`);
    }
    return serializeBigInt(admission);
  }

  async updateAdmission(id: number | string, dto: UpdateAdmissionDto) {
    await this.findAdmissionById(id);

    const updated = await this.prisma.admission.update({
      where: { id: BigInt(id) },
      data: {
        attendingDoctorId: dto.attendingDoctorId ? BigInt(dto.attendingDoctorId) : undefined,
        expectedDischargeDate: dto.expectedDischargeDate ? new Date(dto.expectedDischargeDate) : undefined,
        admissionType: dto.admissionType || undefined,
        admissionReason: dto.admissionReason !== undefined ? dto.admissionReason : undefined,
        diagnosis: dto.diagnosis !== undefined ? dto.diagnosis : undefined,
        clinicalNotes: dto.clinicalNotes !== undefined ? dto.clinicalNotes : undefined,
      },
      include: {
        patient: { select: { id: true, name: true, patientId: true } },
        attendingDoctor: { select: { id: true, name: true } },
        ward: true,
        bed: true,
      },
    });
    return serializeBigInt(updated);
  }

  async cancelAdmission(id: number | string, dto: CancelAdmissionDto, userId?: number | string) {
    const admission = await this.findAdmissionById(id);

    if (admission.status === 'DISCHARGED') {
      throw new BadRequestException('A discharged admission cannot be cancelled.');
    }

    // Check if financial charges exist
    const folioItemsCount = await this.prisma.inpatientFolioItem.count({
      where: { folio: { admissionId: BigInt(id) }, isReversed: false },
    });

    if (folioItemsCount > 0) {
      throw new BadRequestException(
        `Admission #${admission.admissionNumber} has ${folioItemsCount} active charge(s) posted on its folio. Reverse or settle charges before cancelling.`,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      // Release bed
      await tx.bed.update({
        where: { id: BigInt(admission.bedId) },
        data: { status: 'AVAILABLE' },
      });

      // Close allocation
      await tx.bedAllocationHistory.updateMany({
        where: { admissionId: BigInt(id), releasedAt: null },
        data: { releasedAt: new Date(), releasedBy: userId ? BigInt(userId) : null },
      });

      // Update admission
      const cancelled = await tx.admission.update({
        where: { id: BigInt(id) },
        data: {
          status: 'CANCELLED',
          clinicalNotes: `${admission.clinicalNotes || ''} | CANCELLED: ${dto.reason}`.trim(),
        },
      });

      return serializeBigInt(cancelled);
    });
  }

  // ===========================================================================
  // 5. BED TRANSFER (DETERMINISTIC CONCURRENCY LOCKING)
  // ===========================================================================

  async transferBed(admissionId: number | string, dto: TransferBedDto, userId?: number | string) {
    const admission = await this.findAdmissionById(admissionId);

    if (admission.status === 'DISCHARGED' || admission.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot transfer an admission with status ${admission.status}.`);
    }

    const destBedId = dto.targetBedId || dto.destinationBedId;
    if (!destBedId) {
      throw new BadRequestException('Target destination bed ID is required.');
    }

    const transferReasonText = dto.reason || dto.transferReason || 'Bed transfer';

    const oldBedId = BigInt(admission.bedId);
    const newBedId = BigInt(destBedId);

    if (oldBedId === newBedId) {
      throw new BadRequestException('Source and destination bed cannot be the same.');
    }

    const transferDate = dto.transferDate ? new Date(dto.transferDate) : new Date();

    return await this.prisma.$transaction(async (tx) => {
      // 1. Deterministic row locking in ascending order to prevent deadlocks
      const [firstBedId, secondBedId] = [oldBedId, newBedId].sort((a, b) => (a < b ? -1 : 1));

      await tx.$queryRaw`SELECT id FROM bed WHERE id = ${firstBedId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM bed WHERE id = ${secondBedId} FOR UPDATE`;

      // 2. Validate destination bed
      const targetBed = await tx.bed.findUnique({
        where: { id: newBedId },
        include: { category: true },
      });
      if (!targetBed) {
        throw new NotFoundException(`Destination bed #${dto.targetBedId} not found.`);
      }
      if (!targetBed.isActive) {
        throw new BadRequestException(`Destination bed ${targetBed.number} is inactive.`);
      }
      if (targetBed.status !== 'AVAILABLE') {
        throw new ConflictException(`Destination bed ${targetBed.number} is currently ${targetBed.status}.`);
      }

      // Check no conflicting active allocation on new bed
      const conflictingAlloc = await tx.bedAllocationHistory.findFirst({
        where: { bedId: newBedId, releasedAt: null },
      });
      if (conflictingAlloc) {
        throw new ConflictException(`Destination bed ${targetBed.number} already has an active allocation.`);
      }

      // 3. Close old bed allocation
      const currentAllocation = await tx.bedAllocationHistory.findFirst({
        where: { admissionId: BigInt(admissionId), bedId: oldBedId, releasedAt: null },
      });

      if (currentAllocation) {
        // Calculate stay days for old bed and post bed charges to folio
        const stayDurationMs = Math.max(0, transferDate.getTime() - new Date(currentAllocation.allocatedAt).getTime());
        const stayDays = Math.max(1, Math.ceil(stayDurationMs / (1000 * 60 * 60 * 24)));
        const dailyRate = Number(currentAllocation.rateSnapshot || 0);

        if (dailyRate > 0) {
          const totalBedCharge = stayDays * dailyRate;
          const oldWard = await tx.bedCategory.findUnique({ where: { id: admission.wardId } });
          const folio = await tx.inpatientFolio.findUnique({ where: { admissionId: BigInt(admissionId) } });

          if (folio) {
            const idempotencyKey = `BED-${currentAllocation.id}-${transferDate.toISOString().slice(0, 10)}`;
            const existingCharge = await tx.inpatientFolioItem.findUnique({ where: { idempotencyKey } });

            if (!existingCharge) {
              await tx.inpatientFolioItem.create({
                data: {
                  folioId: folio.id,
                  sourceModule: 'BED',
                  sourceRecordId: currentAllocation.id.toString(),
                  idempotencyKey,
                  chargeCategory: 'BED_STAY',
                  description: `Bed Charge: ${oldWard?.category || 'Ward'} (${stayDays} day(s) @ ${dailyRate}/day)`,
                  quantity: stayDays,
                  unitPrice: new Prisma.Decimal(dailyRate),
                  totalAmount: new Prisma.Decimal(totalBedCharge),
                  postedAt: transferDate,
                  postedBy: userId ? BigInt(userId) : null,
                },
              });

              await tx.inpatientFolio.update({
                where: { id: folio.id },
                data: {
                  totalCharges: { increment: totalBedCharge },
                  balance: { increment: totalBedCharge },
                },
              });
            }
          }
        }

        await tx.bedAllocationHistory.update({
          where: { id: currentAllocation.id },
          data: {
            releasedAt: transferDate,
            releasedBy: userId ? BigInt(userId) : null,
          },
        });
      }

      // 4. Open new allocation on target bed
      const targetRate = targetBed.category?.baseRate ? Number(targetBed.category.baseRate) : 0;
      await tx.bedAllocationHistory.create({
        data: {
          admissionId: BigInt(admissionId),
          bedId: newBedId,
          allocatedAt: transferDate,
          rateSnapshot: new Prisma.Decimal(targetRate),
          transferReason: transferReasonText,
          allocatedBy: userId ? BigInt(userId) : null,
        },
      });

      // 5. Update old and new bed statuses
      await tx.bed.update({
        where: { id: oldBedId },
        data: { status: 'CLEANING' },
      });

      await tx.bed.update({
        where: { id: newBedId },
        data: { status: 'OCCUPIED' },
      });

      // 6. Update admission header
      const updatedAdmission = await tx.admission.update({
        where: { id: BigInt(admissionId) },
        data: {
          bedId: newBedId,
          wardId: targetBed.categoryId,
          status: 'TRANSFERRED',
        },
        include: {
          bed: true,
          ward: true,
          patient: { select: { id: true, name: true, patientId: true } },
        },
      });

      return serializeBigInt(updatedAdmission);
    });
  }

  // ===========================================================================
  // 6. DISCHARGE WORKFLOW & BED RELEASE
  // ===========================================================================

  async requestDischarge(admissionId: number | string, dto: RequestDischargeDto, _userId?: number | string) {
    const admission = await this.findAdmissionById(admissionId);

    if (admission.status === 'DISCHARGED' || admission.status === 'CANCELLED') {
      throw new BadRequestException(`Admission #${admission.admissionNumber} is already ${admission.status}.`);
    }

    const updated = await this.prisma.admission.update({
      where: { id: BigInt(admissionId) },
      data: {
        status: 'DISCHARGE_PENDING',
        dischargeSummary: dto.summary?.trim() || null,
        dischargeCondition: dto.condition || 'IMPROVED',
      },
      include: { patient: true, bed: true, ward: true, folio: true },
    });
    return serializeBigInt(updated);
  }

  async completeDischarge(admissionId: number | string, dto: CompleteDischargeDto, userId?: number | string) {
    const admission = await this.findAdmissionById(admissionId);

    if (admission.status === 'DISCHARGED') {
      throw new BadRequestException(
        `Admission #${admission.admissionNumber} was already discharged on ${admission.actualDischargeDate}.`,
      );
    }

    const dischargeDate = dto.dischargeDate ? new Date(dto.dischargeDate) : new Date();

    if (dischargeDate < new Date(admission.admissionDate)) {
      throw new BadRequestException('Discharge timestamp cannot be earlier than admission timestamp.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Lock active allocation and post final bed stay charge
      const activeAllocation = await tx.bedAllocationHistory.findFirst({
        where: { admissionId: BigInt(admissionId), releasedAt: null },
      });

      if (activeAllocation) {
        const stayDurationMs = Math.max(0, dischargeDate.getTime() - new Date(activeAllocation.allocatedAt).getTime());
        const stayDays = Math.max(1, Math.ceil(stayDurationMs / (1000 * 60 * 60 * 24)));
        const dailyRate = Number(activeAllocation.rateSnapshot || 0);

        if (dailyRate > 0) {
          const totalBedCharge = stayDays * dailyRate;
          const ward = await tx.bedCategory.findUnique({ where: { id: admission.wardId } });
          const folio = await tx.inpatientFolio.findUnique({ where: { admissionId: BigInt(admissionId) } });

          if (folio) {
            const idempotencyKey = `BED-${activeAllocation.id}-FINAL`;
            const existingCharge = await tx.inpatientFolioItem.findUnique({ where: { idempotencyKey } });

            if (!existingCharge) {
              await tx.inpatientFolioItem.create({
                data: {
                  folioId: folio.id,
                  sourceModule: 'BED',
                  sourceRecordId: activeAllocation.id.toString(),
                  idempotencyKey,
                  chargeCategory: 'BED_STAY',
                  description: `Final Bed Charge: ${ward?.category || 'Ward'} (${stayDays} day(s) @ ${dailyRate}/day)`,
                  quantity: stayDays,
                  unitPrice: new Prisma.Decimal(dailyRate),
                  totalAmount: new Prisma.Decimal(totalBedCharge),
                  postedAt: dischargeDate,
                  postedBy: userId ? BigInt(userId) : null,
                },
              });

              await tx.inpatientFolio.update({
                where: { id: folio.id },
                data: {
                  totalCharges: { increment: totalBedCharge },
                  balance: { increment: totalBedCharge },
                },
              });
            }
          }
        }

        // Close allocation
        await tx.bedAllocationHistory.update({
          where: { id: activeAllocation.id },
          data: {
            releasedAt: dischargeDate,
            releasedBy: userId ? BigInt(userId) : null,
          },
        });
      }

      // 2. Release bed to 'CLEANING' state
      await tx.bed.update({
        where: { id: BigInt(admission.bedId) },
        data: { status: 'CLEANING' },
      });

      // 3. Complete Admission record
      const updatedAdmission = await tx.admission.update({
        where: { id: BigInt(admissionId) },
        data: {
          actualDischargeDate: dischargeDate,
          status: 'DISCHARGED',
          dischargeSummary: dto.dischargeSummary.trim(),
          dischargeCondition: dto.dischargeCondition,
          dischargedBy: userId ? BigInt(userId) : null,
        },
      });

      // 4. Update legacy AllotedBed mirror
      await tx.allotedBed.updateMany({
        where: { bedId: BigInt(admission.bedId), dTime: null },
        data: { dTime: dischargeDate.toISOString() },
      });

      // 5. Finalize Folio
      const folio = await tx.inpatientFolio.findUnique({
        where: { admissionId: BigInt(admissionId) },
      });

      if (folio) {
        let finalInvoiceId: bigint | null = null;

        // If outstanding balance exists and settlement invoice requested
        if (dto.createSettlementInvoice && Number(folio.balance) > 0) {
          const finalInvoice = await tx.payment.create({
            data: {
              patientId: BigInt(admission.patientId),
              admissionId: BigInt(admissionId),
              date: dischargeDate.toISOString().slice(0, 10),
              amount: folio.balance,
              grossTotal: folio.balance,
              amountReceived: new Prisma.Decimal(0),
              discount: new Prisma.Decimal(0),
              vat: new Prisma.Decimal(0),
              status: 'unpaid',
              category: 'INPATIENT_FOLIO',
              categoryName: `Inpatient Settlement - ${admission.admissionNumber}`,
              remarks: `Final settlement invoice for admission ${admission.admissionNumber}. Discharge condition: ${dto.dischargeCondition}`,
              careSetting: 'ipd',
            },
          });
          finalInvoiceId = finalInvoice.id;
        }

        await tx.inpatientFolio.update({
          where: { id: folio.id },
          data: {
            status: Number(folio.balance) <= 0 ? 'SETTLED' : 'CLOSED',
            settledAt: dischargeDate,
            settledBy: userId ? BigInt(userId) : null,
            finalInvoiceId,
          },
        });
      }

      return serializeBigInt(updatedAdmission);
    });
  }

  // ===========================================================================
  // 7. INPATIENT ADMISSION FOLIO & CHARGES
  // ===========================================================================

  async getFolio(admissionId: number | string) {
    const folio = await this.prisma.inpatientFolio.findUnique({
      where: { admissionId: BigInt(admissionId) },
      include: {
        admission: {
          include: {
            patient: { select: { id: true, name: true, patientId: true, age: true, sex: true, phone: true } },
            ward: true,
            bed: true,
            attendingDoctor: { select: { id: true, name: true } },
          },
        },
        items: {
          orderBy: { postedAt: 'desc' },
        },
        finalInvoice: true,
      },
    });

    if (!folio) {
      throw new NotFoundException(`Folio for admission #${admissionId} not found.`);
    }

    // Aggregate category summaries
    const activeItems = folio.items.filter((i) => !i.isReversed);
    const categoryTotals: Record<string, number> = {};

    for (const item of activeItems) {
      const cat = item.sourceModule || 'OTHER';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(item.totalAmount);
    }

    return {
      ...serializeBigInt(folio),
      categoryTotals,
    };
  }

  /**
   * Concurrency-safe, idempotent posting of charges to admission folio.
   */
  async postCharge(admissionId: number | string, dto: PostFolioChargeDto, userId?: number | string) {
    const admission = await this.prisma.admission.findUnique({
      where: { id: BigInt(admissionId) },
      include: { folio: true },
    });

    if (!admission) {
      throw new NotFoundException(`Admission #${admissionId} not found.`);
    }

    if (admission.status === 'DISCHARGED') {
      throw new BadRequestException(
        `Admission #${admission.admissionNumber} is discharged. Discharged stays cannot accept ordinary new charges without authorization.`,
      );
    }

    if (!admission.folio) {
      throw new NotFoundException(`Inpatient folio for admission #${admissionId} not found.`);
    }

    const folioId = admission.folio.id;
    const qty = Math.max(1, dto.quantity || 1);
    const unitPrice = dto.unitPrice >= 0 ? dto.unitPrice : 0;
    const totalAmount = dto.totalAmount !== undefined ? dto.totalAmount : qty * unitPrice;

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.inpatientFolioItem.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        this.logger.log(`Idempotent charge replay ignored for key ${dto.idempotencyKey}`);
        return {
          duplicate: true,
          item: serializeBigInt(existing),
          folio: serializeBigInt(admission.folio),
        };
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const item = await tx.inpatientFolioItem.create({
        data: {
          folioId,
          sourceModule: dto.sourceModule,
          sourceRecordId: dto.sourceRecordId || null,
          idempotencyKey: dto.idempotencyKey || null,
          chargeCategory: dto.chargeCategory,
          description: dto.description.trim(),
          quantity: qty,
          unitPrice: new Prisma.Decimal(unitPrice),
          totalAmount: new Prisma.Decimal(totalAmount),
          postedAt: new Date(),
          postedBy: userId ? BigInt(userId) : null,
        },
      });

      const updatedFolio = await tx.inpatientFolio.update({
        where: { id: folioId },
        data: {
          totalCharges: { increment: totalAmount },
          balance: { increment: totalAmount },
        },
      });

      return {
        item: serializeBigInt(item),
        folio: serializeBigInt(updatedFolio),
      };
    });
  }

  /**
   * Auditable charge reversal with mandatory reason and balance reconciliation.
   */
  async reverseCharge(folioItemId: number | string, dto: ReverseFolioChargeDto, userId?: number | string) {
    const item = await this.prisma.inpatientFolioItem.findUnique({
      where: { id: BigInt(folioItemId) },
      include: { folio: true },
    });

    if (!item) {
      throw new NotFoundException(`Folio item #${folioItemId} not found.`);
    }

    if (item.isReversed) {
      throw new BadRequestException(`Folio charge #${folioItemId} has already been reversed.`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const reversedItem = await tx.inpatientFolioItem.update({
        where: { id: BigInt(folioItemId) },
        data: {
          isReversed: true,
          reversedAt: new Date(),
          reversedBy: userId ? BigInt(userId) : null,
          reversalReason: dto.reversalReason.trim(),
        },
      });

      const amountToReverse = Number(item.totalAmount);

      const updatedFolio = await tx.inpatientFolio.update({
        where: { id: item.folioId },
        data: {
          totalCharges: { decrement: amountToReverse },
          balance: { decrement: amountToReverse },
        },
      });

      return {
        item: serializeBigInt(reversedItem),
        folio: serializeBigInt(updatedFolio),
      };
    });
  }

  async settleFolio(admissionId: number | string, dto: SettleFolioDto, userId?: number | string) {
    const folio = await this.prisma.inpatientFolio.findUnique({
      where: { admissionId: BigInt(admissionId) },
    });

    if (!folio) {
      throw new NotFoundException(`Folio for admission #${admissionId} not found.`);
    }

    const amountPaid = dto.amountPaid ? Math.max(0, dto.amountPaid) : Number(folio.balance);

    return await this.prisma.$transaction(async (tx) => {
      const newPaid = Number(folio.totalPaid) + amountPaid;
      const newBalance = Math.max(0, Number(folio.totalCharges) - newPaid);
      const isFullySettled = newBalance <= 0;

      const updated = await tx.inpatientFolio.update({
        where: { id: folio.id },
        data: {
          totalPaid: new Prisma.Decimal(newPaid),
          balance: new Prisma.Decimal(newBalance),
          status: isFullySettled ? 'SETTLED' : folio.status,
          settledAt: isFullySettled ? new Date() : folio.settledAt,
          settledBy: isFullySettled && userId ? BigInt(userId) : folio.settledBy,
        },
      });

      // If amountPaid > 0 and user has an active shift, record CashTransaction
      if (amountPaid > 0 && userId && (tx as any).cashierShift) {
        const activeShift = await (tx as any).cashierShift.findFirst({
          where: { cashierId: BigInt(userId), status: 'OPEN' },
        });

        if (activeShift && (tx as any).cashTransaction) {
          const methodStr = (dto.paymentMethod || 'Cash').toLowerCase().trim();
          const isCash = methodStr === '' || methodStr === 'cash';
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const count = await (tx as any).cashTransaction.count({
            where: { transactionNumber: { startsWith: `CTX-${dateStr}-` } },
          });
          const txNumber = `CTX-${dateStr}-${String(count + 1).padStart(4, '0')}`;
          await (tx as any).cashTransaction.create({
            data: {
              shiftId: activeShift.id,
              transactionNumber: txNumber,
              transactionType: 'PAYMENT_RECEIVED',
              sourceModule: 'INPATIENT_FOLIO',
              sourceReference: folio.folioNumber,
              idempotencyKey: `FOL-SETTLE-${folio.id}-${newPaid}`,
              paymentMethod: dto.paymentMethod || 'Cash',
              amount: new Prisma.Decimal(amountPaid),
              isCash,
              direction: 'INFLOW',
              recordedBy: BigInt(userId),
              notes: dto.remarks || `Inpatient folio settlement for ${folio.folioNumber}`,
            },
          });
        }
      }

      return {
        folio: serializeBigInt(updated),
      };
    });
  }
}
