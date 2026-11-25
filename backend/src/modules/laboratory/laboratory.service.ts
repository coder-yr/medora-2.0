import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLabTestCatalogueDto,
  CreateTestParameterDto,
  UpdateLabTestCatalogueDto,
} from './dto/catalogue.dto';
import { CancelLabOrderDto, CreateLabOrderDto } from './dto/lab-order.dto';
import { CollectSampleDto, ReceiveSampleDto, RecollectSampleDto, RejectSampleDto } from './dto/sample.dto';
import {
  ApproveReportDto,
  EnterResultsDto,
  VerifyResultsDto,
} from './dto/result.dto';
import { AmendReportDto } from './dto/amendment.dto';
import { QueryLabCatalogueDto, QueryLabOrdersDto } from './dto/query-lab.dto';
import { Prisma } from '@prisma/client';
import { Optional } from '@nestjs/common';
import { BranchAuthorizationService } from '../../common/services/branch-authorization.service';
import { NotificationService } from '../notification/notification.service';
import { AuthUser } from '../../common/types/auth-user.interface';

@Injectable()
export class LaboratoryService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly branchAuth?: BranchAuthorizationService,
    @Optional() private readonly notificationService?: NotificationService,
  ) { }

  // ===========================================================================
  // 1. SERIALIZATION HELPERS
  // ===========================================================================

  private serializeBigInt<T>(obj: T): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return Number(obj);
    if (obj instanceof Date) return obj.toISOString();
    if (Prisma.Decimal.isDecimal(obj)) return Number(obj);
    if (Array.isArray(obj)) return obj.map((item) => this.serializeBigInt(item));
    if (typeof obj === 'object') {
      const copy: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        copy[key] = this.serializeBigInt(val);
      }
      return copy;
    }
    return obj;
  }

  // ===========================================================================
  // 2. TEST CATALOGUE MANAGEMENT
  // ===========================================================================

  async getCatalogue(query: QueryLabCatalogueDto) {
    const where: Prisma.LabCategoryWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.sampleType) {
      where.sampleType = { contains: query.sampleType, mode: 'insensitive' };
    }

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { category: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { referenceValue: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.labCategory.findMany({
      where,
      include: {
        parameters: {
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { labTests: true },
        },
      },
      orderBy: { category: 'asc' },
    });

    return this.serializeBigInt(
      items.map((item: any) => ({
        ...item,
        timesRequested: item._count.labTests,
      })),
    );
  }

  async getCatalogueItemById(id: number) {
    const item = await this.prisma.labCategory.findUnique({
      where: { id: BigInt(id) },
      include: {
        parameters: {
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { labTests: true },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Lab test #${id} not found in catalogue.`);
    }

    return this.serializeBigInt({
      ...item,
      timesRequested: item._count.labTests,
    });
  }

  async createCatalogueItem(dto: CreateLabTestCatalogueDto) {
    const name = (dto.name || dto.category || '').trim();
    if (!name) {
      throw new BadRequestException('Test name is required.');
    }

    // Prevent duplicate test names in catalogue (matching legacy rule)
    const existing = await this.prisma.labCategory.findFirst({
      where: { category: { equals: name, mode: 'insensitive' } },
    });

    if (existing) {
      throw new ConflictException(`That test is already in the catalogue (${name}).`);
    }

    const created = await this.prisma.labCategory.create({
      data: {
        category: name,
        code: dto.code?.trim() || null,
        department: dto.department?.trim() || null,
        description: dto.description?.trim() || null,
        referenceValue: dto.referenceValue?.trim() || null,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : null,
        sampleType: dto.sampleType?.trim() || null,
        turnaroundHours: dto.turnaroundHours ?? 24,
        instructions: dto.instructions?.trim() || null,
        collectionNotes: dto.collectionNotes?.trim() || null,
        criticalLow: dto.criticalLow !== undefined ? new Prisma.Decimal(dto.criticalLow) : null,
        criticalHigh: dto.criticalHigh !== undefined ? new Prisma.Decimal(dto.criticalHigh) : null,
        isActive: true,
        parameters: dto.parameters?.length
          ? {
            create: dto.parameters.map((p, idx) => {
              const range =
                p.referenceRange?.trim() ||
                (p.referenceMin && p.referenceMax
                  ? `${p.referenceMin} - ${p.referenceMax} ${p.unit || ''}`.trim()
                  : null);
              return {
                name: p.name.trim(),
                unit: p.unit?.trim() || null,
                referenceRange: range,
                gender: p.gender?.trim() || 'ALL',
                ageMin: p.ageMin,
                ageMax: p.ageMax,
                displayOrder: p.displayOrder ?? idx + 1,
                isActive: true,
              };
            }),
          }
          : undefined,
      },
      include: {
        parameters: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return this.serializeBigInt(created);
  }

  async updateCatalogueItem(id: number, dto: UpdateLabTestCatalogueDto) {
    const item = await this.prisma.labCategory.findUnique({
      where: { id: BigInt(id) },
    });

    if (!item) {
      throw new NotFoundException(`Lab test #${id} not found in catalogue.`);
    }

    const testName = (dto.name || dto.category || '').trim();
    if (testName) {
      const clash = await this.prisma.labCategory.findFirst({
        where: {
          category: { equals: testName, mode: 'insensitive' },
          id: { not: BigInt(id) },
        },
      });

      if (clash) {
        throw new ConflictException(`That test is already in the catalogue (${testName}).`);
      }
    }

    if (dto.parameters) {
      await this.prisma.labTestParameter.deleteMany({
        where: { labCategoryId: BigInt(id) },
      });
      for (let idx = 0; idx < dto.parameters.length; idx++) {
        const p = dto.parameters[idx];
        const range =
          p.referenceRange?.trim() ||
          (p.referenceMin && p.referenceMax
            ? `${p.referenceMin} - ${p.referenceMax} ${p.unit || ''}`.trim()
            : null);
        await this.prisma.labTestParameter.create({
          data: {
            labCategoryId: BigInt(id),
            name: p.name.trim(),
            unit: p.unit?.trim() || null,
            referenceRange: range,
            gender: p.gender?.trim() || 'ALL',
            ageMin: p.ageMin,
            ageMax: p.ageMax,
            displayOrder: p.displayOrder ?? idx + 1,
            isActive: true,
          },
        });
      }
    }

    const updated = await this.prisma.labCategory.update({
      where: { id: BigInt(id) },
      data: {
        category: testName || undefined,
        code: dto.code !== undefined ? dto.code?.trim() || null : undefined,
        department: dto.department !== undefined ? dto.department?.trim() || null : undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        referenceValue:
          dto.referenceValue !== undefined ? dto.referenceValue?.trim() || null : undefined,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        sampleType: dto.sampleType !== undefined ? dto.sampleType?.trim() || null : undefined,
        turnaroundHours: dto.turnaroundHours !== undefined ? dto.turnaroundHours : undefined,
        instructions:
          dto.instructions !== undefined ? dto.instructions?.trim() || null : undefined,
        collectionNotes:
          dto.collectionNotes !== undefined ? dto.collectionNotes?.trim() || null : undefined,
        criticalLow: dto.criticalLow !== undefined ? new Prisma.Decimal(dto.criticalLow) : undefined,
        criticalHigh: dto.criticalHigh !== undefined ? new Prisma.Decimal(dto.criticalHigh) : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
      },
      include: {
        parameters: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return this.serializeBigInt(updated);
  }

  async deleteCatalogueItem(id: number) {
    const item = await this.prisma.labCategory.findUnique({
      where: { id: BigInt(id) },
    });

    if (!item) {
      throw new NotFoundException(`Lab test #${id} not found in catalogue.`);
    }

    // Historical test preservation rule: A requested test stays in the catalogue!
    const usageCount = await this.prisma.labTest.count({
      where: { labCategoryId: BigInt(id) },
    });

    if (usageCount > 0) {
      throw new BadRequestException(
        `${item.category} has been requested (${usageCount} record(s)), so it stays in the catalogue. Deactivate it instead.`,
      );
    }

    await this.prisma.labCategory.delete({
      where: { id: BigInt(id) },
    });

    return { message: `${item.category} removed from catalogue.` };
  }

  async addParameter(categoryId: number, dto: CreateTestParameterDto) {
    await this.getCatalogueItemById(categoryId);

    const parameter = await this.prisma.labTestParameter.create({
      data: {
        labCategoryId: BigInt(categoryId),
        name: dto.name.trim(),
        unit: dto.unit?.trim() || null,
        referenceRange: dto.referenceRange?.trim() || null,
        gender: dto.gender?.trim() || 'ALL',
        ageMin: dto.ageMin,
        ageMax: dto.ageMax,
        displayOrder: dto.displayOrder ?? 0,
        isActive: true,
      },
    });

    return this.serializeBigInt(parameter);
  }

  async deleteParameter(parameterId: number) {
    const param = await this.prisma.labTestParameter.findUnique({
      where: { id: BigInt(parameterId) },
    });

    if (!param) {
      throw new NotFoundException(`Test parameter #${parameterId} not found.`);
    }

    await this.prisma.labTestParameter.delete({
      where: { id: BigInt(parameterId) },
    });

    return { message: `Parameter ${param.name} removed.` };
  }

  // ===========================================================================
  // 3. LAB ORDER WORKFLOW & LIFECYCLE
  // ===========================================================================

  async createOrder(dto: CreateLabOrderDto, userId: number, user?: AuthUser) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: BigInt(dto.patientId) },
    });

    if (!patient) {
      throw new NotFoundException(`Patient #${dto.patientId} not found.`);
    }

    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, patient.branchId, 'patient');
    }

    let doctor: any = null;
    if (dto.doctorId) {
      doctor = await this.prisma.doctor.findUnique({
        where: { id: BigInt(dto.doctorId) },
      });
      if (!doctor) {
        throw new NotFoundException(`Doctor #${dto.doctorId} not found.`);
      }
    }

    if (dto.appointmentId) {
      const appt = await this.prisma.appointment.findUnique({
        where: { id: BigInt(dto.appointmentId) },
      });
      if (!appt) {
        throw new NotFoundException(`Appointment #${dto.appointmentId} not found.`);
      }
    }

    if (dto.consultationId) {
      const consult = await this.prisma.consultation.findUnique({
        where: { id: BigInt(dto.consultationId) },
      });
      if (!consult) {
        throw new NotFoundException(`Consultation #${dto.consultationId} not found.`);
      }
    }

    const testIds = Array.from(new Set(dto.testIds.map((id) => Number(id))));
    if (!testIds.length) {
      throw new BadRequestException('Choose at least one test, or the request asks for nothing.');
    }

    const catalogueTests = await this.prisma.labCategory.findMany({
      where: { id: { in: testIds.map((id) => BigInt(id)) } },
      include: {
        parameters: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (catalogueTests.length !== testIds.length) {
      throw new BadRequestException('One or more selected tests do not exist in the catalogue.');
    }

    const orderDate = dto.date || new Date().toISOString().split('T')[0];
    const orderNumber = `LAB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    // Group tests by sample requirement (e.g. EDTA Blood, Serum, Urine)
    const sampleTypeMap = new Map<string, typeof catalogueTests>();
    for (const test of catalogueTests) {
      const sType = test.sampleType?.trim() || 'General Specimen';
      if (!sampleTypeMap.has(sType)) {
        sampleTypeMap.set(sType, []);
      }
      sampleTypeMap.get(sType)!.push(test);
    }

    return await this.prisma.$transaction(async (tx: any) => {
      // Resolve active admission if specified or patient is admitted
      let admissionId: bigint | null = null;
      if (dto.admissionId) {
        admissionId = BigInt(dto.admissionId);
      } else if (tx.admission) {
        const activeStay = await tx.admission.findFirst({
          where: {
            patientId: BigInt(dto.patientId),
            status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PENDING'] },
          },
        });
        if (activeStay) {
          admissionId = activeStay.id;
        }
      }

      const totalAmount = catalogueTests.reduce(
        (sum: number, t: any) => sum + (t.price ? Number(t.price) : 0),
        0,
      );

      // Resolve tenant and branch context
      const organizationId = user?.organizationId
        ? BigInt(user.organizationId)
        : ((patient as any).branch?.organizationId ? BigInt((patient as any).branch.organizationId) : null);
      const branchId = user?.branchId
        ? BigInt(user.branchId)
        : (patient.branchId || null);

      // 1. Optional Invoice Integration (only for outpatient when not admitted)
      let invoiceId: bigint | null = null;
      if (!admissionId && dto.generateInvoice) {
        const payment = await tx.payment.create({
          data: {
            invoiceNumber: `INV-LAB-${orderNumber}`,
            organizationId,
            branchId,
            patientId: BigInt(dto.patientId),
            doctor: doctor ? doctor.name : null,
            date: orderDate,
            amount: new Prisma.Decimal(totalAmount),
            grossTotal: new Prisma.Decimal(totalAmount),
            amountReceived: new Prisma.Decimal(0.0),
            discount: new Prisma.Decimal(0.0),
            vat: new Prisma.Decimal(0.0),
            status: totalAmount > 0 ? 'unpaid' : 'paid',
            category: 'LABORATORY',
            categoryName: catalogueTests.map((t: any) => t.category).join(', '),
            items: {
              create: catalogueTests.map((t: any) => ({
                name: `[Lab] ${t.category}`,
                quantity: 1,
                unitPrice: t.price || new Prisma.Decimal(0.0),
                lineTotal: t.price || new Prisma.Decimal(0.0),
              })),
            },
          },
        });
        invoiceId = payment.id;
      }

      // 2. Create parent Lab Order

      const lab = await tx.lab.create({
        data: {
          organizationId,
          branchId,
          orderNumber,
          patientId: BigInt(dto.patientId),
          doctorId: dto.doctorId ? BigInt(dto.doctorId) : null,
          appointmentId: dto.appointmentId ? BigInt(dto.appointmentId) : null,
          consultationId: dto.consultationId ? BigInt(dto.consultationId) : null,
          invoiceId,
          admissionId,
          date: orderDate,
          dateString: orderDate,
          priority: dto.priority || 'ROUTINE',
          clinicalNotes: dto.clinicalNotes?.trim() || null,
          user: String(userId),
          patientName: patient.name,
          patientPhone: patient.phone || null,
          patientAddress: patient.address || null,
          doctorName: doctor?.name || null,
          status: 'ORDERED',
        },
      });

      // Post financial charge to Inpatient Folio if active stay
      if (admissionId && totalAmount > 0) {
        const folio = await tx.inpatientFolio.findUnique({
          where: { admissionId },
        });
        if (folio) {
          const idempotencyKey = `LAB-${lab.id}`;
          const existingItem = await tx.inpatientFolioItem.findUnique({
            where: { idempotencyKey },
          });
          if (!existingItem) {
            await tx.inpatientFolioItem.create({
              data: {
                folioId: folio.id,
                sourceModule: 'LABORATORY',
                sourceRecordId: lab.id.toString(),
                idempotencyKey,
                chargeCategory: 'LABORATORY',
                description: `Lab Tests: ${catalogueTests.map((t: any) => t.category).join(', ')}`.slice(0, 255),
                quantity: 1,
                unitPrice: new Prisma.Decimal(totalAmount),
                totalAmount: new Prisma.Decimal(totalAmount),
                postedAt: new Date(),
                postedBy: userId ? BigInt(userId) : null,
              },
            });

            await tx.inpatientFolio.update({
              where: { id: folio.id },
              data: {
                totalCharges: { increment: totalAmount },
                balance: { increment: totalAmount },
              },
            });
          }
        }
      }

      // 3. Create LabSample records for each distinct specimen type
      const createdSamples = new Map<string, bigint>();
      let sampleSeq = 1;
      for (const [sType] of sampleTypeMap.entries()) {
        const sampleNumber = `SMP-${orderDate.replace(/-/g, '')}-${lab.id}-${sampleSeq++}`;
        const sample = await tx.labSample.create({
          data: {
            labId: lab.id,
            sampleNumber,
            sampleType: sType,
            status: 'PENDING',
          },
        });
        createdSamples.set(sType, sample.id);
      }

      // 4. Create LabTest line items and pre-create LabResultParameter records
      for (const test of catalogueTests) {
        const sType = test.sampleType?.trim() || 'General Specimen';
        const sampleId = createdSamples.get(sType) || null;

        const labTest = await tx.labTest.create({
          data: {
            labId: lab.id,
            labCategoryId: test.id,
            sampleId,
            name: test.category,
            referenceValue: test.referenceValue || null,
            priceSnapshot: test.price || null,
            sampleType: sType,
            status: 'requested',
          },
        });

        // Pre-create result parameter placeholders if catalogue defines parameters
        if (test.parameters.length) {
          await tx.labResultParameter.createMany({
            data: test.parameters.map((p: any) => ({
              labTestId: labTest.id,
              parameterId: p.id,
              parameterName: p.name,
              value: '',
              unitSnapshot: p.unit || null,
              referenceRangeSnapshot: p.referenceRange || null,
              abnormalFlag: 'NORMAL',
            })),
          });
        }
      }

      // 5. Update legacy summary strings for backwards compatibility
      const legacyCategoryIds = catalogueTests.map((t: any) => t.id.toString()).join(',');
      const legacyCategoryName = catalogueTests.map((t: any) => t.category).join(', ').slice(0, 1000);
      const legacyReport = catalogueTests.map((t: any) => `${t.category}: pending`).join('\n').slice(0, 10000);

      await tx.lab.update({
        where: { id: lab.id },
        data: {
          category: legacyCategoryIds,
          categoryName: legacyCategoryName,
          report: legacyReport,
          status: 'SAMPLE_PENDING',
        },
      });

      const fullOrder = await tx.lab.findUnique({
        where: { id: lab.id },
        include: {
          patient: true,
          doctor: true,
          samples: true,
          tests: {
            include: {
              resultParameters: true,
            },
          },
          invoice: true,
        },
      });

      return this.serializeBigInt(fullOrder);
    });
  }

  async getOrderById(id: number, user?: AuthUser) {
    const order = await this.prisma.lab.findUnique({
      where: { id: BigInt(id) },
      include: {
        patient: true,
        doctor: true,
        appointment: true,
        consultation: true,
        invoice: {
          include: {
            payments: true,
          },
        },
        samples: true,
        tests: {
          include: {
            labCategory: true,
            sample: true,
            resultParameters: {
              orderBy: { id: 'asc' },
            },
          },
        },
        amendments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Lab order #${id} not found.`);
    }

    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, order.patient?.branchId, 'laboratory order');
    }

    return this.serializeBigInt(order);
  }

  async getOrders(query: QueryLabOrdersDto, user?: AuthUser) {
    const where: Prisma.LabWhereInput = {};

    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      const accessibleBranches = await this.branchAuth.resolveAccessibleBranchIds(user);
      const isOrg1 = !user.organizationId || BigInt(user.organizationId) === 1n;
      if (isOrg1) {
        where.patient = {
          OR: [
            { branchId: { in: accessibleBranches || [] } },
            { branchId: null },
          ],
        };
      } else {
        where.patient = {
          branchId: { in: accessibleBranches || [] },
        };
      }
    }

    if (query.patientId) {
      where.patientId = BigInt(query.patientId);
    }

    if (query.doctorId) {
      where.doctorId = BigInt(query.doctorId);
    }

    if (query.status) {
      // Map legacy and modern status queries
      if (query.status === 'pending') {
        where.status = {
          in: ['requested', 'partial', 'ORDERED', 'SAMPLE_PENDING', 'SAMPLE_COLLECTED', 'SAMPLE_RECEIVED', 'PROCESSING', 'RESULT_ENTERED', 'VERIFIED'],
        };
      } else if (query.status === 'reported') {
        where.status = { in: ['reported', 'COMPLETED'] };
      } else {
        where.status = { equals: query.status, mode: 'insensitive' };
      }
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.date) {
      where.date = query.date;
    }

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { patientName: { contains: q, mode: 'insensitive' } },
        { doctorName: { contains: q, mode: 'insensitive' } },
        { categoryName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 25;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.lab.count({ where }),
      this.prisma.lab.findMany({
        where,
        skip,
        take: limit,
        include: {
          patient: true,
          doctor: true,
          samples: true,
          tests: {
            include: {
              resultParameters: true,
            },
          },
          invoice: true,
        },
        orderBy: { id: 'desc' },
      }),
    ]);

    const serialized = this.serializeBigInt(items);
    return {
      items: serialized,
      data: serialized,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSampleQueue() {
    const samples = await this.prisma.labSample.findMany({
      where: {
        status: { in: ['PENDING', 'COLLECTED', 'REJECTED'] },
      },
      include: {
        lab: {
          include: {
            patient: true,
            doctor: true,
          },
        },
        tests: true,
      },
      orderBy: { id: 'desc' },
    });

    return this.serializeBigInt(samples);
  }

  async cancelOrder(id: number, dto: CancelLabOrderDto, _userId: number, user?: AuthUser) {
    const order = await this.getOrderById(id, user);

    if (order.status === 'COMPLETED' || order.status === 'reported') {
      throw new BadRequestException('Cannot cancel a completed lab order with finalized results.');
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Lab order is already cancelled.');
    }

    const updated = await this.prisma.lab.update({
      where: { id: BigInt(id) },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: dto.reason.trim(),
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    return this.serializeBigInt(updated);
  }

  // ===========================================================================
  // 4. SAMPLE COLLECTION & SPECIMEN ACCESSIONING
  // ===========================================================================

  async collectSample(sampleId: number, dto: CollectSampleDto, userId: number) {
    const sample = await this.prisma.labSample.findUnique({
      where: { id: BigInt(sampleId) },
      include: { lab: true },
    });

    if (!sample) {
      throw new NotFoundException(`Sample #${sampleId} not found.`);
    }

    if (sample.status === 'COLLECTED' || sample.status === 'RECEIVED') {
      throw new BadRequestException(`Sample #${sampleId} has already been collected.`);
    }

    const now = new Date();
    const updatedSample = await this.prisma.$transaction(async (tx: any) => {
      const s = await tx.labSample.update({
        where: { id: BigInt(sampleId) },
        data: {
          status: 'COLLECTED',
          collectorLocation: dto.collectorLocation?.trim() || null,
          condition: dto.condition?.trim() || 'GOOD',
          collectedAt: now,
          collectedBy: BigInt(userId),
          notes: dto.notes?.trim() || sample.notes,
        },
      });

      // Update parent order status
      await tx.lab.update({
        where: { id: sample.labId },
        data: { status: 'SAMPLE_COLLECTED' },
      });

      return s;
    });

    return this.serializeBigInt(updatedSample);
  }

  async recollectSample(sampleId: number, dto: RecollectSampleDto, userId: number) {
    const originalSample = await this.prisma.labSample.findUnique({
      where: { id: BigInt(sampleId) },
      include: { lab: true, tests: true },
    });

    if (!originalSample) {
      throw new NotFoundException(`Sample #${sampleId} not found.`);
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const newSampleNumber = `SMP-${dateStr}-${originalSample.labId}-R${Math.floor(100 + Math.random() * 900)}`;

    const newSample = await this.prisma.$transaction(async (tx: any) => {
      const created = await tx.labSample.create({
        data: {
          labId: originalSample.labId,
          sampleNumber: newSampleNumber,
          sampleType: originalSample.sampleType,
          collectorLocation: dto.collectorLocation?.trim() || null,
          condition: dto.condition?.trim() || 'FRESH',
          isRecollection: true,
          recollectedFromId: originalSample.id,
          status: 'COLLECTED',
          collectedAt: now,
          collectedBy: BigInt(userId),
          notes: dto.notes?.trim() || `Recollected after #${originalSample.sampleNumber} rejection`,
        },
      });

      // Re-link test line items to the newly recollected sample
      await tx.labTest.updateMany({
        where: { sampleId: originalSample.id },
        data: { sampleId: created.id },
      });

      // Update lab order status back to SAMPLE_COLLECTED
      await tx.lab.update({
        where: { id: originalSample.labId },
        data: { status: 'SAMPLE_COLLECTED' },
      });

      return created;
    });

    return this.serializeBigInt(newSample);
  }

  async receiveSample(sampleId: number, dto: ReceiveSampleDto, userId: number) {
    const sample = await this.prisma.labSample.findUnique({
      where: { id: BigInt(sampleId) },
      include: { lab: true },
    });

    if (!sample) {
      throw new NotFoundException(`Sample #${sampleId} not found.`);
    }

    if (sample.status !== 'COLLECTED') {
      throw new BadRequestException(
        `Cannot receive sample in "${sample.status}" status. It must be collected first.`,
      );
    }

    const now = new Date();
    const updatedSample = await this.prisma.$transaction(async (tx: any) => {
      const s = await tx.labSample.update({
        where: { id: BigInt(sampleId) },
        data: {
          status: 'RECEIVED',
          receivedAt: now,
          receivedBy: BigInt(userId),
          notes: dto.notes?.trim() || sample.notes,
        },
      });

      await tx.lab.update({
        where: { id: sample.labId },
        data: { status: 'PROCESSING' },
      });

      return s;
    });

    return this.serializeBigInt(updatedSample);
  }

  async rejectSample(sampleId: number, dto: RejectSampleDto, userId: number) {
    const sample = await this.prisma.labSample.findUnique({
      where: { id: BigInt(sampleId) },
      include: { lab: true },
    });

    if (!sample) {
      throw new NotFoundException(`Sample #${sampleId} not found.`);
    }

    const now = new Date();
    const updatedSample = await this.prisma.$transaction(async (tx: any) => {
      const s = await tx.labSample.update({
        where: { id: BigInt(sampleId) },
        data: {
          status: 'REJECTED',
          rejectedAt: now,
          rejectedBy: BigInt(userId),
          rejectionReason: `${dto.reason}: ${dto.notes || 'No additional remarks'}`,
        },
      });

      // Reset order status to SAMPLE_PENDING so phlebotomist sees recollection is needed
      await tx.lab.update({
        where: { id: sample.labId },
        data: { status: 'SAMPLE_PENDING' },
      });

      return s;
    });

    return this.serializeBigInt(updatedSample);
  }

  // ===========================================================================
  // 5. RESULT ENTRY, VERIFICATION & AMENDMENTS
  // ===========================================================================

  private evaluateAbnormalFlag(
    valueStr: string,
    referenceRange?: string | null,
    criticalLow?: number | null,
    criticalHigh?: number | null,
  ): string {
    if (!valueStr) return 'NORMAL';
    const trimmed = valueStr.trim();
    const upper = trimmed.toUpperCase();

    // Check qualitative values first
    if (['POSITIVE', 'REACTIVE', 'DETECTED', 'PRESENT'].includes(upper)) {
      return 'REACTIVE';
    }
    if (['NEGATIVE', 'NON-REACTIVE', 'NOT DETECTED', 'ABSENT'].includes(upper)) {
      return 'NORMAL';
    }

    const num = parseFloat(trimmed);
    if (isNaN(num)) {
      return 'NORMAL';
    }

    // Parse reference range bounds
    let rangeMin: number | null = null;
    let rangeMax: number | null = null;

    if (referenceRange) {
      // 1. "13.5 - 17.5", "13.5-17.5"
      const dashMatch = referenceRange.match(/^([0-9.]+)\s*-\s*([0-9.]+)/);
      if (dashMatch) {
        rangeMin = parseFloat(dashMatch[1]);
        rangeMax = parseFloat(dashMatch[2]);
      } else {
        // 2. "< 200", "<= 200"
        const ltMatch = referenceRange.match(/^(?:<=?|<)\s*([0-9.]+)/);
        if (ltMatch) {
          rangeMax = parseFloat(ltMatch[1]);
        } else {
          // 3. "> 60", ">= 60"
          const gtMatch = referenceRange.match(/^(?:>=?|>)\s*([0-9.]+)/);
          if (gtMatch) {
            rangeMin = parseFloat(gtMatch[1]);
          }
        }
      }
    }

    // Critical limits check: only evaluate when clinically consistent with this parameter's scale
    const isCriticalLowValid =
      criticalLow !== null &&
      criticalLow !== undefined &&
      (rangeMin === null || criticalLow < rangeMin);

    const isCriticalHighValid =
      criticalHigh !== null &&
      criticalHigh !== undefined &&
      (rangeMax === null || criticalHigh > rangeMax);

    if (isCriticalLowValid && num < (criticalLow as number)) {
      return 'CRITICAL_LOW';
    }
    if (isCriticalHighValid && num > (criticalHigh as number)) {
      return 'CRITICAL_HIGH';
    }

    if (rangeMin !== null && num < rangeMin) return 'LOW';
    if (rangeMax !== null && num > rangeMax) return 'HIGH';

    return 'NORMAL';
  }

  async enterResults(orderId: number, dto: EnterResultsDto, userId: number) {
    const order = await this.prisma.lab.findUnique({
      where: { id: BigInt(orderId) },
      include: {
        tests: {
          include: {
            labCategory: true,
            resultParameters: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Lab order #${orderId} not found.`);
    }

    if (order.status === 'COMPLETED' || order.status === 'reported') {
      throw new BadRequestException(
        'Cannot modify results on an approved, completed report. Use the controlled amendment endpoint instead.',
      );
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Cannot enter results for a cancelled lab order.');
    }

    return await this.prisma.$transaction(async (tx: any) => {
      const now = new Date();

      for (const param of dto.parameters) {
        const test = order.tests.find((t: any) => Number(t.id) === param.testId);
        if (!test) {
          continue;
        }

        const value = param.value.trim();

        // Legacy protection: blank value doesn't wipe existing result submitted from stale page
        if (value === '' && test.result) {
          continue;
        }

        const existingParam = test.resultParameters.find(
          (rp: any) =>
            (param.parameterId && Number(rp.parameterId) === param.parameterId) ||
            rp.parameterName.toLowerCase() === param.parameterName.trim().toLowerCase(),
        );

        // Blank box protection: don't overwrite existing non-empty value with blank whitespace
        if (value === '' && existingParam && existingParam.value) {
          continue;
        }

        const referenceRange = existingParam?.referenceRangeSnapshot || param.referenceRangeSnapshot;
        const criticalLow = test.labCategory?.criticalLow ? Number(test.labCategory.criticalLow) : null;
        const criticalHigh = test.labCategory?.criticalHigh ? Number(test.labCategory.criticalHigh) : null;
        const calculatedFlag = this.evaluateAbnormalFlag(value, referenceRange, criticalLow, criticalHigh);
        const finalFlag = (param.abnormalFlag && param.abnormalFlag !== 'NORMAL')
          ? param.abnormalFlag
          : calculatedFlag;

        // Upsert result parameter reading
        if (existingParam) {
          await tx.labResultParameter.update({
            where: { id: existingParam.id },
            data: {
              value: value !== '' ? value : existingParam.value,
              abnormalFlag: finalFlag,
              clinicalComments: param.clinicalComments?.trim() || existingParam.clinicalComments,
              enteredById: BigInt(userId),
              enteredAt: now,
            },
          });
        } else {
          await tx.labResultParameter.create({
            data: {
              labTestId: test.id,
              parameterId: param.parameterId ? BigInt(param.parameterId) : null,
              parameterName: param.parameterName.trim(),
              value,
              unitSnapshot: param.unitSnapshot?.trim() || null,
              referenceRangeSnapshot: param.referenceRangeSnapshot?.trim() || null,
              abnormalFlag: finalFlag,
              clinicalComments: param.clinicalComments?.trim() || null,
              enteredById: BigInt(userId),
              enteredAt: now,
            },
          });
        }

        // Update test line item result summary and status
        const newResult = value !== '' ? value : test.result;
        await tx.labTest.update({
          where: { id: test.id },
          data: {
            result: newResult,
            status: newResult ? 'reported' : 'requested',
            reportedAt: newResult ? (test.reportedAt || now) : null,
          },
        });
      }

      // Re-query updated tests to derive request status and summary strings
      const updatedTests = await tx.labTest.findMany({
        where: { labId: order.id },
        include: { resultParameters: true },
      });

      const reportedCount = updatedTests.filter((t: any) => t.result && t.result.trim() !== '').length;
      const totalCount = updatedTests.length;

      const derivedLegacyStatus =
        reportedCount === 0 ? 'requested' : reportedCount === totalCount ? 'reported' : 'partial';

      const derivedModernStatus =
        reportedCount === 0
          ? 'PROCESSING'
          : reportedCount === totalCount
            ? 'RESULT_ENTERED'
            : 'PARTIAL';

      const legacyCategoryName = updatedTests.map((t: any) => t.name).join(', ').slice(0, 1000);
      const legacyReport = updatedTests
        .map((t: any) => `${t.name}: ${t.result || 'pending'}`)
        .join('\n')
        .slice(0, 10000);

      await tx.lab.update({
        where: { id: order.id },
        data: {
          status: derivedModernStatus,
          categoryName: legacyCategoryName,
          report: legacyReport,
          completedAt: derivedLegacyStatus === 'reported' ? now : null,
        },
      });

      const fullOrder = await tx.lab.findUnique({
        where: { id: order.id },
        include: {
          patient: true,
          doctor: true,
          tests: {
            include: {
              resultParameters: true,
            },
          },
          samples: true,
        },
      });

      return this.serializeBigInt(fullOrder);
    });
  }

  async verifyResults(orderId: number, _dto: VerifyResultsDto, userId: number) {
    const order = await this.prisma.lab.findUnique({
      where: { id: BigInt(orderId) },
      include: { tests: true },
    });

    if (!order) {
      throw new NotFoundException(`Lab order #${orderId} not found.`);
    }

    const unrecorded = order.tests.filter((t: any) => !t.result || t.result.trim() === '');
    if (unrecorded.length > 0) {
      throw new BadRequestException(
        `Cannot verify results: ${unrecorded.length} test(s) still have pending results.`,
      );
    }

    const updated = await this.prisma.lab.update({
      where: { id: BigInt(orderId) },
      data: {
        status: 'VERIFIED',
        verifiedBy: BigInt(userId),
        verifiedAt: new Date(),
      },
      include: {
        patient: true,
        doctor: true,
        tests: {
          include: { resultParameters: true },
        },
      },
    });

    // Phase 10.5.8: Detect critical findings and escalate to responsible clinician
    if (this.notificationService && updated.tests) {
      const criticalParams = updated.tests.flatMap((t: any) => t.resultParameters || [])
        .filter((p: any) => ['CRITICAL_HIGH', 'CRITICAL_LOW', 'CRITICAL', 'ALERT'].includes(p.abnormalFlag));

      if (criticalParams.length > 0) {
        const findings = criticalParams
          .map((p: any) => `Value: ${p.value} (${p.abnormalFlag})`)
          .join('; ');
        void this.notificationService.triggerCriticalResultEscalation(BigInt(orderId), findings);
      }
    }

    return this.serializeBigInt(updated);
  }

  async approveReport(orderId: number, _dto: ApproveReportDto, userId: number) {
    const order = await this.prisma.lab.findUnique({
      where: { id: BigInt(orderId) },
      include: { tests: true },
    });

    if (!order) {
      throw new NotFoundException(`Lab order #${orderId} not found.`);
    }

    if (order.status !== 'VERIFIED' && order.status !== 'RESULT_ENTERED') {
      throw new BadRequestException(
        `Cannot approve report in "${order.status}" status. Results must be entered and verified.`,
      );
    }

    const now = new Date();
    const updated = await this.prisma.lab.update({
      where: { id: BigInt(orderId) },
      data: {
        status: 'COMPLETED',
        approvedBy: BigInt(userId),
        approvedAt: now,
        completedAt: now,
      },
      include: {
        patient: true,
        doctor: true,
        tests: {
          include: { resultParameters: true },
        },
        samples: true,
      },
    });

    // Phase 10.5.8: Notify patient of finalized laboratory report
    if (this.notificationService) {
      void this.notificationService.triggerLabReportNotification(BigInt(orderId), false);
    }

    return this.serializeBigInt(updated);
  }

  async amendReport(orderId: number, dto: AmendReportDto, userId: number) {
    const order = await this.prisma.lab.findUnique({
      where: { id: BigInt(orderId) },
      include: {
        tests: {
          include: { resultParameters: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Lab order #${orderId} not found.`);
    }

    if (order.status !== 'COMPLETED' && order.status !== 'reported') {
      throw new BadRequestException(
        'Amendments can only be filed against finalized, approved reports.',
      );
    }

    return await this.prisma.$transaction(async (tx: any) => {
      // 1. Take previous snapshot
      const previousSnapshot = this.serializeBigInt({
        report: order.report,
        tests: order.tests,
      });

      // 2. Update parameter values
      for (const param of dto.parameters) {
        const test = order.tests.find((t: any) => Number(t.id) === param.testId);
        if (!test) continue;

        if (param.parameterId) {
          const existingParam = test.resultParameters.find(
            (rp: any) => Number(rp.parameterId) === param.parameterId,
          );
          if (existingParam) {
            await tx.labResultParameter.update({
              where: { id: existingParam.id },
              data: {
                value: param.value.trim(),
                abnormalFlag: param.abnormalFlag || existingParam.abnormalFlag,
                clinicalComments: param.clinicalComments?.trim() || existingParam.clinicalComments,
              },
            });
          }
        }

        await tx.labTest.update({
          where: { id: test.id },
          data: { result: param.value.trim() },
        });
      }

      // 3. Take new snapshot
      const refreshedTests = await tx.labTest.findMany({
        where: { labId: order.id },
        include: { resultParameters: true },
      });

      const newReport = refreshedTests
        .map((t: any) => `${t.name}: ${t.result || 'pending'}`)
        .join('\n')
        .slice(0, 10000);

      await tx.lab.update({
        where: { id: order.id },
        data: { report: newReport },
      });

      const newSnapshot = this.serializeBigInt({
        report: newReport,
        tests: refreshedTests,
      });

      // 4. Record audit trail entry
      await tx.labReportAmendment.create({
        data: {
          labId: order.id,
          amendedBy: BigInt(userId),
          reason: dto.reason.trim(),
          previousSnapshot,
          newSnapshot,
        },
      });

      const fullAmendedOrder = await tx.lab.findUnique({
        where: { id: order.id },
        include: {
          patient: true,
          doctor: true,
          tests: { include: { resultParameters: true } },
          samples: true,
          amendments: { orderBy: { createdAt: 'desc' } },
        },
      });

      return this.serializeBigInt(fullAmendedOrder);
    });
  }

  // ===========================================================================
  // 6. DASHBOARD & CLINICAL ANALYTICS
  // ===========================================================================

  async getDashboard() {
    const [
      pendingOrders,
      sampleCollectionQueue,
      processingQueue,
      awaitingVerification,
      completedReports,
      rejectedSamples,
      totalTestsInCatalogue,
    ] = await Promise.all([
      this.prisma.lab.count({
        where: { status: { in: ['requested', 'ORDERED', 'SAMPLE_PENDING'] } },
      }),
      this.prisma.labSample.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.lab.count({
        where: { status: { in: ['SAMPLE_COLLECTED', 'SAMPLE_RECEIVED', 'PROCESSING'] } },
      }),
      this.prisma.lab.count({
        where: { status: 'RESULT_ENTERED' },
      }),
      this.prisma.lab.count({
        where: { status: { in: ['reported', 'COMPLETED'] } },
      }),
      this.prisma.labSample.count({
        where: { status: 'REJECTED' },
      }),
      this.prisma.labCategory.count({
        where: { isActive: true },
      }),
    ]);

    const recentOrders = await this.prisma.lab.findMany({
      take: 5,
      orderBy: { id: 'desc' },
      include: {
        patient: true,
        doctor: true,
        tests: true,
      },
    });

    return {
      metrics: {
        pendingOrders,
        sampleCollectionQueue,
        processingQueue,
        awaitingVerification,
        completedReports,
        rejectedSamples,
        totalTestsInCatalogue,
      },
      recentOrders: this.serializeBigInt(recentOrders),
    };
  }

  async getPatientHistory(patientId: number, user?: AuthUser) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: BigInt(patientId) },
    });
    if (!patient) {
      throw new NotFoundException(`Patient #${patientId} not found.`);
    }

    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, patient.branchId, 'patient');
    }

    const orders = await this.prisma.lab.findMany({
      where: { patientId: BigInt(patientId) },
      include: {
        tests: {
          include: {
            resultParameters: true,
          },
        },
        doctor: true,
      },
      orderBy: { date: 'desc' },
    });

    return this.serializeBigInt(orders);
  }

  // ===========================================================================
  // 7. PRINTABLE LABORATORY REPORT
  // ===========================================================================

  async getPrintout(id: number, user?: AuthUser) {
    const order = await this.prisma.lab.findUnique({
      where: { id: BigInt(id) },
      include: {
        patient: true,
        doctor: true,
        branch: {
          include: {
            settings: true,
            organization: {
              include: {
                settings: true,
              },
            },
          },
        },
        organization: {
          include: {
            settings: true,
          },
        },
        samples: {
          orderBy: { id: 'asc' },
        },
        tests: {
          include: {
            labCategory: true,
            sample: true,
            resultParameters: {
              include: {
                enteredBy: true,
              },
              orderBy: { id: 'asc' },
            },
          },
        },
        amendments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Lab order #${id} not found.`);
    }

    if (this.branchAuth && user && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, order.patient?.branchId, 'laboratory order');
    }

    const hospitalSettings = await this.prisma.hospitalSettings.findFirst({
      orderBy: { id: 'desc' },
    });

    let verifierName: string | null = null;
    if (order.verifiedBy) {
      const vUser = await this.prisma.user.findUnique({ where: { id: order.verifiedBy } });
      if (vUser) verifierName = `${vUser.firstName} ${vUser.lastName}`.trim();
    }
    let approverName: string | null = null;
    if (order.approvedBy) {
      const aUser = await this.prisma.user.findUnique({ where: { id: order.approvedBy } });
      if (aUser) approverName = `${aUser.firstName} ${aUser.lastName}`.trim();
    }

    const orgSettings = order.organization?.settings || order.branch?.organization?.settings;
    const branchSettings = order.branch?.settings;

    const printoutPayload = {
      orderNumber: order.orderNumber,
      orderDate: order.date,
      priority: order.priority,
      status: order.status,
      clinicalNotes: order.clinicalNotes,
      hospital: {
        name: orgSettings?.legalName || hospitalSettings?.hospitalName || 'Medora Healthcare',
        address: orgSettings?.address || hospitalSettings?.address || '',
        phone: orgSettings?.phone || hospitalSettings?.phone || '',
        email: orgSettings?.email || hospitalSettings?.email || '',
        taxNumber: orgSettings?.taxNumber || hospitalSettings?.taxNumber || '',
        logoUrl: branchSettings?.logoUrlOverride || orgSettings?.logoUrl || hospitalSettings?.logoUrl || null,
        branchName: order.branch?.name || null,
        branchAddress: order.branch?.address || null,
      },
      patient: {
        id: Number(order.patient.id),
        mrn: order.patient.patientId || order.patient.oldMrn || `PAT-${order.patient.id}`,
        name: order.patient.name,
        age: order.patient.age,
        gender: order.patient.sex,
        phone: order.patient.phone,
        address: order.patient.address,
      },
      doctor: {
        id: order.doctor ? Number(order.doctor.id) : null,
        name: order.doctor ? order.doctor.name : (order.doctorName || 'Attending Physician'),
        department: order.doctor?.department || null,
      },
      samples: order.samples.map((s: any) => ({
        sampleNumber: s.sampleNumber,
        sampleType: s.sampleType,
        status: s.status,
        collectorLocation: s.collectorLocation,
        condition: s.condition,
        isRecollection: s.isRecollection,
        collectedAt: s.collectedAt ? s.collectedAt.toISOString() : null,
        receivedAt: s.receivedAt ? s.receivedAt.toISOString() : null,
      })),
      tests: order.tests.map((t: any) => ({
        id: Number(t.id),
        name: t.name,
        department: t.labCategory?.department || 'General',
        sampleType: t.sampleType,
        resultSummary: t.result,
        status: t.status,
        parameters: t.resultParameters.map((p: any) => ({
          parameterName: p.parameterName,
          value: p.value,
          unit: p.unitSnapshot,
          referenceRange: p.referenceRangeSnapshot,
          abnormalFlag: p.abnormalFlag,
          clinicalComments: p.clinicalComments,
          enteredBy: p.enteredBy ? `${p.enteredBy.firstName} ${p.enteredBy.lastName}`.trim() : null,
          enteredAt: p.enteredAt ? p.enteredAt.toISOString() : null,
        })),
      })),
      verification: {
        verifiedByName: verifierName,
        verifiedAt: order.verifiedAt ? order.verifiedAt.toISOString() : null,
        approvedByName: approverName,
        approvedAt: order.approvedAt ? order.approvedAt.toISOString() : null,
      },
      amendments: order.amendments.map((a: any) => ({
        id: Number(a.id),
        reason: a.reason,
        createdAt: a.createdAt.toISOString(),
      })),
      printedAt: new Date().toISOString(),
    };

    return this.serializeBigInt(printoutPayload);
  }
}
