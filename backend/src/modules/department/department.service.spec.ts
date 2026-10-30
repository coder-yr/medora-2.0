import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DepartmentService } from './department.service';

describe('DepartmentService (Legacy Business Rule Parity)', () => {
  let service: DepartmentService;
  let deptsMap: Map<string, any>;
  let docsMap: Map<string, any>;
  let autoDeptId: bigint;

  const mockPrismaService = {
    department: {
      findMany: jest.fn().mockImplementation(async () => {
        const arr = Array.from(deptsMap.values());
        arr.sort((a, b) => a.name.localeCompare(b.name));
        return arr;
      }),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        return deptsMap.get(where.id.toString()) || null;
      }),
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        const nameVal = where?.name?.equals?.toLowerCase();
        for (const d of deptsMap.values()) {
          if (where.NOT && d.id === where.NOT.id) continue;
          if (d.name.toLowerCase() === nameVal) return d;
        }
        return null;
      }),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        autoDeptId++;
        const id = autoDeptId;
        const record = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        deptsMap.set(id.toString(), record);
        return record;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const d = deptsMap.get(where.id.toString());
        if (!d) throw new Error('Not found');
        const updated = { ...d, ...data, updatedAt: new Date() };
        deptsMap.set(where.id.toString(), updated);
        return updated;
      }),
      delete: jest.fn().mockImplementation(async ({ where }: any) => {
        deptsMap.delete(where.id.toString());
        return { id: where.id };
      }),
    },
    doctor: {
      findMany: jest.fn().mockImplementation(async () => {
        return Array.from(docsMap.values()).map((doc) => ({ department: doc.department }));
      }),
      count: jest.fn().mockImplementation(async ({ where }: any) => {
        let count = 0;
        for (const doc of docsMap.values()) {
          if (doc.department === where.department) count++;
        }
        return count;
      }),
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        let count = 0;
        for (const doc of docsMap.values()) {
          if (doc.department === where.department) {
            doc.department = data.department;
            count++;
          }
        }
        return { count };
      }),
    },
    $transaction: jest.fn().mockImplementation(async (promises: any) => {
      if (Array.isArray(promises)) {
        return Promise.all(promises);
      }
      return promises(mockPrismaService);
    }),
  };

  // Helper in test scope only to seed test doctors
  const seedTestDoctor = (id: string, name: string, department: string | null) => {
    docsMap.set(id, { id, name, department });
  };

  beforeEach(async () => {
    deptsMap = new Map();
    docsMap = new Map();
    autoDeptId = 0n;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
  });

  it('Rule 1: adding a department with a valid name succeeds', async () => {
    const created = await service.create({
      name: 'Cardiology',
      description: 'Adult cardiology',
    });

    expect(created.id).toBe('1');
    expect(created.name).toBe('Cardiology');
    expect(created.description).toBe('Adult cardiology');
    expect(created.doctorCount).toBe(0);
    expect(typeof created.id).toBe('string');
  });

  it('Rule 2: department name is required and rejects empty string', async () => {
    await expect(service.create({ name: '   ' })).rejects.toThrow(BadRequestException);
  });

  it('Rule 3: two departments cannot share the same name (case-insensitive)', async () => {
    await service.create({ name: 'Pediatrics' });

    await expect(service.create({ name: 'pediatrics' })).rejects.toThrow(
      new BadRequestException('That department is already on the list.'),
    );
  });

  it('Rule 4: departments are listed alphabetically with doctor usage counts', async () => {
    await service.create({ name: 'Neurology' });
    await service.create({ name: 'Cardiology' });
    await service.create({ name: 'Dermatology' });

    seedTestDoctor('101', 'Dr Heart', 'Cardiology');
    seedTestDoctor('102', 'Dr Pulse', 'Cardiology');
    seedTestDoctor('103', 'Dr Skin', 'Dermatology');

    const result = await service.findAll();
    expect(result.departments.length).toBe(3);
    expect(result.departments[0].name).toBe('Cardiology');
    expect(result.departments[0].doctorCount).toBe(2);

    expect(result.departments[1].name).toBe('Dermatology');
    expect(result.departments[1].doctorCount).toBe(1);

    expect(result.departments[2].name).toBe('Neurology');
    expect(result.departments[2].doctorCount).toBe(0);
  });

  it('Rule 5: unlisted departments used by doctors are identified', async () => {
    await service.create({ name: 'Cardiology' });

    seedTestDoctor('201', 'Dr Heart', 'Cardiology');
    seedTestDoctor('202', 'Dr Bone', 'Orthopaedics');
    seedTestDoctor('203', 'Dr Eye', 'Ophthalmology');

    const result = await service.findAll();
    expect(result.unlisted).toEqual(['Ophthalmology', 'Orthopaedics']);
  });

  it('Rule 6: renaming a department cascades to doctors and reports moved records', async () => {
    const dept = await service.create({ name: 'Cardio' });
    seedTestDoctor('301', 'Dr Heart', 'Cardio');
    seedTestDoctor('302', 'Dr Pulse', 'Cardio');

    const updateResult = await service.update(dept.id, { name: 'Cardiology' });
    expect(updateResult.department.name).toBe('Cardiology');
    expect(updateResult.movedDoctors).toBe(2);
    expect(updateResult.message).toContain('2 doctor record(s) moved with it');

    const list = await service.findAll();
    const cardiology = list.departments.find((d) => d.name === 'Cardiology');
    expect(cardiology?.doctorCount).toBe(2);
  });

  it('Rule 7: updating a department to an existing name throws clash exception', async () => {
    await service.create({ name: 'Cardiology' });
    const oncology = await service.create({ name: 'Oncology' });

    await expect(service.update(oncology.id, { name: 'Cardiology' })).rejects.toThrow(
      new BadRequestException('That department is already on the list.'),
    );
  });

  it('Rule 8: a department with active doctors CANNOT be deleted', async () => {
    const dept = await service.create({ name: 'Radiology' });
    seedTestDoctor('401', 'Dr Ray', 'Radiology');

    await expect(service.remove(dept.id)).rejects.toThrow(
      new BadRequestException(
        'Radiology has 1 doctor(s) in it. Move them first, or rename it instead.',
      ),
    );
  });

  it('Rule 9: a department with zero doctors is deleted successfully', async () => {
    const dept = await service.create({ name: 'Empty Dept' });

    const result = await service.remove(dept.id);
    expect(result.message).toBe('Empty Dept removed.');

    await expect(service.findById(dept.id)).rejects.toThrow(NotFoundException);
  });

  it('Rule 10: adopt auto-creates catalogue records for all unlisted doctor departments', async () => {
    await service.create({ name: 'Cardiology' });
    seedTestDoctor('501', 'Dr Bone', 'Orthopaedics');
    seedTestDoctor('502', 'Dr Brain', 'Neurology');

    const adoptResult = await service.adopt();
    expect(adoptResult.adoptedCount).toBe(2);
    expect(adoptResult.adoptedNames).toEqual(['Neurology', 'Orthopaedics']);

    const list = await service.findAll();
    expect(list.unlisted.length).toBe(0);
    expect(list.departments.length).toBe(3);
  });

  it('Rule 11: adopt when nothing is unlisted returns clean message', async () => {
    await service.create({ name: 'Cardiology' });
    seedTestDoctor('601', 'Dr Heart', 'Cardiology');

    const adoptResult = await service.adopt();
    expect(adoptResult.adoptedCount).toBe(0);
    expect(adoptResult.adoptedNames).toEqual([]);
    expect(adoptResult.message).toContain('Nothing to adopt');
  });
});
