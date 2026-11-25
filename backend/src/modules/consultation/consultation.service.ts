import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { BranchAuthorizationService } from '../../common/services/branch-authorization.service';
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
import { AmendConsultationDto } from './dto/amend-consultation.dto';
import { DoctorDashboardSummaryDto } from './dto/doctor-dashboard.dto';
import {
  PatientClinicalChartDto,
  ChartDiagnosisDto,
  ChartVitalsDto,
} from './dto/patient-chart.dto';

const TEMPLATE_FIELDS = [
  'presenting_complaint',
  'history',
  'provisional_diagnosis',
  'diagnosis',
  'plan',
  'treatment',
  'follow_up_notes',
  'allergies',
  'soap_subjective',
  'soap_objective',
  'soap_assessment',
  'soap_plan',
] as const;

@Injectable()
export class ConsultationService {
  private readonly logger = new Logger(ConsultationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patientService: PatientService,
    private readonly doctorService: DoctorService,
    private readonly appointmentService: AppointmentService,
    @Optional() private readonly branchAuth?: BranchAuthorizationService,
  ) { }

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
   * Helper to calculate BMI from weight (kg) and height (cm).
   */
  static calculateBmi(
    weight?: string | number | null,
    height?: string | number | null,
  ): string | null {
    if (!weight || !height) return null;
    const w = typeof weight === 'number' ? weight : parseFloat(String(weight));
    const h = typeof height === 'number' ? height : parseFloat(String(height));
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return null;

    const heightM = h / 100;
    const bmi = w / (heightM * heightM);
    return bmi.toFixed(1);
  }

  /**
   * Loads complete clinical context for an outpatient encounter.
   */
  async getVisitConsultationContext(
    appointmentIdOrKey: string | number,
    user?: any,
  ): Promise<VisitConsultationContextDto> {
    const apptIdStr = String(appointmentIdOrKey);

    const visit = await this.appointmentService.findOne(apptIdStr);
    if (!visit) {
      throw new NotFoundException(`Visit #${apptIdStr} not found.`);
    }

    if (this.branchAuth && user) {
      await this.branchAuth.assertResourceAccess(
        user,
        visit.branchId ? String(visit.branchId) : null,
        'consultation visit',
      );
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
      include: {
        patient: true,
        doctor: true,
        appointment: true,
        signedBy: true,
        amendments: {
          include: { amendedByUser: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
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

      const determinedAllergyStatus =
        patient.allergies &&
          (patient.allergies.toUpperCase().includes('NKDA') ||
            patient.allergies.toUpperCase().includes('NO KNOWN'))
          ? 'NKDA'
          : patient.allergies
            ? 'ALLERGIES_RECORDED'
            : 'UNKNOWN';

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
        allergies: lastConsult ? lastConsult.allergies || null : patient.allergies || null,
        pastHistory: lastConsult
          ? (lastConsult.pastHistory as Record<string, unknown> | null)
          : null,
        socialHistory: lastConsult
          ? (lastConsult.socialHistory as Record<string, unknown> | null)
          : null,
        specialty: null,
        immunizations: lastConsult
          ? (lastConsult.immunizations as Record<string, unknown> | null)
          : null,
        soapSubjective: null,
        soapObjective: null,
        soapAssessment: null,
        soapPlan: null,
        chiefComplaintDetails: null,
        hpiDetails: null,
        vitals: {
          bp: visit.bp || null,
          pulse: visit.pulse || null,
          temperature: visit.temperature || null,
          weight: visit.weight || null,
        },
        diagnoses: [],
        treatmentPlan: null,
        allergyStatus: determinedAllergyStatus,
        signedAt: null,
        signedById: null,
        signedBy: null,
        branchId: visit.branchId ? String(visit.branchId) : null,
        amendments: [],
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
      include: {
        patient: true,
        doctor: true,
        appointment: true,
        signedBy: true,
        amendments: {
          include: { amendedByUser: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
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
    user?: any,
  ): Promise<VisitConsultationContextDto> {
    return this.getVisitConsultationContext(appointmentIdOrKey, user);
  }

  /**
   * Save, update, sign or complete an outpatient consultation in PostgreSQL.
   * Atomic 1:1 constraint with appointment and immutable signed/completed consultations.
   */
  async saveVisitConsultation(
    appointmentIdOrKey: string | number,
    dto: SaveConsultationDto,
    userId = '',
    user?: any,
  ): Promise<ConsultationResponseDto> {
    const apptIdStr = String(appointmentIdOrKey);

    const visit = await this.appointmentService.findOne(apptIdStr);
    if (!visit) {
      throw new NotFoundException(`Visit #${apptIdStr} not found.`);
    }

    if (this.branchAuth && user) {
      await this.branchAuth.assertResourceAccess(
        user,
        visit.branchId ? String(visit.branchId) : null,
        'consultation visit',
      );
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

    // Calculate / normalize vitals object including live BMI calculation
    const vitalsObj: Record<string, unknown> = {
      ...(dto.vitals || {}),
    };
    if (dto.b_p && !vitalsObj.bp) vitalsObj.bp = dto.b_p;
    if (dto.pulse && !vitalsObj.pulse) vitalsObj.pulse = dto.pulse;
    if (dto.temprature && !vitalsObj.temperature) vitalsObj.temperature = dto.temprature;
    if (dto.weight && !vitalsObj.weight) vitalsObj.weight = dto.weight;

    const calculatedBmi = ConsultationService.calculateBmi(
      vitalsObj.weight as string | number,
      vitalsObj.height as string | number,
    );
    if (calculatedBmi && !vitalsObj.bmi) {
      vitalsObj.bmi = calculatedBmi;
    }

    const action = dto.action || 'save';
    const isSign = action === 'sign';
    const isComplete = action === 'complete';
    const isFinalized = isSign || isComplete;
    const consultStatus = isSign ? 'signed' : isComplete ? 'completed' : 'draft';
    const now = new Date();

    return await this.prisma.$transaction(async (tx) => {
      let c = await tx.consultation.findUnique({
        where: { appointmentId: BigInt(apptIdStr) },
      });

      // Immutability Check: Do not allow direct overwrites on signed/completed consultations
      if (c && (c.status === 'signed' || c.status === 'completed')) {
        throw new BadRequestException(
          'Cannot modify a signed or completed consultation record. Please use the amendment workflow to add an auditable addendum.',
        );
      }

      const effectiveSignedAt = isFinalized ? now : c?.signedAt || null;
      const effectiveSignedById = isFinalized
        ? userId
          ? BigInt(userId)
          : null
        : c?.signedById || null;

      const consultData: Prisma.ConsultationUncheckedCreateWithoutAppointmentInput = {
        patientId: BigInt(patient.id),
        doctorId: doctor ? BigInt(doctor.id) : null,
        branchId: visit.branchId ? BigInt(visit.branchId) : null,
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
        allergyStatus: dto.allergy_status ?? 'UNKNOWN',
        examination: (examClean ?? undefined) as Prisma.InputJsonValue | undefined,
        pastHistory: (pastClean ?? undefined) as Prisma.InputJsonValue | undefined,
        socialHistory: (socialClean ?? undefined) as Prisma.InputJsonValue | undefined,
        specialty: (specialtyClean ?? undefined) as Prisma.InputJsonValue | undefined,
        immunizations: (vaccinesClean ?? undefined) as Prisma.InputJsonValue | undefined,
        soapSubjective: dto.soap_subjective ?? null,
        soapObjective: dto.soap_objective ?? null,
        soapAssessment: dto.soap_assessment ?? null,
        soapPlan: dto.soap_plan ?? null,
        chiefComplaintDetails: (cleanObject(dto.chief_complaint_details) ??
          undefined) as Prisma.InputJsonValue | undefined,
        hpiDetails: (cleanObject(dto.hpi_details) ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        vitals: (cleanObject(vitalsObj) ?? undefined) as Prisma.InputJsonValue | undefined,
        diagnoses: (dto.diagnoses && dto.diagnoses.length > 0
          ? dto.diagnoses
          : undefined) as Prisma.InputJsonValue | undefined,
        treatmentPlan: (cleanObject(dto.treatment_plan) ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        status: consultStatus,
        completedAt: isFinalized ? now : c?.completedAt,
        signedAt: effectiveSignedAt,
        signedById: effectiveSignedById,
        createdBy: c?.createdBy || (userId ? BigInt(userId) : null),
      };

      // Update visit vitals and lifecycle on Appointment atomically
      const updateVisitData: Record<string, unknown> = {};
      if (dto.b_p !== undefined || vitalsObj.bp !== undefined) {
        updateVisitData.bp = dto.b_p ?? (vitalsObj.bp as string);
      }
      if (dto.pulse !== undefined || vitalsObj.pulse !== undefined) {
        updateVisitData.pulse = dto.pulse ?? String(vitalsObj.pulse);
      }
      if (dto.temprature !== undefined || vitalsObj.temperature !== undefined) {
        updateVisitData.temperature = dto.temprature ?? String(vitalsObj.temperature);
      }
      if (dto.weight !== undefined || vitalsObj.weight !== undefined) {
        updateVisitData.weight = dto.weight ?? String(vitalsObj.weight);
      }

      if (isFinalized) {
        updateVisitData.status = 'completed';
        updateVisitData.checkedOutAt = now;
        if (!visit.consultStartedAt) updateVisitData.consultStartedAt = now;
      } else if (['scheduled', 'arrived', 'checked_in', 'waiting'].includes(visit.status)) {
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

      // Sync Patient allergy status if provided
      if (dto.allergies !== undefined) {
        await tx.patient.update({
          where: { id: BigInt(patient.id) },
          data: {
            allergies: dto.allergies,
          },
        });
      }

      if (c) {
        c = await tx.consultation.update({
          where: { id: c.id },
          data: consultData,
          include: {
            patient: true,
            doctor: true,
            appointment: true,
            signedBy: true,
            amendments: {
              include: { amendedByUser: { select: { id: true, firstName: true, lastName: true } } },
              orderBy: { createdAt: 'desc' },
            },
          },
        });
      } else {
        c = await tx.consultation.create({
          data: {
            appointmentId: BigInt(apptIdStr),
            ...consultData,
          },
          include: {
            patient: true,
            doctor: true,
            appointment: true,
            signedBy: true,
            amendments: {
              include: { amendedByUser: { select: { id: true, firstName: true, lastName: true } } },
              orderBy: { createdAt: 'desc' },
            },
          },
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

      // Phase 10.5.8: Automatically sync clinical follow-up entity
      if (dto.follow_up_date) {
        try {
          const orgId = user?.organizationId ? BigInt(user.organizationId) : BigInt(1);
          const branchId = visit.branchId ? BigInt(visit.branchId) : BigInt(1);
          const dueDateObj = new Date(dto.follow_up_date);
          const prefix = `FOL-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-`;
          const count = await tx.followUp.count({ where: { followUpNumber: { startsWith: prefix } } });
          const folNumber = `${prefix}${(count + 1).toString().padStart(4, '0')}`;

          await tx.followUp.create({
            data: {
              followUpNumber: folNumber,
              organizationId: orgId,
              branchId,
              patientId: BigInt(patient.id),
              doctorId: doctor ? BigInt(doctor.id) : BigInt(1),
              consultationId: c.id,
              dueDate: dueDateObj,
              reason: dto.follow_up_notes?.trim() || 'Post-consultation follow-up',
              priority: 'ROUTINE',
              status: 'SCHEDULED',
            },
          });
        } catch (fErr) {
          this.logger.warn(`Failed to auto-create follow-up record for consult #${c.id}: ${fErr}`);
        }
      }

      return this.formatConsultation(c);
    });
  }

  /**
   * Amend an already signed or completed consultation with an auditable addendum.
   */
  async amendConsultation(
    idOrKey: string | number,
    dto: AmendConsultationDto,
    userId = '',
    user?: any,
  ): Promise<ConsultationResponseDto> {
    const idStr = String(idOrKey);

    const consult = await this.prisma.consultation.findUnique({
      where: { id: BigInt(idStr) },
      include: { appointment: true, patient: true, doctor: true },
    });
    if (!consult) {
      throw new NotFoundException(`Consultation #${idStr} not found.`);
    }

    if (this.branchAuth && user) {
      await this.branchAuth.assertResourceAccess(
        user,
        consult.branchId
          ? String(consult.branchId)
          : (consult as any).appointment?.branchId
            ? String((consult as any).appointment.branchId)
            : null,
        'amend consultation',
      );
    }

    if (consult.status !== 'signed' && consult.status !== 'completed') {
      throw new BadRequestException(
        'Only signed or completed consultations can be amended. Draft consultations can be updated directly.',
      );
    }

    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('A reason for the amendment is mandatory.');
    }
    if (!dto.newNotes || !dto.newNotes.trim()) {
      throw new BadRequestException('New amendment notes cannot be empty.');
    }

    const amendAuthorId = userId ? BigInt(userId) : consult.signedById || BigInt(1);

    await this.prisma.consultationAmendment.create({
      data: {
        consultationId: BigInt(idStr),
        amendedBy: amendAuthorId,
        reason: dto.reason.trim(),
        amendedSection: dto.amendedSection?.trim() || 'GENERAL',
        previousNotes: dto.previousNotes?.trim() || null,
        newNotes: dto.newNotes.trim(),
      },
    });

    const updated = await this.prisma.consultation.findUnique({
      where: { id: BigInt(idStr) },
      include: {
        patient: true,
        doctor: true,
        appointment: true,
        signedBy: true,
        amendments: {
          include: {
            amendedByUser: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return this.formatConsultation(updated);
  }

  /**
   * Doctor Dashboard summary containing metrics, live OPD queue, and active drafts.
   */
  async getDoctorDashboard(
    doctorId?: string | number,
    branchId?: string | number,
    user?: any,
  ): Promise<DoctorDashboardSummaryDto> {
    const today = new Date().toISOString().split('T')[0];
    const docIdStr = doctorId ? String(doctorId) : undefined;
    const branchIdStr = branchId ? String(branchId) : undefined;

    let branchFilter: any = undefined;
    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      const accessibleBranches = await this.branchAuth.resolveAccessibleBranchIds(user);
      if (accessibleBranches && accessibleBranches.length > 0) {
        branchFilter = { in: accessibleBranches };
      }
    } else if (branchIdStr) {
      branchFilter = BigInt(branchIdStr);
    }

    const apptWhere: Prisma.AppointmentWhereInput = {
      date: today,
      ...(docIdStr ? { doctorId: BigInt(docIdStr) } : {}),
      ...(branchFilter ? { branchId: branchFilter } : {}),
    };

    const appointmentsToday = await this.prisma.appointment.findMany({
      where: apptWhere,
      orderBy: [{ queueNumber: 'asc' }, { timeSlot: 'asc' }, { id: 'asc' }],
      include: {
        patient: true,
        doctor: true,
        consultation: true,
      },
    });

    const waitingPatients = appointmentsToday.filter((a) =>
      ['arrived', 'checked_in', 'waiting'].includes((a.status || '').toLowerCase()),
    ).length;

    const calledPatients = appointmentsToday.filter((a) =>
      ['called', 'in consultation'].includes((a.status || '').toLowerCase()),
    ).length;

    const activeConsultations = appointmentsToday.filter((a) =>
      ['in consultation', 'in_consultation'].includes((a.status || '').toLowerCase()),
    ).length;

    const completedConsultations = appointmentsToday.filter((a) =>
      ['completed', 'discharged'].includes((a.status || '').toLowerCase()),
    ).length;

    const draftWhere: Prisma.ConsultationWhereInput = {
      status: 'draft',
      ...(docIdStr ? { doctorId: BigInt(docIdStr) } : {}),
      ...(branchFilter ? { appointment: { branchId: branchFilter } } : {}),
    };

    const drafts = await this.prisma.consultation.findMany({
      where: draftWhere,
      take: 20,
      orderBy: { updatedAt: 'desc' },
      include: {
        patient: true,
        doctor: true,
        appointment: true,
        signedBy: true,
        amendments: {
          include: { amendedByUser: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const criticalAlertsCount = appointmentsToday.filter(
      (a) =>
        a.visitType === 'emergency' ||
        (a.patient?.allergies &&
          a.patient.allergies.trim() !== '' &&
          !a.patient.allergies.toUpperCase().includes('NKDA') &&
          !a.patient.allergies.toUpperCase().includes('NO KNOWN')),
    ).length;

    const queue = appointmentsToday.map((a) => ({
      id: a.id.toString(),
      appointmentId: a.id.toString(),
      patientId: a.patientId.toString(),
      patientName: a.patient?.name || 'Unknown',
      mrn: a.patient?.patientId || '',
      age: a.patient?.age || null,
      sex: a.patient?.sex || null,
      doctorName: a.doctor?.name || '',
      department: a.doctor?.department || null,
      timeSlot: a.timeSlot,
      queueNumber: a.queueNumber,
      status: a.status,
      appointmentType: a.visitType,
      reasonForVisit: a.remarks || null,
      vitals: {
        bp: a.bp,
        pulse: a.pulse,
        temperature: a.temperature,
        weight: a.weight,
      },
      consultationId: a.consultation?.id ? a.consultation.id.toString() : null,
      consultationStatus: a.consultation?.status || null,
    }));

    const formattedDrafts = drafts.map((d) => this.formatConsultation(d));

    return {
      todayAppointments: appointmentsToday.length,
      waitingPatients,
      calledPatients,
      activeConsultations,
      completedConsultations,
      pendingDrafts: drafts.length,
      criticalAlertsCount,
      queue,
      drafts: formattedDrafts,
    };
  }

  /**
   * Consolidated patient clinical chart consolidating allergies, previous encounters,
   * vitals trends, previous diagnoses, prescriptions, labs, and radiology.
   */
  async getPatientClinicalChart(
    patientIdOrKey: string | number,
    user?: any,
  ): Promise<PatientClinicalChartDto> {
    const patIdStr = String(patientIdOrKey);

    const patient = await this.prisma.patient.findFirst({
      where: {
        OR: [
          ...(isNaN(Number(patIdStr)) ? [] : [{ id: BigInt(patIdStr) }]),
          { patientId: patIdStr },
        ],
      },
      include: {
        branch: true,
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient #${patIdStr} not found.`);
    }

    if (this.branchAuth && user) {
      await this.branchAuth.assertResourceAccess(
        user,
        patient.branchId ? String(patient.branchId) : null,
        'patient clinical chart',
      );
    }

    const patientBigInt = patient.id;

    // Concurrently fetch consultations, prescriptions, labs, radiology, and appointments
    const [consultations, prescriptions, labs, radiologyOrders, appointments, documents] =
      await Promise.all([
        this.prisma.consultation.findMany({
          where: { patientId: patientBigInt },
          include: {
            doctor: true,
            signedBy: true,
            amendments: {
              include: { amendedByUser: { select: { id: true, firstName: true, lastName: true } } },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: 20,
        }),
        this.prisma.prescription.findMany({
          where: { patientId: patientBigInt },
          include: { doctor: true, medicines: true },
          orderBy: [{ id: 'desc' }],
          take: 20,
        }),
        this.prisma.lab.findMany({
          where: { patientId: patientBigInt },
          include: { tests: true },
          orderBy: [{ id: 'desc' }],
          take: 20,
        }),
        this.prisma.radiologyOrder.findMany({
          where: { patientId: patientBigInt },
          orderBy: [{ id: 'desc' }],
          take: 20,
        }),
        this.prisma.appointment.findMany({
          where: { patientId: patientBigInt },
          include: { doctor: true },
          orderBy: [{ id: 'desc' }],
          take: 20,
        }),
        this.prisma.patientDocument.findMany({
          where: { patientId: patientBigInt },
          orderBy: [{ id: 'desc' }],
          take: 20,
        }),
      ]);

    // Determine Allergy Status explicitly
    let allergyStatus: 'NKDA' | 'ALLERGIES_RECORDED' | 'UNKNOWN' = 'UNKNOWN';
    if (patient.allergies && patient.allergies.trim() !== '') {
      const upper = patient.allergies.toUpperCase();
      if (upper.includes('NKDA') || upper.includes('NO KNOWN')) {
        allergyStatus = 'NKDA';
      } else {
        allergyStatus = 'ALLERGIES_RECORDED';
      }
    }

    // Extract Latest Vitals from recent consultations or appointments
    let latestVitals: ChartVitalsDto | null = null;
    for (const c of consultations) {
      if (c.vitals && typeof c.vitals === 'object' && Object.keys(c.vitals).length > 0) {
        const v = c.vitals as Record<string, any>;
        latestVitals = {
          bp: v.bp ? String(v.bp) : undefined,
          pulse: v.pulse ? String(v.pulse) : undefined,
          respiratoryRate: v.respiratoryRate ? String(v.respiratoryRate) : undefined,
          temperature: v.temperature ? String(v.temperature) : undefined,
          oxygenSaturation: v.oxygenSaturation ? String(v.oxygenSaturation) : undefined,
          height: v.height ? `${v.height} cm` : undefined,
          weight: v.weight ? `${v.weight} kg` : undefined,
          bmi: v.bmi ? String(v.bmi) : undefined,
          recordedAt: c.date ? c.date.toISOString() : undefined,
          recordedBy: (c as any).doctor?.name || undefined,
        };
        break;
      }
    }
    if (!latestVitals) {
      for (const a of appointments) {
        if (a.bp || a.pulse || a.temperature || a.weight) {
          latestVitals = {
            bp: a.bp || undefined,
            pulse: a.pulse || undefined,
            temperature: a.temperature || undefined,
            weight: a.weight ? `${a.weight} kg` : undefined,
            recordedAt: a.date || undefined,
            recordedBy: a.doctor?.name || undefined,
          };
          break;
        }
      }
    }

    // Extract Diagnoses across all past consultations
    const diagnoses: ChartDiagnosisDto[] = [];
    const seenDiagnoses = new Set<string>();

    for (const c of consultations) {
      if (Array.isArray(c.diagnoses)) {
        for (const d of c.diagnoses as any[]) {
          if (d && d.description && !seenDiagnoses.has(d.description.toLowerCase())) {
            seenDiagnoses.add(d.description.toLowerCase());
            diagnoses.push({
              type: d.type || 'PRIMARY',
              description: d.description,
              code: d.code || undefined,
              diagnosedDate: c.date ? c.date.toISOString().split('T')[0] : undefined,
              diagnosedBy: (c as any).doctor?.name || undefined,
            });
          }
        }
      } else if (c.diagnosis && !seenDiagnoses.has(c.diagnosis.toLowerCase())) {
        seenDiagnoses.add(c.diagnosis.toLowerCase());
        diagnoses.push({
          type: 'PRIMARY',
          description: c.diagnosis,
          diagnosedDate: c.date ? c.date.toISOString().split('T')[0] : undefined,
          diagnosedBy: (c as any).doctor?.name || undefined,
        });
      }
    }

    // Consolidated History from patient record or past consultations
    const pastHistoryFromConsult = consultations.find((c) => c.pastHistory)?.pastHistory as
      | Record<string, string>
      | undefined;
    const socialHistoryFromConsult = consultations.find((c) => c.socialHistory)?.socialHistory as
      | Record<string, string>
      | undefined;

    return {
      patient: {
        id: patient.id.toString(),
        patientId: patient.patientId || '',
        name: patient.name,
        sex: patient.sex || null,
        birthdate: patient.birthdate || null,
        age: patient.age ? parseInt(String(patient.age), 10) : null,
        phone: patient.phone || null,
        bloodGroup: patient.bloodGroup || null,
        emergencyContactName: patient.emergencyContactName || null,
        emergencyContactPhone: patient.emergencyContactPhone || null,
        emergencyContactRelation: patient.emergencyContactRelation || null,
      },
      allergyStatus,
      allergies: patient.allergies || null,
      history: {
        medicalConditions:
          patient.medicalHistory && typeof patient.medicalHistory === 'object'
            ? (patient.medicalHistory as Record<string, string>)
            : pastHistoryFromConsult || null,
        surgicalHistory:
          patient.surgicalHistory && typeof patient.surgicalHistory === 'object'
            ? (patient.surgicalHistory as Record<string, string>)
            : null,
        familyHistory:
          patient.familyHistory && typeof patient.familyHistory === 'object'
            ? (patient.familyHistory as Record<string, string>)
            : null,
        socialHistory: socialHistoryFromConsult || null,
      },
      latestVitals,
      diagnoses,
      prescriptions: prescriptions.map((p) => ({
        id: p.id.toString(),
        date: p.date,
        doctorName: p.doctor?.name || null,
        symptom: p.symptom,
        advice: p.advice,
        state: p.state,
        medicines: p.medicines.map((m) => ({
          id: m.id.toString(),
          name: m.name,
          dosage: m.dosage,
          duration: m.duration,
          instructions: m.instructions,
        })),
      })),
      consultations: consultations.map((c) => this.formatConsultation(c)),
      labResults: labs.map((l) => ({
        id: l.id.toString(),
        orderNumber: l.orderNumber,
        date: l.date,
        category: l.categoryName || l.category,
        status: l.status,
        priority: l.priority,
        report: l.report,
        tests: l.tests.map((t) => ({
          id: t.id.toString(),
          name: t.name,
          status: t.status,
          result: t.result,
          referenceValue: t.referenceValue,
        })),
      })),
      radiologyReports: radiologyOrders.map((r) => ({
        id: r.id.toString(),
        orderNumber: r.orderNumber,
        examName: r.examName,
        modality: r.modality,
        orderDate: r.orderDate ? r.orderDate.toISOString() : null,
        status: r.status,
        findings: r.findings,
        impression: r.impression,
        recommendations: r.recommendations,
      })),
      previousAppointments: appointments.map((a) => ({
        id: a.id.toString(),
        date: a.date,
        timeSlot: a.timeSlot,
        doctorName: a.doctor?.name || null,
        status: a.status,
        appointmentType: a.visitType,
        reasonForVisit: a.remarks,
      })),
      documents: documents.map((d) => ({
        id: d.id.toString(),
        title: d.title,
        documentType: d.documentType,
        fileUrl: d.fileUrl,
        fileSize: d.fileSize,
        createdAt: d.createdAt ? d.createdAt.toISOString() : null,
      })),
    };
  }

  /**
   * List consultations with filtering and pagination.
   */
  async findAll(query: ConsultationQueryDto, user?: any): Promise<PaginatedConsultationsDto> {
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

    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      const accessibleBranches = await this.branchAuth.resolveAccessibleBranchIds(user);
      if (accessibleBranches) {
        where.appointment = {
          branchId: {
            in: accessibleBranches,
          },
        };
      }
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
          signedBy: true,
          amendments: {
            include: { amendedByUser: { select: { id: true, firstName: true, lastName: true } } },
            orderBy: { createdAt: 'desc' },
          },
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
  async findOne(idOrKey: string | number, user?: any): Promise<ConsultationResponseDto> {
    const idStr = String(idOrKey);

    const found = await this.prisma.consultation.findUnique({
      where: { id: BigInt(idStr) },
      include: {
        patient: true,
        doctor: true,
        appointment: true,
        signedBy: true,
        amendments: {
          include: { amendedByUser: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!found) {
      throw new NotFoundException(`Consultation #${idStr} not found.`);
    }

    if (this.branchAuth && user) {
      await this.branchAuth.assertResourceAccess(
        user,
        found.branchId
          ? String(found.branchId)
          : (found as any).appointment?.branchId
            ? String((found as any).appointment.branchId)
            : null,
        'consultation',
      );
    }

    return this.formatConsultation(found);
  }

  /**
   * Printable summary for clinical report generation.
   */
  async printout(idOrKey: string | number, user?: any): Promise<ConsultationResponseDto> {
    return this.findOne(idOrKey, user);
  }

  // --- Reusable Note Templates ---

  /**
   * List consult templates available to a doctor or hospital-wide.
   */
  async listTemplates(doctorId?: string | number): Promise<ConsultTemplateResponseDto[]> {
    const docIdStr = doctorId ? String(doctorId) : undefined;

    const templates = await this.prisma.consultTemplate.findMany({
      where: {
        OR: [{ doctorId: null }, ...(docIdStr ? [{ doctorId: BigInt(docIdStr) }] : [])],
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
      c.date instanceof Date ? c.date.toISOString().split('T')[0] : String(c.date);

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
      soapSubjective: c.soapSubjective || null,
      soapObjective: c.soapObjective || null,
      soapAssessment: c.soapAssessment || null,
      soapPlan: c.soapPlan || null,
      chiefComplaintDetails: c.chiefComplaintDetails || null,
      hpiDetails: c.hpiDetails || null,
      vitals: c.vitals || null,
      diagnoses: c.diagnoses || null,
      treatmentPlan: c.treatmentPlan || null,
      allergyStatus: c.allergyStatus || null,
      signedAt: c.signedAt instanceof Date ? c.signedAt.toISOString() : c.signedAt || null,
      signedById: c.signedById ? c.signedById.toString() : null,
      signedBy: c.signedBy
        ? {
            id: c.signedBy.id.toString(),
            name: `${(c.signedBy as any).firstName || ''} ${(c.signedBy as any).lastName || ''}`.trim() || 'Staff',
          }
        : undefined,
      branchId: c.branchId ? c.branchId.toString() : null,
      amendments: Array.isArray(c.amendments)
        ? c.amendments.map((a: any) => ({
            id: a.id.toString(),
            amendedBy: a.amendedBy.toString(),
            amendedByName: a.amendedByUser
              ? `${a.amendedByUser.firstName || ''} ${a.amendedByUser.lastName || ''}`.trim()
              : undefined,
            reason: a.reason,
            amendedSection: a.amendedSection,
            previousNotes: a.previousNotes || null,
            newNotes: a.newNotes,
            createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
          }))
        : undefined,
      status: c.status,
      completedAt: c.completedAt
        ? c.completedAt instanceof Date
          ? c.completedAt.toISOString()
          : c.completedAt
        : null,
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
