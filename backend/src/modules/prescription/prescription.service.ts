import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchAuthorizationService } from '../../common/services/branch-authorization.service';
import { AuthUser } from '../../common/types/auth-user.interface';
import { CreatePrescriptionDto, PrescriptionItemDto } from './dto/create-prescription.dto';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';
import {
  MedicineSearchResultDto,
  PaginatedPrescriptionsDto,
  PrescriptionPrintoutDto,
  PrescriptionResponseDto,
} from './dto/prescription-response.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { SignPrescriptionDto } from './dto/sign-prescription.dto';
import { CancelPrescriptionDto } from './dto/cancel-prescription.dto';
import { AmendPrescriptionDto } from './dto/amend-prescription.dto';

interface CleanedItem {
  medicineId: number | null;
  name: string;
  dosage: string | null;
  duration: string | null;
  instructions: string | null;
  quantityPrescribed: number;
  unit: string | null;
  route: string | null;
  frequency: string | null;
  timing: string | null;
  refills: number;
  startDate: string | null;
  endDate: string | null;
}

@Injectable()
export class PrescriptionService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly branchAuth?: BranchAuthorizationService,
  ) {}

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
   * Returns a paginated list of prescriptions filterable by patient, doctor, status, and drug name
   */
  async findAll(query: PrescriptionQueryDto, user?: AuthUser): Promise<PaginatedPrescriptionsDto> {
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

    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      const accessibleBranches = await this.branchAuth.resolveAccessibleBranchIds(user);
      const isOrg1 = !user.organizationId || BigInt(user.organizationId) === 1n;
      if (isOrg1) {
        where.patient = {
          OR: [
            { branchId: { in: accessibleBranches || [] } },
            { branchId: null },
          ],
        };
      } else {
        where.patient = {
          branchId: { in: accessibleBranches || [] },
        };
      }
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
              sex: true,
              age: true,
              bloodGroup: true,
              allergies: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              department: true,
            },
          },
          signedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              group: true,
            },
          },
          cancelledBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              group: true,
            },
          },
          medicines: {
            orderBy: { id: 'asc' },
          },
          amendments: {
            orderBy: { id: 'desc' },
            include: {
              amendedByUser: {
                select: { id: true, firstName: true, lastName: true, group: true },
              },
            },
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
   * Retrieve a single prescription with items, amendments, and clinician metadata
   */
  async findById(id: number | bigint, user?: AuthUser): Promise<PrescriptionResponseDto> {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: BigInt(id) },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientId: true,
            phone: true,
            sex: true,
            age: true,
            bloodGroup: true,
            allergies: true,
            branchId: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            department: true,
          },
        },
        signedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            group: true,
          },
        },
        cancelledBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            group: true,
          },
        },
        medicines: {
          orderBy: { id: 'asc' },
        },
        amendments: {
          orderBy: { id: 'desc' },
          include: {
            amendedByUser: {
              select: { id: true, firstName: true, lastName: true, group: true },
            },
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription #${id} not found.`);
    }

    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(
        user,
        prescription.branchId || (prescription.patient as any)?.branchId,
        'prescription',
      );
    }

    // Check allergy status & alerts for the patient
    const allergyInfo = await this.evaluateAllergies(
      prescription.patientId,
      (prescription.medicines || []).map((m: any) => m.name),
    );

    return this.mapToResponse(prescription, allergyInfo);
  }

  /**
   * Create a new prescription with relational line items, uniqueness check, and allergy safety check
   */
  async create(dto: CreatePrescriptionDto, user?: AuthUser): Promise<PrescriptionResponseDto> {
    // 1. Verify patient exists
    const patient = await this.prisma.patient.findUnique({
      where: { id: BigInt(dto.patientId) },
    });
    if (!patient) {
      throw new NotFoundException(`Patient #${dto.patientId} does not exist.`);
    }

    const branchId = dto.branchId || dto.branch_id || patient.branchId || user?.branchId;
    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, branchId ? BigInt(branchId) : null, 'prescription patient');
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

    // 4. Evaluate allergy safety
    const allergyInfo = await this.evaluateAllergies(
      BigInt(dto.patientId),
      cleanedItems.map((i) => i.name),
    );

    // 5. Determine lifecycle status and digital signature
    const isSigned = dto.status === 'SIGNED' || dto.signImmediately === true;
    const initialStatus = isSigned ? 'SIGNED' : (dto.status || 'DRAFT');
    const signedAt = isSigned ? new Date() : null;
    const signedById = isSigned && user?.id ? BigInt(user.id) : null;

    // 6. Generate reliable unique prescription number
    const prescriptionNumber = await this.generatePrescriptionNumber();

    // 7. Compute legacy summary column
    const legacySummary = this.computeLegacySummary(cleanedItems);

    const organizationId = user?.organizationId ? BigInt(user.organizationId) : null;
    const resolvedBranchId = branchId ? BigInt(branchId) : null;
    const consultationId = dto.consultationId ? BigInt(dto.consultationId) : null;

    // 8. Insert in transaction
    const created = await this.prisma.$transaction(
      async (tx) => {
        return tx.prescription.create({
          data: {
            prescriptionNumber,
            consultationId,
            organizationId,
            branchId: resolvedBranchId,
            patientId: BigInt(dto.patientId),
            doctorId: BigInt(dto.doctorId),
            date: dto.date,
            symptom: dto.symptom?.trim() || null,
            advice: dto.advice?.trim() || null,
            status: initialStatus,
            signedAt,
            signedById,
            state: isSigned ? 'issued' : 'draft',
            dd: dto.dd?.trim() || null,
            medicine: legacySummary,
            validity: dto.validity?.trim() || '30 days',
            note: dto.note?.trim() || null,
            medicines: {
              create: cleanedItems.map((item) => ({
                medicineId: item.medicineId ? BigInt(item.medicineId) : null,
                name: item.name,
                dosage: item.dosage,
                duration: item.duration,
                instructions: item.instructions,
                quantityPrescribed: item.quantityPrescribed,
                unit: item.unit,
                route: item.route,
                frequency: item.frequency,
                timing: item.timing,
                refills: item.refills,
                startDate: item.startDate,
                endDate: item.endDate,
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
                sex: true,
                age: true,
                bloodGroup: true,
                allergies: true,
              },
            },
            doctor: {
              select: {
                id: true,
                name: true,
                department: true,
              },
            },
            signedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                group: true,
              },
            },
            cancelledBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                group: true,
              },
            },
            medicines: {
              orderBy: { id: 'asc' },
            },
            amendments: {
              orderBy: { id: 'desc' },
              include: {
                amendedByUser: {
                  select: { id: true, firstName: true, lastName: true, group: true },
                },
              },
            },
          },
        });
      },
      { maxWait: 10000, timeout: 20000 },
    );

    return this.mapToResponse(created, allergyInfo);
  }

  /**
   * Digital sign-off stamping signed_at and signed_by_id, transitioning status to SIGNED
   */
  async sign(
    id: number | bigint,
    dto: SignPrescriptionDto,
    user: AuthUser,
  ): Promise<PrescriptionResponseDto> {
    const existing = await this.prisma.prescription.findUnique({
      where: { id: BigInt(id) },
      include: { medicines: true },
    });

    if (!existing) {
      throw new NotFoundException(`Prescription #${id} not found.`);
    }

    if (this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, existing.branchId, 'prescription');
    }

    if (existing.status === 'SIGNED' || existing.status === 'PARTIALLY_DISPENSED' || existing.status === 'DISPENSED') {
      throw new BadRequestException(`Prescription #${id} is already signed.`);
    }

    if (existing.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot sign cancelled prescription #${id}.`);
    }

    let updatedNote = existing.note || '';
    if (dto.signatureNotes?.trim()) {
      updatedNote = updatedNote
        ? `${updatedNote}\n[Sign-off remark: ${dto.signatureNotes.trim()}]`
        : `[Sign-off remark: ${dto.signatureNotes.trim()}]`;
    }

    const updated = await this.prisma.prescription.update({
      where: { id: BigInt(id) },
      data: {
        status: 'SIGNED',
        state: 'issued',
        signedAt: new Date(),
        signedById: BigInt(user.id),
        note: updatedNote || null,
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientId: true,
            phone: true,
            sex: true,
            age: true,
            bloodGroup: true,
            allergies: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            department: true,
          },
        },
        signedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            group: true,
          },
        },
        cancelledBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            group: true,
          },
        },
        medicines: {
          orderBy: { id: 'asc' },
        },
        amendments: {
          orderBy: { id: 'desc' },
          include: {
            amendedByUser: {
              select: { id: true, firstName: true, lastName: true, group: true },
            },
          },
        },
      },
    });

    const allergyInfo = await this.evaluateAllergies(
      updated.patientId,
      (updated.medicines || []).map((m: any) => m.name),
    );

    return this.mapToResponse(updated, allergyInfo);
  }

  /**
   * Cancel a prescription with mandatory clinical reason
   */
  async cancel(
    id: number | bigint,
    dto: CancelPrescriptionDto,
    user: AuthUser,
  ): Promise<PrescriptionResponseDto> {
    const existing = await this.prisma.prescription.findUnique({
      where: { id: BigInt(id) },
      include: { medicines: true },
    });

    if (!existing) {
      throw new NotFoundException(`Prescription #${id} not found.`);
    }

    if (this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, existing.branchId, 'prescription');
    }

    if (existing.status === 'DISPENSED' || existing.state === 'dispensed') {
      throw new BadRequestException(
        `Cannot cancel prescription #${id} because medications have already been fully dispensed.`,
      );
    }

    if (existing.status === 'CANCELLED') {
      throw new BadRequestException(`Prescription #${id} is already cancelled.`);
    }

    const updated = await this.prisma.prescription.update({
      where: { id: BigInt(id) },
      data: {
        status: 'CANCELLED',
        state: 'cancelled',
        cancelledAt: new Date(),
        cancelledById: BigInt(user.id),
        cancellationReason: dto.reason.trim(),
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientId: true,
            phone: true,
            sex: true,
            age: true,
            bloodGroup: true,
            allergies: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            department: true,
          },
        },
        signedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            group: true,
          },
        },
        cancelledBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            group: true,
          },
        },
        medicines: {
          orderBy: { id: 'asc' },
        },
        amendments: {
          orderBy: { id: 'desc' },
          include: {
            amendedByUser: {
              select: { id: true, firstName: true, lastName: true, group: true },
            },
          },
        },
      },
    });

    return this.mapToResponse(updated);
  }

  /**
   * Auditable clinical amendment workflow for signed or active prescriptions
   */
  async amend(
    id: number | bigint,
    dto: AmendPrescriptionDto,
    user: AuthUser,
  ): Promise<PrescriptionResponseDto> {
    const existing = await this.prisma.prescription.findUnique({
      where: { id: BigInt(id) },
      include: { medicines: true },
    });

    if (!existing) {
      throw new NotFoundException(`Prescription #${id} not found.`);
    }

    if (this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, existing.branchId, 'prescription');
    }

    if (existing.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot amend cancelled prescription #${id}.`);
    }

    const section = (dto.amendedSection || 'GENERAL').toUpperCase();
    const amendmentReason = dto.reason.trim();
    const newNotes = dto.newNotes.trim();
    const prevNotes = dto.previousNotes?.trim() || null;

    // Record amendment and append to prescription note
    await this.prisma.$transaction(async (tx) => {
      await tx.prescriptionAmendment.create({
        data: {
          prescriptionId: BigInt(id),
          amendedBy: BigInt(user.id),
          reason: amendmentReason,
          amendedSection: section,
          previousNotes: prevNotes,
          newNotes: newNotes,
        },
      });

      const auditLine = `[Amendment ${new Date().toISOString().slice(0, 10)} by User #${user.id} (${section}): ${amendmentReason} - ${newNotes}]`;
      const updatedNote = existing.note ? `${existing.note}\n${auditLine}` : auditLine;

      await tx.prescription.update({
        where: { id: BigInt(id) },
        data: { note: updatedNote },
      });
    });

    return this.findById(id, user);
  }

  /**
   * Update an existing draft prescription (immutability guard enforced on signed/dispensed)
   */
  async update(
    id: number | bigint,
    dto: UpdatePrescriptionDto,
    user?: AuthUser,
  ): Promise<PrescriptionResponseDto> {
    const existing = await this.prisma.prescription.findUnique({
      where: { id: BigInt(id) },
      include: { medicines: true },
    });

    if (!existing) {
      throw new NotFoundException(`Prescription #${id} not found.`);
    }

    // Immutability Guard: signed or dispensed prescriptions cannot be directly updated
    if (
      existing.status === 'SIGNED' ||
      existing.status === 'PARTIALLY_DISPENSED' ||
      existing.status === 'DISPENSED' ||
      existing.status === 'CANCELLED'
    ) {
      throw new BadRequestException(
        `Prescription #${id} is in status '${existing.status}' and is immutable. Use the amendment workflow (POST /prescriptions/${id}/amend) to make clinical corrections.`,
      );
    }

    if (dto.patientId) {
      const patient = await this.prisma.patient.findUnique({
        where: { id: BigInt(dto.patientId) },
      });
      if (!patient) {
        throw new NotFoundException(`Patient #${dto.patientId} does not exist.`);
      }
      if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
        await this.branchAuth.assertResourceAccess(user, patient.branchId, 'prescription patient');
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
              quantityPrescribed: item.quantityPrescribed,
              unit: item.unit,
              route: item.route,
              frequency: item.frequency,
              timing: item.timing,
              refills: item.refills,
              startDate: item.startDate,
              endDate: item.endDate,
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
                sex: true,
                age: true,
                bloodGroup: true,
                allergies: true,
              },
            },
            doctor: {
              select: {
                id: true,
                name: true,
                department: true,
              },
            },
            signedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                group: true,
              },
            },
            cancelledBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                group: true,
              },
            },
            medicines: {
              orderBy: { id: 'asc' },
            },
            amendments: {
              orderBy: { id: 'desc' },
              include: {
                amendedByUser: {
                  select: { id: true, firstName: true, lastName: true, group: true },
                },
              },
            },
          },
        });
      },
      { maxWait: 10000, timeout: 20000 },
    );

    return this.mapToResponse(updated);
  }

  /**
   * Delete a prescription (immutability guard enforced on signed/dispensed)
   */
  async remove(id: number | bigint, user?: AuthUser): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.prescription.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existing) {
      throw new NotFoundException(`Prescription #${id} not found.`);
    }

    if (
      existing.status === 'SIGNED' ||
      existing.status === 'PARTIALLY_DISPENSED' ||
      existing.status === 'DISPENSED'
    ) {
      throw new BadRequestException(
        `Prescription #${id} is signed or dispensed and cannot be deleted. Use cancellation instead.`,
      );
    }

    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, existing.branchId, 'prescription');
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.prescriptionAmendment.deleteMany({
          where: { prescriptionId: BigInt(id) },
        });
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
   * Pharmacy Queue: Returns prescriptions ready for dispensing (SIGNED or PARTIALLY_DISPENSED)
   */
  async getPharmacyQueue(
    query: { branchId?: string; search?: string; date?: string },
    user?: AuthUser,
  ) {
    const where: any = {
      status: { in: ['SIGNED', 'PARTIALLY_DISPENSED'] },
    };

    if (query.date) {
      where.date = query.date;
    }

    if (query.branchId) {
      where.branchId = BigInt(query.branchId);
    } else if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      const accessibleBranches = await this.branchAuth.resolveAccessibleBranchIds(user);
      where.branchId = { in: accessibleBranches || [] };
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { prescriptionNumber: { contains: search, mode: 'insensitive' } },
        { patient: { name: { contains: search, mode: 'insensitive' } } },
        { patient: { patientId: { contains: search, mode: 'insensitive' } } },
        { doctor: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const prescriptions = await this.prisma.prescription.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 100,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientId: true,
            phone: true,
            sex: true,
            age: true,
            bloodGroup: true,
            allergies: true,
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

    return prescriptions.map((p) => {
      const totalPrescribed = p.medicines.reduce((acc, m) => acc + (m.quantityPrescribed || 1), 0);
      const totalDispensed = p.medicines.reduce((acc, m) => acc + (m.dispensedQuantity || 0), 0);
      const allDone = p.medicines.every((m) => (m.dispensedQuantity || 0) >= (m.quantityPrescribed || 1));

      return {
        ...this.mapToResponse(p),
        totalPrescribed,
        totalDispensed,
        isFullyDispensed: allDone,
      };
    });
  }

  /**
   * Generates a printable prescription summary view with clinic and doctor credentials
   */
  async getPrintout(id: number | bigint, user?: AuthUser): Promise<PrescriptionPrintoutDto> {
    const prescription = await this.findById(id, user);

    let orgName = 'Medora Healthcare Clinic';
    let branchName = 'Main Clinic';
    let address = 'Central Medical Complex';
    let phone = '+92-51-1234567';
    let logoUrl = '/assets/medora-logo.png';

    const branch = prescription.branchId
      ? await this.prisma.hospitalBranch.findUnique({
          where: { id: BigInt(prescription.branchId) },
          include: { organization: true },
        })
      : null;

    if (branch) {
      branchName = branch.name;
      if (branch.address) address = branch.address;
      if (branch.phone) phone = branch.phone;
      if (branch.organization?.name) orgName = branch.organization.name;
    }

    return {
      prescription,
      organization: {
        name: orgName,
        branchName,
        address,
        phone,
        logoUrl,
      },
    };
  }

  /**
   * Generates reliable unique business prescription number: RX-YYYYMMDD-XXXX
   */
  private async generatePrescriptionNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RX-${dateStr}-`;

    const countToday = await this.prisma.prescription.count({
      where: {
        prescriptionNumber: {
          startsWith: prefix,
        },
      },
    });

    const seq = String(countToday + 1).padStart(4, '0');
    let candidate = `${prefix}${seq}`;

    // Collision check
    const existing = await this.prisma.prescription.findUnique({
      where: { prescriptionNumber: candidate },
    });

    if (existing) {
      candidate = `${prefix}${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    }

    return candidate;
  }

  /**
   * Clinical safety: evaluates patient allergy status and checks prescribed drugs against recorded allergies
   */
  private async evaluateAllergies(
    patientId: bigint,
    prescribedDrugNames: string[],
  ): Promise<{ allergyStatus: string; allergyAlerts: string[]; recordedAllergies: string | null }> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        allergies: true,
      },
    });

    if (!patient) {
      return {
        allergyStatus: 'UNKNOWN',
        allergyAlerts: ['Warning: Patient not found to verify allergies.'],
        recordedAllergies: null,
      };
    }

    const recordedAllergies = patient.allergies?.trim() || null;
    const alerts: string[] = [];

    // Check allergy status
    let status = 'RECORDED';
    if (!recordedAllergies || recordedAllergies.toUpperCase() === 'UNKNOWN') {
      status = 'UNKNOWN';
      alerts.push('Patient allergy status is UNKNOWN. Clinical review recommended before prescribing.');
    } else if (
      recordedAllergies.toUpperCase() === 'NKDA' ||
      recordedAllergies.toUpperCase() === 'NONE' ||
      recordedAllergies.toUpperCase() === 'NIL' ||
      recordedAllergies.toLowerCase().includes('no known')
    ) {
      status = 'NKDA';
    } else {
      status = 'KNOWN_ALLERGIES';
      const allergyTokens = recordedAllergies
        .toLowerCase()
        .split(/[,;\n]+/)
        .map((t: string) => t.trim())
        .filter(Boolean);

      for (const drug of prescribedDrugNames) {
        const drugLower = drug.toLowerCase();
        for (const allergen of allergyTokens) {
          if (allergen.length > 2 && (drugLower.includes(allergen) || allergen.includes(drugLower))) {
            alerts.push(
              `CRITICAL ALLERGY ALERT: Prescribed medication '${drug}' conflicts with recorded patient allergy '${allergen}'.`,
            );
          }
        }
      }
    }

    return {
      allergyStatus: status,
      allergyAlerts: alerts,
      recordedAllergies,
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
        quantityPrescribed: typeof row.quantityPrescribed === 'number' && row.quantityPrescribed > 0 ? row.quantityPrescribed : 1,
        unit: this.blankToNull(row.unit),
        route: this.blankToNull(row.route),
        frequency: this.blankToNull(row.frequency),
        timing: this.blankToNull(row.timing),
        refills: typeof row.refills === 'number' && row.refills >= 0 ? row.refills : 0,
        startDate: this.blankToNull(row.startDate),
        endDate: this.blankToNull(row.endDate),
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
   */
  private computeLegacySummary(items: CleanedItem[]): string {
    const parts = items.map((item) => {
      const segments: string[] = [item.name];
      if (item.dosage) segments.push(item.dosage);
      if (item.frequency) segments.push(item.frequency);
      if (item.duration) segments.push(`for ${item.duration}`);
      if (item.timing) segments.push(`(${item.timing})`);
      return segments.join(' ');
    });

    return parts.join(', ').slice(0, 1000);
  }

  /**
   * Serializes BigInt primary/foreign keys into string DTOs for JSON response
   */
  private mapToResponse(
    raw: any,
    allergyInfo?: { allergyStatus: string; allergyAlerts: string[]; recordedAllergies: string | null },
  ): PrescriptionResponseDto {
    return {
      id: raw.id.toString(),
      prescriptionNumber: raw.prescriptionNumber || `RX-LEGACY-${raw.id.toString().padStart(6, '0')}`,
      consultationId: raw.consultationId ? raw.consultationId.toString() : null,
      organizationId: raw.organizationId ? raw.organizationId.toString() : null,
      branchId: raw.branchId ? raw.branchId.toString() : null,
      patientId: raw.patientId.toString(),
      doctorId: raw.doctorId.toString(),
      date: raw.date,
      symptom: raw.symptom,
      advice: raw.advice,
      status: raw.status || (raw.state === 'dispensed' ? 'DISPENSED' : 'SIGNED'),
      state: raw.state,
      dd: raw.dd,
      medicine: raw.medicine,
      validity: raw.validity,
      note: raw.note,
      signedAt: raw.signedAt,
      signedById: raw.signedById ? raw.signedById.toString() : null,
      signedBy: raw.signedBy
        ? {
            id: raw.signedBy.id.toString(),
            name: `${raw.signedBy.firstName || ''} ${raw.signedBy.lastName || ''}`.trim() || 'Staff',
            role: raw.signedBy.group || 'user',
          }
        : null,
      cancelledAt: raw.cancelledAt,
      cancelledById: raw.cancelledById ? raw.cancelledById.toString() : null,
      cancelledBy: raw.cancelledBy
        ? {
            id: raw.cancelledBy.id.toString(),
            name: `${raw.cancelledBy.firstName || ''} ${raw.cancelledBy.lastName || ''}`.trim() || 'Staff',
            role: raw.cancelledBy.group || 'user',
          }
        : null,
      cancellationReason: raw.cancellationReason,
      patient: raw.patient
        ? {
            id: raw.patient.id.toString(),
            name: raw.patient.name,
            patientId: raw.patient.patientId,
            phone: raw.patient.phone,
            gender: raw.patient.sex,
            age: raw.patient.age,
            bloodGroup: raw.patient.bloodGroup,
            allergies: raw.patient.allergies || allergyInfo?.recordedAllergies || null,
            allergyStatus: allergyInfo?.allergyStatus || (raw.patient.allergies ? 'RECORDED' : 'UNKNOWN'),
          }
        : undefined,
      doctor: raw.doctor
        ? {
            id: raw.doctor.id.toString(),
            name: raw.doctor.name,
            department: raw.doctor.department,
          }
        : undefined,
      items: (raw.medicines || []).map((m: any) => {
        const qtyPrescribed = m.quantityPrescribed || 1;
        const qtyDispensed = m.dispensedQuantity || 0;
        const remaining = Math.max(0, qtyPrescribed - qtyDispensed);

        return {
          id: m.id.toString(),
          prescriptionId: m.prescriptionId.toString(),
          medicineId: m.medicineId ? m.medicineId.toString() : null,
          name: m.name,
          dosage: m.dosage,
          duration: m.duration,
          instructions: m.instructions,
          quantityPrescribed: qtyPrescribed,
          unit: m.unit,
          route: m.route,
          frequency: m.frequency,
          timing: m.timing,
          refills: m.refills || 0,
          startDate: m.startDate,
          endDate: m.endDate,
          dispensedQuantity: qtyDispensed,
          remainingQuantity: remaining,
        };
      }),
      amendments: (raw.amendments || []).map((a: any) => ({
        id: a.id.toString(),
        prescriptionId: a.prescriptionId.toString(),
        amendedBy: a.amendedBy.toString(),
        amendedByUser: a.amendedByUser
          ? {
              id: a.amendedByUser.id.toString(),
              name: `${a.amendedByUser.firstName || ''} ${a.amendedByUser.lastName || ''}`.trim() || 'Staff',
              role: a.amendedByUser.group || 'user',
            }
          : undefined,
        reason: a.reason,
        amendedSection: a.amendedSection,
        previousNotes: a.previousNotes,
        newNotes: a.newNotes,
        createdAt: a.createdAt,
      })),
      allergyAlerts: allergyInfo?.allergyAlerts || [],
      allergyStatus: allergyInfo?.allergyStatus || 'UNKNOWN',
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
