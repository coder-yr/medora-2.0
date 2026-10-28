import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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

interface MemoryConsultation {
  id: string;
  appointmentId: string | null;
  patientId: string;
  doctorId: string | null;
  date: string;
  presentingComplaint: string | null;
  history: string | null;
  examination: any | null;
  provisionalDiagnosis: string | null;
  diagnosis: string | null;
  plan: string | null;
  treatment: string | null;
  followUpDate: string | null;
  followUpNotes: string | null;
  allergies: string | null;
  pastHistory: any | null;
  socialHistory: any | null;
  specialty: any | null;
  immunizations: any | null;
  status: string;
  completedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MemoryConsultTemplate {
  id: string;
  name: string;
  doctorId: string | null;
  fields: any;
  createdAt: Date;
  updatedAt: Date;
}

const TEMPLATE_FIELDS = [
  'presenting_complaint',
  'history',
  'provisional_diagnosis',
  'diagnosis',
  'plan',
  'treatment',
  'follow_up_notes',
];

@Injectable()
export class ConsultationService {
  private readonly logger = new Logger(ConsultationService.name);

  // In-memory fallback stores for test isolation and offline resilience
  private memoryConsultations: Map<string, MemoryConsultation> = new Map();
  private memoryTemplates: Map<string, MemoryConsultTemplate> = new Map();
  private nextId = 1;
  private nextTemplateId = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly patientService: PatientService,
    private readonly doctorService: DoctorService,
    private readonly appointmentService: AppointmentService,
  ) {}


  /**
   * Expected date of delivery from last menstrual period (Naegele's rule: LMP + 280 days)
   * and gestational age in weeks and days.
   */
  static obstetricDates(
    lmp: string | null | undefined,
    on?: string | null,
  ): [string | null, string | null] {
    if (!lmp) {
      return [null, null];
    }

    const lmpDate = new Date(lmp);
    if (isNaN(lmpDate.getTime())) {
      return [null, null];
    }

    // EDD = LMP + 280 days
    const eddDate = new Date(lmpDate);
    eddDate.setDate(eddDate.getDate() + 280);
    const eddStr = eddDate.toISOString().split('T')[0];

    // Gestational age today or on specified date
    const targetDate = on ? new Date(on) : new Date();
    const diffMs = targetDate.getTime() - lmpDate.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const gaStr =
      days >= 0
        ? `${Math.floor(days / 7)}w ${days % 7}d`
        : null;

    return [eddStr, gaStr];
  }

  /**
   * Load context for starting or viewing an outpatient consultation.
   * Automatically carries forward allergies and past history from the patient's previous visit.
   */
  async getVisitContext(
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
    if (this.prisma.connected) {
      try {
        const found = await this.prisma.consultation.findUnique({
          where: { appointmentId: BigInt(apptIdStr) },
          include: { patient: true, doctor: true, appointment: true },
        });
        if (found) {
          consultationDto = this.formatConsultation(found);
        }
      } catch (err: any) {
        this.logger.warn(`Prisma findUnique consultation failed: ${err.message}.`);
      }
    }

    if (!consultationDto) {
      const memoryMatch = Array.from(this.memoryConsultations.values()).find(
        (c) => c.appointmentId === apptIdStr,
      );
      if (memoryMatch) {
        consultationDto = this.formatMemoryConsultation(memoryMatch, patient, doctor, visit);
      }
    }

    // 2. If no consultation exists yet, carry forward allergies and past history from last visit
    if (!consultationDto) {
      let lastConsult: any = null;
      if (this.prisma.connected) {
        try {
          lastConsult = await this.prisma.consultation.findFirst({
            where: { patientId: BigInt(patient.id) },
            orderBy: [{ date: 'desc' }, { id: 'desc' }],
          });
        } catch (err: any) {
          this.logger.warn(`Prisma findFirst last consultation failed: ${err.message}.`);
        }
      }

      if (!lastConsult) {
        lastConsult = Array.from(this.memoryConsultations.values())
          .filter((c) => c.patientId === patient.id)
          .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id))[0];
      }

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
        pastHistory: lastConsult ? (lastConsult.pastHistory || null) : null,
        socialHistory: lastConsult ? (lastConsult.socialHistory || null) : null,
        specialty: null,
        immunizations: lastConsult ? (lastConsult.immunizations || null) : null,
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
    let previous: ConsultationResponseDto[] = [];
    if (this.prisma.connected) {
      try {
        const prevDb = await this.prisma.consultation.findMany({
          where: {
            patientId: BigInt(patient.id),
            NOT: consultationDto.id ? { id: BigInt(consultationDto.id) } : undefined,
          },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: 5,
          include: { patient: true, doctor: true },
        });
        previous = prevDb.map((c) => this.formatConsultation(c));
      } catch (err: any) {
        this.logger.warn(`Prisma findMany previous consultations failed: ${err.message}.`);
      }
    }

    if (previous.length === 0) {
      previous = Array.from(this.memoryConsultations.values())
        .filter(
          (c) =>
            c.patientId === patient.id &&
            c.id !== consultationDto.id,
        )
        .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id))
        .slice(0, 5)
        .map((m) => this.formatMemoryConsultation(m, patient, doctor));
    }

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
   * Save, update, or complete an outpatient consultation.
   * Updates encounter vitals on the appointment record and transitions appointment status.
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
    const cleanObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      const res: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)) {
          res[k] = typeof v === 'object' && !Array.isArray(v) ? cleanObject(v) : v;
        }
      }
      return Object.keys(res).length > 0 ? res : null;
    };

    // Calculate gynae EDD and gestational age if LMP is present
    const gynaeClean = cleanObject(dto.gynae) || {};
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

    // 1. Transaction via Prisma if connected
    if (this.prisma.connected) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          let c = await tx.consultation.findUnique({
            where: { appointmentId: BigInt(apptIdStr) },
          });

          const consultData: any = {
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
            examination: examClean ?? undefined,
            pastHistory: pastClean ?? undefined,
            socialHistory: socialClean ?? undefined,
            specialty: specialtyClean ?? undefined,
            immunizations: vaccinesClean ?? undefined,
            status: consultStatus,
            completedAt: isComplete ? now : c?.completedAt,
            createdBy: c?.createdBy || (userId ? BigInt(userId) : null),
          };

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

          // Update visit vitals on Appointment
          const updateVisitData: any = {};
          if (dto.b_p !== undefined) updateVisitData.bp = dto.b_p;
          if (dto.pulse !== undefined) updateVisitData.pulse = dto.pulse;
          if (dto.temprature !== undefined) updateVisitData.temperature = dto.temprature;
          if (dto.weight !== undefined) updateVisitData.weight = dto.weight;

          if (isComplete) {
            updateVisitData.status = 'completed';
            updateVisitData.checkedOutAt = now;
            if (!visit.consultStartedAt) updateVisitData.consultStartedAt = now;
          } else if (['scheduled', 'arrived'].includes(visit.status)) {
            // Opening and saving a consultation moves visit to 'in consultation'
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

          // Save template if requested
          if (dto.template_name && dto.template_name.trim() !== '') {
            const templateFields: Record<string, any> = {};
            for (const field of TEMPLATE_FIELDS) {
              const camelKey = field.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
              if ((c as any)[camelKey] || (dto as any)[field]) {
                templateFields[field] = (c as any)[camelKey] || (dto as any)[field];
              }
            }

            await tx.consultTemplate.create({
              data: {
                name: dto.template_name.trim(),
                doctorId: doctor ? BigInt(doctor.id) : null,
                fields: templateFields,
              },
            });
          }

          return this.formatConsultation(c);
        });
      } catch (err: any) {
        if (err instanceof BadRequestException) {
          throw err;
        }
        this.logger.warn(`Prisma saveVisitConsultation failed: ${err.message}. Using fallback.`);
      }
    }

    // 2. In-memory fallback
    let memoryMatch = Array.from(this.memoryConsultations.values()).find(
      (c) => c.appointmentId === apptIdStr,
    );

    if (memoryMatch && memoryMatch.status === 'completed') {
      throw new BadRequestException('Cannot modify a completed consultation record.');
    }

    if (!memoryMatch) {
      const newId = (this.nextId++).toString();
      memoryMatch = {
        id: newId,
        appointmentId: apptIdStr,
        patientId: patient.id,
        doctorId: doctor ? doctor.id : null,
        date: visit.date || now.toISOString().split('T')[0],
        presentingComplaint: null,
        history: null,
        examination: null,
        provisionalDiagnosis: null,
        diagnosis: null,
        plan: null,
        treatment: null,
        followUpDate: null,
        followUpNotes: null,
        allergies: null,
        pastHistory: null,
        socialHistory: null,
        specialty: null,
        immunizations: null,
        status: 'draft',
        completedAt: null,
        createdBy: userId || null,
        createdAt: now,
        updatedAt: now,
      };
      this.memoryConsultations.set(newId, memoryMatch);
    }

    memoryMatch.presentingComplaint = dto.presenting_complaint ?? memoryMatch.presentingComplaint;
    memoryMatch.history = dto.history ?? memoryMatch.history;
    memoryMatch.provisionalDiagnosis = dto.provisional_diagnosis ?? memoryMatch.provisionalDiagnosis;
    memoryMatch.diagnosis = dto.diagnosis ?? memoryMatch.diagnosis;
    memoryMatch.plan = dto.plan ?? memoryMatch.plan;
    memoryMatch.treatment = dto.treatment ?? memoryMatch.treatment;
    memoryMatch.followUpDate = dto.follow_up_date ?? memoryMatch.followUpDate;
    memoryMatch.followUpNotes = dto.follow_up_notes ?? memoryMatch.followUpNotes;
    memoryMatch.allergies = dto.allergies ?? memoryMatch.allergies;
    if (examClean) memoryMatch.examination = examClean;
    if (pastClean) memoryMatch.pastHistory = pastClean;
    if (socialClean) memoryMatch.socialHistory = socialClean;
    if (specialtyClean) memoryMatch.specialty = specialtyClean;
    if (vaccinesClean) memoryMatch.immunizations = vaccinesClean;
    memoryMatch.status = consultStatus;
    if (isComplete) memoryMatch.completedAt = now;
    memoryMatch.updatedAt = now;

    // Update appointment visit in memory
    const apptUpdate: any = {};
    if (dto.b_p !== undefined) apptUpdate.b_p = dto.b_p;
    if (dto.pulse !== undefined) apptUpdate.pulse = dto.pulse;
    if (dto.temprature !== undefined) apptUpdate.temprature = dto.temprature;
    if (dto.weight !== undefined) apptUpdate.weight = dto.weight;

    if (isComplete) {
      apptUpdate.status = 'completed';
    } else if (['scheduled', 'arrived'].includes(visit.status)) {
      apptUpdate.status = 'in consultation';
    }

    await this.appointmentService.update(apptIdStr, apptUpdate);

    // Save template in memory if requested
    if (dto.template_name && dto.template_name.trim() !== '') {
      const templateFields: Record<string, any> = {};
      for (const field of TEMPLATE_FIELDS) {
        if ((dto as any)[field]) {
          templateFields[field] = (dto as any)[field];
        }
      }
      this.createTemplate({
        name: dto.template_name.trim(),
        doctorId: doctor ? doctor.id : undefined,
        fields: templateFields,
      });
    }

    const updatedVisit = await this.appointmentService.findOne(apptIdStr);
    return this.formatMemoryConsultation(memoryMatch, patient, doctor, updatedVisit);
  }

  /**
   * List consultations with day-view filtering by date, doctor, or patient.
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

    if (this.prisma.connected) {
      try {
        const where: any = {};
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
      } catch (err: any) {
        this.logger.warn(`Prisma findAll consultations failed: ${err.message}.`);
      }
    }

    // In-memory fallback
    let matches = Array.from(this.memoryConsultations.values());

    if (targetDate) {
      matches = matches.filter((c) => c.date === targetDate);
    }
    if (doctorIdStr) {
      matches = matches.filter((c) => c.doctorId === doctorIdStr);
    }
    if (patientIdStr) {
      matches = matches.filter((c) => c.patientId === patientIdStr);
    }
    if (status) {
      matches = matches.filter((c) => c.status === status);
    }

    matches.sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));

    const total = matches.length;
    const paged = matches.slice(skip, skip + limit);

    const data = await Promise.all(
      paged.map(async (m) => {
        const p = await this.patientService.findById(m.patientId);
        const d = m.doctorId ? await this.doctorService.findById(m.doctorId).catch(() => null) : null;
        const v = m.appointmentId ? await this.appointmentService.findOne(m.appointmentId).catch(() => null) : null;
        return this.formatMemoryConsultation(m, p, d, v);
      }),
    );

    return {
      data,
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

    if (this.prisma.connected) {
      try {
        const found = await this.prisma.consultation.findUnique({
          where: { id: BigInt(idStr) },
          include: { patient: true, doctor: true, appointment: true },
        });
        if (found) {
          return this.formatConsultation(found);
        }
      } catch (err: any) {
        this.logger.warn(`Prisma findOne consultation failed: ${err.message}.`);
      }
    }

    const memory = this.memoryConsultations.get(idStr);
    if (!memory) {
      throw new NotFoundException(`Consultation #${idStr} not found.`);
    }

    const p = await this.patientService.findById(memory.patientId);
    const d = memory.doctorId ? await this.doctorService.findById(memory.doctorId).catch(() => null) : null;
    const v = memory.appointmentId ? await this.appointmentService.findOne(memory.appointmentId).catch(() => null) : null;

    return this.formatMemoryConsultation(memory, p, d, v);
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

    if (this.prisma.connected) {
      try {
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
      } catch (err: any) {
        this.logger.warn(`Prisma listTemplates failed: ${err.message}.`);
      }
    }

    return Array.from(this.memoryTemplates.values())
      .filter((t) => !t.doctorId || t.doctorId === docIdStr)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({
        id: t.id,
        name: t.name,
        doctorId: t.doctorId,
        fields: t.fields,
        createdAt: t.createdAt.toISOString(),
      }));
  }

  /**
   * Create a new consultation note template.
   */
  async createTemplate(dto: CreateConsultTemplateDto): Promise<ConsultTemplateResponseDto> {
    const docIdStr = dto.doctorId ? String(dto.doctorId) : null;

    if (this.prisma.connected) {
      try {
        const created = await this.prisma.consultTemplate.create({
          data: {
            name: dto.name,
            doctorId: docIdStr ? BigInt(docIdStr) : null,
            fields: dto.fields,
          },
        });
        return {
          id: created.id.toString(),
          name: created.name,
          doctorId: created.doctorId ? created.doctorId.toString() : null,
          fields: created.fields,
          createdAt: created.createdAt ? created.createdAt.toISOString() : null,
        };
      } catch (err: any) {
        this.logger.warn(`Prisma createTemplate failed: ${err.message}.`);
      }
    }

    const id = (this.nextTemplateId++).toString();
    const memoryRecord: MemoryConsultTemplate = {
      id,
      name: dto.name,
      doctorId: docIdStr,
      fields: dto.fields,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.memoryTemplates.set(id, memoryRecord);

    return {
      id: memoryRecord.id,
      name: memoryRecord.name,
      doctorId: memoryRecord.doctorId,
      fields: memoryRecord.fields,
      createdAt: memoryRecord.createdAt.toISOString(),
    };
  }

  /**
   * Remove a consult template.
   */
  async removeTemplate(idOrKey: string | number): Promise<{ message: string }> {
    const idStr = String(idOrKey);

    if (this.prisma.connected) {
      try {
        await this.prisma.consultTemplate.delete({
          where: { id: BigInt(idStr) },
        });
        return { message: 'Template removed.' };
      } catch (err: any) {
        this.logger.warn(`Prisma delete template failed: ${err.message}.`);
      }
    }

    this.memoryTemplates.delete(idStr);
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

  private formatMemoryConsultation(
    m: MemoryConsultation,
    patient?: any,
    doctor?: any,
    visit?: any,
  ): ConsultationResponseDto {
    return {
      id: m.id,
      appointmentId: m.appointmentId,
      patientId: m.patientId,
      doctorId: m.doctorId,
      date: m.date,
      presentingComplaint: m.presentingComplaint,
      history: m.history,
      examination: m.examination,
      provisionalDiagnosis: m.provisionalDiagnosis,
      diagnosis: m.diagnosis,
      plan: m.plan,
      treatment: m.treatment,
      followUpDate: m.followUpDate,
      followUpNotes: m.followUpNotes,
      allergies: m.allergies,
      pastHistory: m.pastHistory,
      socialHistory: m.socialHistory,
      specialty: m.specialty,
      immunizations: m.immunizations,
      status: m.status,
      completedAt: m.completedAt ? m.completedAt.toISOString() : null,
      createdBy: m.createdBy,
      patient: patient
        ? {
            id: patient.id,
            patientId: patient.patientId || '',
            name: patient.name,
            sex: patient.sex || null,
            age: patient.age || null,
            phone: patient.phone || null,
          }
        : undefined,
      doctor: doctor
        ? {
            id: doctor.id,
            name: doctor.name,
            department: doctor.department || null,
          }
        : undefined,
      visit: visit
        ? {
            id: visit.id,
            date: visit.date,
            timeSlot: visit.timeSlot,
            status: visit.status,
            bp: visit.bp,
            pulse: visit.pulse,
            temperature: visit.temperature,
            weight: visit.weight,
          }
        : undefined,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  // --- Test Helpers ---

  /** Clear in-memory stores for test isolation */
  clearMemory(): void {
    this.memoryConsultations.clear();
    this.memoryTemplates.clear();
    this.nextId = 1;
    this.nextTemplateId = 1;
  }
}
