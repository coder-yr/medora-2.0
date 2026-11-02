import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LaboratoryService } from './laboratory.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LaboratoryService (Unit)', () => {
  let service: LaboratoryService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      labCategory: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      labTestParameter: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      lab: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      labSample: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      labTest: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      labResultParameter: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
      },
      labReportAmendment: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      patient: {
        findUnique: jest.fn(),
      },
      doctor: {
        findUnique: jest.fn(),
      },
      appointment: {
        findUnique: jest.fn(),
      },
      consultation: {
        findUnique: jest.fn(),
      },
      payment: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaboratoryService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<LaboratoryService>(LaboratoryService);
  });

  describe('Catalogue Management', () => {
    it('creates a new test catalogue item with parameters', async () => {
      prismaMock.labCategory.findFirst.mockResolvedValue(null);
      prismaMock.labCategory.create.mockResolvedValue({
        id: 1n,
        category: 'Complete Blood Count (CBC)',
        description: 'Automated 5-part differential',
        price: 1500,
        sampleType: 'EDTA Blood',
        turnaroundHours: 4,
        isActive: true,
        parameters: [
          { id: 1n, name: 'Hemoglobin', unit: 'g/dL', referenceRange: '13.5 - 17.5' },
        ],
      });

      const res = await service.createCatalogueItem({
        category: 'Complete Blood Count (CBC)',
        description: 'Automated 5-part differential',
        price: 1500,
        sampleType: 'EDTA Blood',
        turnaroundHours: 4,
        parameters: [
          { name: 'Hemoglobin', unit: 'g/dL', referenceRange: '13.5 - 17.5' },
        ],
      });

      expect(res.category).toBe('Complete Blood Count (CBC)');
      expect(res.parameters).toHaveLength(1);
    });

    it('rejects duplicate test catalogue names with ConflictException', async () => {
      prismaMock.labCategory.findFirst.mockResolvedValue({ id: 1n, category: 'CBC' });

      await expect(
        service.createCatalogueItem({
          category: 'CBC',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('prevents deletion of a test that has been requested in lab_test', async () => {
      prismaMock.labCategory.findUnique.mockResolvedValue({ id: 1n, category: 'Haemoglobin' });
      prismaMock.labTest.count.mockResolvedValue(5);

      await expect(service.deleteCatalogueItem(1)).rejects.toThrow(BadRequestException);
    });

    it('allows deletion of an unrequested catalogue item', async () => {
      prismaMock.labCategory.findUnique.mockResolvedValue({ id: 2n, category: 'Unused Test' });
      prismaMock.labTest.count.mockResolvedValue(0);
      prismaMock.labCategory.delete.mockResolvedValue({ id: 2n });

      const res = await service.deleteCatalogueItem(2);
      expect(res.message).toContain('removed from catalogue');
    });
  });

  describe('Order Creation & Lifecycle', () => {
    it('creates a lab order, samples, test lines, and parameter placeholders', async () => {
      prismaMock.patient.findUnique.mockResolvedValue({ id: 10n, name: 'Amina Yousaf', phone: '03001234567' });
      prismaMock.doctor.findUnique.mockResolvedValue({ id: 5n, name: 'Dr. Bilal' });
      prismaMock.labCategory.findMany.mockResolvedValue([
        {
          id: 1n,
          category: 'CBC',
          price: 1500,
          sampleType: 'EDTA Blood',
          referenceValue: 'See panel',
          parameters: [{ id: 100n, name: 'Hb', unit: 'g/dL', referenceRange: '13-17' }],
        },
      ]);

      prismaMock.lab.create.mockResolvedValue({ id: 101n, status: 'ORDERED' });
      prismaMock.labSample.create.mockResolvedValue({ id: 501n, sampleNumber: 'SMP-20261031-101-1' });
      prismaMock.labTest.create.mockResolvedValue({ id: 201n, name: 'CBC' });
      prismaMock.labResultParameter.createMany.mockResolvedValue({ count: 1 });
      prismaMock.lab.update.mockResolvedValue({ id: 101n, status: 'SAMPLE_PENDING' });
      prismaMock.lab.findUnique.mockResolvedValue({
        id: 101n,
        orderNumber: 'LAB-20261031-1234',
        patientName: 'Amina Yousaf',
        status: 'SAMPLE_PENDING',
        samples: [{ id: 501n, status: 'PENDING' }],
        tests: [{ id: 201n, name: 'CBC', resultParameters: [] }],
      });

      const res = await service.createOrder(
        {
          patientId: 10,
          doctorId: 5,
          testIds: [1],
        },
        1,
      );

      expect(res.id).toBe(101);
      expect(res.status).toBe('SAMPLE_PENDING');
      expect(res.samples).toHaveLength(1);
    });

    it('rejects order creation with empty test list', async () => {
      prismaMock.patient.findUnique.mockResolvedValue({ id: 10n, name: 'Amina' });

      await expect(
        service.createOrder(
          {
            patientId: 10,
            testIds: [],
          },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('cancels a pending order with clinical reason', async () => {
      prismaMock.lab.findUnique.mockResolvedValue({ id: 101n, status: 'SAMPLE_PENDING' });
      prismaMock.lab.update.mockResolvedValue({ id: 101n, status: 'CANCELLED', cancelReason: 'Patient declined' });

      const res = await service.cancelOrder(101, { reason: 'Patient declined' }, 1);
      expect(res.status).toBe('CANCELLED');
    });

    it('rejects cancelling a completed report', async () => {
      prismaMock.lab.findUnique.mockResolvedValue({ id: 101n, status: 'COMPLETED' });

      await expect(
        service.cancelOrder(101, { reason: 'Cancellation attempt' }, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Sample Collection & Rejection', () => {
    it('marks a sample as collected and advances order to SAMPLE_COLLECTED', async () => {
      prismaMock.labSample.findUnique.mockResolvedValue({ id: 501n, labId: 101n, status: 'PENDING' });
      prismaMock.labSample.update.mockResolvedValue({ id: 501n, status: 'COLLECTED' });
      prismaMock.lab.update.mockResolvedValue({ id: 101n, status: 'SAMPLE_COLLECTED' });

      const res = await service.collectSample(501, { notes: 'Collected from left arm' }, 2);
      expect(res.status).toBe('COLLECTED');
    });

    it('accessions a collected sample and moves order to PROCESSING', async () => {
      prismaMock.labSample.findUnique.mockResolvedValue({ id: 501n, labId: 101n, status: 'COLLECTED' });
      prismaMock.labSample.update.mockResolvedValue({ id: 501n, status: 'RECEIVED' });
      prismaMock.lab.update.mockResolvedValue({ id: 101n, status: 'PROCESSING' });

      const res = await service.receiveSample(501, { notes: 'Specimen in good order' }, 3);
      expect(res.status).toBe('RECEIVED');
    });

    it('rejects an unsuitable specimen and returns order to SAMPLE_PENDING for recollection', async () => {
      prismaMock.labSample.findUnique.mockResolvedValue({ id: 501n, labId: 101n, status: 'COLLECTED' });
      prismaMock.labSample.update.mockResolvedValue({ id: 501n, status: 'REJECTED' });
      prismaMock.lab.update.mockResolvedValue({ id: 101n, status: 'SAMPLE_PENDING' });

      const res = await service.rejectSample(
        501,
        { reason: 'HEMOLYZED', notes: 'Severe hemolysis observed' },
        3,
      );
      expect(res.status).toBe('REJECTED');
    });
  });

  describe('Result Processing, Verification & Amendments', () => {
    it('enters results, derives RESULT_ENTERED when all complete, and protects blank boxes', async () => {
      prismaMock.lab.findUnique.mockResolvedValue({
        id: 101n,
        status: 'PROCESSING',
        tests: [
          {
            id: 201n,
            name: 'Haemoglobin',
            result: null,
            resultParameters: [],
          },
        ],
      });

      prismaMock.labResultParameter.create.mockResolvedValue({ id: 1001n });
      prismaMock.labTest.update.mockResolvedValue({ id: 201n });
      prismaMock.labTest.findMany.mockResolvedValue([
        { id: 201n, name: 'Haemoglobin', result: '14.2 g/dL' },
      ]);
      prismaMock.lab.update.mockResolvedValue({ id: 101n });
      prismaMock.lab.findUnique.mockResolvedValue({
        id: 101n,
        status: 'RESULT_ENTERED',
        report: 'Haemoglobin: 14.2 g/dL',
        tests: [{ id: 201n, name: 'Haemoglobin', result: '14.2 g/dL', resultParameters: [] }],
      });

      const res = await service.enterResults(
        101,
        {
          parameters: [
            {
              testId: 201,
              parameterName: 'Hb',
              value: '14.2 g/dL',
              abnormalFlag: 'NORMAL',
            },
          ],
        },
        3,
      );

      expect(res.status).toBe('RESULT_ENTERED');
    });

    it('verifies entered results', async () => {
      prismaMock.lab.findUnique.mockResolvedValue({
        id: 101n,
        status: 'RESULT_ENTERED',
        tests: [{ id: 201n, result: '14.2 g/dL' }],
      });
      prismaMock.lab.update.mockResolvedValue({ id: 101n, status: 'VERIFIED' });

      const res = await service.verifyResults(101, {}, 4);
      expect(res.status).toBe('VERIFIED');
    });

    it('approves and finalizes report into immutable COMPLETED state', async () => {
      prismaMock.lab.findUnique.mockResolvedValue({
        id: 101n,
        status: 'VERIFIED',
        tests: [{ id: 201n, result: '14.2 g/dL' }],
      });
      prismaMock.lab.update.mockResolvedValue({ id: 101n, status: 'COMPLETED' });

      const res = await service.approveReport(101, {}, 5);
      expect(res.status).toBe('COMPLETED');
    });

    it('records an audited amendment with reason and snapshots for completed report', async () => {
      prismaMock.lab.findUnique
        .mockResolvedValueOnce({
          id: 101n,
          status: 'COMPLETED',
          report: 'Haemoglobin: 14.2 g/dL',
          tests: [
            {
              id: 201n,
              name: 'Haemoglobin',
              result: '14.2 g/dL',
              resultParameters: [],
            },
          ],
        })
        .mockResolvedValueOnce({
          id: 101n,
          status: 'COMPLETED',
          report: 'Haemoglobin: 14.5 g/dL',
          tests: [
            {
              id: 201n,
              name: 'Haemoglobin',
              result: '14.5 g/dL',
              resultParameters: [],
            },
          ],
          amendments: [
            {
              id: 1n,
              reason: 'Re-run on analyzer secondary module',
            },
          ],
        });

      prismaMock.labTest.update.mockResolvedValue({ id: 201n });
      prismaMock.labTest.findMany.mockResolvedValue([
        { id: 201n, name: 'Haemoglobin', result: '14.5 g/dL' },
      ]);
      prismaMock.lab.update.mockResolvedValue({ id: 101n });
      prismaMock.labReportAmendment.create.mockResolvedValue({ id: 1n });

      const res = await service.amendReport(
        101,
        {
          reason: 'Re-run on analyzer secondary module',
          parameters: [
            {
              testId: 201,
              parameterName: 'Hb',
              value: '14.5 g/dL',
            },
          ],
        },
        5,
      );

      expect(res.amendments).toHaveLength(1);
      expect(prismaMock.labReportAmendment.create).toHaveBeenCalled();
    });
  });
});
