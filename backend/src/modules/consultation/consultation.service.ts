import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppointmentService } from '../appointment/appointment.service';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConsultTemplateDto } from './dto/consult-template.dto';
import { ConsultationQueryDto } from './dto/consultation-query.dto';
import {
  ConsultTemplateResponseDto,
  ConsultationResponseDto,
  PaginatedConsultationsDto,
  VisitConsultationContextDto,
} from './dto/consultation-response.dto';
import { SaveConsultationDto } from './dto/save-consultation.dto';

const TEMPLATE_FIELDS = [
  'presenting_complaint',
  'history',
  'provisional_diagnosis',
  'diagnosis',
  'plan',
  'treatment',
  'follow_up_notes',
  'allergies',
] as const;

@Injectable()
export class ConsultationService {
  private readonly logger = new Logger(ConsultationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patientService: PatientService,
    private readonly doctorService: DoctorService,
    private readonly appointmentService: AppointmentService,
  ) {}

  /**
   * Helper to derive obstetric dates (EDD, Gestational Age) from Last Menstrual Period (LMP).
   * Uses Naegele's rule: EDD = LMP + 1 year - 3 months + 7 days (or + 280 days).
   */
  static obstetricDates(
    lmp?: string | null,
    asOfDate?: string | null,
  ): [string | null, string | null] {
    if (!lmp || typeof lmp !== 'string') {
      return [null, null];
    }

    const lmpDate = new Date(lmp);
    if (isNaN(lmpDate.getTime())) {
      return [null, null];
    }

    const eddDate = new Date(lmpDate);
    eddDate.setDate(eddDate.getDate() + 280);
    const edd = eddDate.toISOString().split('T')[0];

    const today = asOfDate ? new Date(asOfDate) : new Date();
    const diffMs = today.getTime() - lmpDate.getTime();
    if (diffMs < 0) {
      return [edd, '0w 0d'];
    }

    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(totalDays / 7);
    const days = totalDays % 7;
    const ga = `${weeks}w ${days}d`;

    return [edd, ga];
  }

  /**
   * Loads complete clinical context for an outpatient encounter.
   */
  async getVisitConsultationContext(
    appointmentIdOrKey: string | number,
  ): Promise<VisitConsultationContextDto> {
    const apptIdStr = String(appointmentIdOrKey);

    const visit = await this.appointmentService.findOne(apptIdStr);
    if (!visit) {
      throw new NotFoundException(`Visit #${apptIdStr} not found.`);
    }

    const patient = await this.patientService.findById(visit.patientId);
    if (!patient) {
      throw new NotFoundException(`Patient #${visit.patientId} not found.`);
    }

    const doctor = visit.doctorId
      ? await this.doctorService.findById(visit.doctorId).catch(() => null)
      : null;

    // 1. Find existing consultation or draft for this visit
    let consultationDto: ConsultationResponseDto | null = null;
    const found = await this.prisma.consultation.findUnique({
      where: { appointmentId: BigInt(apptIdStr) },
      include: { patient: true, doctor: true, appointment: true },
    });
    if (found) {
      consultationDto = this.formatConsultation(found);
    }

    // 2. If no consultation exists yet, carry forward allergies and past history from last visit
    if (!consultationDto) {
      const lastConsult = await this.prisma.consultation.findFirst({
        where: { patientId: BigInt(patient.id) },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
      });

      consultationDto = {
        id: '',
        appointmentId: apptIdStr,
        patientId: patient.id,
        doctorId: doctor ? doctor.id : null,
        date: visit.date || new Date().toISOString().split('T')[0],
        presentingComplaint: null,
        history: null,
        examination: null,
        provisionalDiagnosis: null,
        diagnosis: null,
        plan: null,
        treatment: null,
        followUpDate: null,
        followUpNotes: null,
        allergies: lastConsult ? (lastConsult.allergies || null) : null,
        pastHistory: lastConsult ? (lastConsult.pastHistory as Record<string, unknown> | null) : null,
        socialHistory: lastConsult ? (lastConsult.socialHistory as Record<string, unknown> | null) : null,
        specialty: null,
        immunizations: lastConsult ? (lastConsult.immunizations as Record<string, unknown> | null) : null,
        status: 'draft',
        completedAt: null,
        createdBy: null,
        patient: {
          id: patient.id,
          patientId: patient.patientId || '',
          name: patient.name,
          sex: patient.sex || null,
          age: patient.age || null,
          phone: patient.phone || null,
        },
        doctor: doctor
          ? {
              id: doctor.id,
              name: doctor.name,
              department: doctor.department || null,
            }
          : undefined,
        visit: {
          id: visit.id,
          date: visit.date,
          timeSlot: visit.timeSlot,
          status: visit.status,
          bp: visit.bp,
          pulse: visit.pulse,
          temperature: visit.temperature,
          weight: visit.weight,
        },
      };
    }

    // 3. Find previous 5 consultations for this patient
    const prevDb = await this.prisma.consultation.findMany({
      where: {
        patientId: BigInt(patient.id),
        NOT: consultationDto.id ? { id: BigInt(consultationDto.id) } : undefined,
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: 5,
      include: { patient: true, doctor: true, appointment: true },
    });
    const previous = prevDb.map((c) => this.formatConsultation(c));

    // 4. Find available templates (general or doctor-specific)
    const templates = await this.listTemplates(doctor ? doctor.id : undefined);

    return {
      consultation: consultationDto,
      visit: {
        id: visit.id,
        date: visit.date,
        timeSlot: visit.timeSlot,
        status: visit.status,
        bp: visit.bp,
        pulse: visit.pulse,
        temperature: visit.temperature,
        weight: visit.weight,
      },
      patient: {
        id: patient.id,
        patientId: patient.patientId || '',
        name: patient.name,
        sex: patient.sex || null,
        age: patient.age || null,
        phone: patient.phone || null,
      },
      doctor: doctor
        ? {
            id: doctor.id,
            name: doctor.name,
            department: doctor.department || null,
          }
        : undefined,
      previous,
      templates,
    };
  }

  /**
   * Alias for getVisitConsultationContext.
   */
  async getVisitContext(
    appointmentIdOrKey: string | number,
  ): Promise<VisitConsultationContextDto> {
    return this.getVisitConsultationContext(appointmentIdOrKey);
  }

  /**
   * Save, update, or complete an outpatient consultation in PostgreSQL.
   * Atomic 1:1 constraint with appointment and immutable completed consultations.
   */
  async saveVisitConsultation(
    appointmentIdOrKey: string | number,
    dto: SaveConsultationDto,
    userId = '',
  ): Promise<ConsultationResponseDto> {
    const apptIdStr = String(appointmentIdOrKey);

    const visit = await this.appointmentService.findOne(apptIdStr);
    if (!visit) {
      throw new NotFoundException(`Visit #${apptIdStr} not found.`);
    }

    const patient = await this.patientService.findById(visit.patientId);
    if (!patient) {
      throw new NotFoundException(`Patient #${visit.patientId} not found.`);
    }

    const doctor = visit.doctorId
      ? await this.doctorService.findById(visit.doctorId).catch(() => null)
      : null;

    // Clean JSON structures: omit null, empty strings, and empty arrays
    const cleanObject = (obj: unknown): unknown => {
      if (!obj || typeof obj !== 'object') return obj;
      const res: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)) {
          res[k] = typeof v === 'object' && !Array.isArray(v) ? cleanObject(v) : v;
        }
      }
      return Object.keys(res).length > 0 ? res : null;
    };

    // Calculate gynae EDD and gestational age if LMP is present
    const gynaeClean = (cleanObject(dto.gynae) || {}) as Record<string, string>;
    if (gynaeClean.lmp) {
      const [edd, ga] = ConsultationService.obstetricDates(gynaeClean.lmp);
      if (edd) gynaeClean.edd = edd;
      if (ga) gynaeClean.gestational_age = ga;
    }

    const specialtyClean = cleanObject({
      gynae: Object.keys(gynaeClean).length > 0 ? gynaeClean : undefined,
      dental: cleanObject(dto.dental),
      eye: cleanObject(dto.eye),
    });

    const examClean = cleanObject(dto.exam ?? dto.examination);
    const pastClean = cleanObject(dto.past ?? dto.past_history);
    const socialClean = cleanObject(dto.social ?? dto.social_history);
    const vaccinesClean = cleanObject(dto.vaccines);

    const action = dto.action || 'save';
    const isComplete = action === 'complete';
    const consultStatus = isComplete ? 'completed' : 'draft';
    const now = new Date();

    return await this.prisma.$transaction(async (tx) => {
      let c = await tx.consultation.findUnique({
        where: { appointmentId: BigInt(apptIdStr) },
      });

      const consultData: Prisma.ConsultationUncheckedCreateWithoutAppointmentInput = {
        patientId: BigInt(patient.id),
        doctorId: doctor ? BigInt(doctor.id) : null,
        date: new Date(visit.date || now.toISOString().split('T')[0]),
        presentingComplaint: dto.presenting_complaint ?? null,
        history: dto.history ?? null,
        provisionalDiagnosis: dto.provisional_diagnosis ?? null,
        diagnosis: dto.diagnosis ?? null,
        plan: dto.plan ?? null,
        treatment: dto.treatment ?? null,
        followUpDate: dto.follow_up_date ? new Date(dto.follow_up_date) : null,
        followUpNotes: dto.follow_up_notes ?? null,
        allergies: dto.allergies ?? null,
        examination: (examClean ?? undefined) as Prisma.InputJsonValue | undefined,
        pastHistory: (pastClean ?? undefined) as Prisma.InputJsonValue | undefined,
        socialHistory: (socialClean ?? undefined) as Prisma.InputJsonValue | undefined,
        specialty: (specialtyClean ?? undefined) as Prisma.InputJsonValue | undefined,
        immunizations: (vaccinesClean ?? undefined) as Prisma.InputJsonValue | undefined,
        status: consultStatus,
        completedAt: isComplete ? now : c?.completedAt,
        createdBy: c?.createdBy || (userId ? BigInt(userId) : null),
      };

      // Update visit vitals on Appointment atomically
      const updateVisitData: Record<string, unknown> = {};
      if (dto.b_p !== undefined) updateVisitData.bp = dto.b_p;
      if (dto.pulse !== undefined) updateVisitData.pulse = dto.pulse;
      if (dto.temprature !== undefined) updateVisitData.temperature = dto.temprature;
      if (dto.weight !== undefined) updateVisitData.weight = dto.weight;

      if (isComplete) {
        updateVisitData.status = 'completed';
        updateVisitData.checkedOutAt = now;
        if (!visit.consultStartedAt) updateVisitData.consultStartedAt = now;
      } else if (['scheduled', 'arrived'].includes(visit.status)) {
        updateVisitData.status = 'in consultation';
        if (!visit.consultStartedAt) updateVisitData.consultStartedAt = now;
        if (!visit.checkedInAt) updateVisitData.checkedInAt = now;
      }

      if (Object.keys(updateVisitData).length > 0) {
        await tx.appointment.update({
          where: { id: BigInt(apptIdStr) },
          data: updateVisitData,
        });
      }

      if (c) {
        if (c.status === 'completed') {
          throw new BadRequestException('Cannot modify a completed consultation record.');
        }
        c = await tx.consultation.update({
          where: { id: c.id },
          data: consultData,
          include: { patient: true, doctor: true, appointment: true },
        });
      } else {
        c = await tx.consultation.create({
          data: {
            appointmentId: BigInt(apptIdStr),
            ...consultData,
          },
          include: { patient: true, doctor: true, appointment: true },
        });
      }

      // Save template if requested
      if (dto.template_name && dto.template_name.trim() !== '') {
        const templateFields: Record<string, unknown> = {};
        const dtoRecord = dto as unknown as Record<string, unknown>;
        for (const field of TEMPLATE_FIELDS) {
          if (dtoRecord[field] !== undefined) {
            templateFields[field] = dtoRecord[field];
          }
        }

        await tx.consultTemplate.create({
          data: {
            name: dto.template_name.trim(),
            doctorId: doctor ? BigInt(doctor.id) : null,
            fields: templateFields as Prisma.InputJsonValue,
          },
        });
      }

      return this.formatConsultation(c);
    });
  }

  /**
   * List consultations with filtering and pagination.
   */
  async findAll(query: ConsultationQueryDto): Promise<PaginatedConsultationsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

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

    const where: Record<string, unknown> = {};
    if (targetDate) {
      where.date = new Date(targetDate);
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
      this.prisma.consultation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        include: {
          patient: true,
          doctor: true,
          appointment: true,
        },
      }),
      this.prisma.consultation.count({ where }),
    ]);

    return {
      data: records.map((r) => this.formatConsultation(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find a single consultation by ID.
   */
  async findOne(idOrKey: string | number): Promise<ConsultationResponseDto> {
    const idStr = String(idOrKey);

    const found = await this.prisma.consultation.findUnique({
      where: { id: BigInt(idStr) },
      include: { patient: true, doctor: true, appointment: true },
    });

    if (!found) {
      throw new NotFoundException(`Consultation #${idStr} not found.`);
    }

    return this.formatConsultation(found);
  }

  /**
   * Printable summary for clinical report generation.
   */
  async printout(idOrKey: string | number): Promise<ConsultationResponseDto> {
    return this.findOne(idOrKey);
  }

  // --- Reusable Note Templates ---

  /**
   * List consult templates available to a doctor or hospital-wide.
   */
  async listTemplates(doctorId?: string | number): Promise<ConsultTemplateResponseDto[]> {
    const docIdStr = doctorId ? String(doctorId) : undefined;

    const templates = await this.prisma.consultTemplate.findMany({
      where: {
        OR: [
          { doctorId: null },
          ...(docIdStr ? [{ doctorId: BigInt(docIdStr) }] : []),
        ],
      },
      orderBy: { name: 'asc' },
    });

    return templates.map((t) => ({
      id: t.id.toString(),
      name: t.name,
      doctorId: t.doctorId ? t.doctorId.toString() : null,
      fields: t.fields,
      createdAt: t.createdAt ? t.createdAt.toISOString() : null,
    }));
  }

  /**
   * Create a new consultation note template.
   */
  async createTemplate(dto: CreateConsultTemplateDto): Promise<ConsultTemplateResponseDto> {
    const docIdStr = dto.doctorId ? String(dto.doctorId) : null;

    const created = await this.prisma.consultTemplate.create({
      data: {
        name: dto.name,
        doctorId: docIdStr ? BigInt(docIdStr) : null,
        fields: dto.fields as Prisma.InputJsonValue,
      },
    });

    return {
      id: created.id.toString(),
      name: created.name,
      doctorId: created.doctorId ? created.doctorId.toString() : null,
      fields: created.fields,
      createdAt: created.createdAt ? created.createdAt.toISOString() : null,
    };
  }

  /**
   * Remove a consult template.
   */
  async removeTemplate(idOrKey: string | number): Promise<{ message: string }> {
    const idStr = String(idOrKey);

    await this.prisma.consultTemplate.delete({
      where: { id: BigInt(idStr) },
    });

    return { message: 'Template removed.' };
  }

  // --- Formatters ---

  private formatConsultation(c: any): ConsultationResponseDto {
    const dateStr =
      c.date instanceof Date
        ? c.date.toISOString().split('T')[0]
        : String(c.date);

    return {
      id: c.id.toString(),
      appointmentId: c.appointmentId ? c.appointmentId.toString() : null,
      patientId: c.patientId.toString(),
      doctorId: c.doctorId ? c.doctorId.toString() : null,
      date: dateStr,
      presentingComplaint: c.presentingComplaint || null,
      history: c.history || null,
      examination: c.examination || null,
      provisionalDiagnosis: c.provisionalDiagnosis || null,
      diagnosis: c.diagnosis || null,
      plan: c.plan || null,
      treatment: c.treatment || null,
      followUpDate: c.followUpDate
        ? c.followUpDate instanceof Date
          ? c.followUpDate.toISOString().split('T')[0]
          : String(c.followUpDate)
        : null,
      followUpNotes: c.followUpNotes || null,
      allergies: c.allergies || null,
      pastHistory: c.pastHistory || null,
      socialHistory: c.socialHistory || null,
      specialty: c.specialty || null,
      immunizations: c.immunizations || null,
      status: c.status,
      completedAt: c.completedAt ? c.completedAt.toISOString() : null,
      createdBy: c.createdBy ? c.createdBy.toString() : null,
      patient: c.patient
        ? {
            id: c.patient.id.toString(),
            patientId: c.patient.patientId || '',
            name: c.patient.name,
            sex: c.patient.sex || null,
            age: c.patient.age || null,
            phone: c.patient.phone || null,
          }
        : undefined,
      doctor: c.doctor
        ? {
            id: c.doctor.id.toString(),
            name: c.doctor.name,
            department: c.doctor.department || null,
          }
        : undefined,
      visit: c.appointment
        ? {
            id: c.appointment.id.toString(),
            date: c.appointment.date,
            timeSlot: c.appointment.timeSlot || '',
            status: c.appointment.status,
            bp: c.appointment.bp || null,
            pulse: c.appointment.pulse || null,
            temperature: c.appointment.temperature || null,
            weight: c.appointment.weight || null,
          }
        : undefined,
      createdAt: c.createdAt ? c.createdAt.toISOString() : null,
      updatedAt: c.updatedAt ? c.updatedAt.toISOString() : null,
    };
  }
}
