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

  let patientsMap: Map<string, any>;
  let doctorsMap: Map<string, any>;
  let appointmentsMap: Map<string, any>;
  let slotsMap: Map<string, any>;
  let blocksMap: Map<string, any>;

  let autoApptId: bigint;
  let autoPatientId: bigint;
  let autoDoctorId: bigint;
  let autoSlotId: number;
  let autoBlockId: number;

  let patient1: any;
  let patient2: any;
  let doctor1: any;
  let doctor2: any;

  // Test helper to add weekly clinic slots
  const addTestSlot = (slot: {
    doctorId: string | number;
    weekday: number;
    startTime: string;
    endTime: string;
    slotMinutes: number;
    active: boolean;
  }) => {
    autoSlotId++;
    const id = BigInt(autoSlotId);
    const record = { id, ...slot, doctorId: BigInt(slot.doctorId) };
    slotsMap.set(id.toString(), record);
    return record;
  };

  // Test helper to add slot blocks
  const addTestBlock = (block: {
    doctorId: string | number;
    date: string;
    startTime: string | null;
    endTime: string | null;
    reason: string | null;
  }) => {
    autoBlockId++;
    const id = BigInt(autoBlockId);
    const record = {
      id,
      ...block,
      doctorId: BigInt(block.doctorId),
      date: new Date(block.date),
    };
    blocksMap.set(id.toString(), record);
    return record;
  };

  const createMockPrisma = () => {
    const txMock = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      appointment: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          for (const a of appointmentsMap.values()) {
            if (where.doctorId && a.doctorId !== where.doctorId) continue;
            if (where.NOT?.id && a.id === where.NOT.id) continue;
            if (where.status?.notIn && where.status.notIn.includes(a.status)) continue;
            // Overlap check
            if (where.sTime?.lt && where.eTime?.gt) {
              if (a.sTime < where.sTime.lt && a.eTime > where.eTime.gt) {
                const patient = patientsMap.get(a.patientId.toString());
                return { ...a, patient };
              }
            }
          }
          return null;
        }),
        aggregate: jest.fn().mockImplementation(async ({ where }: any) => {
          let maxToken = 0;
          for (const a of appointmentsMap.values()) {
            if (where.doctorId && a.doctorId !== where.doctorId) continue;
            if (where.date && a.date !== where.date) continue;
            if (a.tokenNo && a.tokenNo > maxToken) maxToken = a.tokenNo;
          }
          return { _max: { tokenNo: maxToken } };
        }),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          autoApptId++;
          const id = autoApptId;
          const patient = patientsMap.get(data.patientId.toString());
          const doctor = doctorsMap.get(data.doctorId.toString());
          const record = {
            id,
            ...data,
            patient,
            doctor,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          appointmentsMap.set(id.toString(), record);
          return record;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => {
          const a = appointmentsMap.get(where.id.toString());
          if (!a) throw new Error('Not found');
          const patient = patientsMap.get(a.patientId.toString());
          const doctor = doctorsMap.get(a.doctorId.toString());
          const updated = {
            ...a,
            ...data,
            patient,
            doctor,
            updatedAt: new Date(),
          };
          appointmentsMap.set(where.id.toString(), updated);
          return updated;
        }),
      },
      doctorSlot: {
        findMany: jest.fn().mockImplementation(async ({ where }: any) => {
          return Array.from(slotsMap.values()).filter(
            (s) => s.doctorId === where.doctorId && s.active,
          );
        }),
      },
      slotBlock: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          for (const b of blocksMap.values()) {
            if (b.doctorId === where.doctorId) {
              return b;
            }
          }
          return null;
        }),
      },
    };

    return {
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(txMock)),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockImplementation(async (strings: TemplateStringsArray) => {
        const text = strings.join('');
        if (text.includes('MAX')) return [{ max_id: 0 }];
        if (text.includes('nextval')) return [{ next_val: 1 }];
        return [];
      }),
      appointment: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          const a = appointmentsMap.get(where.id.toString());
          if (!a) return null;
          const patient = patientsMap.get(a.patientId.toString());
          const doctor = doctorsMap.get(a.doctorId.toString());
          return { ...a, patient, doctor };
        }),
        findMany: jest.fn().mockImplementation(async ({ where, skip = 0, take = 50 }: any) => {
          let list = Array.from(appointmentsMap.values());
          if (where?.date) list = list.filter((a) => a.date === where.date);
          if (where?.doctorId) list = list.filter((a) => a.doctorId === where.doctorId);
          if (where?.patientId) list = list.filter((a) => a.patientId === where.patientId);
          if (where?.status?.notIn) {
            list = list.filter((a) => !where.status.notIn.includes(a.status));
          }
          if (where?.status?.in) {
            list = list.filter((a) => where.status.in.includes(a.status));
          }
          list.sort((a, b) => a.sTime.localeCompare(b.sTime));
          return list.slice(skip, skip + take).map((a) => ({
            ...a,
            patient: patientsMap.get(a.patientId.toString()),
            doctor: doctorsMap.get(a.doctorId.toString()),
          }));
        }),
        count: jest.fn().mockImplementation(async ({ where }: any) => {
          let list = Array.from(appointmentsMap.values());
          if (where?.date) list = list.filter((a) => a.date === where.date);
          if (where?.doctorId) list = list.filter((a) => a.doctorId === where.doctorId);
          if (where?.patientId) list = list.filter((a) => a.patientId === where.patientId);
          if (where?.status) list = list.filter((a) => a.status === where.status);
          return list.length;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => {
          const a = appointmentsMap.get(where.id.toString());
          if (!a) throw new Error('Not found');
          const patient = patientsMap.get(a.patientId.toString());
          const doctor = doctorsMap.get(a.doctorId.toString());
          const updated = {
            ...a,
            ...data,
            patient,
            doctor,
            updatedAt: new Date(),
          };
          appointmentsMap.set(where.id.toString(), updated);
          return updated;
        }),
        delete: jest.fn().mockImplementation(async ({ where }: any) => {
          appointmentsMap.delete(where.id.toString());
          return { id: where.id };
        }),
      },
      patient: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          autoPatientId++;
          const id = autoPatientId;
          const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          patientsMap.set(id.toString(), record);
          return record;
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where.patientId) {
            for (const p of patientsMap.values()) {
              if (p.patientId === where.patientId) return p;
            }
          }
          if (where.OR) {
            for (const cond of where.OR) {
              if (cond.id) {
                const p = patientsMap.get(cond.id.toString());
                if (p) return p;
              }
            }
          }
          return null;
        }),
      },
      doctor: {
        aggregate: jest.fn().mockImplementation(async ({ where }: any) => {
          let maxToken = 0;
          for (const a of appointmentsMap.values()) {
            if (where.doctorId && a.doctorId !== where.doctorId) continue;
            if (where.date && a.date !== where.date) continue;
            if (a.tokenNo && a.tokenNo > maxToken) maxToken = a.tokenNo;
          }
          return { _max: { tokenNo: maxToken } };
        }),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          autoDoctorId++;
          const id = autoDoctorId;
          const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          doctorsMap.set(id.toString(), record);
          return record;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          return doctorsMap.get(where.id.toString()) || null;
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      department: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      doctorSlot: {
        findMany: jest.fn().mockImplementation(async ({ where }: any) => {
          return Array.from(slotsMap.values()).filter(
            (s) => s.doctorId === where.doctorId && s.weekday === where.weekday && s.active,
          );
        }),
      },
      slotBlock: {
        findMany: jest.fn().mockImplementation(async ({ where }: any) => {
          return Array.from(blocksMap.values()).filter(
            (b) => b.doctorId === where.doctorId,
          );
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 999n }),
      },
    };
  };

  beforeEach(async () => {
    patientsMap = new Map();
    doctorsMap = new Map();
    appointmentsMap = new Map();
    slotsMap = new Map();
    blocksMap = new Map();

    autoApptId = 0n;
    autoPatientId = 0n;
    autoDoctorId = 0n;
    autoSlotId = 0;
    autoBlockId = 0;

    const mockPrisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        PatientService,
        DepartmentService,
        DoctorService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    patientService = module.get<PatientService>(PatientService);
    doctorService = module.get<DoctorService>(DoctorService);

    patient1 = await patientService.create({ name: 'Amina Yousaf' });
    patient2 = await patientService.create({ name: 'Bilal Ahmed' });
    doctor1 = await doctorService.create({ name: 'Dr Nadia Aslam' });
    doctor2 = await doctorService.create({ name: 'Dr Imran Shah' });
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
    });

    // Exact clash
    await expect(
      service.create({
        patient: patient2.id,
        doctor: doctor1.id,
        date: '2026-10-01',
        start: '09:00',
        minutes: 30,
      }),
    ).rejects.toThrow(BadRequestException);

    // Partial overlap (starts during active appointment)
    await expect(
      service.create({
        patient: patient2.id,
        doctor: doctor1.id,
        date: '2026-10-01',
        start: '09:15',
        minutes: 30,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Rule 3: independent doctors can be booked at the exact same time without clash', async () => {
    const app1 = await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
    });

    const app2 = await service.create({
      patient: patient2.id,
      doctor: doctor2.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
    });

    expect(app1.id).toBeDefined();
    expect(app2.id).toBeDefined();
    expect(app1.sTime).toBe(app2.sTime);
  });

  it('Rule 4: cancelled or no-show appointments do not block re-booking of the slot', async () => {
    const app1 = await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
    });

    await service.update(app1.id, { status: 'cancelled' });

    // The slot can now be booked by patient2
    const app2 = await service.create({
      patient: patient2.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
    });

    expect(app2.id).toBeDefined();
    expect(app2.status).toBe('scheduled');
  });

  it('Rule 5: status transitions follow supported clinical lifecycle', async () => {
    const app = await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '10:00',
      minutes: 15,
    });

    expect(app.status).toBe('scheduled');

    const arrived = await service.update(app.id, { status: 'arrived' });
    expect(arrived.status).toBe('arrived');

    const inConsult = await service.update(app.id, { status: 'in consultation' });
    expect(inConsult.status).toBe('in consultation');

    const completed = await service.update(app.id, { status: 'completed' });
    expect(completed.status).toBe('completed');
  });

  it('Rule 6: invalid status values are rejected with 400 Bad Request', async () => {
    const app = await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '11:00',
      minutes: 15,
    });

    await expect(
      service.update(app.id, { status: 'non_existent_status' as any }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Rule 7: updating an appointment allows keeping its own time slot', async () => {
    const app = await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '09:00',
      minutes: 30,
    });

    // Updating remarks while keeping identical doctor, date, and start should succeed
    const updated = await service.update(app.id, {
      remarks: 'Patient requested follow-up notes',
    });

    expect(updated.remarks).toBe('Patient requested follow-up notes');
    expect(updated.sTime).toBe('2026-10-01 09:00:00');
  });

  it('Rule 8: day view filter returns appointments for the requested date', async () => {
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
    addTestSlot({
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
    addTestBlock({
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
    addTestSlot({
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

  it('Rule 13: doctor break hours exclude slots and reject bookings during break', async () => {
    // Weekday 4 (Thursday) with a break between 13:00 and 14:00
    addTestSlot({
      doctorId: doctor2.id,
      weekday: 4,
      startTime: '12:00',
      endTime: '15:00',
      slotMinutes: 30,
      active: true,
      breakStartTime: '13:00',
      breakEndTime: '14:00',
    } as any);

    const slots = await service.getFreeSlots(doctor2.id, '2026-10-01');
    const slotStarts = slots.map((s) => s.start);
    // 12:00, 12:30, 14:00, 14:30 (13:00 and 13:30 should be excluded by the break)
    expect(slotStarts).toContain('12:00');
    expect(slotStarts).toContain('12:30');
    expect(slotStarts).not.toContain('13:00');
    expect(slotStarts).not.toContain('13:30');
    expect(slotStarts).toContain('14:00');
    expect(slotStarts).toContain('14:30');

    // Attempting to book during break time must throw BadRequestException
    await expect(
      service.create({
        patient: patient1.id,
        doctor: doctor2.id,
        date: '2026-10-01',
        start: '13:00',
        minutes: 30,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Rule 14: walk-in creation generates sequential token numbers and checks in immediately', async () => {
    const walkIn1 = await service.createWalkIn({
      patient: patient1.id,
      doctor: doctor1.id,
      priority: 'URGENT',
      reason: 'Sudden chest discomfort',
    });

    expect(walkIn1.status).toBe('waiting');
    expect(walkIn1.tokenNumber).toBe('W-01');
    expect(walkIn1.priority).toBe('URGENT');
    expect(walkIn1.checkedInAt).toBeTruthy();

    const walkIn2 = await service.createWalkIn({
      patient: patient2.id,
      doctor: doctor1.id,
      priority: 'NORMAL',
      reason: 'Routine check-up',
    });

    expect(walkIn2.tokenNumber).toBe('W-02');
    expect(walkIn2.status).toBe('waiting');
  });

  it('Rule 15: patient check-in generates queue token if absent and sets status to waiting', async () => {
    const app = await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '16:00',
      minutes: 15,
      status: 'scheduled',
    });

    expect(app.status).toBe('scheduled');
    expect(app.tokenNumber).toBeNull();

    const checkedIn = await service.checkIn(app.id);
    expect(checkedIn.status).toBe('waiting');
    expect(checkedIn.tokenNumber).toMatch(/^Q-\d{2}$/);
    expect(checkedIn.checkedInAt).toBeTruthy();
  });

  it('Rule 16: OPD queue orders by priority then arrival time and calculates metrics', async () => {
    const today = new Date().toISOString().split('T')[0];

    // Create a NORMAL priority walk-in
    await service.createWalkIn({
      patient: patient1.id,
      doctor: doctor1.id,
      priority: 'NORMAL',
      reason: 'Cold',
    });

    // Create an EMERGENCY priority walk-in
    await service.createWalkIn({
      patient: patient2.id,
      doctor: doctor1.id,
      priority: 'EMERGENCY',
      reason: 'Severe allergic reaction',
    });

    const queue = await service.getOpdQueue(undefined, doctor1.id, today);
    expect(queue.items.length).toBeGreaterThanOrEqual(2);

    // EMERGENCY should be first in queue even though checked in after NORMAL
    expect(queue.items[0].priority).toBe('EMERGENCY');
    expect(queue.items[0].queuePosition).toBe(1);
    expect(queue.summary.totalWaiting).toBeGreaterThanOrEqual(2);
  });

  it('Rule 17: appointment cancellation records reason and prevents completing', async () => {
    const app = await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '16:30',
      minutes: 15,
    });

    const cancelled = await service.cancel(app.id, {
      reason: 'Patient requested cancellation due to personal reasons',
    });

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellationReason).toBe('Patient requested cancellation due to personal reasons');
    expect(cancelled.cancelledAt).toBeTruthy();

    await expect(service.completeConsultation(app.id)).rejects.toThrow(BadRequestException);
  });

  it('Rule 18: appointment rescheduling preserves historical record and creates linked new appointment', async () => {
    const original = await service.create({
      patient: patient1.id,
      doctor: doctor1.id,
      date: '2026-10-01',
      start: '16:45',
      minutes: 15,
    });

    const rescheduled = await service.reschedule(original.id, {
      date: '2026-10-01',
      start: '17:00',
      minutes: 15,
      reason: 'Doctor surgery running late',
    });

    expect(rescheduled.id).not.toBe(original.id);
    expect(rescheduled.rescheduledFromId).toBe(original.id);
    expect(rescheduled.rescheduleReason).toBe('Doctor surgery running late');
    expect(rescheduled.timeSlot).toBe('17:00 - 17:15');

    // Verify original appointment is now marked 'rescheduled'
    const fetchedOriginal = await service.findOne(original.id);
    expect(fetchedOriginal.status).toBe('rescheduled');
  });
});
