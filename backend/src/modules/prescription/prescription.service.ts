import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto, PrescriptionItemDto } from './dto/create-prescription.dto';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';
import {
  MedicineSearchResultDto,
  PaginatedPrescriptionsDto,
  PrescriptionResponseDto,
} from './dto/prescription-response.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';

interface CleanedItem {
  medicineId: number | null;
  name: string;
  dosage: string | null;
  duration: string | null;
  instructions: string | null;
}

@Injectable()
export class PrescriptionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search hospital medicine catalog for autocomplete when writing prescriptions
   */
  async searchMedicines(query: string): Promise<MedicineSearchResultDto[]> {
    const term = (query || '').trim();
    if (!term) {
      const topMedicines = await this.prisma.medicine.findMany({
        take: 20,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          generic: true,
          company: true,
          quantity: true,
        },
      });
      return topMedicines.map((m) => ({
        id: m.id.toString(),
        name: m.name,
        generic: m.generic,
        company: m.company,
        quantity: m.quantity,
      }));
    }

    const medicines = await this.prisma.medicine.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { generic: { contains: term, mode: 'insensitive' } },
          { company: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: 25,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        generic: true,
        company: true,
        quantity: true,
      },
    });

    return medicines.map((m) => ({
      id: m.id.toString(),
      name: m.name,
      generic: m.generic,
      company: m.company,
      quantity: m.quantity,
    }));
  }

  /**
   * Returns a paginated list of prescriptions filterable by patient, doctor, and drug name
   */
  async findAll(query: PrescriptionQueryDto): Promise<PaginatedPrescriptionsDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.patient) {
      where.patientId = BigInt(query.patient);
    }

    if (query.doctor) {
      where.doctorId = BigInt(query.doctor);
    }

    if (query.drug && query.drug.trim() !== '') {
      const drugSearch = query.drug.trim();
      where.medicines = {
        some: {
          name: {
            contains: drugSearch,
            mode: 'insensitive',
          },
        },
      };
    }

    const [total, records] = await Promise.all([
      this.prisma.prescription.count({ where }),
      this.prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              patientId: true,
              phone: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              department: true,
            },
          },
          medicines: {
            orderBy: { id: 'asc' },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: records.map((r) => this.mapToResponse(r)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Retrieve a single prescription with items and clinician metadata
   */
  async findById(id: number | bigint): Promise<PrescriptionResponseDto> {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: BigInt(id) },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientId: true,
            phone: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            department: true,
          },
        },
        medicines: {
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription #${id} not found.`);
    }

    return this.mapToResponse(prescription);
  }

  /**
   * Create a new prescription with relational line items and synced legacy summary
   */
  async create(dto: CreatePrescriptionDto): Promise<PrescriptionResponseDto> {
    // 1. Verify patient exists
    const patient = await this.prisma.patient.findUnique({
      where: { id: BigInt(dto.patientId) },
    });
    if (!patient) {
      throw new NotFoundException(`Patient #${dto.patientId} does not exist.`);
    }

    // 2. Verify doctor exists
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: BigInt(dto.doctorId) },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor #${dto.doctorId} does not exist.`);
    }

    // 3. Clean and validate line items
    const cleanedItems = await this.cleanAndResolveItems(dto.items || []);
    if (cleanedItems.length === 0) {
      throw new BadRequestException(
        'Add at least one medicine, or this prescription says nothing.',
      );
    }

    // 4. Compute legacy summary column
    const legacySummary = this.computeLegacySummary(cleanedItems);

    // 5. Insert in transaction
    const created = await this.prisma.$transaction(
      async (tx) => {
        return tx.prescription.create({
          data: {
            patientId: BigInt(dto.patientId),
            doctorId: BigInt(dto.doctorId),
            date: dto.date,
            symptom: dto.symptom?.trim() || null,
            advice: dto.advice?.trim() || null,
            state: dto.state?.trim() || 'issued',
            dd: dto.dd?.trim() || null,
            medicine: legacySummary,
            validity: dto.validity?.trim() || null,
            note: dto.note?.trim() || null,
            medicines: {
              create: cleanedItems.map((item) => ({
                medicineId: item.medicineId ? BigInt(item.medicineId) : null,
                name: item.name,
                dosage: item.dosage,
                duration: item.duration,
                instructions: item.instructions,
              })),
            },
          },
          include: {
            patient: {
              select: {
                id: true,
                name: true,
                patientId: true,
                phone: true,
              },
            },
            doctor: {
              select: {
                id: true,
                name: true,
                department: true,
              },
            },
            medicines: {
              orderBy: { id: 'asc' },
            },
          },
        });
      },
      { maxWait: 10000, timeout: 20000 },
    );

    return this.mapToResponse(created);
  }

  /**
   * Update an existing prescription, replacing items wholesale and refreshing summary
   */
  async update(
    id: number | bigint,
    dto: UpdatePrescriptionDto,
  ): Promise<PrescriptionResponseDto> {
    const existing = await this.prisma.prescription.findUnique({
      where: { id: BigInt(id) },
    });
    if (!existing) {
      throw new NotFoundException(`Prescription #${id} not found.`);
    }

    if (dto.patientId) {
      const patient = await this.prisma.patient.findUnique({
        where: { id: BigInt(dto.patientId) },
      });
      if (!patient) {
        throw new NotFoundException(`Patient #${dto.patientId} does not exist.`);
      }
    }

    if (dto.doctorId) {
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: BigInt(dto.doctorId) },
      });
      if (!doctor) {
        throw new NotFoundException(`Doctor #${dto.doctorId} does not exist.`);
      }
    }

    let cleanedItems: CleanedItem[] | null = null;
    let legacySummary: string | null = null;

    if (dto.items !== undefined) {
      cleanedItems = await this.cleanAndResolveItems(dto.items);
      if (cleanedItems.length === 0) {
        throw new BadRequestException(
          'Add at least one medicine, or this prescription says nothing.',
        );
      }
      legacySummary = this.computeLegacySummary(cleanedItems);
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        if (cleanedItems) {
          // Replace line items wholesale (legacy parity)
          await tx.prescriptionMedicine.deleteMany({
            where: { prescriptionId: BigInt(id) },
          });

          await tx.prescriptionMedicine.createMany({
            data: cleanedItems.map((item) => ({
              prescriptionId: BigInt(id),
              medicineId: item.medicineId ? BigInt(item.medicineId) : null,
              name: item.name,
              dosage: item.dosage,
              duration: item.duration,
              instructions: item.instructions,
            })),
          });
        }

        const updateData: any = {};
        if (dto.patientId !== undefined) updateData.patientId = BigInt(dto.patientId);
        if (dto.doctorId !== undefined) updateData.doctorId = BigInt(dto.doctorId);
        if (dto.date !== undefined) updateData.date = dto.date;
        if (dto.symptom !== undefined) updateData.symptom = dto.symptom?.trim() || null;
        if (dto.advice !== undefined) updateData.advice = dto.advice?.trim() || null;
        if (dto.state !== undefined) updateData.state = dto.state?.trim() || null;
        if (dto.dd !== undefined) updateData.dd = dto.dd?.trim() || null;
        if (dto.validity !== undefined) updateData.validity = dto.validity?.trim() || null;
        if (dto.note !== undefined) updateData.note = dto.note?.trim() || null;
        if (legacySummary !== null) updateData.medicine = legacySummary;

        return tx.prescription.update({
          where: { id: BigInt(id) },
          data: updateData,
          include: {
            patient: {
              select: {
                id: true,
                name: true,
                patientId: true,
                phone: true,
              },
            },
            doctor: {
              select: {
                id: true,
                name: true,
                department: true,
              },
            },
            medicines: {
              orderBy: { id: 'asc' },
            },
          },
        });
      },
      { maxWait: 10000, timeout: 20000 },
    );

    return this.mapToResponse(updated);
  }

  /**
   * Delete a prescription and its associated line items
   */
  async remove(id: number | bigint): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.prescription.findUnique({
      where: { id: BigInt(id) },
    });
    if (!existing) {
      throw new NotFoundException(`Prescription #${id} not found.`);
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.prescriptionMedicine.deleteMany({
          where: { prescriptionId: BigInt(id) },
        });
        await tx.prescription.delete({
          where: { id: BigInt(id) },
        });
      },
      { maxWait: 10000, timeout: 20000 },
    );

    return {
      success: true,
      message: 'Prescription removed.',
    };
  }

  /**
   * Drops blank rows and resolves each line to a valid name (from catalog or free text)
   */
  private async cleanAndResolveItems(
    rows: PrescriptionItemDto[],
  ): Promise<CleanedItem[]> {
    const out: CleanedItem[] = [];

    // Collect all requested medicine IDs to batch query
    const requestedIds = rows
      .map((r) => r.medicineId)
      .filter((id): id is number => typeof id === 'number' && id > 0);

    const catalogMap = new Map<number, string>();
    if (requestedIds.length > 0) {
      const medicines = await this.prisma.medicine.findMany({
        where: {
          id: { in: requestedIds.map((id) => BigInt(id)) },
        },
        select: { id: true, name: true },
      });
      for (const m of medicines) {
        catalogMap.set(Number(m.id), m.name);
      }
    }

    for (const row of rows) {
      let medId: number | null = row.medicineId ?? null;
      let name = (row.name || '').trim();

      if (medId) {
        if (!catalogMap.has(medId)) {
          throw new NotFoundException(`Medicine #${medId} not found in catalog.`);
        }
        // Catalogue name is copied onto the line item
        name = catalogMap.get(medId)!;
      }

      // Drop blank rows
      if (!name) {
        continue;
      }

      out.push({
        medicineId: medId,
        name,
        dosage: this.blankToNull(row.dosage),
        duration: this.blankToNull(row.duration),
        instructions: this.blankToNull(row.instructions),
      });
    }

    return out;
  }

  private blankToNull(val?: string | null): string | null {
    if (!val) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  }

  /**
   * Computes legacy summary string kept in step with line items
   * E.g.: "Amoxil 1+0+1 for 5 days, Paracetamol 1+1+1"
   */
  private computeLegacySummary(items: CleanedItem[]): string {
    const parts = items.map((item) => {
      const segments: string[] = [item.name];
      if (item.dosage) segments.push(item.dosage);
      if (item.duration) segments.push(`for ${item.duration}`);
      return segments.join(' ');
    });

    return parts.join(', ').slice(0, 1000);
  }

  /**
   * Serializes BigInt primary/foreign keys into string DTOs for JSON response
   */
  private mapToResponse(raw: any): PrescriptionResponseDto {
    return {
      id: raw.id.toString(),
      patientId: raw.patientId.toString(),
      doctorId: raw.doctorId.toString(),
      date: raw.date,
      symptom: raw.symptom,
      advice: raw.advice,
      state: raw.state,
      dd: raw.dd,
      medicine: raw.medicine,
      validity: raw.validity,
      note: raw.note,
      patient: raw.patient
        ? {
            id: raw.patient.id.toString(),
            name: raw.patient.name,
            patientId: raw.patient.patientId,
            phone: raw.patient.phone,
          }
        : undefined,
      doctor: raw.doctor
        ? {
            id: raw.doctor.id.toString(),
            name: raw.doctor.name,
            department: raw.doctor.department,
          }
        : undefined,
      items: (raw.medicines || []).map((m: any) => ({
        id: m.id.toString(),
        prescriptionId: m.prescriptionId.toString(),
        medicineId: m.medicineId ? m.medicineId.toString() : null,
        name: m.name,
        dosage: m.dosage,
        duration: m.duration,
        instructions: m.instructions,
      })),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
