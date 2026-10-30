import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentService } from '../department/department.service';
import { PrismaService } from '../prisma/prisma.service';
import { DoctorService } from './doctor.service';

describe('DoctorService (Legacy Business Rule Parity)', () => {
  let service: DoctorService;
  let doctorsMap: Map<string, any>;
  let apptsMap: Map<string, any>;
  let autoDocId: bigint;
  let autoApptId: bigint;

  const mockPrismaService = {
    doctor: {
      findMany: jest.fn().mockImplementation(async ({ where, select, skip = 0, take = 50 }: any) => {
        if (select?.department) {
          return Array.from(doctorsMap.values())
            .filter((d) => Boolean(d.department))
            .map((d) => ({ department: d.department }));
        }
        let all = Array.from(doctorsMap.values());
        if (where?.OR) {
          all = all.filter((d) =>
            where.OR.some((clause: any) => {
              for (const [key, val] of Object.entries(clause)) {
                const target = d[key];
                const term = (val as any)?.contains;
                if (target && term && String(target).toLowerCase().includes(term.toLowerCase())) {
                  return true;
                }
              }
              return false;
            }),
          );
        }
        all.sort((a, b) => a.name.localeCompare(b.name));
        return all.slice(skip, skip + take);
      }),
      count: jest.fn().mockImplementation(async ({ where }: any) => {
        if (!where?.OR) return doctorsMap.size;
        return Array.from(doctorsMap.values()).filter((d) =>
          where.OR.some((clause: any) => {
            for (const [key, val] of Object.entries(clause)) {
              const target = d[key];
              const term = (val as any)?.contains;
              if (target && term && String(target).toLowerCase().includes(term.toLowerCase())) {
                return true;
              }
            }
            return false;
          }),
        ).length;
      }),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        return doctorsMap.get(where.id.toString()) || null;
      }),
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        const email = where?.email?.equals?.toLowerCase();
        for (const d of doctorsMap.values()) {
          if (where.NOT && d.id === where.NOT.id) continue;
          if (d.email && d.email.toLowerCase() === email) return d;
        }
        return null;
      }),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        autoDocId++;
        const id = autoDocId;
        const record = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        doctorsMap.set(id.toString(), record);
        return record;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const d = doctorsMap.get(where.id.toString());
        if (!d) throw new Error('Not found');
        const updated = { ...d, ...data, updatedAt: new Date() };
        doctorsMap.set(where.id.toString(), updated);
        return updated;
      }),
      delete: jest.fn().mockImplementation(async ({ where }: any) => {
        doctorsMap.delete(where.id.toString());
        return { id: where.id };
      }),
    },
    appointment: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        for (const a of apptsMap.values()) {
          if (a.doctorId === where.doctorId) return a;
        }
        return null;
      }),
      count: jest.fn().mockImplementation(async ({ where }: any) => {
        let count = 0;
        for (const a of apptsMap.values()) {
          if (a.doctorId === where.doctorId) {
            if (where.status?.notIn && where.status.notIn.includes(a.status)) continue;
            count++;
          }
        }
        return count;
      }),
    },
    department: {
      findMany: jest.fn().mockImplementation(async () => [
        { name: 'Cardiology' },
        { name: 'Dermatology' },
      ]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: 999n,
        ...data,
      })),
    },
  };

  const mockDepartmentService = {
    findAll: jest.fn().mockResolvedValue({
      departments: [{ name: 'Cardiology' }, { name: 'Dermatology' }],
      unlisted: [],
    }),
  };

  // Test helper to seed appointments for testing deletion and upcoming counts
  const seedTestAppointment = (doctorId: string, status = 'scheduled', date?: string) => {
    autoApptId++;
    const id = autoApptId.toString();
    const apptDate = date || new Date().toISOString().slice(0, 10);
    apptsMap.set(id, {
      id,
      doctorId: BigInt(doctorId),
      status,
      date: apptDate,
    });
    return id;
  };

  beforeEach(async () => {
    doctorsMap = new Map();
    apptsMap = new Map();
    autoDocId = 0n;
    autoApptId = 0n;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: DepartmentService,
          useValue: mockDepartmentService,
        },
      ],
    }).compile();

    service = module.get<DoctorService>(DoctorService);
  });

  it('Rule 1: a doctor can be added with only a name', async () => {
    const doctor = await service.create({ name: 'Dr Sana Riaz' });

    expect(doctor).toBeDefined();
    expect(doctor.name).toBe('Dr Sana Riaz');
    expect(doctor.email).toBeNull();
    expect(doctor.department).toBeNull();
    expect(doctor.hasLogin).toBe(false);
    expect(typeof doctor.id).toBe('string');
  });

  it('Rule 2: the name is required and rejects empty string', async () => {
    await expect(service.create({ name: '   ' })).rejects.toThrow(
      new BadRequestException('Doctor name is required'),
    );
  });

  it('Rule 3: two doctors cannot share an email address', async () => {
    await service.create({ name: 'Dr One', email: 'same@example.test' });

    await expect(service.create({ name: 'Dr Two', email: 'same@example.test' })).rejects.toThrow(
      new BadRequestException('Another doctor is already on file with that email address.'),
    );
  });

  it('Rule 4: a blank email does not clash with another blank email', async () => {
    const doc1 = await service.create({ name: 'Dr One' });
    const doc2 = await service.create({ name: 'Dr Two' });

    expect(doc1.id).toBeDefined();
    expect(doc2.id).toBeDefined();
    expect(doc1.id).not.toBe(doc2.id);

    const list = await service.findAll({});
    expect(list.items.length).toBe(2);
  });

  it('Rule 5: editing a doctor keeps their own email and updates department', async () => {
    const created = await service.create({
      name: 'Dr One',
      email: 'one@example.test',
      department: 'General',
    });

    const updated = await service.update(created.id, {
      name: 'Dr One Updated',
      email: 'one@example.test',
      department: 'Cardiology',
    });

    expect(updated.name).toBe('Dr One Updated');
    expect(updated.email).toBe('one@example.test');
    expect(updated.department).toBe('Cardiology');
  });

  it('Rule 6: a doctor with appointments is not deleted', async () => {
    const doctor = await service.create({ name: 'Dr Busy' });
    seedTestAppointment(doctor.id, 'scheduled');

    await expect(service.remove(doctor.id)).rejects.toThrow(
      new BadRequestException('Dr Busy has appointments on file, so the record stays.'),
    );
  });

  it('Rule 7: a doctor with no appointments is deleted', async () => {
    const doctor = await service.create({ name: 'Dr Locum' });

    const result = await service.remove(doctor.id);
    expect(result.message).toBe('Removed Dr Locum.');

    await expect(service.findById(doctor.id)).rejects.toThrow(NotFoundException);
  });

  it('Rule 8: the list can be searched by department and name', async () => {
    await service.create({ name: 'Dr Heart', department: 'Cardiology' });
    await service.create({ name: 'Dr Bone', department: 'Orthopaedics' });

    const searchCardio = await service.findAll({ q: 'Cardio' });
    expect(searchCardio.items.length).toBe(1);
    expect(searchCardio.items[0].name).toBe('Dr Heart');

    const searchBone = await service.findAll({ q: 'Bone' });
    expect(searchBone.items.length).toBe(1);
    expect(searchBone.items[0].name).toBe('Dr Bone');
  });

  it('Rule 9: upcoming appointments count is accurately tracked per doctor', async () => {
    const doctor = await service.create({ name: 'Dr Popular' });
    const today = new Date().toISOString().slice(0, 10);

    // Active future appointment
    seedTestAppointment(doctor.id, 'scheduled', today);
    seedTestAppointment(doctor.id, 'confirmed', today);
    // Cancelled appointment (should not be counted in active upcoming load)
    seedTestAppointment(doctor.id, 'cancelled', today);

    const docDetail = await service.findById(doctor.id);
    expect(docDetail.upcomingAppointments).toBe(2);
  });

  it('Rule 10: department suggestions merge listed catalogue with doctor in-use strings', async () => {
    await service.create({ name: 'Dr Brain', department: 'Neurology' });

    const suggestions = await service.getDepartmentSuggestions();
    expect(suggestions).toContain('Cardiology');
    expect(suggestions).toContain('Neurology');
  });
});
