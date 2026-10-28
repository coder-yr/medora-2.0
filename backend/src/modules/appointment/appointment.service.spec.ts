import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentService } from '../department/department.service';
import { DoctorService } from '../doctor/doctor.service';
import { PatientService } from '../patient/patient.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentService } from './appointment.service';

describe('AppointmentService (Legacy Parity & Concurrency)', () => {
  let service: AppointmentService;
  let patientService: PatientService;
  let doctorService: DoctorService;

  let patient1: any;
  let patient2: any;
  let doctor1: any;
  let doctor2: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        PatientService,
        DepartmentService,
        DoctorService,
        {
          provide: PrismaService,
          useValue: {
            connected: false,
            appointment: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            patient: {
              findFirst: jest.fn(),
              delete: jest.fn(),
            },
            doctor: {
              findFirst: jest.fn(),
              delete: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb({
              $executeRaw: jest.fn(),
              appointment: {
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
              },
              doctorSlot: {
                findMany: jest.fn(),
              },
              slotBlock: {
                findFirst: jest.fn(),
              },
            })),
          },
        },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    patientService = module.get<PatientService>(PatientService);
    doctorService = module.get<DoctorService>(DoctorService);

    // Setup base patients and doctors in in-memory storage
    patient1 = await patientService.create({ name: 'Amina Yousaf' });
    patient2 = await patientService.create({ name: 'Bilal Ahmed' });
    doctor1 = await doctorService.create({ name: 'Dr Nadia Aslam' });
    doctor2 = await doctorService.create({ name: 'Dr Imran Shah' });
  });

  afterEach(() => {
    service.clearMemory();
    patientService.clearMemoryStore();
    doctorService.clearMemoryStore();
  });

  it('Rule 1: derives the end time, time slot label, and legacy s_time_key', async () => {
    const app = await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
      status: 'scheduled',
    });

    expect(app.sTime).toBe('2026-10-01 09:00:00');
    expect(app.eTime).toBe('2026-10-01 09:30:00');
    expect(app.timeSlot).toBe('09:00 - 09:30');
    expect(app.sTimeKey).toBe('202610010900');
  });

  it('Rule 2: a doctor cannot be double booked (overlapping slots rejected)', async () => {
    await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
      status: 'scheduled',
    });

    // Overlaps by 15 minutes (09:15 to 09:45)
    await expect(
      service.create({
        patient: patient2.id,
        doctor: doctor1.id,
        date: '2026-10-01',
        start: '09:15',
        minutes: 30,
        status: 'scheduled',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Rule 3: back to back appointments are allowed (touching boundaries do not clash)', async () => {
    await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
      status: 'scheduled',
    });

    // Starts at 09:30 exactly when the first ends
    const app2 = await service.create({
      patient: patient2.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:30',
      minutes: 30,
      status: 'scheduled',
    });

    expect(app2).toBeDefined();
    expect(app2.sTime).toBe('2026-10-01 09:30:00');
  });

  it('Rule 4: a cancelled appointment frees the slot for another patient', async () => {
    await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
      status: 'cancelled',
    });

    // Booking same slot succeeds because previous booking was cancelled
    const app2 = await service.create({
      patient: patient2.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
      status: 'scheduled',
    });

    expect(app2).toBeDefined();
    expect(app2.patient?.id).toBe(patient2.id);
  });

  it('Rule 5: two different doctors can hold appointments at the exact same slot', async () => {
    await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
      status: 'scheduled',
    });

    const app2 = await service.create({
      patient: patient2.id,
      doctor: doctor2.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
      status: 'scheduled',
    });

    expect(app2).toBeDefined();
    expect(app2.doctor?.id).toBe(doctor2.id);
  });

  it('Rule 6: editing an appointment does not clash with itself', async () => {
    const created = await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
      status: 'scheduled',
    });

    const updated = await service.update(created.id, {
      status: 'arrived',
      b_p: '120/80',
    });

    expect(updated.status).toBe('arrived');
    expect(updated.bp).toBe('120/80');
  });

  it('Rule 7: booking requires a valid patient and doctor', async () => {
    await expect(
      service.create({
        patient: '9999',
        doctor: doctor1.id,
        date: '2026-10-01',
        start: '09:00',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create({
        patient: patient1.id,
        doctor: '9999',
        date: '2026-10-01',
        start: '09:00',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Rule 8: day view only shows requested date', async () => {
    await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
    });

    await service.create({
      patient: patient2.id,
      doctor: doctor1.id,
      date: '2026-10-02',
      start: '09:00',
      minutes: 30,
    });

    const dayView = await service.findAll({ date: '2026-10-01' });
    expect(dayView.total).toBe(1);
    expect(dayView.data[0].patient?.name).toBe('Amina Yousaf');
  });

  it('Rule 9: doctor clinic hours validation when weekly slots are configured', async () => {
    // 2026-10-01 is Thursday (dayOfWeek = 4)
    // Add slot for doctor1 on Thursday: 09:00 to 12:00
    service.addTestSlot({
      doctorId: doctor1.id,
      weekday: 4,
      startTime: '09:00',
      endTime: '12:00',
      slotMinutes: 15,
      active: true,
    });

    // Booking inside clinic hours succeeds
    const app = await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:30',
      minutes: 30,
    });
    expect(app).toBeDefined();

    // Booking outside clinic hours throws 400
    await expect(
      service.create({
        patient: patient2.id,
        doctor: doctor1.id,
        date: '2026-10-01',
        start: '14:00',
        minutes: 30,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Rule 10: slot block prevents booking during doctor leave or meeting', async () => {
    // Add block on 2026-10-01 between 10:00 and 11:00
    service.addTestBlock({
      doctorId: doctor1.id,
      date: '2026-10-01',
      startTime: '10:00',
      endTime: '11:00',
      reason: 'Department meeting',
    });

    await expect(
      service.create({
        patient: patient1.id,
        doctor: doctor1.id,
        date: '2026-10-01',
        start: '10:15',
        minutes: 30,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Rule 11: video consultation generates random Jitsi room and keeps it across edits', async () => {
    const app = await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
      video: true,
    });

    expect(app.mode).toBe('video');
    expect(app.videoRoom).toMatch(/^icthospital-[0-9a-f]{24}$/);
    expect(app.videoUrl).toContain(app.videoRoom!);

    const originalRoom = app.videoRoom;

    // Reschedule appointment
    const updated = await service.update(app.id, {
      start: '10:00',
      remarks: 'Rescheduled video visit',
    });

    expect(updated.videoRoom).toBe(originalRoom);
  });

  it('Rule 12: free slots calculation steps through clinic windows excluding bookings', async () => {
    // 2026-10-01 (Thursday, dayOfWeek = 4)
    service.addTestSlot({
      doctorId: doctor1.id,
      weekday: 4,
      startTime: '09:00',
      endTime: '10:00',
      slotMinutes: 15,
      active: true,
    });

    // Book 09:15 to 09:30
    await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:15',
      minutes: 15,
    });

    const freeSlots = await service.getFreeSlots(doctor1.id, '2026-10-01');
    expect(freeSlots).toEqual([
      { start: '09:00', minutes: 15 },
      { start: '09:30', minutes: 15 },
      { start: '09:45', minutes: 15 },
    ]);
  });
});
