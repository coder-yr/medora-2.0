import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { Patient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BranchAuthorizationService } from '../../common/services/branch-authorization.service';
import { AuthUser } from '../../common/types/auth-user.interface';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { PaginatedPatientsDto, PatientResponseDto } from './dto/patient-response.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { CheckDuplicateQueryDto } from './dto/check-duplicate-query.dto';
import { DuplicateCheckResponseDto, DuplicateMatchItemDto } from './dto/duplicate-check-response.dto';
import {
  EncounterAppointmentDto,
  EncounterConsultationDto,
  EncounterInvoiceDto,
  EncounterLabDto,
  EncounterPrescriptionDto,
  PatientEncounterResponseDto,
} from './dto/patient-encounter-response.dto';
import { CreatePatientDocumentDto, PatientDocumentResponseDto } from './dto/patient-document.dto';

@Injectable()
export class PatientService {
  private readonly logger = new Logger(PatientService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly branchAuth?: BranchAuthorizationService,
  ) {}

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
  async findAll(query: PatientQueryDto, user?: AuthUser): Promise<PaginatedPatientsDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 25));
    const skip = (page - 1) * limit;
    const term = (query.q || '').trim();

    let branchFilter: any = {};
    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      const accessibleBranches = await this.branchAuth.resolveAccessibleBranchIds(user);

      if (query.branchId) {
        const authorizedBranchId = await this.branchAuth.assertBranchAccess(user, query.branchId);
        branchFilter = { branchId: authorizedBranchId };
      } else {
        const branchIds = accessibleBranches || [];
        branchFilter = { branchId: { in: branchIds } };
      }
    } else if (query.branchId && user && this.branchAuth) {
      const authorizedBranchId = await this.branchAuth.assertBranchAccess(user, query.branchId);
      branchFilter = { branchId: authorizedBranchId };
    }

    const whereClause: any = {
      ...branchFilter,
      ...(term
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
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.patient.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
      }),
      this.prisma.patient.count({ where: whereClause }),
    ]);

    const mapped = items.map((p) => this.mapToDto(p));
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
   * Find patient by numeric ID or 6-digit patient_id.
   */
  async findById(idOrPatientId: string | number, user?: AuthUser): Promise<PatientResponseDto> {
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

    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, patient.branchId, 'patient');
    }

    return this.mapToDto(patient);
  }

  /**
   * Register a new patient with sequential ID and derived age in PostgreSQL.
   */
  async create(
    dto: CreatePatientDto,
    howAdded = 'front desk',
    user?: AuthUser,
  ): Promise<PatientResponseDto> {
    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException('Patient name is required');
    }

    let targetBranchId: bigint | null = null;
    if (dto.branchId) {
      targetBranchId =
        user && this.branchAuth
          ? await this.branchAuth.assertBranchAccess(user, dto.branchId)
          : BigInt(dto.branchId);
    } else if (user?.branchId) {
      targetBranchId = BigInt(user.branchId);
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
        branchId: targetBranchId,
        imageUrl: dto.photoData ? 'patients/webcam_capture.jpg' : null,
        addDate,
        registrationTime,
        ionUserId: '',
        howAdded,
        emergencyContactName: dto.emergencyContactName?.trim() || null,
        emergencyContactPhone: dto.emergencyContactPhone?.trim() || null,
        emergencyContactRelation: dto.emergencyContactRelation?.trim() || null,
        allergies: dto.allergies?.trim() || null,
        medicalHistory: dto.medicalHistory?.trim() || null,
        surgicalHistory: dto.surgicalHistory?.trim() || null,
        familyHistory: dto.familyHistory?.trim() || null,
        currentMedications: dto.currentMedications?.trim() || null,
      },
    });

    this.logger.log(`Patient registered: ${created.patientId} - ${created.name}`);
    return this.mapToDto(created);
  }

  /**
   * Update an existing patient record and recalculate age if birthdate changes.
   */
  async update(
    idOrPatientId: string | number,
    dto: UpdatePatientDto,
    user?: AuthUser,
  ): Promise<PatientResponseDto> {
    const existing = await this.findById(idOrPatientId, user);
    if (user && this.branchAuth) {
      await this.branchAuth.assertResourceAccess(user, existing.branchId, 'patient');
    }
    if (dto.branchId && user && this.branchAuth) {
      await this.branchAuth.assertBranchAccess(user, dto.branchId);
    }

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

    if (dto.emergencyContactName !== undefined)
      updateData.emergencyContactName = dto.emergencyContactName?.trim() || null;
    if (dto.emergencyContactPhone !== undefined)
      updateData.emergencyContactPhone = dto.emergencyContactPhone?.trim() || null;
    if (dto.emergencyContactRelation !== undefined)
      updateData.emergencyContactRelation = dto.emergencyContactRelation?.trim() || null;
    if (dto.allergies !== undefined)
      updateData.allergies = dto.allergies?.trim() || null;
    if (dto.medicalHistory !== undefined)
      updateData.medicalHistory = dto.medicalHistory?.trim() || null;
    if (dto.surgicalHistory !== undefined)
      updateData.surgicalHistory = dto.surgicalHistory?.trim() || null;
    if (dto.familyHistory !== undefined)
      updateData.familyHistory = dto.familyHistory?.trim() || null;
    if (dto.currentMedications !== undefined)
      updateData.currentMedications = dto.currentMedications?.trim() || null;

    const updated = await this.prisma.patient.update({
      where: { id: BigInt(existing.id) },
      data: updateData,
    });

    return this.mapToDto(updated);
  }

  /**
   * Delete a patient record from PostgreSQL with active appointment constraint guard.
   */
  async remove(idOrPatientId: string | number, user?: AuthUser): Promise<{ message: string }> {
    const existing = await this.findById(idOrPatientId, user);
    if (user && this.branchAuth) {
      await this.branchAuth.assertResourceAccess(user, existing.branchId, 'patient');
    }
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
   * Check for potential duplicate patients within the authorized branch/tenant.
   */
  async checkDuplicates(
    query: CheckDuplicateQueryDto,
    user?: AuthUser,
  ): Promise<DuplicateCheckResponseDto> {
    const phone = query.phone?.trim();
    const cnic = this.formatCnic(query.cnic);
    const name = query.name?.trim();
    const birthdate = query.birthdate?.trim();

    if (!phone && !cnic && !(name && birthdate)) {
      return { hasMatch: false, matchCount: 0, matches: [] };
    }

    let branchFilter: Record<string, unknown> = {};
    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      const accessibleBranches = await this.branchAuth.resolveAccessibleBranchIds(user);

      if (query.branchId) {
        const authorizedBranchId = await this.branchAuth.assertBranchAccess(user, query.branchId);
        branchFilter = { branchId: authorizedBranchId };
      } else {
        const branchIds = accessibleBranches || [];
        branchFilter = { branchId: { in: branchIds } };
      }
    } else if (query.branchId && user && this.branchAuth) {
      const authorizedBranchId = await this.branchAuth.assertBranchAccess(user, query.branchId);
      branchFilter = { branchId: authorizedBranchId };
    }

    const orConditions: Array<Record<string, unknown>> = [];

    if (phone) {
      orConditions.push({ phone });
      orConditions.push({ altPhone: phone });
    }
    if (cnic) {
      orConditions.push({ cnic });
    }
    if (name && birthdate) {
      orConditions.push({
        AND: [
          { name: { equals: name, mode: 'insensitive' as const } },
          { birthdate },
        ],
      });
    }

    const matchedPatients = await this.prisma.patient.findMany({
      where: {
        ...branchFilter,
        OR: orConditions,
      },
      take: 10,
    });

    const matches: DuplicateMatchItemDto[] = matchedPatients.map((p) => {
      const matchedOn: string[] = [];
      if (phone && (p.phone === phone || p.altPhone === phone)) {
        matchedOn.push('phone');
      }
      if (cnic && p.cnic === cnic) {
        matchedOn.push('cnic');
      }
      if (
        name &&
        birthdate &&
        p.name.toLowerCase() === name.toLowerCase() &&
        p.birthdate === birthdate
      ) {
        matchedOn.push('name_birthdate');
      }
      return {
        patient: this.mapToDto(p),
        matchedOn,
      };
    });

    return {
      hasMatch: matches.length > 0,
      matchCount: matches.length,
      matches,
    };
  }

  /**
   * Retrieves aggregated clinical encounter history across outpatient modules.
   */
  async getEncounterHistory(
    idOrPatientId: string | number,
    user?: AuthUser,
  ): Promise<PatientEncounterResponseDto> {
    const patientDto = await this.findById(idOrPatientId, user);
    const patientBigInt = BigInt(patientDto.id);

    const [appointments, consultations, prescriptions, labs, invoices] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { patientId: patientBigInt },
        include: { doctor: true },
        orderBy: { id: 'desc' },
        take: 50,
      }),
      this.prisma.consultation.findMany({
        where: { patientId: patientBigInt },
        include: { doctor: true },
        orderBy: { id: 'desc' },
        take: 50,
      }),
      this.prisma.prescription.findMany({
        where: { patientId: patientBigInt },
        include: { doctor: true, medicines: true },
        orderBy: { id: 'desc' },
        take: 50,
      }),
      this.prisma.lab.findMany({
        where: { patientId: patientBigInt },
        orderBy: { id: 'desc' },
        take: 50,
      }),
      this.prisma.payment.findMany({
        where: { patientId: patientBigInt },
        orderBy: { id: 'desc' },
        take: 50,
      }),
    ]);

    const mappedAppointments: EncounterAppointmentDto[] = appointments.map((a) => ({
      id: a.id.toString(),
      date: a.addDate || a.date || '',
      time: a.timeSlot || null,
      doctorName: a.doctor?.name || null,
      status: a.status || 'scheduled',
      type: a.visitType || 'first_visit',
    }));

    const mappedConsultations: EncounterConsultationDto[] = consultations.map((c) => ({
      id: c.id.toString(),
      date: c.createdAt ? c.createdAt.toISOString() : c.date.toISOString(),
      doctorName: c.doctor?.name || null,
      diagnosis: c.diagnosis || c.provisionalDiagnosis || null,
      symptoms: c.presentingComplaint || null,
      notes: c.plan || null,
      status: c.status || 'draft',
    }));

    const mappedPrescriptions: EncounterPrescriptionDto[] = prescriptions.map((pr) => {
      const medNames = (pr.medicines || []).map((m) => m.name).filter(Boolean);
      return {
        id: pr.id.toString(),
        date: pr.date || '',
        doctorName: pr.doctor?.name || null,
        itemCount: medNames.length,
        medicines: medNames,
      };
    });

    const mappedLabs: EncounterLabDto[] = labs.map((l) => ({
      id: l.id.toString(),
      date: l.date || '',
      testName: l.category || 'Laboratory Test',
      status: l.status || 'ORDERED',
    }));

    let totalInvoiced = 0;
    let totalPaid = 0;
    const mappedInvoices: EncounterInvoiceDto[] = invoices.map((inv) => {
      const gross = Number(inv.grossTotal || 0);
      const paid = Number(inv.amountReceived || 0);
      totalInvoiced += gross;
      totalPaid += paid;
      return {
        id: inv.id.toString(),
        date: inv.date || '',
        amount: gross,
        paidAmount: paid,
        status: inv.status || 'unpaid',
      };
    });

    return {
      patientId: patientDto.id,
      summary: {
        totalAppointments: mappedAppointments.length,
        totalConsultations: mappedConsultations.length,
        totalPrescriptions: mappedPrescriptions.length,
        totalLabs: mappedLabs.length,
        totalInvoiced,
        outstandingBalance: Math.max(0, totalInvoiced - totalPaid),
      },
      appointments: mappedAppointments,
      consultations: mappedConsultations,
      prescriptions: mappedPrescriptions,
      labs: mappedLabs,
      invoices: mappedInvoices,
    };
  }

  /**
   * Retrieves uploaded clinical documents and reports for a patient.
   */
  async getDocuments(
    idOrPatientId: string | number,
    user?: AuthUser,
  ): Promise<PatientDocumentResponseDto[]> {
    const patientDto = await this.findById(idOrPatientId, user);
    const docs = await this.prisma.patientDocument.findMany({
      where: { patientId: BigInt(patientDto.id) },
      include: { uploadedBy: true },
      orderBy: { id: 'desc' },
    });

    return docs.map((d) => ({
      id: d.id.toString(),
      patientId: d.patientId.toString(),
      branchId: d.branchId ? d.branchId.toString() : null,
      title: d.title,
      documentType: d.documentType,
      fileUrl: d.fileUrl,
      fileSize: d.fileSize || null,
      mimeType: d.mimeType || null,
      notes: d.notes || null,
      uploadedByName: d.uploadedBy ? `${d.uploadedBy.firstName} ${d.uploadedBy.lastName}`.trim() : null,
      createdAt: d.createdAt ? d.createdAt.toISOString() : null,
    }));
  }

  /**
   * Attaches a document or external medical report to a patient.
   */
  async addDocument(
    idOrPatientId: string | number,
    dto: CreatePatientDocumentDto,
    user?: AuthUser,
  ): Promise<PatientDocumentResponseDto> {
    const patientDto = await this.findById(idOrPatientId, user);
    let targetBranchId: bigint | null = patientDto.branchId ? BigInt(patientDto.branchId) : null;

    if (dto.branchId && user && this.branchAuth) {
      targetBranchId = await this.branchAuth.assertBranchAccess(user, dto.branchId);
    }

    const doc = await this.prisma.patientDocument.create({
      data: {
        patientId: BigInt(patientDto.id),
        branchId: targetBranchId,
        title: dto.title.trim(),
        documentType: dto.documentType?.trim() || 'GENERAL',
        fileUrl: dto.fileUrl.trim(),
        fileSize: dto.fileSize || null,
        mimeType: dto.mimeType?.trim() || null,
        notes: dto.notes?.trim() || null,
        uploadedById: user ? BigInt(user.id) : null,
      },
      include: { uploadedBy: true },
    });

    return {
      id: doc.id.toString(),
      patientId: doc.patientId.toString(),
      branchId: doc.branchId ? doc.branchId.toString() : null,
      title: doc.title,
      documentType: doc.documentType,
      fileUrl: doc.fileUrl,
      fileSize: doc.fileSize || null,
      mimeType: doc.mimeType || null,
      notes: doc.notes || null,
      uploadedByName: doc.uploadedBy ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`.trim() : null,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
    };
  }

  /**
   * Removes a patient document.
   */
  async removeDocument(
    idOrPatientId: string | number,
    docId: string | number,
    user?: AuthUser,
  ): Promise<{ message: string }> {
    const patientDto = await this.findById(idOrPatientId, user);
    const doc = await this.prisma.patientDocument.findFirst({
      where: {
        id: BigInt(docId),
        patientId: BigInt(patientDto.id),
      },
    });

    if (!doc) {
      throw new NotFoundException(`Document #${docId} not found for patient #${patientDto.patientId}`);
    }

    await this.prisma.patientDocument.delete({
      where: { id: doc.id },
    });

    return { message: `Document #${docId} successfully removed.` };
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
      emergencyContactName: p.emergencyContactName || null,
      emergencyContactPhone: p.emergencyContactPhone || null,
      emergencyContactRelation: p.emergencyContactRelation || null,
      allergies: p.allergies || null,
      medicalHistory: p.medicalHistory || null,
      surgicalHistory: p.surgicalHistory || null,
      familyHistory: p.familyHistory || null,
      currentMedications: p.currentMedications || null,
      createdAt: p.createdAt ? p.createdAt.toISOString() : null,
      updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
    };
  }
}
