import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { QueryMedicineDto } from './dto/query-medicine.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import {
  CreateDosageFormDto,
  CreateManufacturerDto,
  CreateMeasurementUnitDto,
  CreateSupplierDto,
  UpdateManufacturerDto,
  UpdateSupplierDto,
} from './dto/supporting-catalogue.dto';

@Injectable()
export class MedicineService {
  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // 1. MEDICINE CATALOGUE CRUD & SEARCH
  // ===========================================================================

  async findAll(query: QueryMedicineDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.MedicineWhereInput = {};

    // Search filter across brand, generic, company, strength
    const term = (query.q || '').trim();
    if (term) {
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { generic: { contains: term, mode: 'insensitive' } },
        { company: { contains: term, mode: 'insensitive' } },
        { strength: { contains: term, mode: 'insensitive' } },
        { box: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.categoryId) {
      where.categoryId = BigInt(query.categoryId);
    }

    if (query.manufacturerId) {
      where.manufacturerId = BigInt(query.manufacturerId);
    }

    if (query.dosageFormId) {
      where.dosageFormId = BigInt(query.dosageFormId);
    }

    // Active status filter ('all' = no filter, 'false' = inactive, default/true = active)
    if (query.isActive === 'all') {
      // no filter
    } else if (query.isActive === 'false' || query.isActive === false as any) {
      where.isActive = false;
    } else {
      where.isActive = true;
    }

    const sortOrder: Prisma.SortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
    let orderBy: Prisma.MedicineOrderByWithRelationInput = { name: sortOrder };

    if (query.sortBy === 'createdAt') {
      orderBy = { createdAt: sortOrder };
    } else if (query.sortBy === 'quantity') {
      orderBy = { quantity: sortOrder };
    } else if (query.sortBy === 'price') {
      orderBy = { price: sortOrder };
    } else if (query.sortBy === 'sPrice') {
      orderBy = { sPrice: sortOrder };
    }

    const [total, items] = await Promise.all([
      this.prisma.medicine.count({ where }),
      this.prisma.medicine.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: true,
          manufacturer: true,
          dosageForm: true,
          measurementUnit: true,
          supplier: true,
        },
      }),
    ]);

    return {
      data: items.map((item) => this.serializeMedicine(item)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: number | bigint) {
    const med = await this.prisma.medicine.findUnique({
      where: { id: BigInt(id) },
      include: {
        category: true,
        manufacturer: true,
        dosageForm: true,
        measurementUnit: true,
        supplier: true,
      },
    });

    if (!med) {
      throw new NotFoundException(`Medicine #${id} not found in hospital catalogue`);
    }

    return this.serializeMedicine(med);
  }

  async create(dto: CreateMedicineDto) {
    const trimmedName = dto.name.trim();
    const normalizedBox = dto.box ? dto.box.trim() : null;

    // Duplicate clash check: Name + Box clash against existing active medicines
    await this.checkDuplicateClash(trimmedName, normalizedBox);

    // Validate foreign keys if provided
    await this.validateForeignKeys(dto);

    const created = await this.prisma.medicine.create({
      data: {
        name: trimmedName,
        generic: dto.generic ? dto.generic.trim() : null,
        company: dto.company ? dto.company.trim() : null,
        categoryId: dto.categoryId ? BigInt(dto.categoryId) : null,
        manufacturerId: dto.manufacturerId ? BigInt(dto.manufacturerId) : null,
        dosageFormId: dto.dosageFormId ? BigInt(dto.dosageFormId) : null,
        strength: dto.strength ? dto.strength.trim() : null,
        unitId: dto.unitId ? BigInt(dto.unitId) : null,
        supplierId: dto.supplierId ? BigInt(dto.supplierId) : null,
        box: normalizedBox,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : new Prisma.Decimal(0),
        sPrice: dto.sPrice !== undefined ? new Prisma.Decimal(dto.sPrice) : null,
        quantity: dto.quantity !== undefined ? dto.quantity : 0,
        effects: dto.effects ? dto.effects.trim() : null,
        expiryDate: dto.expiryDate ? dto.expiryDate.trim() : null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      include: {
        category: true,
        manufacturer: true,
        dosageForm: true,
        measurementUnit: true,
        supplier: true,
      },
    });

    return this.serializeMedicine(created);
  }

  async update(id: number | bigint, dto: UpdateMedicineDto) {
    const existing = await this.prisma.medicine.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existing) {
      throw new NotFoundException(`Medicine #${id} not found in hospital catalogue`);
    }

    const nextName = dto.name !== undefined ? dto.name.trim() : existing.name;
    const nextBox = dto.box !== undefined ? (dto.box ? dto.box.trim() : null) : existing.box;

    if (dto.name !== undefined || dto.box !== undefined) {
      await this.checkDuplicateClash(nextName, nextBox, existing.id);
    }

    await this.validateForeignKeys(dto);

    const updated = await this.prisma.medicine.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined && { name: nextName }),
        ...(dto.generic !== undefined && { generic: dto.generic ? dto.generic.trim() : null }),
        ...(dto.company !== undefined && { company: dto.company ? dto.company.trim() : null }),
        ...(dto.categoryId !== undefined && {
          categoryId: dto.categoryId ? BigInt(dto.categoryId) : null,
        }),
        ...(dto.manufacturerId !== undefined && {
          manufacturerId: dto.manufacturerId ? BigInt(dto.manufacturerId) : null,
        }),
        ...(dto.dosageFormId !== undefined && {
          dosageFormId: dto.dosageFormId ? BigInt(dto.dosageFormId) : null,
        }),
        ...(dto.strength !== undefined && { strength: dto.strength ? dto.strength.trim() : null }),
        ...(dto.unitId !== undefined && { unitId: dto.unitId ? BigInt(dto.unitId) : null }),
        ...(dto.supplierId !== undefined && {
          supplierId: dto.supplierId ? BigInt(dto.supplierId) : null,
        }),
        ...(dto.box !== undefined && { box: nextBox }),
        ...(dto.price !== undefined && {
          price: dto.price !== null ? new Prisma.Decimal(dto.price) : new Prisma.Decimal(0),
        }),
        ...(dto.sPrice !== undefined && {
          sPrice: dto.sPrice !== null ? new Prisma.Decimal(dto.sPrice) : null,
        }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.effects !== undefined && { effects: dto.effects ? dto.effects.trim() : null }),
        ...(dto.expiryDate !== undefined && {
          expiryDate: dto.expiryDate ? dto.expiryDate.trim() : null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        category: true,
        manufacturer: true,
        dosageForm: true,
        measurementUnit: true,
        supplier: true,
      },
    });

    return this.serializeMedicine(updated);
  }

  async remove(id: number | bigint) {
    const med = await this.prisma.medicine.findUnique({
      where: { id: BigInt(id) },
    });

    if (!med) {
      throw new NotFoundException(`Medicine #${id} not found in hospital catalogue`);
    }

    // Historical prescription check: Never delete a prescribed medication
    const prescriptionCount = await this.prisma.prescriptionMedicine.count({
      where: { medicineId: med.id },
    });

    if (prescriptionCount > 0) {
      throw new BadRequestException(
        `${med.name} has been prescribed in clinical encounters (${prescriptionCount} record(s)) and cannot be deleted from the catalogue. Deactivate it instead.`,
      );
    }

    // Historical pharmacy sales check
    const saleCount = await this.prisma.pharmacySaleItem.count({
      where: { medicineId: med.id },
    });

    if (saleCount > 0) {
      throw new BadRequestException(
        `${med.name} has historical pharmacy sales records (${saleCount} item(s)) and cannot be deleted. Deactivate it instead.`,
      );
    }

    await this.prisma.medicine.delete({
      where: { id: med.id },
    });

    return {
      message: `${med.name} successfully removed from the catalogue.`,
    };
  }

  async toggleActive(id: number | bigint, isActive?: boolean) {
    const med = await this.prisma.medicine.findUnique({
      where: { id: BigInt(id) },
    });

    if (!med) {
      throw new NotFoundException(`Medicine #${id} not found in hospital catalogue`);
    }

    const nextState = isActive !== undefined ? isActive : !med.isActive;

    const updated = await this.prisma.medicine.update({
      where: { id: med.id },
      data: { isActive: nextState },
      include: {
        category: true,
        manufacturer: true,
        dosageForm: true,
        measurementUnit: true,
        supplier: true,
      },
    });

    return this.serializeMedicine(updated);
  }

  async search(query: string) {
    const term = (query || '').trim();
    if (!term) {
      const top = await this.prisma.medicine.findMany({
        where: { isActive: true },
        take: 20,
        orderBy: { name: 'asc' },
        include: {
          category: true,
          dosageForm: true,
          measurementUnit: true,
        },
      });
      return top.map((m) => this.serializeMedicine(m));
    }

    const medicines = await this.prisma.medicine.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { generic: { contains: term, mode: 'insensitive' } },
          { company: { contains: term, mode: 'insensitive' } },
          { strength: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: 25,
      orderBy: { name: 'asc' },
      include: {
        category: true,
        dosageForm: true,
        measurementUnit: true,
      },
    });

    return medicines.map((m) => this.serializeMedicine(m));
  }

  // ===========================================================================
  // 2. CATEGORY MANAGEMENT
  // ===========================================================================

  async findAllCategories() {
    const categories = await this.prisma.medicineCategory.findMany({
      orderBy: { category: 'asc' },
      include: {
        _count: {
          select: { medicines: true },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id.toString(),
      category: cat.category,
      description: cat.description,
      isActive: cat.isActive,
      medicineCount: cat._count.medicines,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));
  }

  async findCategoryById(id: number | bigint) {
    const cat = await this.prisma.medicineCategory.findUnique({
      where: { id: BigInt(id) },
      include: {
        _count: {
          select: { medicines: true },
        },
      },
    });

    if (!cat) {
      throw new NotFoundException(`Category #${id} not found`);
    }

    return {
      id: cat.id.toString(),
      category: cat.category,
      description: cat.description,
      isActive: cat.isActive,
      medicineCount: cat._count.medicines,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    };
  }

  async createCategory(dto: CreateCategoryDto) {
    const name = dto.category.trim();
    const existing = await this.prisma.medicineCategory.findFirst({
      where: { category: { equals: name, mode: 'insensitive' } },
    });

    if (existing) {
      throw new ConflictException(`Medicine category "${name}" already exists.`);
    }

    const created = await this.prisma.medicineCategory.create({
      data: {
        category: name,
        description: dto.description ? dto.description.trim() : null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return {
      id: created.id.toString(),
      category: created.category,
      description: created.description,
      isActive: created.isActive,
      medicineCount: 0,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async updateCategory(id: number | bigint, dto: UpdateCategoryDto) {
    const existing = await this.prisma.medicineCategory.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existing) {
      throw new NotFoundException(`Category #${id} not found`);
    }

    const name = dto.category !== undefined ? dto.category.trim() : existing.category;

    if (dto.category && name.toLowerCase() !== existing.category.toLowerCase()) {
      const clash = await this.prisma.medicineCategory.findFirst({
        where: {
          category: { equals: name, mode: 'insensitive' },
          id: { not: existing.id },
        },
      });
      if (clash) {
        throw new ConflictException(`Medicine category "${name}" already exists.`);
      }
    }

    const updated = await this.prisma.medicineCategory.update({
      where: { id: existing.id },
      data: {
        category: name,
        ...(dto.description !== undefined && {
          description: dto.description ? dto.description.trim() : null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        _count: { select: { medicines: true } },
      },
    });

    return {
      id: updated.id.toString(),
      category: updated.category,
      description: updated.description,
      isActive: updated.isActive,
      medicineCount: updated._count.medicines,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async removeCategory(id: number | bigint) {
    const cat = await this.prisma.medicineCategory.findUnique({
      where: { id: BigInt(id) },
      include: {
        _count: { select: { medicines: true } },
      },
    });

    if (!cat) {
      throw new NotFoundException(`Category #${id} not found`);
    }

    if (cat._count.medicines > 0) {
      throw new BadRequestException(
        `Category "${cat.category}" still has ${cat._count.medicines} medicine(s) in it and cannot be removed.`,
      );
    }

    await this.prisma.medicineCategory.delete({
      where: { id: cat.id },
    });

    return {
      message: `Category "${cat.category}" removed successfully.`,
    };
  }

  // ===========================================================================
  // 3. SUPPORTING ENTITIES (MANUFACTURERS, DOSAGE FORMS, UNITS, SUPPLIERS)
  // ===========================================================================

  // Manufacturers
  async findAllManufacturers() {
    const items = await this.prisma.manufacturer.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { medicines: true } } },
    });
    return items.map((m) => ({
      id: m.id.toString(),
      name: m.name,
      country: m.country,
      contactEmail: m.contactEmail,
      contactPhone: m.contactPhone,
      address: m.address,
      isActive: m.isActive,
      medicineCount: m._count.medicines,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  async createManufacturer(dto: CreateManufacturerDto) {
    const name = dto.name.trim();
    const clash = await this.prisma.manufacturer.findUnique({ where: { name } });
    if (clash) {
      throw new ConflictException(`Manufacturer "${name}" already exists.`);
    }
    const created = await this.prisma.manufacturer.create({
      data: {
        name,
        country: dto.country ? dto.country.trim() : null,
        contactEmail: dto.contactEmail ? dto.contactEmail.trim() : null,
        contactPhone: dto.contactPhone ? dto.contactPhone.trim() : null,
        address: dto.address ? dto.address.trim() : null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
    return { ...created, id: created.id.toString(), medicineCount: 0 };
  }

  async updateManufacturer(id: number | bigint, dto: UpdateManufacturerDto) {
    const existing = await this.prisma.manufacturer.findUnique({ where: { id: BigInt(id) } });
    if (!existing) throw new NotFoundException(`Manufacturer #${id} not found`);

    if (dto.name && dto.name.trim() !== existing.name) {
      const clash = await this.prisma.manufacturer.findUnique({ where: { name: dto.name.trim() } });
      if (clash && clash.id !== existing.id) {
        throw new ConflictException(`Manufacturer "${dto.name.trim()}" already exists.`);
      }
    }

    const updated = await this.prisma.manufacturer.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.country !== undefined && { country: dto.country ? dto.country.trim() : null }),
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail ? dto.contactEmail.trim() : null }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone ? dto.contactPhone.trim() : null }),
        ...(dto.address !== undefined && { address: dto.address ? dto.address.trim() : null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return { ...updated, id: updated.id.toString() };
  }

  async removeManufacturer(id: number | bigint) {
    const m = await this.prisma.manufacturer.findUnique({
      where: { id: BigInt(id) },
      include: { _count: { select: { medicines: true } } },
    });
    if (!m) throw new NotFoundException(`Manufacturer #${id} not found`);
    if (m._count.medicines > 0) {
      throw new BadRequestException(`Manufacturer "${m.name}" has ${m._count.medicines} linked medicines and cannot be deleted.`);
    }
    await this.prisma.manufacturer.delete({ where: { id: m.id } });
    return { message: `Manufacturer "${m.name}" removed.` };
  }

  // Dosage Forms
  async findAllDosageForms() {
    const forms = await this.prisma.dosageForm.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { medicines: true } } },
    });
    return forms.map((f) => ({
      id: f.id.toString(),
      name: f.name,
      description: f.description,
      isActive: f.isActive,
      medicineCount: f._count.medicines,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
  }

  async createDosageForm(dto: CreateDosageFormDto) {
    const name = dto.name.trim();
    const clash = await this.prisma.dosageForm.findUnique({ where: { name } });
    if (clash) throw new ConflictException(`Dosage form "${name}" already exists.`);

    const created = await this.prisma.dosageForm.create({
      data: {
        name,
        description: dto.description ? dto.description.trim() : null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
    return { ...created, id: created.id.toString(), medicineCount: 0 };
  }

  async removeDosageForm(id: number | bigint) {
    const form = await this.prisma.dosageForm.findUnique({
      where: { id: BigInt(id) },
      include: { _count: { select: { medicines: true } } },
    });
    if (!form) throw new NotFoundException(`Dosage form #${id} not found`);
    if (form._count.medicines > 0) {
      throw new BadRequestException(`Dosage form "${form.name}" has ${form._count.medicines} linked medicines and cannot be deleted.`);
    }
    await this.prisma.dosageForm.delete({ where: { id: form.id } });
    return { message: `Dosage form "${form.name}" removed.` };
  }

  // Measurement Units
  async findAllUnits() {
    const units = await this.prisma.measurementUnit.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { medicines: true } } },
    });
    return units.map((u) => ({
      id: u.id.toString(),
      name: u.name,
      symbol: u.symbol,
      isActive: u.isActive,
      medicineCount: u._count.medicines,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  async createUnit(dto: CreateMeasurementUnitDto) {
    const name = dto.name.trim();
    const clash = await this.prisma.measurementUnit.findUnique({ where: { name } });
    if (clash) throw new ConflictException(`Measurement unit "${name}" already exists.`);

    const created = await this.prisma.measurementUnit.create({
      data: {
        name,
        symbol: dto.symbol.trim(),
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
    return { ...created, id: created.id.toString(), medicineCount: 0 };
  }

  async removeUnit(id: number | bigint) {
    const unit = await this.prisma.measurementUnit.findUnique({
      where: { id: BigInt(id) },
      include: { _count: { select: { medicines: true } } },
    });
    if (!unit) throw new NotFoundException(`Measurement unit #${id} not found`);
    if (unit._count.medicines > 0) {
      throw new BadRequestException(`Unit "${unit.name}" has ${unit._count.medicines} linked medicines and cannot be deleted.`);
    }
    await this.prisma.measurementUnit.delete({ where: { id: unit.id } });
    return { message: `Measurement unit "${unit.name}" removed.` };
  }

  // Suppliers
  async findAllSuppliers() {
    const suppliers = await this.prisma.supplier.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { medicines: true } } },
    });
    return suppliers.map((s) => ({
      id: s.id.toString(),
      name: s.name,
      contactPerson: s.contactPerson,
      email: s.email,
      phone: s.phone,
      address: s.address,
      isActive: s.isActive,
      medicineCount: s._count.medicines,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  async createSupplier(dto: CreateSupplierDto) {
    const created = await this.prisma.supplier.create({
      data: {
        name: dto.name.trim(),
        contactPerson: dto.contactPerson ? dto.contactPerson.trim() : null,
        email: dto.email ? dto.email.trim() : null,
        phone: dto.phone ? dto.phone.trim() : null,
        address: dto.address ? dto.address.trim() : null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
    return { ...created, id: created.id.toString(), medicineCount: 0 };
  }

  async updateSupplier(id: number | bigint, dto: UpdateSupplierDto) {
    const existing = await this.prisma.supplier.findUnique({ where: { id: BigInt(id) } });
    if (!existing) throw new NotFoundException(`Supplier #${id} not found`);

    const updated = await this.prisma.supplier.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.contactPerson !== undefined && { contactPerson: dto.contactPerson ? dto.contactPerson.trim() : null }),
        ...(dto.email !== undefined && { email: dto.email ? dto.email.trim() : null }),
        ...(dto.phone !== undefined && { phone: dto.phone ? dto.phone.trim() : null }),
        ...(dto.address !== undefined && { address: dto.address ? dto.address.trim() : null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return { ...updated, id: updated.id.toString() };
  }

  async removeSupplier(id: number | bigint) {
    const s = await this.prisma.supplier.findUnique({
      where: { id: BigInt(id) },
      include: { _count: { select: { medicines: true } } },
    });
    if (!s) throw new NotFoundException(`Supplier #${id} not found`);
    if (s._count.medicines > 0) {
      throw new BadRequestException(`Supplier "${s.name}" has ${s._count.medicines} linked medicines and cannot be deleted.`);
    }
    await this.prisma.supplier.delete({ where: { id: s.id } });
    return { message: `Supplier "${s.name}" removed.` };
  }

  // ===========================================================================
  // 4. PRIVATE HELPERS
  // ===========================================================================

  private async checkDuplicateClash(name: string, box: string | null, ignoreId?: bigint) {
    const clash = await this.prisma.medicine.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        box: box ? { equals: box, mode: 'insensitive' } : null,
        isActive: true,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
    });

    if (clash) {
      throw new ConflictException(
        `That medicine is already in the catalogue with the same pack or strength (${name}${box ? ' - ' + box : ''}).`,
      );
    }
  }

  private async validateForeignKeys(dto: Partial<CreateMedicineDto>) {
    if (dto.categoryId) {
      const cat = await this.prisma.medicineCategory.findUnique({
        where: { id: BigInt(dto.categoryId) },
      });
      if (!cat) throw new NotFoundException(`Category #${dto.categoryId} does not exist`);
    }

    if (dto.manufacturerId) {
      const m = await this.prisma.manufacturer.findUnique({
        where: { id: BigInt(dto.manufacturerId) },
      });
      if (!m) throw new NotFoundException(`Manufacturer #${dto.manufacturerId} does not exist`);
    }

    if (dto.dosageFormId) {
      const df = await this.prisma.dosageForm.findUnique({
        where: { id: BigInt(dto.dosageFormId) },
      });
      if (!df) throw new NotFoundException(`Dosage form #${dto.dosageFormId} does not exist`);
    }

    if (dto.unitId) {
      const u = await this.prisma.measurementUnit.findUnique({
        where: { id: BigInt(dto.unitId) },
      });
      if (!u) throw new NotFoundException(`Measurement unit #${dto.unitId} does not exist`);
    }

    if (dto.supplierId) {
      const sup = await this.prisma.supplier.findUnique({
        where: { id: BigInt(dto.supplierId) },
      });
      if (!sup) throw new NotFoundException(`Supplier #${dto.supplierId} does not exist`);
    }
  }

  private serializeMedicine(m: any) {
    return {
      id: m.id.toString(),
      name: m.name,
      generic: m.generic,
      company: m.company,
      categoryId: m.categoryId ? m.categoryId.toString() : null,
      category: m.category
        ? {
            id: m.category.id.toString(),
            category: m.category.category,
            description: m.category.description,
          }
        : null,
      manufacturerId: m.manufacturerId ? m.manufacturerId.toString() : null,
      manufacturer: m.manufacturer
        ? {
            id: m.manufacturer.id.toString(),
            name: m.manufacturer.name,
            country: m.manufacturer.country,
          }
        : null,
      dosageFormId: m.dosageFormId ? m.dosageFormId.toString() : null,
      dosageForm: m.dosageForm
        ? {
            id: m.dosageForm.id.toString(),
            name: m.dosageForm.name,
            description: m.dosageForm.description,
          }
        : null,
      strength: m.strength,
      unitId: m.unitId ? m.unitId.toString() : null,
      measurementUnit: m.measurementUnit
        ? {
            id: m.measurementUnit.id.toString(),
            name: m.measurementUnit.name,
            symbol: m.measurementUnit.symbol,
          }
        : null,
      supplierId: m.supplierId ? m.supplierId.toString() : null,
      supplier: m.supplier
        ? {
            id: m.supplier.id.toString(),
            name: m.supplier.name,
            contactPerson: m.supplier.contactPerson,
            phone: m.supplier.phone,
          }
        : null,
      box: m.box,
      price: m.price ? Number(m.price) : 0,
      sPrice: m.sPrice ? Number(m.sPrice) : null,
      quantity: m.quantity,
      effects: m.effects,
      expiryDate: m.expiryDate,
      isActive: m.isActive,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }
}
