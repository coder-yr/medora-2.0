import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MedicineService } from './medicine.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MedicineService', () => {
  let service: MedicineService;
  let prisma: any;

  const mockMedicine = {
    id: BigInt(1),
    name: 'Amoxicillin 500mg',
    generic: 'Amoxicillin',
    company: 'GSK',
    categoryId: BigInt(1),
    manufacturerId: BigInt(1),
    dosageFormId: BigInt(1),
    strength: '500',
    unitId: BigInt(1),
    supplierId: BigInt(1),
    box: '10x10 Capsules',
    price: new Prisma.Decimal('8.00'),
    sPrice: new Prisma.Decimal('12.00'),
    quantity: 150,
    effects: 'Take with food',
    expiryDate: '2028-12-31',
    isActive: true,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    category: { id: BigInt(1), category: 'Antibiotics', description: 'Antibacterials' },
    manufacturer: { id: BigInt(1), name: 'GSK', country: 'UK' },
    dosageForm: { id: BigInt(1), name: 'Capsule', description: 'Hard gelatin' },
    measurementUnit: { id: BigInt(1), name: 'Milligram', symbol: 'mg' },
    supplier: { id: BigInt(1), name: 'PharmaDist', contactPerson: 'Ali', phone: '051-111' },
  };

  const mockCategory = {
    id: BigInt(1),
    category: 'Antibiotics',
    description: 'Antimicrobial agents',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { medicines: 1 },
  };

  beforeEach(async () => {
    prisma = {
      medicine: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      medicineCategory: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      manufacturer: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      dosageForm: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      measurementUnit: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      supplier: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      prescriptionMedicine: {
        count: jest.fn(),
      },
      pharmacySaleItem: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicineService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<MedicineService>(MedicineService);
  });

  describe('findAll', () => {
    it('returns paginated active medicines with relations and pagination meta', async () => {
      prisma.medicine.count.mockResolvedValue(1);
      prisma.medicine.findMany.mockResolvedValue([mockMedicine]);

      const result = await service.findAll({ page: 1, limit: 10, sortBy: 'name', sortOrder: 'asc' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('1');
      expect(result.data[0].name).toBe('Amoxicillin 500mg');
      expect(result.data[0].category?.category).toBe('Antibiotics');
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(prisma.medicine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          skip: 0,
          take: 10,
        }),
      );
    });

    it('filters by search term across brand, generic, company, and strength', async () => {
      prisma.medicine.count.mockResolvedValue(1);
      prisma.medicine.findMany.mockResolvedValue([mockMedicine]);

      await service.findAll({ q: 'Amox', page: 1, limit: 20, sortBy: 'name', sortOrder: 'asc' });

      expect(prisma.medicine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              { name: { contains: 'Amox', mode: 'insensitive' } },
              { generic: { contains: 'Amox', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('filters by category, manufacturer, dosageForm, and active status', async () => {
      prisma.medicine.count.mockResolvedValue(1);
      prisma.medicine.findMany.mockResolvedValue([mockMedicine]);

      await service.findAll({
        categoryId: 1,
        manufacturerId: 2,
        dosageFormId: 3,
        isActive: 'false',
        page: 1,
        limit: 10,
        sortBy: 'quantity',
        sortOrder: 'desc',
      });

      expect(prisma.medicine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            categoryId: BigInt(1),
            manufacturerId: BigInt(2),
            dosageFormId: BigInt(3),
            isActive: false,
          },
          orderBy: { quantity: 'desc' },
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns serialized medicine when found', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);

      const result = await service.findById(1);
      expect(result.id).toBe('1');
      expect(result.name).toBe('Amoxicillin 500mg');
      expect(result.price).toBe(8);
      expect(result.sPrice).toBe(12);
    });

    it('throws NotFoundException when medicine does not exist', async () => {
      prisma.medicine.findUnique.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a new medicine when duplicate check and foreign keys pass', async () => {
      prisma.medicine.findFirst.mockResolvedValue(null); // No clash
      prisma.medicineCategory.findUnique.mockResolvedValue({ id: BigInt(1) });
      prisma.manufacturer.findUnique.mockResolvedValue({ id: BigInt(1) });
      prisma.dosageForm.findUnique.mockResolvedValue({ id: BigInt(1) });
      prisma.measurementUnit.findUnique.mockResolvedValue({ id: BigInt(1) });
      prisma.supplier.findUnique.mockResolvedValue({ id: BigInt(1) });
      prisma.medicine.create.mockResolvedValue(mockMedicine);

      const result = await service.create({
        name: 'Amoxicillin 500mg',
        generic: 'Amoxicillin',
        categoryId: 1,
        manufacturerId: 1,
        dosageFormId: 1,
        unitId: 1,
        supplierId: 1,
        box: '10x10 Capsules',
        price: 8.0,
        sPrice: 12.0,
        quantity: 150,
      });

      expect(result.name).toBe('Amoxicillin 500mg');
      expect(prisma.medicine.create).toHaveBeenCalled();
    });

    it('throws ConflictException if an active medicine with identical name and pack size exists', async () => {
      prisma.medicine.findFirst.mockResolvedValue(mockMedicine); // Clash!

      await expect(
        service.create({
          name: 'Amoxicillin 500mg',
          box: '10x10 Capsules',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if supplied categoryId does not exist', async () => {
      prisma.medicine.findFirst.mockResolvedValue(null);
      prisma.medicineCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'New Drug',
          categoryId: 999,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates medicine fields and re-validates duplicate clash', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);
      prisma.medicine.findFirst.mockResolvedValue(null); // No clash
      prisma.medicine.update.mockResolvedValue({
        ...mockMedicine,
        name: 'Amoxicillin Forte 500mg',
      });

      const result = await service.update(1, {
        name: 'Amoxicillin Forte 500mg',
      });

      expect(result.name).toBe('Amoxicillin Forte 500mg');
      expect(prisma.medicine.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when updating non-existent medicine', async () => {
      prisma.medicine.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { name: 'Something' })).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if updated name and pack clash with another medicine', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);
      prisma.medicine.findFirst.mockResolvedValue({ id: BigInt(2), name: 'Clashing Drug' });

      await expect(
        service.update(1, { name: 'Clashing Drug', box: '10x10 Capsules' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes an unreferenced medicine', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);
      prisma.prescriptionMedicine.count.mockResolvedValue(0);
      prisma.pharmacySaleItem.count.mockResolvedValue(0);
      prisma.medicine.delete.mockResolvedValue(mockMedicine);

      const result = await service.remove(1);
      expect(result.message).toContain('successfully removed');
      expect(prisma.medicine.delete).toHaveBeenCalledWith({ where: { id: BigInt(1) } });
    });

    it('throws BadRequestException if medicine is referenced in historical prescriptions', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);
      prisma.prescriptionMedicine.count.mockResolvedValue(5); // 5 prescriptions reference it

      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
      expect(prisma.medicine.delete).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if medicine has historical pharmacy sales', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);
      prisma.prescriptionMedicine.count.mockResolvedValue(0);
      prisma.pharmacySaleItem.count.mockResolvedValue(3); // 3 sales

      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
      expect(prisma.medicine.delete).not.toHaveBeenCalled();
    });
  });

  describe('toggleActive', () => {
    it('toggles isActive status and returns updated record', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);
      prisma.medicine.update.mockResolvedValue({ ...mockMedicine, isActive: false });

      const result = await service.toggleActive(1);
      expect(result.isActive).toBe(false);
      expect(prisma.medicine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        }),
      );
    });
  });

  describe('search', () => {
    it('returns active medicines for autocomplete', async () => {
      prisma.medicine.findMany.mockResolvedValue([mockMedicine]);

      const result = await service.search('Amox');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Amoxicillin 500mg');
      expect(prisma.medicine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  // ===========================================================================
  // CATEGORIES & SUPPORTING ENTITIES
  // ===========================================================================

  describe('Category Management', () => {
    it('lists categories with item counts', async () => {
      prisma.medicineCategory.findMany.mockResolvedValue([mockCategory]);

      const result = await service.findAllCategories();
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Antibiotics');
      expect(result[0].medicineCount).toBe(1);
    });

    it('creates a new category', async () => {
      prisma.medicineCategory.findFirst.mockResolvedValue(null);
      prisma.medicineCategory.create.mockResolvedValue({
        id: BigInt(2),
        category: 'Analgesics',
        description: 'Pain relief',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createCategory({ category: 'Analgesics', description: 'Pain relief' });
      expect(result.category).toBe('Analgesics');
    });

    it('throws ConflictException on duplicate category name', async () => {
      prisma.medicineCategory.findFirst.mockResolvedValue(mockCategory);

      await expect(service.createCategory({ category: 'Antibiotics' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('prevents deletion if category contains medicines', async () => {
      prisma.medicineCategory.findUnique.mockResolvedValue(mockCategory); // medicineCount: 1

      await expect(service.removeCategory(1)).rejects.toThrow(BadRequestException);
      expect(prisma.medicineCategory.delete).not.toHaveBeenCalled();
    });

    it('deletes category if empty', async () => {
      prisma.medicineCategory.findUnique.mockResolvedValue({
        ...mockCategory,
        _count: { medicines: 0 },
      });
      prisma.medicineCategory.delete.mockResolvedValue(mockCategory);

      const result = await service.removeCategory(1);
      expect(result.message).toContain('removed successfully');
      expect(prisma.medicineCategory.delete).toHaveBeenCalled();
    });
  });

  describe('Supporting Entities CRUD', () => {
    it('manages manufacturers (find, create, delete with guard)', async () => {
      prisma.manufacturer.findMany.mockResolvedValue([
        { id: BigInt(1), name: 'Pfizer', _count: { medicines: 0 } },
      ]);
      const list = await service.findAllManufacturers();
      expect(list).toHaveLength(1);

      prisma.manufacturer.findUnique.mockResolvedValue(null);
      prisma.manufacturer.create.mockResolvedValue({ id: BigInt(2), name: 'Roche', isActive: true });
      const created = await service.createManufacturer({ name: 'Roche' });
      expect(created.name).toBe('Roche');

      prisma.manufacturer.findUnique.mockResolvedValue({
        id: BigInt(1),
        name: 'Pfizer',
        _count: { medicines: 2 },
      });
      await expect(service.removeManufacturer(1)).rejects.toThrow(BadRequestException);
    });

    it('manages dosage forms (find, create, delete with guard)', async () => {
      prisma.dosageForm.findMany.mockResolvedValue([
        { id: BigInt(1), name: 'Tablet', _count: { medicines: 0 } },
      ]);
      const list = await service.findAllDosageForms();
      expect(list).toHaveLength(1);

      prisma.dosageForm.findUnique.mockResolvedValue({ id: BigInt(1), name: 'Tablet', _count: { medicines: 0 } });
      prisma.dosageForm.delete.mockResolvedValue({});
      const res = await service.removeDosageForm(1);
      expect(res.message).toContain('removed');
    });

    it('manages measurement units (find, create, delete with guard)', async () => {
      prisma.measurementUnit.findMany.mockResolvedValue([
        { id: BigInt(1), name: 'Milligram', symbol: 'mg', _count: { medicines: 0 } },
      ]);
      const list = await service.findAllUnits();
      expect(list[0].symbol).toBe('mg');

      prisma.measurementUnit.findUnique.mockResolvedValue(null);
      prisma.measurementUnit.create.mockResolvedValue({ id: BigInt(2), name: 'Gram', symbol: 'g', isActive: true });
      const created = await service.createUnit({ name: 'Gram', symbol: 'g' });
      expect(created.symbol).toBe('g');
    });

    it('manages suppliers (find, create, update, delete with guard)', async () => {
      prisma.supplier.findMany.mockResolvedValue([
        { id: BigInt(1), name: 'Distro', _count: { medicines: 0 } },
      ]);
      const list = await service.findAllSuppliers();
      expect(list).toHaveLength(1);

      prisma.supplier.create.mockResolvedValue({ id: BigInt(1), name: 'Distro', isActive: true });
      const created = await service.createSupplier({ name: 'Distro' });
      expect(created.name).toBe('Distro');
    });
  });
});
