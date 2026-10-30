import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PrescriptionService } from './prescription.service';

describe('PrescriptionService', () => {
  let service: PrescriptionService;
  let prisma: any;

  const mockPatient = {
    id: BigInt(1),
    name: 'Amina Yousaf',
    patientId: '000001',
    phone: '03001234567',
  };

  const mockDoctor = {
    id: BigInt(2),
    name: 'Dr Nadia Aslam',
    department: 'Cardiology',
  };

  const mockMedicine = {
    id: BigInt(10),
    name: 'Amoxil',
    generic: 'Amoxicillin',
    company: 'GSK',
    quantity: 50,
  };

  const mockPrescription = {
    id: BigInt(100),
    patientId: BigInt(1),
    doctorId: BigInt(2),
    date: '2026-10-30',
    symptom: 'Cough',
    advice: 'Drink warm water',
    state: 'issued',
    dd: 'Bronchitis',
    medicine: 'Amoxil 1+0+1 for 5 days',
    validity: '30 days',
    note: 'Take after meals',
    patient: mockPatient,
    doctor: mockDoctor,
    medicines: [
      {
        id: BigInt(500),
        prescriptionId: BigInt(100),
        medicineId: BigInt(10),
        name: 'Amoxil',
        dosage: '1+0+1',
        duration: '5 days',
        instructions: 'After meals',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      patient: {
        findUnique: jest.fn(),
      },
      doctor: {
        findUnique: jest.fn(),
      },
      medicine: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      prescription: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      prescriptionMedicine: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<PrescriptionService>(PrescriptionService);
  });

  describe('searchMedicines', () => {
    it('returns top medicines when query is empty', async () => {
      prisma.medicine.findMany.mockResolvedValue([mockMedicine]);

      const result = await service.searchMedicines('');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Amoxil');
      expect(prisma.medicine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('filters medicines by search term', async () => {
      prisma.medicine.findMany.mockResolvedValue([mockMedicine]);

      const result = await service.searchMedicines('Amox');
      expect(result).toHaveLength(1);
      expect(prisma.medicine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated prescriptions with filters', async () => {
      prisma.prescription.count.mockResolvedValue(1);
      prisma.prescription.findMany.mockResolvedValue([mockPrescription]);

      const result = await service.findAll({
        patient: 1,
        doctor: 2,
        drug: 'Amoxil',
        page: 1,
        limit: 10,
      });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('100');
      expect(result.data[0].patient?.name).toBe('Amina Yousaf');
      expect(result.data[0].items[0].name).toBe('Amoxil');
    });
  });

  describe('findById', () => {
    it('returns prescription when found', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);

      const result = await service.findById(100);
      expect(result.id).toBe('100');
      expect(result.doctor?.name).toBe('Dr Nadia Aslam');
    });

    it('throws NotFoundException when prescription does not exist', async () => {
      prisma.prescription.findUnique.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates prescription with catalog medicine and computes legacy summary', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.medicine.findMany.mockResolvedValue([mockMedicine]);
      prisma.prescription.create.mockResolvedValue(mockPrescription);

      const dto = {
        patientId: 1,
        doctorId: 2,
        date: '2026-10-30',
        symptom: 'Cough',
        advice: 'Drink warm water',
        items: [
          {
            medicineId: 10,
            dosage: '1+0+1',
            duration: '5 days',
            instructions: 'After meals',
          },
        ],
      };

      const result = await service.create(dto);
      expect(result.id).toBe('100');
      expect(prisma.prescription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            medicine: 'Amoxil 1+0+1 for 5 days',
          }),
        }),
      );
    });

    it('allows a drug outside catalogue to be prescribed', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.prescription.create.mockResolvedValue({
        ...mockPrescription,
        medicines: [
          {
            id: BigInt(501),
            prescriptionId: BigInt(100),
            medicineId: null,
            name: 'Imported Antifungal',
            dosage: '1+0+0',
            duration: '10 days',
            instructions: null,
          },
        ],
      });

      const dto = {
        patientId: 1,
        doctorId: 2,
        date: '2026-10-30',
        items: [
          {
            name: 'Imported Antifungal',
            dosage: '1+0+0',
            duration: '10 days',
          },
        ],
      };

      const result = await service.create(dto);
      expect(result.items[0].name).toBe('Imported Antifungal');
      expect(result.items[0].medicineId).toBeNull();
    });

    it('drops blank medicine rows', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.medicine.findMany.mockResolvedValue([mockMedicine]);
      prisma.prescription.create.mockResolvedValue(mockPrescription);

      const dto = {
        patientId: 1,
        doctorId: 2,
        date: '2026-10-30',
        items: [
          { medicineId: 10, dosage: '1+0+1' },
          { name: '   ', dosage: '' },
        ],
      };

      const result = await service.create(dto);
      expect(result.items).toHaveLength(1);
    });

    it('throws BadRequestException if no valid medicine rows are provided', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);

      const dto = {
        patientId: 1,
        doctorId: 2,
        date: '2026-10-30',
        items: [{ name: '', dosage: '' }],
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if patient does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);

      const dto = {
        patientId: 999,
        doctorId: 2,
        date: '2026-10-30',
        items: [{ name: 'Panadol' }],
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if doctor does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(null);

      const dto = {
        patientId: 1,
        doctorId: 999,
        date: '2026-10-30',
        items: [{ name: 'Panadol' }],
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if medicineId is not in catalogue', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.medicine.findMany.mockResolvedValue([]); // not found

      const dto = {
        patientId: 1,
        doctorId: 2,
        date: '2026-10-30',
        items: [{ medicineId: 999 }],
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('replaces drug list wholesale and refreshes legacy summary', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.prescription.update.mockResolvedValue({
        ...mockPrescription,
        medicine: 'Paracetamol 1+1+1',
        medicines: [
          {
            id: BigInt(502),
            prescriptionId: BigInt(100),
            medicineId: null,
            name: 'Paracetamol',
            dosage: '1+1+1',
            duration: null,
            instructions: null,
          },
        ],
      });

      const dto = {
        items: [
          {
            name: 'Paracetamol',
            dosage: '1+1+1',
          },
        ],
      };

      const result = await service.update(100, dto);
      expect(prisma.prescriptionMedicine.deleteMany).toHaveBeenCalledWith({
        where: { prescriptionId: BigInt(100) },
      });
      expect(prisma.prescriptionMedicine.createMany).toHaveBeenCalled();
      expect(result.medicine).toBe('Paracetamol 1+1+1');
    });

    it('throws NotFoundException if prescription does not exist', async () => {
      prisma.prescription.findUnique.mockResolvedValue(null);

      await expect(service.update(999, {})).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if updated patient does not exist', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.patient.findUnique.mockResolvedValue(null);

      await expect(service.update(100, { patientId: 999 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException if updated doctor does not exist', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.doctor.findUnique.mockResolvedValue(null);

      await expect(service.update(100, { doctorId: 999 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException if updated items array is empty', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);

      await expect(service.update(100, { items: [] })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('deletes prescription and child line items in transaction', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.prescription.delete.mockResolvedValue(mockPrescription);

      const result = await service.remove(100);
      expect(result.success).toBe(true);
      expect(prisma.prescriptionMedicine.deleteMany).toHaveBeenCalledWith({
        where: { prescriptionId: BigInt(100) },
      });
      expect(prisma.prescription.delete).toHaveBeenCalledWith({
        where: { id: BigInt(100) },
      });
    });

    it('throws NotFoundException if prescription does not exist', async () => {
      prisma.prescription.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
