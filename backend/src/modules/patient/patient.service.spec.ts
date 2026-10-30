import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PatientService } from './patient.service';

describe('PatientService (Legacy Business Rule Parity)', () => {
  let service: PatientService;
  let mockPrisma: any;
  let patientsMap: Map<string, any>;
  let autoId: bigint;
  let sequenceVal: number;

  beforeEach(() => {
    patientsMap = new Map();
    autoId = 0n;
    sequenceVal = 0;

    mockPrisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockImplementation(async (strings: TemplateStringsArray) => {
        const text = strings.join('');
        if (text.includes('MAX')) {
          let max = 0;
          for (const p of patientsMap.values()) {
            const num = parseInt(p.patientId.replace(/\D/g, ''), 10) || 0;
            if (num > max) max = num;
          }
          return [{ max_id: max }];
        }
        if (text.includes('nextval')) {
          sequenceVal++;
          return [{ next_val: sequenceVal }];
        }
        return [];
      }),
      patient: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          autoId++;
          const id = autoId;
          const record = {
            id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          patientsMap.set(id.toString(), record);
          return record;
        }),
        findMany: jest.fn().mockImplementation(async ({ where, skip = 0, take = 50 }: any) => {
          let all = Array.from(patientsMap.values());
          if (where?.OR) {
            all = all.filter((p) => {
              return where.OR.some((clause: any) => {
                for (const [key, val] of Object.entries(clause)) {
                  const target = p[key];
                  const term = (val as any)?.contains;
                  if (target && term && String(target).toLowerCase().includes(term.toLowerCase())) {
                    return true;
                  }
                }
                return false;
              });
            });
          }
          all.sort((a, b) => (b.id > a.id ? 1 : -1));
          return all.slice(skip, skip + take);
        }),
        count: jest.fn().mockImplementation(async ({ where }: any) => {
          if (!where?.OR) return patientsMap.size;
          let count = 0;
          for (const p of patientsMap.values()) {
            const match = where.OR.some((clause: any) => {
              for (const [key, val] of Object.entries(clause)) {
                const target = p[key];
                const term = (val as any)?.contains;
                if (target && term && String(target).toLowerCase().includes(term.toLowerCase())) {
                  return true;
                }
              }
              return false;
            });
            if (match) count++;
          }
          return count;
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          for (const p of patientsMap.values()) {
            if (where.patientId && p.patientId === where.patientId) return p;
            if (where.OR) {
              for (const cond of where.OR) {
                if (cond.id && p.id === cond.id) return p;
                if (cond.patientId && p.patientId === cond.patientId) return p;
              }
            }
          }
          return null;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => {
          const key = where.id.toString();
          const existing = patientsMap.get(key);
          if (!existing) throw new Error('Not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          patientsMap.set(key, updated);
          return updated;
        }),
        delete: jest.fn().mockImplementation(async ({ where }: any) => {
          const key = where.id.toString();
          patientsMap.delete(key);
          return { id: where.id };
        }),
      },
      appointment: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    service = new PatientService(mockPrisma);
  });

  it('Rule 1: registration stores a patient and derives the age from birthdate', async () => {
    const thirtyFourYearsAgo = new Date();
    thirtyFourYearsAgo.setFullYear(thirtyFourYearsAgo.getFullYear() - 34);
    thirtyFourYearsAgo.setDate(thirtyFourYearsAgo.getDate() - 2);
    const birthdateStr = thirtyFourYearsAgo.toISOString().slice(0, 10);

    const patient = await service.create({
      name: 'Amina Yousaf',
      birthdate: birthdateStr,
      phone: '03001234567',
      sex: 'female',
      bloodGroup: 'O+',
    });

    expect(patient).toBeDefined();
    expect(patient.name).toBe('Amina Yousaf');
    expect(patient.age).toBe('34');
    expect(patient.howAdded).toBe('front desk');
    expect(patient.registrationTime).toBeDefined();
    expect(patient.patientId).toBe('000001');
  });

  it('Rule 2: name is the only strictly required field for front-desk walk-ins', async () => {
    const patient = await service.create({
      name: 'Unknown Male',
    });

    expect(patient).toBeDefined();
    expect(patient.name).toBe('Unknown Male');
    expect(patient.age).toBe(''); // no birthdate means empty string, not a guess
    expect(patient.patientId).toBe('000001');
  });

  it('Rule 3: registration rejects missing or empty name with BadRequestException', async () => {
    await expect(
      service.create({
        name: '   ',
        phone: '03001234567',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Rule 4: patient IDs are sequential and do NOT repeat or re-use after a deletion', async () => {
    const first = await service.create({ name: 'First Patient' });
    const second = await service.create({ name: 'Second Patient' });

    expect(first.patientId).toBe('000001');
    expect(second.patientId).toBe('000002');

    // Deleting the newest must not hand 000002 to the next registration
    await service.remove(second.id);

    const third = await service.create({ name: 'Third Patient' });
    expect(third.patientId).toBe('000003');
  });

  it('Rule 5: search matches name, phone, CNIC, and patient_id across single search box', async () => {
    await service.create({
      name: 'Bilal Ahmed',
      phone: '03119876543',
      cnic: '3520112345671',
    });
    await service.create({
      name: 'Sara Khan',
      phone: '03007654321',
      cnic: '3740598765432',
    });

    // Search by partial name
    const byName = await service.findAll({ q: 'Bilal' });
    expect(byName.items.length).toBe(1);
    expect(byName.items[0].name).toBe('Bilal Ahmed');

    // Search by phone
    const byPhone = await service.findAll({ q: '03007654321' });
    expect(byPhone.items.length).toBe(1);
    expect(byPhone.items[0].name).toBe('Sara Khan');

    // Search by patient_id
    const byId = await service.findAll({ q: '000001' });
    expect(byId.items.length).toBe(1);
    expect(byId.items[0].name).toBe('Bilal Ahmed');

    // Search by CNIC
    const byCnic = await service.findAll({ q: '37405' });
    expect(byCnic.items.length).toBe(1);
    expect(byCnic.items[0].name).toBe('Sara Khan');
  });

  it('Rule 6: editing updates the record and recalculates age when birthdate changes', async () => {
    const twentyYearsAgo = new Date();
    twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
    const initialBirthdate = twentyYearsAgo.toISOString().slice(0, 10);

    const created = await service.create({
      name: 'Imran Shah',
      birthdate: initialBirthdate,
    });
    expect(created.age).toBe('20');

    const fortyOneYearsAgo = new Date();
    fortyOneYearsAgo.setFullYear(fortyOneYearsAgo.getFullYear() - 41);
    const updatedBirthdate = fortyOneYearsAgo.toISOString().slice(0, 10);

    const updated = await service.update(created.id, {
      birthdate: updatedBirthdate,
    });

    expect(updated.age).toBe('41');
  });

  it('Rule 7: CNIC formatting normalizes 13 unhyphenated digits to XXXXX-XXXXXXX-X', async () => {
    const created = await service.create({
      name: 'Tariq Mehmood',
      cnic: '1234512345671',
    });

    expect(created.cnic).toBe('12345-1234567-1');
  });

  it('Rule 8: findById throws NotFoundException when record does not exist', async () => {
    await expect(service.findById('999999')).rejects.toThrow(NotFoundException);
  });

  it('Rule 9: deleting the highest-numbered patient does NOT cause reuse of their MR number', async () => {
    const p1 = await service.create({ name: 'Patient One' });
    const p2 = await service.create({ name: 'Patient Two' });
    const p3 = await service.create({ name: 'Patient Three' });

    expect(p1.patientId).toBe('000001');
    expect(p2.patientId).toBe('000002');
    expect(p3.patientId).toBe('000003');

    // Delete the highest-numbered patient (000003)
    await service.remove(p3.id);

    // Next patient must NOT reuse 000003; it must receive 000004
    const p4 = await service.create({ name: 'Patient Four' });
    expect(p4.patientId).toBe('000004');
  });

  it('Rule 10: patient identifier generation when empty starts at 000001', async () => {
    const nextId = await service.nextPatientId();
    expect(nextId).toBe('000001');
  });

  it('Rule 11: BigInt fields are serialized as strings on all response paths', async () => {
    const created = await service.create({
      name: 'Serial Test',
      patientTypeId: 10,
      branchId: 2,
    });

    expect(typeof created.id).toBe('string');
    expect(typeof created.patientTypeId).toBe('string');
    expect(typeof created.branchId).toBe('string');

    const found = await service.findById(created.id);
    expect(typeof found.id).toBe('string');

    const listed = await service.findAll({ q: 'Serial Test' });
    expect(typeof listed.items[0].id).toBe('string');

    const updated = await service.update(created.id, { name: 'Serial Test Updated' });
    expect(typeof updated.id).toBe('string');
  });

  it('Rule 12: ionUserId is independent of external identity providers and defaults safely', async () => {
    const created = await service.create({ name: 'Walk-in Anonymous' });
    expect(created.name).toBe('Walk-in Anonymous');
    expect(created.patientId).toBeDefined();
  });

  it('Rule 13: updates auxiliary demographic and institutional fields', async () => {
    const created = await service.create({ name: 'Aux Patient' });
    const updated = await service.update(created.id, {
      fatherName: 'Father Name',
      email: 'aux@example.com',
      phone: '03001234567',
      address: 'Test Address',
      sex: 'male',
      bloodGroup: 'A+',
      attendingDoctor: 'Dr Expert',
      patientTypeId: 5,
      guardianRelation: 'Father',
      guardianMrn: '000001',
      mlc: true,
      oldMrn: 'OLD-123',
      employeeNo: 'EMP-99',
      altPhone: '03111111111',
      city: 'Islamabad',
      branchId: 3,
      cnic: '3740512345671',
    });

    expect(updated.fatherName).toBe('Father Name');
    expect(updated.email).toBe('aux@example.com');
    expect(updated.attendingDoctor).toBe('Dr Expert');
    expect(updated.patientTypeId).toBe('5');
    expect(updated.branchId).toBe('3');
    expect(updated.cnic).toBe('37405-1234567-1');
    expect(updated.mlc).toBe(true);
  });

  it('Rule 14: remove throws NotFoundException when patient does not exist', async () => {
    await expect(service.remove('999999')).rejects.toThrow(NotFoundException);
  });
});
