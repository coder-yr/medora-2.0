import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentService } from '../appointment/appointment.service';
import { DepartmentService } from '../department/department.service';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConsultationService } from './consultation.service';

describe('ConsultationService (Legacy Parity & Clinical Rules)', () => {
  let service: ConsultationService;
  let patientService: PatientService;
  let doctorService: DoctorService;
  let appointmentService: AppointmentService;

  let patient1: any;
  let doctor1: any;
  let appointment1: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsultationService,
        AppointmentService,
        PatientService,
        DepartmentService,
        DoctorService,
        {
          provide: PrismaService,
          useValue: {
            connected: false,
            consultation: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            consultTemplate: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
            appointment: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            patient: {
              findFirst: jest.fn(),
            },
            doctor: {
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ConsultationService>(ConsultationService);
    patientService = module.get<PatientService>(PatientService);
    doctorService = module.get<DoctorService>(DoctorService);
    appointmentService = module.get<AppointmentService>(AppointmentService);

    service.clearMemory();
    appointmentService.clearMemory();
    patientService.clearMemoryStore();
    doctorService.clearMemoryStore();

    patient1 = await patientService.create({
      name: 'Jane Doe',
      sex: 'female',
      phone: '08031112222',
      birthdate: '1995-05-15',
    });

    doctor1 = await doctorService.create({
      name: 'Dr Gregory House',
      email: 'house.diag@hospital.test',
      phone: '08099998888',
      department: 'Diagnostic Medicine',
    });

    appointment1 = await appointmentService.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-28',
      start: '09:00',
    });
  });

  describe('Naegele\'s Rule Obstetric Math (Legacy baseline)', () => {
    it('calculates EDD and gestational age correctly from LMP', () => {
      // LMP: 2026-08-01. As of 2026-10-10: 70 days = 10 weeks 0 days
      const [edd, gestationalAge] = ConsultationService.obstetricDates('2026-08-01', '2026-10-10');
      expect(edd).toBe('2027-05-08'); // 2026-08-01 + 280 days
      expect(gestationalAge).toBe('10w 0d');
    });

    it('returns nulls if LMP is not provided', () => {
      const [edd, gestationalAge] = ConsultationService.obstetricDates(undefined);
      expect(edd).toBeNull();
      expect(gestationalAge).toBeNull();
    });
  });

  describe('Open Visit Context & History Carry-forward', () => {
    it('opens context for scheduled visit and returns empty prior notes for new patient', async () => {
      const ctx = await service.getVisitContext(appointment1.id);
      expect(ctx.visit.id).toBe(appointment1.id);
      expect(ctx.consultation.presentingComplaint).toBeNull();
      expect(ctx.consultation.allergies).toBeNull();
      expect(ctx.previous.length).toBe(0);
    });

    it('carries forward allergies and past history from the patient prior consultation', async () => {
      // 1. First consultation saves allergies and past history
      await service.saveVisitConsultation(
        appointment1.id,
        {
          allergies: 'Penicillin (anaphylaxis)',
          past: { surgical: 'Appendectomy 2018' },
          presenting_complaint: 'Routine follow-up',
          diagnosis: 'Healthy',
          action: 'complete',
        },
        doctor1.id,
      );

      // 2. Patient books a second appointment
      const appointment2 = await appointmentService.create({
        patient: patient1.id,
        doctor: doctor1.id,
        date: '2026-11-05',
        start: '10:00',
      });

      // 3. Opening second appointment context carries forward previous allergies & past history
      const ctx2 = await service.getVisitContext(appointment2.id);
      expect(ctx2.consultation.allergies).toBe('Penicillin (anaphylaxis)');
      expect(JSON.stringify(ctx2.consultation.pastHistory)).toContain('Appendectomy 2018');
    });
  });

  describe('Save and Complete Consultation', () => {
    it('saves draft consultation, updates appointment vitals, and transitions appointment to in consultation', async () => {
      const saved = await service.saveVisitConsultation(
        appointment1.id,
        {
          presenting_complaint: 'Severe headache and nausea for 3 days',
          history: 'Started after strenuous activity',
          exam: { general: { status: 'normal', note: 'Alert and oriented' } },
          b_p: '140/90',
          pulse: '84',
          temprature: '37.2',
          weight: '72',
          provisional_diagnosis: 'Migraine with aura',
          plan: 'Rest in quiet room, analgesics',
          action: 'save',
        },
        doctor1.id,
      );

      expect(saved.id).toBeDefined();
      expect(saved.status).toBe('draft');
      expect(saved.presentingComplaint).toBe('Severe headache and nausea for 3 days');
      expect(saved.visit?.bp).toBe('140/90');

      // Check appointment vitals & status updated
      const updatedAppt = await appointmentService.findOne(appointment1.id);
      expect(updatedAppt.status).toBe('in consultation');
      expect(updatedAppt.bp).toBe('140/90');
      expect(updatedAppt.pulse).toBe('84');
      expect(updatedAppt.temperature).toBe('37.2');
    });

    it('completes consultation, records completed_at, and marks appointment completed', async () => {
      const completed = await service.saveVisitConsultation(
        appointment1.id,
        {
          presenting_complaint: 'Persistent dry cough',
          diagnosis: 'Acute bronchitis',
          treatment: 'Cough suppressant, hydration',
          action: 'complete',
        },
        doctor1.id,
      );

      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();

      const updatedAppt = await appointmentService.findOne(appointment1.id);
      expect(updatedAppt.status).toBe('completed');
    });

    it('fails when appointment does not exist', async () => {
      await expect(
        service.saveVisitConsultation(
          '99999999',
          {
            presenting_complaint: 'Test',
            action: 'save',
          },
          doctor1.id,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('fails when updating completed consultation without authorized amend flow', async () => {
      await service.saveVisitConsultation(
        appointment1.id,
        {
          presenting_complaint: 'Flu',
          action: 'complete',
        },
        doctor1.id,
      );

      // Attempting to overwrite completed consultation throws BadRequestException
      await expect(
        service.saveVisitConsultation(
          appointment1.id,
          {
            presenting_complaint: 'Modified after complete',
            action: 'save',
          },
          doctor1.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Consultation Note Templates', () => {
    it('creates, lists, and manages doctor templates', async () => {
      const template = await service.createTemplate({
        name: 'General Review of Systems',
        doctorId: doctor1.id,
        fields: {
          presenting_complaint: 'Routine follow-up',
          plan: 'Continue current medication regimen',
        },
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe('General Review of Systems');
      expect(template.fields.plan).toBe('Continue current medication regimen');

      const list = await service.listTemplates(doctor1.id);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((t) => t.id === template.id)).toBe(true);

      const deleted = await service.removeTemplate(template.id);
      expect(deleted.message).toBeDefined();
    });
  });

  describe('Consultation Listing & Printable Summary', () => {
    it('lists consultations by date with pagination', async () => {
      await service.saveVisitConsultation(
        appointment1.id,
        {
          presenting_complaint: 'Routine checkup',
          diagnosis: 'Normal',
          action: 'save',
        },
        doctor1.id,
      );

      const res = await service.findAll({
        date: '2026-10-28',
        page: 1,
        limit: 10,
      });

      expect(res.data.length).toBe(1);
      expect(res.data[0].patientId).toBe(patient1.id);
      expect(res.total).toBe(1);
    });

    it('generates printable consultation summary view', async () => {
      const saved = await service.saveVisitConsultation(
        appointment1.id,
        {
          presenting_complaint: 'Chest pain',
          b_p: '130/85',
          diagnosis: 'Musculoskeletal strain',
          plan: 'Rest and NSAIDs',
          action: 'complete',
        },
        doctor1.id,
      );

      const printSummary = await service.printout(saved.id);
      expect(printSummary.id).toBe(saved.id);
      expect(printSummary.patient?.name).toBe('Jane Doe');
      expect(printSummary.doctor?.name).toBe('Dr Gregory House');
      expect(printSummary.diagnosis).toBe('Musculoskeletal strain');
      expect(printSummary.visit?.bp).toBe('130/85');
    });
  });
});
