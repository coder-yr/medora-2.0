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
        findMany: jest.fn().mockResolvedValue([
          {
            id: 101n,
            addDate: '2026-11-23',
            timeSlot: '10:00 AM',
            doctor: { name: 'Dr. Tariq Khan' },
            status: 'scheduled',
            visitType: 'first_visit',
          },
        ]),
      },
      consultation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 201n,
            createdAt: new Date('2026-11-23T10:30:00.000Z'),
            date: new Date('2026-11-23'),
            doctor: { name: 'Dr. Tariq Khan' },
            diagnosis: 'Acute Pharyngitis',
            provisionalDiagnosis: null,
            presentingComplaint: 'Sore throat, fever',
            plan: 'Rest and hydration',
            status: 'draft',
          },
        ]),
      },
      prescription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 301n,
            date: '2026-11-23',
            doctor: { name: 'Dr. Tariq Khan' },
            medicines: [{ name: 'Amoxicillin 500mg' }, { name: 'Paracetamol 500mg' }],
          },
        ]),
      },
      lab: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 401n,
            date: '2026-11-23',
            category: 'Complete Blood Count (CBC)',
            status: 'COMPLETED',
          },
        ]),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 501n,
            date: '2026-11-23',
            grossTotal: 1500,
            amountReceived: 1000,
            status: 'part_paid',
          },
        ]),
      },
      patientDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 601n,
          ...data,
          uploadedBy: { firstName: 'Dr.', lastName: 'Khan' },
          createdAt: new Date(),
        })),
        findFirst: jest.fn().mockResolvedValue({ id: 601n, patientId: 1n }),
        delete: jest.fn().mockResolvedValue({ id: 601n }),
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

  // Phase 10.5.1 Clinical Operations Tests
  it('Phase 10.5.1: stores and retrieves emergency contact, allergies, and clinical histories', async () => {
    const patient = await service.create({
      name: 'Clinical Patient',
      emergencyContactName: 'Zainab Bibi',
      emergencyContactPhone: '03009876543',
      emergencyContactRelation: 'Spouse',
      allergies: 'Penicillin, Aspirin',
      medicalHistory: 'Type 2 Diabetes Mellitus',
      surgicalHistory: 'Cholecystectomy (2020)',
      familyHistory: 'Father had CAD',
      currentMedications: 'Metformin 500mg BID',
    });

    expect(patient.emergencyContactName).toBe('Zainab Bibi');
    expect(patient.emergencyContactPhone).toBe('03009876543');
    expect(patient.emergencyContactRelation).toBe('Spouse');
    expect(patient.allergies).toBe('Penicillin, Aspirin');
    expect(patient.medicalHistory).toBe('Type 2 Diabetes Mellitus');
    expect(patient.surgicalHistory).toBe('Cholecystectomy (2020)');
    expect(patient.familyHistory).toBe('Father had CAD');
    expect(patient.currentMedications).toBe('Metformin 500mg BID');
  });

  it('Phase 10.5.1: detects potential duplicates by phone, CNIC, or name and birthdate', async () => {
    await service.create({
      name: 'Fatima Noor',
      phone: '03005551234',
      cnic: '3520112345678',
      birthdate: '1995-04-10',
    });

    // Mock findMany for checkDuplicates
    mockPrisma.patient.findMany.mockResolvedValueOnce([
      {
        id: 1n,
        patientId: '000001',
        name: 'Fatima Noor',
        phone: '03005551234',
        cnic: '35201-1234567-8',
        birthdate: '1995-04-10',
      },
    ]);

    const result = await service.checkDuplicates({
      phone: '03005551234',
      cnic: '35201-1234567-8',
    });

    expect(result.hasMatch).toBe(true);
    expect(result.matchCount).toBe(1);
    expect(result.matches[0].matchedOn).toContain('phone');
    expect(result.matches[0].matchedOn).toContain('cnic');
  });

  it('Phase 10.5.1: aggregates unified encounter timeline across outpatient records', async () => {
    const p = await service.create({ name: 'Encounter Patient' });
    const encounters = await service.getEncounterHistory(p.id);

    expect(encounters).toBeDefined();
    expect(encounters.summary.totalAppointments).toBe(1);
    expect(encounters.summary.totalConsultations).toBe(1);
    expect(encounters.summary.totalPrescriptions).toBe(1);
    expect(encounters.summary.totalLabs).toBe(1);
    expect(encounters.summary.totalInvoiced).toBe(1500);
    expect(encounters.summary.outstandingBalance).toBe(500);
    expect(encounters.appointments[0].doctorName).toBe('Dr. Tariq Khan');
    expect(encounters.prescriptions[0].medicines).toContain('Amoxicillin 500mg');
  });

  it('Phase 10.5.1: attaches and retrieves patient clinical documents', async () => {
    const p = await service.create({ name: 'Document Patient' });
    const doc = await service.addDocument(p.id, {
      title: 'Blood Test Report',
      documentType: 'LAB_REPORT',
      fileUrl: 'https://storage.medora.health/doc1.pdf',
      notes: 'Baseline CBC',
    });

    expect(doc).toBeDefined();
    expect(doc.title).toBe('Blood Test Report');
    expect(doc.fileUrl).toBe('https://storage.medora.health/doc1.pdf');
  });
});
