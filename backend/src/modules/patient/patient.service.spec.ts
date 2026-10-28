import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PatientService } from './patient.service';

describe('PatientService (Legacy Business Rule Parity)', () => {
  let service: PatientService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      connected: false,
    };
    service = new PatientService(mockPrisma);
    service.clearMemoryStore();
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
});
