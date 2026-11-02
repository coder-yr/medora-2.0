import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateRadiologyCategoryDto,
  UpdateRadiologyCategoryDto,
  CreateRadiologyExamDto,
  UpdateRadiologyExamDto,
} from './dto/catalogue.dto';
import {
  CreateRadiologyOrderDto,
  ScheduleRadiologyOrderDto,
  CancelRadiologyOrderDto,
} from './dto/order.dto';
import {
  RecordArrivalDto,
  StartExaminationDto,
  CompleteExaminationDto,
  SaveReportDraftDto,
  SubmitReportDto,
  VerifyReportDto,
  ApproveReportDto,
  CreateRadiologyAmendmentDto,
} from './dto/workflow.dto';
import { QueryRadiologyOrderDto, QueryRadiologyExamDto } from './dto/query.dto';

function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Prisma.Decimal.isDecimal(obj)) return Number(obj);
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      res[key] = serializeBigInt(obj[key]);
    }
    return res;
  }
  return obj;
}

@Injectable()
export class RadiologyService {
  private readonly logger = new Logger(RadiologyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // 1. DASHBOARD & KPIS
  // =========================================================================

  async getDashboardMetrics(branchId?: number) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const whereBranch = branchId ? { branchId: BigInt(branchId) } : {};

    const [
      pendingOrders,
      scheduledToday,
      awaitingExamination,
      inProgress,
      reportsPending,
      awaitingVerification,
      completedReports,
      cancelledOrders,
      totalExamsInCatalogue,
      recentOrders,
    ] = await Promise.all([
      this.prisma.radiologyOrder.count({
        where: { ...whereBranch, status: { in: ['ordered', 'ORDERED'] } },
      }),
      this.prisma.radiologyOrder.count({
        where: {
          ...whereBranch,
          status: { in: ['scheduled', 'SCHEDULED'] },
          scheduledAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.radiologyOrder.count({
        where: { ...whereBranch, status: { in: ['arrived', 'ARRIVED'] } },
      }),
      this.prisma.radiologyOrder.count({
        where: { ...whereBranch, status: { in: ['in_progress', 'IN_PROGRESS'] } },
      }),
      this.prisma.radiologyOrder.count({
        where: { ...whereBranch, status: { in: ['done', 'STUDY_COMPLETED', 'REPORT_PENDING'] } },
      }),
      this.prisma.radiologyOrder.count({
        where: { ...whereBranch, status: { in: ['VERIFIED'] } },
      }),
      this.prisma.radiologyOrder.count({
        where: { ...whereBranch, status: { in: ['reported', 'COMPLETED'] } },
      }),
      this.prisma.radiologyOrder.count({
        where: { ...whereBranch, status: { in: ['cancelled', 'CANCELLED'] } },
      }),
      this.prisma.radiologyExam.count({
        where: { active: true },
      }),
      this.prisma.radiologyOrder.findMany({
        where: whereBranch,
        take: 10,
        orderBy: [{ urgent: 'desc' }, { createdAt: 'desc' }],
        include: {
          patient: { select: { id: true, name: true, phone: true, patientId: true } },
          doctor: { select: { id: true, name: true } },
          radiologyExam: { select: { id: true, name: true, modality: true } },
        },
      }),
    ]);

    return serializeBigInt({
      metrics: {
        pendingOrders,
        scheduledToday,
        awaitingExamination,
        inProgress,
        reportsPending,
        awaitingVerification,
        completedReports,
        cancelledOrders,
        totalExamsInCatalogue,
      },
      recentOrders,
    });
  }

  // =========================================================================
  // 2. CATALOGUE & MODALITIES MANAGEMENT
  // =========================================================================

  async getCategories() {
    const categories = await this.prisma.radiologyCategory.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { exams: true } },
      },
    });
    return serializeBigInt(categories);
  }

  async createCategory(dto: CreateRadiologyCategoryDto) {
    const existing = await this.prisma.radiologyCategory.findUnique({
      where: { name: dto.name.trim() },
    });
    if (existing) {
      throw new ConflictException(`Radiology category "${dto.name}" already exists`);
    }

    const category = await this.prisma.radiologyCategory.create({
      data: {
        name: dto.name.trim(),
        modality: dto.modality.toLowerCase().trim(),
        description: dto.description?.trim(),
        displayOrder: dto.displayOrder || 0,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
    return serializeBigInt(category);
  }

  async updateCategory(id: number, dto: UpdateRadiologyCategoryDto) {
    await this.findCategoryOrThrow(id);

    if (dto.name) {
      const existing = await this.prisma.radiologyCategory.findUnique({
        where: { name: dto.name.trim() },
      });
      if (existing && Number(existing.id) !== id) {
        throw new ConflictException(`Category name "${dto.name}" is already taken`);
      }
    }

    const updated = await this.prisma.radiologyCategory.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.modality && { modality: dto.modality.toLowerCase().trim() }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return serializeBigInt(updated);
  }

  async getExams(query: QueryRadiologyExamDto) {
    const where: Prisma.RadiologyExamWhereInput = {};

    if (query.modality) {
      where.modality = query.modality.toLowerCase().trim();
    }
    if (query.categoryId) {
      where.categoryId = BigInt(query.categoryId);
    }
    if (query.active !== undefined) {
      where.active = query.active;
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { code: { contains: s, mode: 'insensitive' } },
        { bodyPart: { contains: s, mode: 'insensitive' } },
      ];
    }

    const exams = await this.prisma.radiologyExam.findMany({
      where,
      orderBy: [{ modality: 'asc' }, { name: 'asc' }],
      include: {
        category: true,
        paymentCategory: { select: { id: true, category: true, cPrice: true } },
      },
    });
    return serializeBigInt(exams);
  }

  async getExamById(id: number) {
    const exam = await this.prisma.radiologyExam.findUnique({
      where: { id: BigInt(id) },
      include: {
        category: true,
        paymentCategory: true,
      },
    });
    if (!exam) {
      throw new NotFoundException(`Radiology exam #${id} not found`);
    }
    return serializeBigInt(exam);
  }

  async createExam(dto: CreateRadiologyExamDto) {
    // Generate unique code if not provided
    const code = dto.code?.trim() || await this.generateExamCode(dto.modality);

    const existingCode = await this.prisma.radiologyExam.findUnique({
      where: { code },
    });
    if (existingCode) {
      throw new ConflictException(`Radiology exam code "${code}" already exists`);
    }

    const exam = await this.prisma.radiologyExam.create({
      data: {
        code,
        name: dto.name.trim(),
        modality: dto.modality.toLowerCase().trim(),
        bodyPart: dto.bodyPart?.trim(),
        categoryId: dto.categoryId ? BigInt(dto.categoryId) : undefined,
        paymentCategoryId: dto.paymentCategoryId ? BigInt(dto.paymentCategoryId) : undefined,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        reportTemplate: dto.reportTemplate?.trim(),
        preparationInstructions: dto.preparationInstructions?.trim(),
        turnaroundHours: dto.turnaroundHours || 24,
        active: dto.active !== undefined ? dto.active : true,
      },
      include: {
        category: true,
        paymentCategory: true,
      },
    });
    return serializeBigInt(exam);
  }

  async updateExam(id: number, dto: UpdateRadiologyExamDto) {
    await this.findExamOrThrow(id);

    if (dto.code) {
      const existing = await this.prisma.radiologyExam.findUnique({
        where: { code: dto.code.trim() },
      });
      if (existing && Number(existing.id) !== id) {
        throw new ConflictException(`Exam code "${dto.code}" is already in use`);
      }
    }

    const updated = await this.prisma.radiologyExam.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.code && { code: dto.code.trim() }),
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.modality && { modality: dto.modality.toLowerCase().trim() }),
        ...(dto.bodyPart !== undefined && { bodyPart: dto.bodyPart }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId ? BigInt(dto.categoryId) : null }),
        ...(dto.paymentCategoryId !== undefined && {
          paymentCategoryId: dto.paymentCategoryId ? BigInt(dto.paymentCategoryId) : null,
        }),
        ...(dto.price !== undefined && {
          price: dto.price !== null ? new Prisma.Decimal(dto.price) : null,
        }),
        ...(dto.reportTemplate !== undefined && { reportTemplate: dto.reportTemplate }),
        ...(dto.preparationInstructions !== undefined && {
          preparationInstructions: dto.preparationInstructions,
        }),
        ...(dto.turnaroundHours !== undefined && { turnaroundHours: dto.turnaroundHours }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      include: {
        category: true,
        paymentCategory: true,
      },
    });
    return serializeBigInt(updated);
  }

  async deleteExam(id: number) {
    await this.findExamOrThrow(id);

    const ordersCount = await this.prisma.radiologyOrder.count({
      where: { radiologyExamId: BigInt(id) },
    });

    if (ordersCount > 0) {
      // Soft deactivation to protect historical requisitions
      const deactivated = await this.prisma.radiologyExam.update({
        where: { id: BigInt(id) },
        data: { active: false },
      });
      return serializeBigInt({
        message: `Exam has ${ordersCount} linked order(s). Exam deactivated rather than deleted.`,
        deactivated: true,
        exam: deactivated,
      });
    }

    await this.prisma.radiologyExam.delete({
      where: { id: BigInt(id) },
    });
    return { success: true, message: `Exam #${id} deleted successfully` };
  }

  // =========================================================================
  // 3. ORDERS MANAGEMENT & REQUISITION LIFECYCLE
  // =========================================================================

  async createOrders(dto: CreateRadiologyOrderDto, userId?: number) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: BigInt(dto.patientId) },
    });
    if (!patient) {
      throw new NotFoundException(`Patient #${dto.patientId} not found`);
    }

    if (dto.doctorId) {
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: BigInt(dto.doctorId) },
      });
      if (!doctor) {
        throw new NotFoundException(`Doctor #${dto.doctorId} not found`);
      }
    }

    const uniqueExamIds = Array.from(new Set(dto.examIds.map((id) => Number(id))));
    const exams = await this.prisma.radiologyExam.findMany({
      where: { id: { in: uniqueExamIds.map((id) => BigInt(id)) }, active: true },
      include: { paymentCategory: true },
    });

    if (exams.length !== uniqueExamIds.length) {
      throw new BadRequestException('One or more selected radiology exams are invalid or inactive');
    }

    // Duplicate prevention check: same patient, same exam, created today in non-terminal state
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existingActiveOrders = await this.prisma.radiologyOrder.findMany({
      where: {
        patientId: BigInt(dto.patientId),
        radiologyExamId: { in: uniqueExamIds.map((id) => BigInt(id)) },
        orderDate: { gte: todayStart },
        status: { in: ['ordered', 'scheduled', 'arrived', 'in_progress', 'done'] },
      },
    });

    if (existingActiveOrders.length > 0) {
      const existingExamIds = existingActiveOrders.map((o) => Number(o.radiologyExamId));
      const duplicateExam = exams.find((e) => existingExamIds.includes(Number(e.id)));
      throw new ConflictException(
        `Active order for "${duplicateExam?.name || 'this exam'}" already placed for this patient today`,
      );
    }

    const urgent = !!dto.urgent || dto.urgency === 'urgent' || dto.urgency === 'stat';
    const urgency = dto.urgency || (urgent ? 'urgent' : 'routine');

    return await this.prisma.$transaction(async (tx) => {
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

      const createdOrders = [];
      const invoiceLineItems = [];

      for (const exam of exams) {
        const orderNumber = await this.generateOrderNumber();
        const initialFindings = exam.reportTemplate || null;

        const order = await tx.radiologyOrder.create({
          data: {
            orderNumber,
            patientId: BigInt(dto.patientId),
            doctorId: dto.doctorId ? BigInt(dto.doctorId) : undefined,
            appointmentId: dto.appointmentId ? BigInt(dto.appointmentId) : undefined,
            consultationId: dto.consultationId ? BigInt(dto.consultationId) : undefined,
            admissionId,
            radiologyExamId: exam.id,
            examName: exam.name,
            modality: exam.modality,
            orderDate: new Date(),
            clinicalIndication: dto.clinicalNotes || dto.clinicalIndication || undefined,
            urgent,
            urgency,
            status: dto.scheduledAt ? 'scheduled' : 'ordered',
            scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
            equipmentRoom: dto.equipmentRoom?.trim() || undefined,
            findings: initialFindings,
            createdBy: userId ? BigInt(userId) : undefined,
          },
          include: {
            patient: { select: { id: true, name: true, patientId: true, phone: true } },
            doctor: { select: { id: true, name: true } },
            radiologyExam: true,
          },
        });
        createdOrders.push(order);

        // Price lookup: check direct exam price fallback or linked payment category
        let unitPrice = 0;
        if (exam.price) {
          unitPrice = Number(exam.price);
        } else if (exam.paymentCategory?.cPrice) {
          unitPrice = Number(exam.paymentCategory.cPrice) || 0;
        }

        invoiceLineItems.push({
          orderId: order.id,
          name: `[Radiology] ${exam.name}`,
          quantity: 1,
          unitPrice,
          lineTotal: unitPrice,
          paymentCategoryId: exam.paymentCategoryId || undefined,
          doctorId: dto.doctorId ? BigInt(dto.doctorId) : undefined,
        });

        // Post financial charge to Inpatient Folio if active stay
        if (admissionId && unitPrice > 0) {
          const folio = await tx.inpatientFolio.findUnique({
            where: { admissionId },
          });
          if (folio) {
            const idempotencyKey = `RAD-${order.id}`;
            const existingItem = await tx.inpatientFolioItem.findUnique({
              where: { idempotencyKey },
            });
            if (!existingItem) {
              await tx.inpatientFolioItem.create({
                data: {
                  folioId: folio.id,
                  sourceModule: 'RADIOLOGY',
                  sourceRecordId: order.id.toString(),
                  idempotencyKey,
                  chargeCategory: 'RADIOLOGY',
                  description: `Radiology Exam: ${exam.name}`,
                  quantity: 1,
                  unitPrice: new Prisma.Decimal(unitPrice),
                  totalAmount: new Prisma.Decimal(unitPrice),
                  postedAt: new Date(),
                  postedBy: userId ? BigInt(userId) : null,
                },
              });

              await tx.inpatientFolio.update({
                where: { id: folio.id },
                data: {
                  totalCharges: { increment: unitPrice },
                  balance: { increment: unitPrice },
                },
              });
            }
          }
        }
      }

      // Handle Outpatient Auto-Billing if requested (only when not admitted)
      if (!admissionId && dto.bill && invoiceLineItems.length > 0) {
        const grossTotal = invoiceLineItems.reduce((acc, item) => acc + item.lineTotal, 0);

        const payment = await tx.payment.create({
          data: {
            patientId: BigInt(dto.patientId),
            amount: new Prisma.Decimal(grossTotal),
            grossTotal: new Prisma.Decimal(grossTotal),
            amountReceived: new Prisma.Decimal(0),
            discount: new Prisma.Decimal(0),
            status: 'unpaid',
            category: 'RADIOLOGY',
            date: new Date().toISOString().split('T')[0],
            items: {
              create: invoiceLineItems.map((item) => ({
                name: item.name,
                quantity: item.quantity,
                unitPrice: new Prisma.Decimal(item.unitPrice),
                lineTotal: new Prisma.Decimal(item.lineTotal),
                paymentCategoryId: item.paymentCategoryId,
                doctorId: item.doctorId,
              })),
            },
          },
        });

        // Link payment invoice to all created orders
        for (const order of createdOrders) {
          await tx.radiologyOrder.update({
            where: { id: order.id },
            data: { invoiceId: payment.id },
          });
          (order as any).invoiceId = payment.id;
        }
      }

      return serializeBigInt(createdOrders);
    });
  }

  async getOrders(query: QueryRadiologyOrderDto) {
    const where: Prisma.RadiologyOrderWhereInput = {};

    if (query.patientId) {
      where.patientId = BigInt(query.patientId);
    }
    if (query.doctorId) {
      where.doctorId = BigInt(query.doctorId);
    }

    if (query.status) {
      const s = query.status.toLowerCase().trim();
      if (s === 'open') {
        where.status = { in: ['ordered', 'scheduled', 'arrived', 'in_progress', 'done'] };
      } else {
        where.status = { in: [s, s.toUpperCase()] };
      }
    }

    if (query.modality) {
      where.modality = query.modality.toLowerCase().trim();
    }
    if (query.urgent !== undefined) {
      where.urgent = query.urgent;
    }

    if (query.from || query.to) {
      where.orderDate = {};
      if (query.from) {
        where.orderDate.gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        where.orderDate.lte = toDate;
      }
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { examName: { contains: q, mode: 'insensitive' } },
        { patient: { name: { contains: q, mode: 'insensitive' } } },
        { patient: { patientId: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(200, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.radiologyOrder.count({ where }),
      this.prisma.radiologyOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ urgent: 'desc' }, { orderDate: 'desc' }],
        include: {
          patient: { select: { id: true, name: true, patientId: true, phone: true, sex: true, age: true } },
          doctor: { select: { id: true, name: true } },
          radiologyExam: {
            select: { id: true, name: true, modality: true, code: true, price: true, reportTemplate: true },
          },
          invoice: { select: { id: true, status: true, grossTotal: true } },
        },
      }),
    ]);

    return serializeBigInt({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    });
  }

  async getOrderById(id: number) {
    const order = await this.prisma.radiologyOrder.findUnique({
      where: { id: BigInt(id) },
      include: {
        patient: true,
        doctor: true,
        radiologyExam: { include: { category: true, paymentCategory: true } },
        reportedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        technologist: { select: { id: true, firstName: true, lastName: true, email: true } },
        invoice: { include: { items: true, payments: true } },
        amendments: {
          orderBy: { createdAt: 'desc' },
          include: { amendedByUser: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Radiology order #${id} not found`);
    }

    // Fetch previous imaging history for the same patient (excluding current order)
    const history = await this.prisma.radiologyOrder.findMany({
      where: {
        patientId: order.patientId,
        id: { not: order.id },
      },
      take: 10,
      orderBy: { orderDate: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        examName: true,
        modality: true,
        status: true,
        orderDate: true,
        impression: true,
      },
    });

    return serializeBigInt({
      ...order,
      history,
    });
  }

  // =========================================================================
  // 4. SCHEDULING & CONFLICT DETECTION
  // =========================================================================

  async scheduleOrder(id: number, dto: ScheduleRadiologyOrderDto, _userId?: number) {
    const order = await this.findOrderOrThrow(id);

    if (order.status.toLowerCase() === 'cancelled') {
      throw new BadRequestException('Cannot schedule a cancelled order');
    }
    if (['reported', 'completed'].includes(order.status.toLowerCase())) {
      throw new BadRequestException('Cannot reschedule an already reported or completed examination');
    }

    const scheduledDate = new Date(dto.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestException('Invalid scheduled date/time provided');
    }

    // Equipment Room Conflict Detection: Check 30-minute window
    if (dto.equipmentRoom?.trim() && !dto.forceConflict) {
      const room = dto.equipmentRoom.trim();
      const windowStart = new Date(scheduledDate.getTime() - 29 * 60 * 1000);
      const windowEnd = new Date(scheduledDate.getTime() + 29 * 60 * 1000);

      const conflict = await this.prisma.radiologyOrder.findFirst({
        where: {
          id: { not: BigInt(id) },
          equipmentRoom: room,
          scheduledAt: { gte: windowStart, lte: windowEnd },
          status: { notIn: ['cancelled', 'CANCELLED'] },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Schedule conflict: Equipment room "${room}" is already reserved for order ${conflict.orderNumber} at ${conflict.scheduledAt?.toISOString()}. Use forceConflict=true to override for emergency STAT.`,
        );
      }
    }

    const updated = await this.prisma.radiologyOrder.update({
      where: { id: BigInt(id) },
      data: {
        status: 'scheduled',
        scheduledAt: scheduledDate,
        equipmentRoom: dto.equipmentRoom?.trim() || order.equipmentRoom,
        technologistId: dto.technologistId ? BigInt(dto.technologistId) : order.technologistId,
      },
      include: {
        patient: { select: { id: true, name: true, patientId: true } },
        doctor: { select: { id: true, name: true } },
        radiologyExam: true,
      },
    });

    return serializeBigInt(updated);
  }

  // =========================================================================
  // 5. EXAMINATION WORKFLOW (ARRIVAL, START, COMPLETE)
  // =========================================================================

  async recordArrival(id: number, _dto: RecordArrivalDto, _userId?: number) {
    const order = await this.findOrderOrThrow(id);

    if (['cancelled', 'reported', 'completed'].includes(order.status.toLowerCase())) {
      throw new BadRequestException(`Cannot mark arrival for order in status: ${order.status}`);
    }

    const updated = await this.prisma.radiologyOrder.update({
      where: { id: BigInt(id) },
      data: {
        status: 'arrived',
        arrivedAt: new Date(),
      },
    });
    return serializeBigInt(updated);
  }

  async startExamination(id: number, dto: StartExaminationDto, userId?: number) {
    const order = await this.findOrderOrThrow(id);

    if (['cancelled', 'reported', 'completed'].includes(order.status.toLowerCase())) {
      throw new BadRequestException(`Cannot start examination for order in status: ${order.status}`);
    }

    const updated = await this.prisma.radiologyOrder.update({
      where: { id: BigInt(id) },
      data: {
        status: 'in_progress',
        technologistId: dto.technologistId ? BigInt(dto.technologistId) : (userId ? BigInt(userId) : order.technologistId),
        equipmentRoom: dto.equipmentRoom?.trim() || order.equipmentRoom,
      },
    });
    return serializeBigInt(updated);
  }

  async completeExamination(id: number, dto: CompleteExaminationDto, userId?: number) {
    const order = await this.findOrderOrThrow(id);

    if (['cancelled'].includes(order.status.toLowerCase())) {
      throw new BadRequestException('Cannot complete a cancelled order');
    }

    const updated = await this.prisma.radiologyOrder.update({
      where: { id: BigInt(id) },
      data: {
        status: order.status.toLowerCase() === 'reported' ? 'reported' : 'done',
        performedAt: order.performedAt || new Date(),
        technologistId: dto.technologistId ? BigInt(dto.technologistId) : (userId ? BigInt(userId) : order.technologistId),
      },
    });
    return serializeBigInt(updated);
  }

  // =========================================================================
  // 6. REPORTING WORKBENCH, VERIFICATION & AMENDMENTS
  // =========================================================================

  async saveReportDraft(id: number, dto: SaveReportDraftDto, _userId?: number) {
    const order = await this.findOrderOrThrow(id);

    if (order.status.toLowerCase() === 'cancelled') {
      throw new BadRequestException('Cannot draft report for a cancelled order');
    }
    if (['reported', 'completed'].includes(order.status.toLowerCase())) {
      throw new BadRequestException(
        'Direct modification of authorized report is blocked. Use the controlled amendment workflow.',
      );
    }

    const updated = await this.prisma.radiologyOrder.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.findings !== undefined && { findings: dto.findings }),
        ...(dto.impression !== undefined && { impression: dto.impression }),
        ...(dto.recommendations !== undefined && { recommendations: dto.recommendations }),
      },
    });
    return serializeBigInt(updated);
  }

  async submitReport(id: number, dto: SubmitReportDto, userId?: number) {
    const order = await this.findOrderOrThrow(id);

    if (order.status.toLowerCase() === 'cancelled') {
      throw new BadRequestException('This order was cancelled.');
    }
    if (['reported', 'completed'].includes(order.status.toLowerCase())) {
      throw new BadRequestException(
        'Direct modification of authorized report is blocked. Use the controlled amendment workflow.',
      );
    }

    if (!dto.impression || dto.impression.trim() === '') {
      throw new BadRequestException('A report needs an impression.');
    }

    const now = new Date();
    const updated = await this.prisma.radiologyOrder.update({
      where: { id: BigInt(id) },
      data: {
        status: 'reported',
        findings: dto.findings ?? order.findings,
        impression: dto.impression.trim(),
        recommendations: dto.recommendations?.trim() ?? order.recommendations,
        performedAt: order.performedAt || now,
        reportedById: userId ? BigInt(userId) : order.reportedById,
        reportedAt: now,
      },
      include: {
        patient: true,
        doctor: true,
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return serializeBigInt(updated);
  }

  async verifyReport(id: number, _dto: VerifyReportDto, userId?: number) {
    const order = await this.findOrderOrThrow(id);

    if (order.status.toLowerCase() !== 'reported') {
      throw new BadRequestException(`Order must be in 'reported' status before verification (current: ${order.status})`);
    }

    const updated = await this.prisma.radiologyOrder.update({
      where: { id: BigInt(id) },
      data: {
        status: 'VERIFIED',
        verifiedById: userId ? BigInt(userId) : undefined,
        verifiedAt: new Date(),
      },
    });
    return serializeBigInt(updated);
  }

  async approveReport(id: number, _dto: ApproveReportDto, userId?: number) {
    const order = await this.findOrderOrThrow(id);

    if (!['reported', 'verified'].includes(order.status.toLowerCase())) {
      throw new BadRequestException(`Order must be reported or verified before final authorization (current: ${order.status})`);
    }

    const updated = await this.prisma.radiologyOrder.update({
      where: { id: BigInt(id) },
      data: {
        status: 'COMPLETED',
        verifiedById: order.verifiedById || (userId ? BigInt(userId) : undefined),
        verifiedAt: order.verifiedAt || new Date(),
      },
    });
    return serializeBigInt(updated);
  }

  async createAmendment(id: number, dto: CreateRadiologyAmendmentDto, userId: number) {
    const order = await this.findOrderOrThrow(id);

    if (!['reported', 'verified', 'completed'].includes(order.status.toLowerCase())) {
      throw new BadRequestException(`Amendments can only be issued on reported or completed studies (current: ${order.status})`);
    }

    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException('Mandatory clinical reason is required for amending an authorized report');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Create append-only amendment record
      const amendment = await tx.radiologyReportAmendment.create({
        data: {
          radiologyOrderId: BigInt(id),
          amendedBy: BigInt(userId),
          reason: dto.reason.trim(),
          previousFindings: order.findings,
          previousImpression: order.impression,
          newFindings: dto.findings ?? order.findings,
          newImpression: dto.impression ?? order.impression,
        },
      });

      // Update current active findings and impression on order
      const updatedOrder = await tx.radiologyOrder.update({
        where: { id: BigInt(id) },
        data: {
          ...(dto.findings !== undefined && { findings: dto.findings }),
          ...(dto.impression !== undefined && { impression: dto.impression }),
          ...(dto.recommendations !== undefined && { recommendations: dto.recommendations }),
          reportedById: BigInt(userId),
          reportedAt: new Date(),
        },
        include: {
          amendments: { orderBy: { createdAt: 'desc' } },
        },
      });

      return serializeBigInt({
        message: 'Report amendment recorded successfully',
        amendment,
        order: updatedOrder,
      });
    });
  }

  async cancelOrder(id: number, dto: CancelRadiologyOrderDto, userId?: number) {
    const order = await this.findOrderOrThrow(id);

    if (['reported', 'verified', 'completed'].includes(order.status.toLowerCase())) {
      throw new BadRequestException('A reported exam cannot be cancelled.');
    }
    if (order.status.toLowerCase() === 'cancelled') {
      throw new BadRequestException('This order is already cancelled.');
    }
    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException('Cancellation reason is required.');
    }

    const updated = await this.prisma.radiologyOrder.update({
      where: { id: BigInt(id) },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledById: userId ? BigInt(userId) : undefined,
        cancelReason: dto.reason.trim(),
      },
    });
    return serializeBigInt(updated);
  }

  // =========================================================================
  // 7. BILLING INTEGRATION
  // =========================================================================

  async billOrder(id: number, _userId?: number) {
    const order = await this.prisma.radiologyOrder.findUnique({
      where: { id: BigInt(id) },
      include: {
        patient: true,
        radiologyExam: { include: { paymentCategory: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Radiology order #${id} not found`);
    }

    if (order.invoiceId) {
      throw new ConflictException(`Already billed on invoice #${order.invoiceId}`);
    }

    const exam = order.radiologyExam;
    let unitPrice = 0;
    if (exam.price) {
      unitPrice = Number(exam.price);
    } else if (exam.paymentCategory?.cPrice) {
      unitPrice = Number(exam.paymentCategory.cPrice) || 0;
    }

    return await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          patientId: order.patientId,
          amount: new Prisma.Decimal(unitPrice),
          grossTotal: new Prisma.Decimal(unitPrice),
          amountReceived: new Prisma.Decimal(0),
          discount: new Prisma.Decimal(0),
          status: 'unpaid',
          category: 'RADIOLOGY',
          date: new Date().toISOString().split('T')[0],
          items: {
            create: [
              {
                name: `[Radiology] ${order.examName || exam.name}`,
                quantity: 1,
                unitPrice: new Prisma.Decimal(unitPrice),
                lineTotal: new Prisma.Decimal(unitPrice),
                paymentCategoryId: exam.paymentCategoryId || undefined,
                doctorId: order.doctorId || undefined,
              },
            ],
          },
        },
      });

      const updated = await tx.radiologyOrder.update({
        where: { id: BigInt(id) },
        data: { invoiceId: payment.id },
      });

      return serializeBigInt({
        message: `Billed successfully on invoice #${payment.id}`,
        invoiceId: payment.id,
        order: updated,
      });
    });
  }

  // =========================================================================
  // 8. ANALYTICS & REPORTS
  // =========================================================================

  async getTatReport() {
    const completedOrders = await this.prisma.radiologyOrder.findMany({
      where: {
        status: { in: ['reported', 'VERIFIED', 'COMPLETED'] },
        performedAt: { not: null },
        reportedAt: { not: null },
      },
      select: {
        id: true,
        modality: true,
        orderDate: true,
        performedAt: true,
        reportedAt: true,
      },
      take: 1000,
    });

    const modalities: Record<string, { totalHours: number; count: number; avgTatHours: number }> = {};

    completedOrders.forEach((o) => {
      const mod = o.modality || 'other';
      if (!modalities[mod]) modalities[mod] = { totalHours: 0, count: 0, avgTatHours: 0 };
      if (o.orderDate && o.reportedAt) {
        const diffMs = new Date(o.reportedAt).getTime() - new Date(o.orderDate).getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        modalities[mod].totalHours += diffHours;
        modalities[mod].count += 1;
      }
    });

    Object.keys(modalities).forEach((k) => {
      modalities[k].avgTatHours =
        modalities[k].count > 0 ? +(modalities[k].totalHours / modalities[k].count).toFixed(1) : 0;
    });

    return {
      totalCompletedStudies: completedOrders.length,
      modalityBreakdown: modalities,
    };
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private async findCategoryOrThrow(id: number) {
    const category = await this.prisma.radiologyCategory.findUnique({
      where: { id: BigInt(id) },
    });
    if (!category) {
      throw new NotFoundException(`Radiology category #${id} not found`);
    }
    return category;
  }

  private async findExamOrThrow(id: number) {
    const exam = await this.prisma.radiologyExam.findUnique({
      where: { id: BigInt(id) },
    });
    if (!exam) {
      throw new NotFoundException(`Radiology exam #${id} not found`);
    }
    return exam;
  }

  private async findOrderOrThrow(id: number) {
    const order = await this.prisma.radiologyOrder.findUnique({
      where: { id: BigInt(id) },
    });
    if (!order) {
      throw new NotFoundException(`Radiology order #${id} not found`);
    }
    return order;
  }

  private async generateExamCode(modality: string): Promise<string> {
    const prefix = `RAD-${modality.toUpperCase().slice(0, 3)}`;
    const count = await this.prisma.radiologyExam.count({
      where: { modality: modality.toLowerCase().trim() },
    });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  private async generateOrderNumber(): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `RAD-${dateStr}-${rand}`;
  }
}
