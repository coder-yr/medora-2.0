import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentService } from '../department/department.service';
import { PrismaService } from '../prisma/prisma.service';
import { DoctorService } from './doctor.service';

describe('DoctorService (Legacy Business Rule Parity)', () => {
  let service: DoctorService;

  const mockPrismaService = {
    connected: false,
    doctor: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    department: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockDepartmentService = {
    findAll: jest.fn().mockResolvedValue({
      departments: [{ name: 'Cardiology' }, { name: 'Dermatology' }],
      unlisted: [],
    }),
    seedMemoryDoctor: jest.fn(),
  };

  beforeEach(async () => {
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
    service.clearMemoryStore();
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
    service.seedMemoryAppointment(doctor.id, 'scheduled');

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
    service.seedMemoryAppointment(doctor.id, 'scheduled', today);
    service.seedMemoryAppointment(doctor.id, 'confirmed', today);
    // Cancelled appointment (should not be counted in active upcoming load)
    service.seedMemoryAppointment(doctor.id, 'cancelled', today);

    const docDetail = await service.findById(doctor.id);
    expect(docDetail.upcomingAppointments).toBe(2);
  });

  it('Rule 10: department suggestions merge listed catalogue with doctor in-use strings', async () => {
    await service.create({ name: 'Dr Brain', department: 'Neurology' });

    const suggestions = await service.getDepartmentSuggestions();
    expect(suggestions).toContain('Cardiology');
    expect(suggestions).toContain('Dermatology');
    expect(suggestions).toContain('Neurology');
  });

  it('Rule 11: optional login provisioning creates user account and links ionUserId', async () => {
    const doctor = await service.create({
      name: 'Dr Account',
      loginUsername: 'dr.account',
      loginPassword: 'DoctorSecret123!',
    });

    expect(doctor.hasLogin).toBe(true);
    expect(doctor.loginUsername).toBe('dr.account');
    expect(doctor.ionUserId).toBeDefined();
  });

  it('Rule 12: BigInt fields are serialized as strings on all response paths', async () => {
    const created = await service.create({
      name: 'Dr BigInt',
      branchId: 1,
    });

    expect(typeof created.id).toBe('string');
    expect(typeof created.branchId).toBe('string');

    const found = await service.findById(created.id);
    expect(typeof found.id).toBe('string');

    const listed = await service.findAll({ q: 'BigInt' });
    expect(typeof listed.items[0].id).toBe('string');
  });
});
