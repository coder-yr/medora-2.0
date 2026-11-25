import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BranchAuthorizationService } from '../../common/services/branch-authorization.service';
import { AuthUser } from '../../common/types/auth-user.interface';
import { CreateBatchDto, UpdateBatchStatusDto } from './dto/batch.dto';
import { CreateGoodsReceiptDto, CreatePurchaseOrderDto } from './dto/purchase.dto';
import { CreateOtcSaleDto, DispensePrescriptionDto } from './dto/dispensation.dto';
import { CreateStockAdjustmentDto } from './dto/adjustment.dto';
import { CreatePharmacyReturnDto } from './dto/return.dto';
import { CreateStockTransferDto, QueryStockTransferDto } from './dto/transfer.dto';
import {
  QueryBatchDto,
  QueryDispensationDto,
  QueryStockMovementDto,
} from './dto/query-pharmacy.dto';

@Injectable()
export class PharmacyService {
  private readonly logger = new Logger(PharmacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly branchAuth?: BranchAuthorizationService,
  ) {}

  /**
   * Safe serializer to convert BigInt IDs and Decimals to standard JSON primitives.
   */
  private serialize<T>(data: T): any {
    return JSON.parse(
      JSON.stringify(data, (key, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      }),
    );
  }

  /**
   * Resolves authoritative branch and organization scope for multi-tenant pharmacy operations.
   */
  private async resolveBranchScope(
    user?: AuthUser,
    requestedBranchId?: bigint | number | string | null,
  ): Promise<{ organizationId: bigint | null; branchId: bigint | null }> {
    let branchId: bigint | null = null;
    let organizationId: bigint | null = user?.organizationId ? BigInt(user.organizationId) : null;

    if (requestedBranchId) {
      if (user && this.branchAuth) {
        branchId = await this.branchAuth.assertBranchAccess(user, requestedBranchId);
      } else {
        branchId = BigInt(requestedBranchId);
      }
    } else if (user?.branchId) {
      branchId = BigInt(user.branchId);
    } else if (user && this.branchAuth) {
      const accessible = await this.branchAuth.resolveAccessibleBranchIds(user);
      if (accessible && accessible.length > 0) {
        branchId = accessible[0];
      }
    }

    if (branchId && !organizationId) {
      const branch = await this.prisma.hospitalBranch.findUnique({
        where: { id: branchId },
        select: { organizationId: true },
      });
      if (branch?.organizationId) {
        organizationId = branch.organizationId;
      }
    }

    if (!organizationId) {
      organizationId = 1n;
    }

    return { organizationId, branchId };
  }

  /**
   * Constructs strict branch-filtering clause:
   * - Host Organization (Org 1) users can see assigned branches or legacy unassigned records.
   * - Secondary Tenant (Org 2+) users are strictly quarantined to their accessible branches.
   */
  private async buildBranchFilter(
    user?: AuthUser,
    requestedBranchId?: bigint | number | string | null,
  ) {
    if (!user || !this.branchAuth || this.branchAuth.isGlobalAdmin(user)) {
      if (requestedBranchId) {
        return { branchId: BigInt(requestedBranchId) };
      }
      return {};
    }

    const isOrg1 = !user.organizationId || BigInt(user.organizationId) === 1n;
    if (requestedBranchId) {
      const authorizedBranchId = await this.branchAuth.assertBranchAccess(user, requestedBranchId);
      return isOrg1
        ? { OR: [{ branchId: authorizedBranchId }, { branchId: null }] }
        : { branchId: authorizedBranchId };
    }

    const accessible = await this.branchAuth.resolveAccessibleBranchIds(user);
    const branchIds = accessible || [];
    return isOrg1
      ? { OR: [{ branchId: { in: branchIds } }, { branchId: null }] }
      : { branchId: { in: branchIds } };
  }

  private async generatePoNumber(tx: Prisma.TransactionClient): Promise<string> {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PO-${todayStr}`;
    const count = typeof (tx.purchaseOrder as any)?.count === 'function'
      ? await tx.purchaseOrder.count({ where: { poNumber: { startsWith: prefix } } })
      : Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateGrnNumber(tx: Prisma.TransactionClient): Promise<string> {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `GRN-${todayStr}`;
    const count = typeof (tx.goodsReceipt as any)?.count === 'function'
      ? await tx.goodsReceipt.count({ where: { receiptNumber: { startsWith: prefix } } })
      : Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateDispensationNumber(tx: Prisma.TransactionClient): Promise<string> {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `DSP-${todayStr}`;
    const count = typeof (tx.pharmacyDispensation as any)?.count === 'function'
      ? await tx.pharmacyDispensation.count({ where: { dispensationNumber: { startsWith: prefix } } })
      : Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateTransferNumber(tx: Prisma.TransactionClient): Promise<string> {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `TRF-${todayStr}`;
    const count = typeof (tx.stockTransfer as any)?.count === 'function'
      ? await tx.stockTransfer.count({ where: { transferNumber: { startsWith: prefix } } })
      : Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateReturnNumber(tx: Prisma.TransactionClient): Promise<string> {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RTN-${todayStr}`;
    const count = typeof (tx.pharmacyReturn as any)?.count === 'function'
      ? await tx.pharmacyReturn.count({ where: { returnNumber: { startsWith: prefix } } })
      : Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INV-${todayStr}`;
    const count = typeof (tx.payment as any)?.count === 'function'
      ? await tx.payment.count({ where: { invoiceNumber: { startsWith: prefix } } })
      : Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  // ===========================================================================
  // 1. DASHBOARD & SUMMARY METRICS
  // ===========================================================================

  async getDashboard(user?: AuthUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAhead = new Date(today);
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    const branchFilter = await this.buildBranchFilter(user);

    const [
      totalMedicines,
      lowStockCount,
      batches,
      recentMovements,
      pendingPOs,
      todayDispensations,
      prescriptionsAwaitingDispense,
    ] = await Promise.all([
      this.prisma.medicine.count({ where: { isActive: true } }),
      this.prisma.medicine.count({ where: { isActive: true, quantity: { lte: 10 } } }),
      this.prisma.medicineBatch.findMany({
        where: { currentQuantity: { gt: 0 }, ...branchFilter },
        select: {
          currentQuantity: true,
          costPrice: true,
          sellingPrice: true,
          expiryDate: true,
          status: true,
        },
      }),
      this.prisma.stockMovement.findMany({
        where: branchFilter,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          medicine: { select: { name: true, generic: true } },
          batch: { select: { batchNumber: true } },
        },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { status: { in: ['DRAFT', 'ORDERED', 'APPROVED', 'PARTIALLY_RECEIVED'] }, ...branchFilter },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { supplier: { select: { name: true } } },
      }),
      this.prisma.pharmacyDispensation.findMany({
        where: { dispenseDate: today.toISOString().split('T')[0], ...branchFilter },
        select: { totalAmount: true },
      }),
      this.prisma.prescription.count({
        where: { status: { in: ['ISSUED', 'PARTIALLY_DISPENSED'] }, ...branchFilter },
      }),
    ]);

    let totalCostValuation = 0;
    let totalRetailValuation = 0;
    let expiringWithin30Days = 0;
    let expiredBatchesCount = 0;
    let activeBatchesCount = 0;
    let totalInventoryQuantity = 0;

    for (const b of batches) {
      const qty = b.currentQuantity;
      totalInventoryQuantity += qty;
      totalCostValuation += qty * Number(b.costPrice);
      totalRetailValuation += qty * Number(b.sellingPrice || b.costPrice);

      const exp = new Date(b.expiryDate);
      if (exp < today) {
        expiredBatchesCount++;
      } else {
        if (b.status === 'ACTIVE') activeBatchesCount++;
        if (exp <= thirtyDaysAhead) {
          expiringWithin30Days++;
        }
      }
    }

    const todayTakings = todayDispensations.reduce(
      (acc, d) => acc + Number(d.totalAmount),
      0,
    );

    return {
      totalMedicines,
      lowStockCount,
      activeBatchesCount,
      totalInventoryQuantity,
      totalCostValuation: Math.round(totalCostValuation * 100) / 100,
      totalRetailValuation: Math.round(totalRetailValuation * 100) / 100,
      expiringWithin30Days,
      expiredBatchesCount,
      todayDispensationsCount: todayDispensations.length,
      todayTakings: Math.round(todayTakings * 100) / 100,
      prescriptionsAwaitingDispense,
      recentMovements: this.serialize(recentMovements),
      pendingPurchaseOrders: this.serialize(pendingPOs),
    };
  }

  // ===========================================================================
  // 2. BATCH MANAGEMENT
  // ===========================================================================

  async createBatch(dto: CreateBatchDto, userId?: number | string, user?: AuthUser) {
    const medicine = await this.prisma.medicine.findUnique({
      where: { id: BigInt(dto.medicineId) },
    });
    if (!medicine) {
      throw new NotFoundException(`Medicine #${dto.medicineId} not found.`);
    }

    const { organizationId, branchId } = await this.resolveBranchScope(user, dto.branchId);

    const existing =
      (await this.prisma.medicineBatch.findFirst({
        where: {
          branchId: branchId ?? null,
          medicineId: BigInt(dto.medicineId),
          batchNumber: dto.batchNumber.trim(),
        },
      })) ||
      (this.prisma.medicineBatch.findUnique
        ? await this.prisma.medicineBatch.findUnique({
            where: {
              medicineId_batchNumber: {
                medicineId: BigInt(dto.medicineId),
                batchNumber: dto.batchNumber.trim(),
              },
            } as any,
          }).catch(() => null)
        : null);
    if (existing) {
      throw new ConflictException(
        `Batch "${dto.batchNumber}" already exists for ${medicine.name} in this branch. Receive more into this batch via Goods Receipt.`,
      );
    }

    const expiry = new Date(dto.expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const initialStatus = expiry < today ? 'EXPIRED' : 'ACTIVE';
    const sellingPrice =
      dto.sellingPrice !== undefined ? dto.sellingPrice : medicine.sPrice ? Number(medicine.sPrice) : dto.costPrice;

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.medicineBatch.create({
        data: {
          medicineId: BigInt(dto.medicineId),
          batchNumber: dto.batchNumber.trim(),
          mfgDate: dto.mfgDate,
          expiryDate: expiry,
          costPrice: dto.costPrice,
          sellingPrice,
          initialQuantity: dto.quantity,
          currentQuantity: dto.quantity,
          supplierId: dto.supplierId ? BigInt(dto.supplierId) : null,
          status: initialStatus,
          notes: dto.notes,
          organizationId,
          branchId,
        },
      });

      // Synchronize Medicine summary quantity atomically
      await tx.medicine.update({
        where: { id: BigInt(dto.medicineId) },
        data: {
          quantity: { increment: dto.quantity },
          price: dto.costPrice,
          sPrice: sellingPrice,
        },
      });

      // Write mandatory audit StockMovement
      await tx.stockMovement.create({
        data: {
          medicineId: BigInt(dto.medicineId),
          batchId: batch.id,
          movementType: 'PURCHASE_RECEIPT',
          quantity: dto.quantity,
          balanceAfter: dto.quantity,
          unitCost: dto.costPrice,
          referenceType: 'INITIAL',
          referenceId: batch.id,
          performedBy: userId ? BigInt(userId) : null,
          reason: dto.notes || 'Initial batch intake',
          organizationId,
          branchId,
        },
      });

      return this.serialize(batch);
    });
  }

  async getBatches(query: QueryBatchDto, user?: AuthUser) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const branchFilter = await this.buildBranchFilter(user, query.branchId || (query as any).branch_id);
    const where: any = { ...branchFilter };

    if (query.medicineId) {
      where.medicineId = BigInt(query.medicineId);
    }
    if (query.supplierId) {
      where.supplierId = BigInt(query.supplierId);
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.q) {
      const term = query.q.trim();
      where.OR = [
        { batchNumber: { contains: term, mode: 'insensitive' } },
        { medicine: { name: { contains: term, mode: 'insensitive' } } },
        { medicine: { generic: { contains: term, mode: 'insensitive' } } },
      ];
    }
    if (query.expiringInDays) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const target = new Date(now);
      target.setDate(target.getDate() + query.expiringInDays);
      where.expiryDate = { gte: now, lte: target };
    }

    const [total, items] = await Promise.all([
      this.prisma.medicineBatch.count({ where }),
      this.prisma.medicineBatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ expiryDate: 'asc' }, { id: 'desc' }],
        include: {
          medicine: {
            select: { id: true, name: true, generic: true, box: true, strength: true },
          },
          supplier: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      items: this.serialize(items),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBatchById(id: number | string, user?: AuthUser) {
    const batch = await this.prisma.medicineBatch.findUnique({
      where: { id: BigInt(id) },
      include: {
        medicine: true,
        supplier: true,
        branch: true,
        stockMovements: {
          take: 15,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!batch) {
      throw new NotFoundException(`Batch #${id} not found.`);
    }

    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, batch.branchId, 'medicine batch');
    }

    return this.serialize(batch);
  }

  async updateBatchStatus(id: number | string, dto: UpdateBatchStatusDto, user?: AuthUser) {
    const batch = await this.prisma.medicineBatch.findUnique({
      where: { id: BigInt(id) },
    });
    if (!batch) {
      throw new NotFoundException(`Batch #${id} not found.`);
    }

    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, batch.branchId, 'medicine batch');
    }

    const updated = await this.prisma.medicineBatch.update({
      where: { id: BigInt(id) },
      data: {
        status: dto.status,
        notes: dto.notes ? `${batch.notes || ''}\n${dto.notes}`.trim() : batch.notes,
      },
    });

    return this.serialize(updated);
  }

  // ===========================================================================
  // 3. PURCHASE ORDERS & GOODS RECEIPTS
  // ===========================================================================

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, userId?: number | string, user?: AuthUser) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: BigInt(dto.supplierId) },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier #${dto.supplierId} not found.`);
    }

    const { organizationId, branchId } = await this.resolveBranchScope(user, dto.branchId);

    let totalAmount = 0;
    const itemsData = dto.items.map((item) => {
      const lineTotal = item.quantityOrdered * item.unitCost;
      totalAmount += lineTotal;
      return {
        medicineId: BigInt(item.medicineId),
        quantityOrdered: item.quantityOrdered,
        quantityReceived: 0,
        unitCost: item.unitCost,
        lineTotal,
      };
    });

    return this.prisma.$transaction(async (tx) => {
      const poNumber = await this.generatePoNumber(tx);
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: BigInt(dto.supplierId),
          orderDate: dto.orderDate,
          expectedDate: dto.expectedDate,
          totalAmount,
          status: 'ORDERED',
          notes: dto.notes,
          createdById: userId ? BigInt(userId) : null,
          organizationId,
          branchId,
          items: {
            create: itemsData,
          },
        },
        include: {
          supplier: true,
          items: { include: { medicine: true } },
        },
      });

      return this.serialize(po);
    });
  }

  async approvePurchaseOrder(id: number | string, notes?: string, user?: AuthUser) {
    const poId = BigInt(id);
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: poId },
      });
      if (!po) throw new NotFoundException(`Purchase Order #${id} not found.`);

      if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
        await this.branchAuth.assertResourceAccess(user, po.branchId, 'purchase order');
      }

      if (po.status !== 'ORDERED' && po.status !== 'DRAFT') {
        throw new BadRequestException(
          `Cannot approve PO in status "${po.status}". Only DRAFT or ORDERED purchase orders can be approved.`,
        );
      }

      const updated = await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: 'APPROVED',
          approvedById: user?.id ? BigInt(user.id) : null,
          approvedAt: new Date(),
          ...(notes ? { notes: po.notes ? `${po.notes}\n[Approved]: ${notes}` : `[Approved]: ${notes}` } : {}),
        },
        include: {
          supplier: true,
          branch: true,
          items: { include: { medicine: true } },
        },
      });

      return this.serialize(updated);
    });
  }

  async cancelPurchaseOrder(id: number | string, reason: string, user?: AuthUser) {
    const poId = BigInt(id);
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: poId },
      });
      if (!po) throw new NotFoundException(`Purchase Order #${id} not found.`);

      if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
        await this.branchAuth.assertResourceAccess(user, po.branchId, 'purchase order');
      }

      if (po.status === 'RECEIVED' || po.status === 'PARTIALLY_RECEIVED') {
        throw new BadRequestException(
          `Cannot cancel PO in status "${po.status}" as goods have already been received.`,
        );
      }

      const updated = await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: 'CANCELLED',
          notes: po.notes ? `${po.notes}\n[Cancelled]: ${reason}` : `[Cancelled]: ${reason}`,
        },
        include: {
          supplier: true,
          branch: true,
          items: { include: { medicine: true } },
        },
      });

      return this.serialize(updated);
    });
  }

  async getPurchaseOrders(
    query: { supplierId?: number; status?: string; branchId?: number; page?: number; limit?: number },
    user?: AuthUser,
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const branchFilter = await this.buildBranchFilter(user, query.branchId);
    const where: any = { ...branchFilter };

    if (query.supplierId) where.supplierId = BigInt(query.supplierId);
    if (query.status) where.status = query.status;

    const [total, items] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          items: { include: { medicine: { select: { id: true, name: true, box: true } } } },
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      items: this.serialize(items),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPurchaseOrderById(id: number | string, user?: AuthUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: BigInt(id) },
      include: {
        supplier: true,
        branch: true,
        items: { include: { medicine: true } },
        goodsReceipts: { include: { items: true } },
      },
    });
    if (!po) {
      throw new NotFoundException(`Purchase Order #${id} not found.`);
    }

    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, po.branchId, 'purchase order');
    }

    return this.serialize(po);
  }

  async createGoodsReceipt(dto: CreateGoodsReceiptDto, userId?: number | string, user?: AuthUser) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: BigInt(dto.supplierId) },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier #${dto.supplierId} not found.`);
    }

    const { organizationId, branchId } = await this.resolveBranchScope(user, dto.branchId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.$transaction(async (tx) => {
      const receiptNumber = await this.generateGrnNumber(tx);
      let grnTotal = 0;
      const receiptItemsToCreate: any[] = [];

      for (const item of dto.items) {
        if (item.quantityReceived <= 0) {
          throw new BadRequestException('Received quantity must be greater than zero.');
        }

        const medicine = await tx.medicine.findUnique({
          where: { id: BigInt(item.medicineId) },
        });
        if (!medicine) {
          throw new NotFoundException(`Medicine #${item.medicineId} not found.`);
        }

        const expiry = new Date(item.expiryDate);
        if (expiry < today) {
          throw new BadRequestException(
            `Cannot receive expired batch "${item.batchNumber}". Expiry date ${expiry.toISOString().split('T')[0]} has already passed.`,
          );
        }

        const lineTotal = item.quantityReceived * item.unitCost;
        grnTotal += lineTotal;

        // Upsert or create MedicineBatch scoped to target branch
        let batch = await tx.medicineBatch.findFirst({
          where: {
            branchId: branchId ?? null,
            medicineId: BigInt(item.medicineId),
            batchNumber: item.batchNumber.trim(),
          },
        });

        const sellingPrice =
          item.sellingPrice !== undefined ? item.sellingPrice : medicine.sPrice ? Number(medicine.sPrice) : item.unitCost;

        if (batch) {
          // Increment existing lot
          batch = await tx.medicineBatch.update({
            where: { id: batch.id },
            data: {
              currentQuantity: { increment: item.quantityReceived },
              initialQuantity: { increment: item.quantityReceived },
              costPrice: item.unitCost,
              sellingPrice,
              status: 'ACTIVE',
            },
          });
        } else {
          // Create new lot in branch
          batch = await tx.medicineBatch.create({
            data: {
              medicineId: BigInt(item.medicineId),
              batchNumber: item.batchNumber.trim(),
              mfgDate: item.mfgDate,
              expiryDate: expiry,
              costPrice: item.unitCost,
              sellingPrice,
              initialQuantity: item.quantityReceived,
              currentQuantity: item.quantityReceived,
              supplierId: BigInt(dto.supplierId),
              status: 'ACTIVE',
              organizationId,
              branchId,
            },
          });
        }

        // Synchronize Medicine total quantity
        await tx.medicine.update({
          where: { id: BigInt(item.medicineId) },
          data: {
            quantity: { increment: item.quantityReceived },
            price: item.unitCost,
            sPrice: sellingPrice,
          },
        });

        // Write StockMovement
        await tx.stockMovement.create({
          data: {
            medicineId: BigInt(item.medicineId),
            batchId: batch.id,
            movementType: 'PURCHASE_RECEIPT',
            quantity: item.quantityReceived,
            balanceAfter: batch.currentQuantity,
            unitCost: item.unitCost,
            referenceType: 'GOODS_RECEIPT',
            performedBy: userId ? BigInt(userId) : null,
            reason: `GRN received from ${supplier.name}`,
            organizationId,
            branchId,
          },
        });

        // If linked to PO item, update quantity received
        if (item.purchaseOrderItemId) {
          await tx.purchaseOrderItem.update({
            where: { id: BigInt(item.purchaseOrderItemId) },
            data: { quantityReceived: { increment: item.quantityReceived } },
          });
        }

        receiptItemsToCreate.push({
          purchaseOrderItemId: item.purchaseOrderItemId ? BigInt(item.purchaseOrderItemId) : null,
          medicineId: BigInt(item.medicineId),
          batchId: batch.id,
          batchNumber: item.batchNumber.trim(),
          mfgDate: item.mfgDate,
          expiryDate: expiry,
          quantityReceived: item.quantityReceived,
          unitCost: item.unitCost,
          sellingPrice,
          lineTotal,
        });
      }

      // Check parent PO status if applicable
      if (dto.purchaseOrderId) {
        const poItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: BigInt(dto.purchaseOrderId) },
        });
        const allReceived = poItems.every(
          (pi) => pi.quantityReceived >= pi.quantityOrdered,
        );
        await tx.purchaseOrder.update({
          where: { id: BigInt(dto.purchaseOrderId) },
          data: { status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
        });
      }

      const goodsReceipt = await tx.goodsReceipt.create({
        data: {
          receiptNumber,
          purchaseOrderId: dto.purchaseOrderId ? BigInt(dto.purchaseOrderId) : null,
          supplierId: BigInt(dto.supplierId),
          receiptDate: dto.receiptDate,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
          totalAmount: grnTotal,
          notes: dto.notes,
          receivedById: userId ? BigInt(userId) : null,
          organizationId,
          branchId,
          items: {
            create: receiptItemsToCreate,
          },
        },
        include: {
          supplier: true,
          items: { include: { medicine: true, batch: true } },
        },
      });

      return this.serialize(goodsReceipt);
    });
  }

  async getGoodsReceipts(
    query: { supplierId?: number; branchId?: number; page?: number; limit?: number },
    user?: AuthUser,
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const branchFilter = await this.buildBranchFilter(user, query.branchId);
    const where: any = { ...branchFilter };

    if (query.supplierId) where.supplierId = BigInt(query.supplierId);

    const [total, items] = await Promise.all([
      this.prisma.goodsReceipt.count({ where }),
      this.prisma.goodsReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
          items: { include: { medicine: { select: { id: true, name: true, box: true } } } },
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      items: this.serialize(items),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getGoodsReceiptById(id: number | string, user?: AuthUser) {
    const grn = await this.prisma.goodsReceipt.findUnique({
      where: { id: BigInt(id) },
      include: {
        supplier: true,
        purchaseOrder: true,
        branch: true,
        items: { include: { medicine: true, batch: true } },
      },
    });
    if (!grn) {
      throw new NotFoundException(`Goods Receipt #${id} not found.`);
    }

    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, grn.branchId, 'goods receipt');
    }

    return this.serialize(grn);
  }

  // ===========================================================================
  // 4. FEFO ALLOCATION & DISPENSING
  // ===========================================================================

  /**
   * Returns active, unexpired batches for a medicine ordered by expiry date (FEFO),
   * strictly scoped to the requesting branch/organization context.
   */
  async getFefoBatches(
    medicineId: number | string,
    requestedQty?: number,
    branchId?: bigint | number | string | null,
    user?: AuthUser,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const branchFilter = await this.buildBranchFilter(user, branchId);

    const batches = await this.prisma.medicineBatch.findMany({
      where: {
        medicineId: BigInt(medicineId),
        status: 'ACTIVE',
        currentQuantity: { gt: 0 },
        expiryDate: { gte: today },
        ...branchFilter,
      },
      orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
    });

    if (!requestedQty || requestedQty <= 0) {
      return this.serialize(batches);
    }

    // Compute FEFO allocation splits
    let remainingNeeded = requestedQty;
    const allocations: Array<{
      batch: any;
      allocatedQty: number;
    }> = [];

    for (const b of batches) {
      if (remainingNeeded <= 0) break;
      const take = Math.min(b.currentQuantity, remainingNeeded);
      allocations.push({
        batch: this.serialize(b),
        allocatedQty: take,
      });
      remainingNeeded -= take;
    }

    const availableTotal = batches.reduce((acc, b) => acc + b.currentQuantity, 0);

    return {
      requestedQty,
      availableTotal,
      isFullyFulfillable: remainingNeeded === 0,
      shortfall: Math.max(0, remainingNeeded),
      allocations,
    };
  }

  async getPrescriptionDispenseContext(prescriptionId: number | string, user?: AuthUser) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: BigInt(prescriptionId) },
      include: {
        patient: { select: { id: true, name: true, patientId: true, age: true, sex: true, phone: true, branchId: true } },
        doctor: { select: { id: true, name: true } },
        medicines: true,
      },
    });
    if (!prescription) {
      throw new NotFoundException(`Prescription #${prescriptionId} not found.`);
    }

    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(
        user,
        prescription.patient?.branchId || (prescription as any).branchId,
        'prescription',
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetBranchId = prescription.patient?.branchId || user?.branchId;

    const estimatePrescriptionQuantity = (dosage?: string | null, duration?: string | null): number => {
      let dailyDoses = 1;
      if (dosage) {
        if (dosage.includes('+') || dosage.includes('-')) {
          const parts = dosage.split(/[+-]/).map((p) => parseInt(p.trim(), 10) || 0);
          const sum = parts.reduce((a, b) => a + b, 0);
          if (sum > 0) dailyDoses = sum;
        } else if (dosage.toLowerCase().includes('tid') || dosage.toLowerCase().includes('tds')) {
          dailyDoses = 3;
        } else if (dosage.toLowerCase().includes('bid') || dosage.toLowerCase().includes('bd')) {
          dailyDoses = 2;
        } else if (dosage.toLowerCase().includes('qid')) {
          dailyDoses = 4;
        }
      }

      let days = 5;
      if (duration) {
        const match = duration.match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (duration.toLowerCase().includes('week')) {
            days = num * 7;
          } else if (duration.toLowerCase().includes('month')) {
            days = num * 30;
          } else {
            days = num;
          }
        }
      }

      return Math.max(1, dailyDoses * days);
    };

    const branchFilter = await this.buildBranchFilter(user, targetBranchId);

    const enrichedLines = await Promise.all(
      prescription.medicines.map(async (line) => {
        let medicine: any = null;
        if (line.medicineId) {
          medicine = await this.prisma.medicine.findUnique({
            where: { id: line.medicineId },
            include: { category: true },
          });
        } else if (line.name) {
          medicine = await this.prisma.medicine.findFirst({
            where: { name: { equals: line.name.trim(), mode: 'insensitive' } },
            include: { category: true },
          });
        }

        let batches: any[] = [];
        let availableStock = 0;
        let fefoPlan: any = null;

        const quantityPrescribed = (line as any).quantityPrescribed && (line as any).quantityPrescribed > 0
          ? (line as any).quantityPrescribed
          : estimatePrescriptionQuantity(line.dosage, line.duration);
        const quantityRemaining = Math.max(0, quantityPrescribed - line.dispensedQuantity);

        if (medicine) {
          batches = await this.prisma.medicineBatch.findMany({
            where: {
              medicineId: medicine.id,
              status: 'ACTIVE',
              currentQuantity: { gt: 0 },
              expiryDate: { gte: today },
              ...branchFilter,
            },
            orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
          });
          availableStock = batches.reduce((acc, b) => acc + b.currentQuantity, 0);

          if (quantityRemaining > 0) {
            fefoPlan = await this.getFefoBatches(
              medicine.id.toString(),
              quantityRemaining,
              targetBranchId,
              user,
            );
          }
        }

        return {
          prescriptionMedicineId: line.id.toString(),
          medicineId: medicine ? medicine.id.toString() : null,
          prescribedName: line.name,
          matchedMedicineName: medicine?.name || null,
          dosage: line.dosage,
          duration: line.duration,
          instructions: line.instructions,
          quantityPrescribed,
          quantityDispensed: line.dispensedQuantity,
          quantityRemaining,
          availableStock,
          unitPrice: medicine?.sPrice ? Number(medicine.sPrice) : 0,
          batches: this.serialize(batches),
          fefoPlan,
        };
      }),
    );

    return {
      prescription: this.serialize(prescription),
      lines: enrichedLines,
    };
  }

  /**
   * Concurrency-safe, transactional dispensing with branch-scoped row locks and FEFO auto-allocation.
   */
  async dispense(dto: DispensePrescriptionDto, userId?: number | string, user?: AuthUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { organizationId, branchId } = await this.resolveBranchScope(user, dto.branchId);

    // If prescription specified, verify prescription exists and user has access
    let prescription: any = null;
    if (dto.prescriptionId) {
      prescription = await this.prisma.prescription.findUnique({
        where: { id: BigInt(dto.prescriptionId) },
        include: { medicines: true, patient: { select: { id: true, branchId: true } } },
      });
      if (!prescription) {
        throw new NotFoundException(`Prescription #${dto.prescriptionId} not found.`);
      }

      if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
        await this.branchAuth.assertResourceAccess(
          user,
          prescription.patient?.branchId || (prescription as any).branchId,
          'prescription',
        );
      }

      if (prescription.status === 'CANCELLED' || prescription.state === 'cancelled') {
        throw new BadRequestException(
          `Cannot dispense cancelled prescription #${prescription.prescriptionNumber || dto.prescriptionId}.`,
        );
      }

      if (prescription.status === 'DRAFT') {
        throw new BadRequestException(
          `Cannot dispense draft prescription #${prescription.prescriptionNumber || dto.prescriptionId}. Prescription must be digitally SIGNED before dispensing.`,
        );
      }

      if (prescription.status === 'DISPENSED' || prescription.state === 'dispensed') {
        throw new BadRequestException(
          `Prescription #${prescription.prescriptionNumber || dto.prescriptionId} is already fully dispensed.`,
        );
      }
    }

    const isOrg1 = !organizationId || organizationId === 1n;

    return this.prisma.$transaction(async (tx) => {
      const dispensationNumber = await this.generateDispensationNumber(tx);
      let subtotal = 0;
      const dispensationItemsData: any[] = [];
      const movementsToCreate: any[] = [];
      const prescriptionLinesToUpdate: Map<bigint, number> = new Map();

      for (const item of dto.items) {
        if (item.isSubstituted && (!item.substitutionReason || item.substitutionReason.trim().length === 0)) {
          throw new BadRequestException('Substitution reason is mandatory when dispensing an alternative medication.');
        }

        if (item.prescriptionMedicineId) {
          const pm = await tx.prescriptionMedicine.findUnique({
            where: { id: BigInt(item.prescriptionMedicineId) },
          });
          if (pm) {
            const alreadyScheduled = prescriptionLinesToUpdate.get(pm.id) || 0;
            const remaining = (pm.quantityPrescribed || 1) - (pm.dispensedQuantity || 0) - alreadyScheduled;
            if (item.quantity > remaining) {
              throw new BadRequestException(
                `Cannot dispense ${item.quantity} units for line item "${pm.name || item.customName || 'Medication'}". Prescribed: ${pm.quantityPrescribed}, Already dispensed: ${pm.dispensedQuantity || 0}, Remaining: ${remaining}.`,
              );
            }
          }
        }
        let medicineName = item.customName || 'Unlisted Medication';
        let unitPrice = item.unitPrice || 0;

        // Custom medication with no medicineId
        if (!item.medicineId) {
          const lineTotal = item.quantity * unitPrice;
          subtotal += lineTotal;
          dispensationItemsData.push({
            prescriptionMedicineId: item.prescriptionMedicineId ? BigInt(item.prescriptionMedicineId) : null,
            medicineId: null,
            batchId: null,
            medicineName,
            batchNumber: null,
            quantity: item.quantity,
            unitPrice,
            totalPrice: lineTotal,
          });
          continue;
        }

        const medicine = await tx.medicine.findUnique({
          where: { id: BigInt(item.medicineId) },
        });
        if (!medicine) {
          throw new NotFoundException(`Medicine #${item.medicineId} not found.`);
        }
        medicineName = medicine.name;

        // Explicit batch specified or FEFO allocation required
        if (item.batchId) {
          // Row lock batch
          const lockedRows = await tx.$queryRaw<
            Array<{ id: bigint; batch_number: string; current_quantity: number; expiry_date: Date; status: string; selling_price: any; branch_id: bigint | null }>
          >`
            SELECT id, batch_number, current_quantity, expiry_date, status, selling_price, branch_id
            FROM medicine_batch
            WHERE id = ${BigInt(item.batchId)} AND medicine_id = ${BigInt(item.medicineId)}
            FOR UPDATE
          `;

          if (!lockedRows || lockedRows.length === 0) {
            throw new NotFoundException(
              `Batch #${item.batchId} not found for medicine ${medicine.name}.`,
            );
          }

          const lockedBatch = lockedRows[0];

          if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
            await this.branchAuth.assertResourceAccess(user, lockedBatch.branch_id, 'medicine batch');
          }

          if (lockedBatch.status !== 'ACTIVE') {
            throw new BadRequestException(
              `Batch ${lockedBatch.batch_number} is not active (status: ${lockedBatch.status}).`,
            );
          }

          if (new Date(lockedBatch.expiry_date) < today) {
            throw new BadRequestException(
              `Batch ${lockedBatch.batch_number} expired on ${lockedBatch.expiry_date.toISOString().split('T')[0]} and cannot be dispensed.`,
            );
          }

          if (lockedBatch.current_quantity < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock in batch ${lockedBatch.batch_number}. Requested: ${item.quantity}, Available: ${lockedBatch.current_quantity}.`,
            );
          }

          const price = item.unitPrice ?? (lockedBatch.selling_price ? Number(lockedBatch.selling_price) : Number(medicine.sPrice || 0));
          const lineTotal = item.quantity * price;
          subtotal += lineTotal;

          // Deduct stock from batch
          await tx.$executeRaw`
            UPDATE medicine_batch
            SET current_quantity = current_quantity - ${item.quantity},
                status = CASE WHEN current_quantity - ${item.quantity} = 0 THEN 'DEPLETED' ELSE status END,
                updated_at = NOW()
            WHERE id = ${lockedBatch.id} AND current_quantity >= ${item.quantity}
          `;

          // Synchronize summary stock
          await tx.medicine.update({
            where: { id: BigInt(item.medicineId) },
            data: { quantity: { decrement: item.quantity } },
          });

          dispensationItemsData.push({
            prescriptionMedicineId: item.prescriptionMedicineId ? BigInt(item.prescriptionMedicineId) : null,
            medicineId: BigInt(item.medicineId),
            batchId: lockedBatch.id,
            medicineName,
            batchNumber: lockedBatch.batch_number,
            quantity: item.quantity,
            unitPrice: price,
            totalPrice: lineTotal,
            isSubstituted: !!item.isSubstituted,
            originalMedicineId: item.originalMedicineId ? BigInt(item.originalMedicineId) : null,
            substitutionReason: item.substitutionReason || null,
          });

          movementsToCreate.push({
            medicineId: BigInt(item.medicineId),
            batchId: lockedBatch.id,
            movementType: 'DISPENSING',
            quantity: -item.quantity,
            balanceAfter: lockedBatch.current_quantity - item.quantity,
            unitCost: price,
            referenceType: 'DISPENSATION',
            organizationId,
            branchId,
          });

          if (item.prescriptionMedicineId) {
            const pmId = BigInt(item.prescriptionMedicineId);
            prescriptionLinesToUpdate.set(pmId, (prescriptionLinesToUpdate.get(pmId) || 0) + item.quantity);
          }
        } else {
          // Automatic FEFO allocation strictly within branch
          const activeBatches = branchId
            ? isOrg1
              ? await tx.$queryRaw<
                  Array<{ id: bigint; batch_number: string; current_quantity: number; expiry_date: Date; status: string; selling_price: any; branch_id: bigint | null }>
                >`
                  SELECT id, batch_number, current_quantity, expiry_date, status, selling_price, branch_id
                  FROM medicine_batch
                  WHERE medicine_id = ${BigInt(item.medicineId)}
                    AND status = 'ACTIVE'
                    AND current_quantity > 0
                    AND expiry_date >= ${today}
                    AND (branch_id = ${branchId} OR branch_id IS NULL)
                  ORDER BY expiry_date ASC, id ASC
                  FOR UPDATE
                `
              : await tx.$queryRaw<
                  Array<{ id: bigint; batch_number: string; current_quantity: number; expiry_date: Date; status: string; selling_price: any; branch_id: bigint | null }>
                >`
                  SELECT id, batch_number, current_quantity, expiry_date, status, selling_price, branch_id
                  FROM medicine_batch
                  WHERE medicine_id = ${BigInt(item.medicineId)}
                    AND status = 'ACTIVE'
                    AND current_quantity > 0
                    AND expiry_date >= ${today}
                    AND branch_id = ${branchId}
                  ORDER BY expiry_date ASC, id ASC
                  FOR UPDATE
                `
            : await tx.$queryRaw<
                Array<{ id: bigint; batch_number: string; current_quantity: number; expiry_date: Date; status: string; selling_price: any; branch_id: bigint | null }>
              >`
                SELECT id, batch_number, current_quantity, expiry_date, status, selling_price, branch_id
                FROM medicine_batch
                WHERE medicine_id = ${BigInt(item.medicineId)}
                  AND status = 'ACTIVE'
                  AND current_quantity > 0
                  AND expiry_date >= ${today}
                ORDER BY expiry_date ASC, id ASC
                FOR UPDATE
              `;

          const totalAvailable = activeBatches.reduce((acc, b) => acc + b.current_quantity, 0);
          if (totalAvailable < item.quantity) {
            throw new BadRequestException(
              `Only ${totalAvailable} of ${medicine.name} left in saleable stock for this branch, but the dispensation requests ${item.quantity}.`,
            );
          }

          let remainingToFulfill = item.quantity;
          for (const batch of activeBatches) {
            if (remainingToFulfill <= 0) break;
            const takeQty = Math.min(batch.current_quantity, remainingToFulfill);
            const price = item.unitPrice ?? (batch.selling_price ? Number(batch.selling_price) : Number(medicine.sPrice || 0));
            const lineTotal = takeQty * price;
            subtotal += lineTotal;

            // Deduct batch stock
            await tx.$executeRaw`
              UPDATE medicine_batch
              SET current_quantity = current_quantity - ${takeQty},
                  status = CASE WHEN current_quantity - ${takeQty} = 0 THEN 'DEPLETED' ELSE status END,
                  updated_at = NOW()
              WHERE id = ${batch.id} AND current_quantity >= ${takeQty}
            `;

            // Deduct summary stock
            await tx.medicine.update({
              where: { id: BigInt(item.medicineId) },
              data: { quantity: { decrement: takeQty } },
            });

            dispensationItemsData.push({
              prescriptionMedicineId: item.prescriptionMedicineId ? BigInt(item.prescriptionMedicineId) : null,
              medicineId: BigInt(item.medicineId),
              batchId: batch.id,
              medicineName,
              batchNumber: batch.batch_number,
              quantity: takeQty,
              unitPrice: price,
              totalPrice: lineTotal,
              isSubstituted: !!item.isSubstituted,
              originalMedicineId: item.originalMedicineId ? BigInt(item.originalMedicineId) : null,
              substitutionReason: item.substitutionReason || null,
            });

            movementsToCreate.push({
              medicineId: BigInt(item.medicineId),
              batchId: batch.id,
              movementType: 'DISPENSING',
              quantity: -takeQty,
              balanceAfter: batch.current_quantity - takeQty,
              unitCost: price,
              referenceType: 'DISPENSATION',
              organizationId,
              branchId,
            });

            remainingToFulfill -= takeQty;
          }

          if (item.prescriptionMedicineId) {
            const pmId = BigInt(item.prescriptionMedicineId);
            prescriptionLinesToUpdate.set(pmId, (prescriptionLinesToUpdate.get(pmId) || 0) + item.quantity);
          }
        }
      }

      const discount = dto.discount ? Math.max(0, dto.discount) : 0;
      const tax = dto.tax ? Math.max(0, dto.tax) : 0;
      const totalAmount = Math.max(0, subtotal - discount + tax);

      const patientId = dto.patientId
        ? BigInt(dto.patientId)
        : prescription?.patientId || null;
      const doctorId = dto.doctorId
        ? BigInt(dto.doctorId)
        : prescription?.doctorId || null;

      // Resolve active admission if specified or patient is admitted
      let admissionId: bigint | null = null;
      if (dto.admissionId) {
        admissionId = BigInt(dto.admissionId);
      } else if (patientId && tx.admission) {
        const activeStay = await tx.admission.findFirst({
          where: {
            patientId,
            status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PENDING'] },
          },
        });
        if (activeStay) {
          admissionId = activeStay.id;
        }
      }

      // Optional Outpatient InvoiceModule integration
      let invoiceId: bigint | null = null;
      if (!admissionId && dto.generateInvoice && patientId) {
        const invNumber = await this.generateInvoiceNumber(tx);
        const invoice = await tx.payment.create({
          data: {
            invoiceNumber: invNumber,
            organizationId,
            branchId,
            patientId,
            date: dto.dispenseDate,
            amount: subtotal,
            discount,
            vat: tax,
            grossTotal: totalAmount,
            amountReceived: totalAmount,
            status: 'paid',
            category: 'PHARMACY',
            categoryName: dispensationItemsData.map((d) => d.medicineName).join(', ').slice(0, 1000),
            categoryAmount: dispensationItemsData.map((d) => d.totalPrice.toString()).join(', ').slice(0, 1000),
            items: {
              create: dispensationItemsData.map((d) => ({
                name: `[Pharmacy] ${d.medicineName} (${d.quantity}x)`,
                quantity: d.quantity,
                unitPrice: d.unitPrice,
                lineTotal: d.totalPrice,
              })),
            },
          },
        });
        invoiceId = invoice.id;
      }

      // Create Dispensation Header & Lines
      const dispensation = await tx.pharmacyDispensation.create({
        data: {
          dispensationNumber,
          prescriptionId: dto.prescriptionId ? BigInt(dto.prescriptionId) : null,
          patientId,
          doctorId,
          patientName: dto.patientName,
          dispenseDate: dto.dispenseDate,
          subtotal,
          discount,
          tax,
          totalAmount,
          status: 'COMPLETED',
          invoiceId,
          admissionId,
          dispensedById: userId ? BigInt(userId) : null,
          organizationId,
          branchId,
          notes: dto.notes,
          items: {
            create: dispensationItemsData,
          },
        },
        include: {
          items: true,
          patient: { select: { id: true, name: true, patientId: true } },
          doctor: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
      });

      // Post financial charge to Inpatient Folio if active stay
      if (admissionId && totalAmount > 0) {
        const folio = await tx.inpatientFolio.findUnique({
          where: { admissionId },
        });
        if (folio) {
          const idempotencyKey = `PHARM-${dispensation.id}`;
          const existingItem = await tx.inpatientFolioItem.findUnique({
            where: { idempotencyKey },
          });
          if (!existingItem) {
            await tx.inpatientFolioItem.create({
              data: {
                folioId: folio.id,
                sourceModule: 'PHARMACY',
                sourceRecordId: dispensation.id.toString(),
                idempotencyKey,
                chargeCategory: 'PHARMACY',
                description: `Pharmacy Dispensation: ${dispensationItemsData.map((d) => d.medicineName).join(', ')}`.slice(0, 255),
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

      // Write StockMovement logs
      for (const m of movementsToCreate) {
        await tx.stockMovement.create({
          data: {
            ...m,
            referenceId: dispensation.id,
            performedBy: userId ? BigInt(userId) : null,
            reason: `Dispensed on ${dispensationNumber}`,
          },
        });
      }

      // Update Prescription line items and overall prescription state
      if (prescription) {
        for (const [pmId, dispensedQty] of prescriptionLinesToUpdate.entries()) {
          await tx.prescriptionMedicine.update({
            where: { id: pmId },
            data: { dispensedQuantity: { increment: dispensedQty } },
          });
        }

        const allLines = await tx.prescriptionMedicine.findMany({
          where: { prescriptionId: prescription.id },
        });

        const allDone = allLines.every((l) => (l.dispensedQuantity || 0) >= (l.quantityPrescribed || 1));
        const anyDispensed = allLines.some((l) => (l.dispensedQuantity || 0) > 0);
        const newStatus = allDone ? 'DISPENSED' : (anyDispensed ? 'PARTIALLY_DISPENSED' : prescription.status);

        await tx.prescription.update({
          where: { id: prescription.id },
          data: {
            status: newStatus,
            state: allDone ? 'dispensed' : (anyDispensed ? 'partially_dispensed' : prescription.state),
          },
        });
      }

      return this.serialize(dispensation);
    });
  }

  async getDispensations(query: QueryDispensationDto, user?: AuthUser) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const branchFilter = await this.buildBranchFilter(user, query.branchId || (query as any).branch_id);
    const where: any = { ...branchFilter };

    if (query.patientId) where.patientId = BigInt(query.patientId);
    if (query.prescriptionId) where.prescriptionId = BigInt(query.prescriptionId);
    if (query.date) where.dispenseDate = query.date;
    if (query.q) {
      const term = query.q.trim();
      where.OR = [
        { dispensationNumber: { contains: term, mode: 'insensitive' } },
        { patientName: { contains: term, mode: 'insensitive' } },
        { patient: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.pharmacyDispensation.count({ where }),
      this.prisma.pharmacyDispensation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: {
          patient: { select: { id: true, name: true, patientId: true } },
          doctor: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          items: true,
        },
      }),
    ]);

    return {
      items: this.serialize(items),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getDispensationById(id: number | string, user?: AuthUser) {
    const dispensation = await this.prisma.pharmacyDispensation.findUnique({
      where: { id: BigInt(id) },
      include: {
        patient: true,
        doctor: true,
        branch: true,
        prescription: {
          include: { medicines: true },
        },
        items: {
          include: { batch: true, medicine: true },
        },
        returns: {
          include: { items: true },
        },
      },
    });
    if (!dispensation) {
      throw new NotFoundException(`Dispensation #${id} not found.`);
    }

    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, dispensation.branchId, 'dispensation');
    }

    return this.serialize(dispensation);
  }

  /**
   * Direct Over-the-Counter (OTC) pharmacy retail sale.
   * STRICT REGULATION: Automatically verifies that no medication with prescriptionRequired=true can be dispensed without a prescription.
   * Allocates batch stock via pessimistic locks (FEFO), creates Phase 10.5.6 invoice, and records stock movements.
   */
  async sellOtc(dto: CreateOtcSaleDto, userId?: number | string, user?: AuthUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { organizationId, branchId } = await this.resolveBranchScope(user, dto.branchId);

    // 1. Regulatory check: No prescriptionRequired medication allowed OTC
    for (const item of dto.items) {
      if (!item.medicineId) continue;
      const med = await this.prisma.medicine.findUnique({
        where: { id: BigInt(item.medicineId) },
        select: { id: true, name: true, prescriptionRequired: true, brandName: true, code: true },
      });
      if (!med) {
        throw new NotFoundException(`Medicine #${item.medicineId} not found in catalogue.`);
      }
      if (med.prescriptionRequired) {
        throw new BadRequestException(
          `Medication "${med.name}" (${med.brandName || med.code || 'ID ' + med.id}) is prescription-restricted and cannot be sold over the counter without a doctor prescription.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const dispensationNumber = await this.generateDispensationNumber(tx);
      let subtotal = 0;
      const dispensationItemsData: any[] = [];
      const movementsToCreate: any[] = [];

      for (const item of dto.items) {
        let medicineName = item.customName || 'Unlisted Medication';
        let unitPrice = item.unitPrice || 0;

        if (!item.medicineId) {
          const lineTotal = item.quantity * unitPrice;
          subtotal += lineTotal;
          dispensationItemsData.push({
            prescriptionMedicineId: null,
            medicineId: null,
            batchId: null,
            medicineName,
            batchNumber: null,
            quantity: item.quantity,
            unitPrice,
            totalPrice: lineTotal,
            isSubstituted: false,
            originalMedicineId: null,
            substitutionReason: null,
          });
          continue;
        }

        const medicine = await tx.medicine.findUnique({
          where: { id: BigInt(item.medicineId) },
        });
        if (!medicine) {
          throw new NotFoundException(`Medicine #${item.medicineId} not found.`);
        }
        medicineName = medicine.name;

        // FEFO allocation with branch scoping and row locks
        const activeBatches = branchId
          ? await tx.$queryRaw<
              Array<{ id: bigint; batch_number: string; current_quantity: number; expiry_date: Date; status: string; selling_price: any; branch_id: bigint | null }>
            >`
              SELECT id, batch_number, current_quantity, expiry_date, status, selling_price, branch_id
              FROM medicine_batch
              WHERE medicine_id = ${BigInt(item.medicineId)}
                AND status = 'ACTIVE'
                AND current_quantity > 0
                AND expiry_date >= ${today}
                AND (branch_id = ${branchId} OR branch_id IS NULL)
              ORDER BY expiry_date ASC, id ASC
              FOR UPDATE
            `
          : await tx.$queryRaw<
              Array<{ id: bigint; batch_number: string; current_quantity: number; expiry_date: Date; status: string; selling_price: any; branch_id: bigint | null }>
            >`
              SELECT id, batch_number, current_quantity, expiry_date, status, selling_price, branch_id
              FROM medicine_batch
              WHERE medicine_id = ${BigInt(item.medicineId)}
                AND status = 'ACTIVE'
                AND current_quantity > 0
                AND expiry_date >= ${today}
              ORDER BY expiry_date ASC, id ASC
              FOR UPDATE
            `;

        const totalAvailable = activeBatches.reduce((acc, b) => acc + b.current_quantity, 0);
        if (totalAvailable < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${medicine.name}". Available in branch: ${totalAvailable}, Requested: ${item.quantity}.`,
          );
        }

        let remainingToFulfill = item.quantity;
        for (const batch of activeBatches) {
          if (remainingToFulfill <= 0) break;
          const takeQty = Math.min(batch.current_quantity, remainingToFulfill);
          const price = item.unitPrice ?? (batch.selling_price ? Number(batch.selling_price) : Number(medicine.sPrice || 0));
          const lineTotal = takeQty * price;
          subtotal += lineTotal;

          await tx.$executeRaw`
            UPDATE medicine_batch
            SET current_quantity = current_quantity - ${takeQty},
                status = CASE WHEN current_quantity - ${takeQty} = 0 THEN 'DEPLETED' ELSE status END,
                updated_at = NOW()
            WHERE id = ${batch.id} AND current_quantity >= ${takeQty}
          `;

          await tx.medicine.update({
            where: { id: BigInt(item.medicineId) },
            data: { quantity: { decrement: takeQty } },
          });

          dispensationItemsData.push({
            prescriptionMedicineId: null,
            medicineId: BigInt(item.medicineId),
            batchId: batch.id,
            medicineName,
            batchNumber: batch.batch_number,
            quantity: takeQty,
            unitPrice: price,
            totalPrice: lineTotal,
            isSubstituted: false,
            originalMedicineId: null,
            substitutionReason: null,
          });

          movementsToCreate.push({
            medicineId: BigInt(item.medicineId),
            batchId: batch.id,
            movementType: 'DISPENSING',
            quantity: -takeQty,
            balanceAfter: batch.current_quantity - takeQty,
            unitCost: price,
            referenceType: 'DISPENSATION',
            organizationId,
            branchId,
          });

          remainingToFulfill -= takeQty;
        }
      }

      const discount = dto.discount ? Math.max(0, dto.discount) : 0;
      const tax = dto.tax ? Math.max(0, dto.tax) : 0;
      const totalAmount = Math.max(0, subtotal - discount + tax);
      const patientId = dto.patientId ? BigInt(dto.patientId) : null;

      let invoiceId: bigint | null = null;
      if (dto.generateInvoice !== false && patientId) {
        const invNumber = await this.generateInvoiceNumber(tx);
        const invoice = await tx.payment.create({
          data: {
            invoiceNumber: invNumber,
            organizationId,
            branchId,
            patientId,
            date: dto.saleDate || (dto as any).dispenseDate || new Date().toISOString().slice(0, 10),
            amount: subtotal,
            discount,
            vat: tax,
            grossTotal: totalAmount,
            amountReceived: totalAmount,
            status: 'paid',
            category: 'PHARMACY',
            categoryName: dispensationItemsData.map((d) => d.medicineName).join(', ').slice(0, 1000),
            categoryAmount: dispensationItemsData.map((d) => d.totalPrice.toString()).join(', ').slice(0, 1000),
            items: {
              create: dispensationItemsData.map((d) => ({
                name: `[OTC Sale] ${d.medicineName} (${d.quantity}x)`,
                quantity: d.quantity,
                unitPrice: d.unitPrice,
                lineTotal: d.totalPrice,
              })),
            },
          },
        });
        invoiceId = invoice.id;
      }

      const dispensation = await tx.pharmacyDispensation.create({
        data: {
          dispensationNumber,
          prescriptionId: null,
          patientId,
          patientName: dto.patientName || 'Walk-in Customer',
          dispenseDate: dto.saleDate || (dto as any).dispenseDate || new Date().toISOString().slice(0, 10),
          subtotal,
          discount,
          tax,
          totalAmount,
          status: 'COMPLETED',
          invoiceId,
          dispensedById: userId ? BigInt(userId) : null,
          organizationId,
          branchId,
          notes: dto.notes ? `[OTC Sale] ${dto.notes}` : '[OTC Sale] Counter Walk-in',
          items: {
            create: dispensationItemsData,
          },
        },
        include: {
          items: true,
          patient: { select: { id: true, name: true, patientId: true } },
          branch: { select: { id: true, name: true } },
        },
      });

      for (const m of movementsToCreate) {
        await tx.stockMovement.create({
          data: {
            ...m,
            referenceId: dispensation.id,
            performedBy: userId ? BigInt(userId) : null,
            reason: `OTC Counter Sale ${dispensationNumber}`,
          },
        });
      }

      return this.serialize(dispensation);
    });
  }

  // ===========================================================================
  // 5. RETURNS & ADJUSTMENTS
  // ===========================================================================

  async processReturn(dto: CreatePharmacyReturnDto, userId?: number | string, user?: AuthUser) {
    const { organizationId, branchId } = await this.resolveBranchScope(user, dto.branchId);

    return this.prisma.$transaction(async (tx) => {
      const returnNumber = await this.generateReturnNumber(tx);
      let totalRefund = 0;
      const returnItemsData: any[] = [];
      const movementsToCreate: any[] = [];

      for (const item of dto.items) {
        let unitPrice = 0;

        // If patient return linked to dispensation item, validate quantity
        if (dto.returnType === 'PATIENT_RETURN' && item.dispensationItemId) {
          const dItem = await tx.pharmacyDispensationItem.findUnique({
            where: { id: BigInt(item.dispensationItemId) },
          });
          if (!dItem) {
            throw new NotFoundException(`Dispensation line #${item.dispensationItemId} not found.`);
          }
          const availableToReturn = dItem.quantity - dItem.returnedQuantity;
          if (item.quantity > availableToReturn) {
            throw new BadRequestException(
              `Cannot return ${item.quantity} units of ${dItem.medicineName}. Only ${availableToReturn} eligible for return.`,
            );
          }
          unitPrice = Number(dItem.unitPrice);

          // Update returned quantity on dispensation line
          await tx.pharmacyDispensationItem.update({
            where: { id: dItem.id },
            data: { returnedQuantity: { increment: item.quantity } },
          });
        }

        const lineRefund = item.quantity * unitPrice;
        totalRefund += lineRefund;

        // If condition is SALEABLE and restock requested, return to inventory
        if (dto.restockToInventory && item.condition === 'SALEABLE') {
          await tx.$executeRaw`
            UPDATE medicine_batch
            SET current_quantity = current_quantity + ${item.quantity},
                status = 'ACTIVE',
                updated_at = NOW()
            WHERE id = ${BigInt(item.batchId)}
          `;

          await tx.medicine.update({
            where: { id: BigInt(item.medicineId) },
            data: { quantity: { increment: item.quantity } },
          });

          const updatedBatch = await tx.medicineBatch.findUnique({
            where: { id: BigInt(item.batchId) },
          });

          movementsToCreate.push({
            medicineId: BigInt(item.medicineId),
            batchId: BigInt(item.batchId),
            movementType: 'CUSTOMER_RETURN',
            quantity: item.quantity,
            balanceAfter: updatedBatch?.currentQuantity || 0,
            unitCost: unitPrice,
            reason: dto.reason,
            organizationId,
            branchId,
          });
        } else if (item.condition !== 'SALEABLE') {
          // Log write-off movement for damaged/expired returned item
          movementsToCreate.push({
            medicineId: BigInt(item.medicineId),
            batchId: BigInt(item.batchId),
            movementType: item.condition === 'EXPIRED' ? 'EXPIRED_WRITE_OFF' : 'DAMAGED_WRITE_OFF',
            quantity: 0,
            balanceAfter: 0,
            unitCost: unitPrice,
            reason: `Return rejected from saleable inventory: condition ${item.condition} - ${dto.reason}`,
            organizationId,
            branchId,
          });
        }

        returnItemsData.push({
          dispensationItemId: item.dispensationItemId ? BigInt(item.dispensationItemId) : null,
          medicineId: BigInt(item.medicineId),
          batchId: BigInt(item.batchId),
          quantity: item.quantity,
          unitPrice,
          totalRefund: lineRefund,
          condition: item.condition,
        });
      }

      const returnRecord = await tx.pharmacyReturn.create({
        data: {
          returnNumber,
          returnType: dto.returnType,
          dispensationId: dto.dispensationId ? BigInt(dto.dispensationId) : null,
          supplierId: dto.supplierId ? BigInt(dto.supplierId) : null,
          returnDate: dto.returnDate,
          reason: dto.reason,
          totalRefund,
          restockToInventory: dto.restockToInventory ?? true,
          processedById: userId ? BigInt(userId) : null,
          organizationId,
          branchId,
          items: {
            create: returnItemsData,
          },
        },
        include: {
          items: true,
          dispensation: true,
          supplier: true,
          branch: true,
        },
      });

      for (const m of movementsToCreate) {
        await tx.stockMovement.create({
          data: {
            ...m,
            referenceType: 'RETURN',
            referenceId: returnRecord.id,
            performedBy: userId ? BigInt(userId) : null,
          },
        });
      }

      return this.serialize(returnRecord);
    });
  }

  async getReturns(
    query?: { returnType?: string; branchId?: number; page?: number; limit?: number },
    user?: AuthUser,
  ) {
    const page = Math.max(1, query?.page || 1);
    const limit = Math.max(1, Math.min(100, query?.limit || 20));
    const skip = (page - 1) * limit;

    const branchFilter = await this.buildBranchFilter(user, query?.branchId);
    const where: any = { ...branchFilter };

    if (query?.returnType) where.returnType = query.returnType;

    const [total, items] = await Promise.all([
      this.prisma.pharmacyReturn.count({ where }),
      this.prisma.pharmacyReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: {
          dispensation: { select: { id: true, dispensationNumber: true, patientName: true } },
          supplier: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          items: true,
        },
      }),
    ]);

    return {
      items: this.serialize(items),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getReturnById(id: number | string, user?: AuthUser) {
    const ret = await this.prisma.pharmacyReturn.findUnique({
      where: { id: BigInt(id) },
      include: {
        dispensation: true,
        supplier: true,
        branch: true,
        items: { include: { batch: true } },
      },
    });
    if (!ret) {
      throw new NotFoundException(`Return #${id} not found.`);
    }

    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertResourceAccess(user, ret.branchId, 'return');
    }

    return this.serialize(ret);
  }

  async createStockAdjustment(dto: CreateStockAdjustmentDto, userId?: number | string, user?: AuthUser) {
    const { organizationId, branchId } = await this.resolveBranchScope(user, dto.branchId);
    const adjustmentNumber = `ADJ-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    return this.prisma.$transaction(async (tx) => {
      const itemsToCreate: any[] = [];
      const movementsToCreate: any[] = [];

      for (const item of dto.items) {
        const batch = await tx.$queryRaw<
          Array<{ id: bigint; current_quantity: number; cost_price: any; batch_number: string; branch_id: bigint | null }>
        >`
          SELECT id, current_quantity, cost_price, batch_number, branch_id
          FROM medicine_batch
          WHERE id = ${BigInt(item.batchId)} AND medicine_id = ${BigInt(item.medicineId)}
          FOR UPDATE
        `;

        if (!batch || batch.length === 0) {
          throw new NotFoundException(`Batch #${item.batchId} not found.`);
        }

        const b = batch[0];

        if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
          await this.branchAuth.assertResourceAccess(user, b.branch_id, 'medicine batch');
        }

        const systemQty = b.current_quantity;
        const diff = item.physicalQuantity - systemQty;

        if (diff !== 0) {
          // Adjust batch
          await tx.$executeRaw`
            UPDATE medicine_batch
            SET current_quantity = ${item.physicalQuantity},
                status = CASE WHEN ${item.physicalQuantity} = 0 THEN 'DEPLETED' ELSE status END,
                updated_at = NOW()
            WHERE id = ${b.id}
          `;

          // Adjust medicine summary
          if (diff > 0) {
            await tx.medicine.update({
              where: { id: BigInt(item.medicineId) },
              data: { quantity: { increment: diff } },
            });
          } else {
            await tx.medicine.update({
              where: { id: BigInt(item.medicineId) },
              data: { quantity: { decrement: Math.abs(diff) } },
            });
          }

          movementsToCreate.push({
            medicineId: BigInt(item.medicineId),
            batchId: b.id,
            movementType: diff > 0 ? 'STOCK_ADJUSTMENT_IN' : 'STOCK_ADJUSTMENT_OUT',
            quantity: diff,
            balanceAfter: item.physicalQuantity,
            unitCost: Number(b.cost_price),
            reason: `Physical count variance (${dto.reason}): ${diff > 0 ? '+' : ''}${diff}`,
            organizationId,
            branchId,
          });
        }

        itemsToCreate.push({
          medicineId: BigInt(item.medicineId),
          batchId: b.id,
          systemQuantity: systemQty,
          physicalQuantity: item.physicalQuantity,
          difference: diff,
          unitCost: Number(b.cost_price),
        });
      }

      const adjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNumber,
          adjustmentDate: dto.adjustmentDate,
          reason: dto.reason,
          status: 'APPROVED',
          adjustedById: userId ? BigInt(userId) : null,
          approvedById: userId ? BigInt(userId) : null,
          organizationId,
          branchId,
          notes: dto.notes,
          items: {
            create: itemsToCreate,
          },
        },
        include: {
          items: { include: { medicine: true, batch: true } },
          branch: { select: { id: true, name: true } },
        },
      });

      for (const m of movementsToCreate) {
        await tx.stockMovement.create({
          data: {
            ...m,
            referenceType: 'ADJUSTMENT',
            referenceId: adjustment.id,
            performedBy: userId ? BigInt(userId) : null,
          },
        });
      }

      return this.serialize(adjustment);
    });
  }

  async getAdjustments(query?: { branchId?: number; page?: number; limit?: number }, user?: AuthUser) {
    const page = Math.max(1, query?.page || 1);
    const limit = Math.max(1, Math.min(100, query?.limit || 20));
    const skip = (page - 1) * limit;

    const branchFilter = await this.buildBranchFilter(user, query?.branchId);
    const where: any = { ...branchFilter };

    const [total, items] = await Promise.all([
      this.prisma.stockAdjustment.count({ where }),
      this.prisma.stockAdjustment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: {
          items: { include: { medicine: { select: { id: true, name: true, box: true } }, batch: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      items: this.serialize(items),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ===========================================================================
  // 6. INTER-BRANCH STOCK TRANSFERS
  // ===========================================================================

  /**
   * Concurrency-safe, transactional inter-branch stock transfer.
   * Acquires pessimistic row lock on source batch, deducts stock, increments/upserts destination batch,
   * creates immutable StockTransfer record and records TRANSFER_OUT / TRANSFER_IN movements in the stock ledger.
   */
  async transferStock(dto: CreateStockTransferDto, userId?: number | string, user?: AuthUser) {
    if (BigInt(dto.fromBranchId) === BigInt(dto.toBranchId)) {
      throw new BadRequestException('Source and destination branches cannot be the same.');
    }

    const { organizationId } = await this.resolveBranchScope(user, dto.fromBranchId);
    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      await this.branchAuth.assertBranchAccess(user, dto.fromBranchId);
    }

    return this.prisma.$transaction(async (tx) => {
      const transferNumber = await this.generateTransferNumber(tx);

      // 1. Pessimistic row-lock on source batch
      const lockedBatchRows = await tx.$queryRaw<
        Array<{
          id: bigint;
          batch_number: string;
          current_quantity: number;
          expiry_date: Date;
          mfg_date: string | null;
          status: string;
          cost_price: any;
          selling_price: any;
          branch_id: bigint | null;
        }>
      >`
        SELECT id, batch_number, current_quantity, expiry_date, mfg_date, status, cost_price, selling_price, branch_id
        FROM medicine_batch
        WHERE id = ${BigInt(dto.batchId)} AND medicine_id = ${BigInt(dto.medicineId)}
        FOR UPDATE
      `;

      if (!lockedBatchRows || lockedBatchRows.length === 0) {
        throw new NotFoundException(`Source batch #${dto.batchId} not found.`);
      }

      const sourceBatch = lockedBatchRows[0];
      if (sourceBatch.current_quantity < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock in source batch ${sourceBatch.batch_number}. Available: ${sourceBatch.current_quantity}, Requested: ${dto.quantity}.`,
        );
      }

      // 2. Deduct from source batch
      await tx.$executeRaw`
        UPDATE medicine_batch
        SET current_quantity = current_quantity - ${dto.quantity},
            status = CASE WHEN current_quantity - ${dto.quantity} = 0 THEN 'DEPLETED' ELSE status END,
            updated_at = NOW()
        WHERE id = ${sourceBatch.id} AND current_quantity >= ${dto.quantity}
      `;

      // 3. Upsert destination batch at toBranchId
      const destBatch = await tx.medicineBatch.findFirst({
        where: {
          medicineId: BigInt(dto.medicineId),
          batchNumber: sourceBatch.batch_number,
          branchId: BigInt(dto.toBranchId),
        },
      });

      if (destBatch) {
        await tx.medicineBatch.update({
          where: { id: destBatch.id },
          data: {
            currentQuantity: { increment: dto.quantity },
            status: 'ACTIVE',
          },
        });
      } else {
        await tx.medicineBatch.create({
          data: {
            medicineId: BigInt(dto.medicineId),
            batchNumber: sourceBatch.batch_number,
            expiryDate: sourceBatch.expiry_date,
            mfgDate: sourceBatch.mfg_date,
            costPrice: sourceBatch.cost_price,
            sellingPrice: sourceBatch.selling_price,
            initialQuantity: dto.quantity,
            currentQuantity: dto.quantity,
            status: 'ACTIVE',
            branchId: BigInt(dto.toBranchId),
          },
        });
      }

      // 4. Create StockTransfer record
      const transfer = await tx.stockTransfer.create({
        data: {
          transferNumber,
          fromBranchId: BigInt(dto.fromBranchId),
          toBranchId: BigInt(dto.toBranchId),
          medicineId: BigInt(dto.medicineId),
          batchId: sourceBatch.id,
          quantity: dto.quantity,
          status: 'COMPLETED',
          reason: dto.reason || (dto as any).notes || null,
          transferredById: userId ? BigInt(userId) : null,
          receivedById: userId ? BigInt(userId) : null,
          organizationId,
        },
        include: {
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          medicine: { select: { id: true, name: true, code: true, brandName: true } },
          batch: { select: { id: true, batchNumber: true, expiryDate: true } },
          transferredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      // 5. Stock movements: TRANSFER_OUT at source, TRANSFER_IN at destination
      await tx.stockMovement.create({
        data: {
          medicineId: BigInt(dto.medicineId),
          batchId: sourceBatch.id,
          movementType: 'TRANSFER_OUT',
          quantity: -dto.quantity,
          balanceAfter: sourceBatch.current_quantity - dto.quantity,
          unitCost: sourceBatch.selling_price ? Number(sourceBatch.selling_price) : 0,
          reason: `Transfer to branch #${dto.toBranchId} (${transferNumber})`,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          organizationId,
          branchId: BigInt(dto.fromBranchId),
          performedBy: userId ? BigInt(userId) : null,
        },
      });

      await tx.stockMovement.create({
        data: {
          medicineId: BigInt(dto.medicineId),
          batchId: sourceBatch.id,
          movementType: 'TRANSFER_IN',
          quantity: dto.quantity,
          balanceAfter: destBatch ? destBatch.currentQuantity + dto.quantity : dto.quantity,
          unitCost: sourceBatch.selling_price ? Number(sourceBatch.selling_price) : 0,
          reason: `Transfer from branch #${dto.fromBranchId} (${transferNumber})`,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          organizationId,
          branchId: BigInt(dto.toBranchId),
          performedBy: userId ? BigInt(userId) : null,
        },
      });

      return this.serialize(transfer);
    });
  }

  async getTransfers(query: QueryStockTransferDto, user?: AuthUser) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.fromBranchId) where.fromBranchId = BigInt(query.fromBranchId);
    if (query.toBranchId) where.toBranchId = BigInt(query.toBranchId);
    if (query.medicineId) where.medicineId = BigInt(query.medicineId);
    if (query.status) where.status = query.status;

    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      const accessibleBranchIds = await this.branchAuth.resolveAccessibleBranchIds(user);
      where.OR = [
        { fromBranchId: { in: accessibleBranchIds } },
        { toBranchId: { in: accessibleBranchIds } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.stockTransfer.count({ where }),
      this.prisma.stockTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: {
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          medicine: { select: { id: true, name: true, code: true, brandName: true } },
          batch: { select: { id: true, batchNumber: true, expiryDate: true } },
          transferredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    return {
      items: items.map((t) => this.serialize(t)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTransferById(id: number | bigint, user?: AuthUser) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id: BigInt(id) },
      include: {
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        medicine: { select: { id: true, name: true, code: true, brandName: true } },
        batch: { select: { id: true, batchNumber: true, expiryDate: true } },
        transferredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Stock transfer #${id} not found.`);
    }

    if (user && this.branchAuth && !this.branchAuth.isGlobalAdmin(user)) {
      const accessible = await this.branchAuth.resolveAccessibleBranchIds(user);
      const canAccess =
        accessible &&
        ((transfer.fromBranchId && accessible.includes(transfer.fromBranchId)) ||
          (transfer.toBranchId && accessible.includes(transfer.toBranchId)));
      if (!canAccess) {
        throw new BadRequestException('You do not have permission to view this transfer.');
      }
    }

    return this.serialize(transfer);
  }

  // ===========================================================================
  // 7. LEDGER & REPORTS
  // ===========================================================================

  async getStockLedger(query: QueryStockMovementDto, user?: AuthUser) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 25));
    const skip = (page - 1) * limit;

    const branchFilter = await this.buildBranchFilter(user, query.branchId || (query as any).branch_id);
    const where: any = { ...branchFilter };

    if (query.medicineId) where.medicineId = BigInt(query.medicineId);
    if (query.batchId) where.batchId = BigInt(query.batchId);
    if (query.movementType) where.movementType = query.movementType;

    const [total, items] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          medicine: { select: { id: true, name: true, generic: true, box: true } },
          batch: { select: { id: true, batchNumber: true, expiryDate: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      items: this.serialize(items),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getExpiryReport(daysAhead = 90, user?: AuthUser) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(now);
    target.setDate(target.getDate() + daysAhead);

    const branchFilter = await this.buildBranchFilter(user);

    const batches = await this.prisma.medicineBatch.findMany({
      where: {
        currentQuantity: { gt: 0 },
        expiryDate: { lte: target },
        ...branchFilter,
      },
      orderBy: { expiryDate: 'asc' },
      include: {
        medicine: { select: { id: true, name: true, generic: true, box: true } },
        supplier: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    const expired = batches.filter((b) => new Date(b.expiryDate) < now);
    const expiringSoon = batches.filter((b) => new Date(b.expiryDate) >= now);

    return {
      now: now.toISOString().split('T')[0],
      daysAhead,
      expiredCount: expired.length,
      expiringSoonCount: expiringSoon.length,
      expiredBatches: this.serialize(expired),
      expiringSoonBatches: this.serialize(expiringSoon),
    };
  }

  async getLowStockReport(threshold = 10, user?: AuthUser) {
    const branchFilter = await this.buildBranchFilter(user);

    const medicines = await this.prisma.medicine.findMany({
      where: {
        isActive: true,
        quantity: { lte: threshold },
      },
      orderBy: { quantity: 'asc' },
      include: {
        batches: {
          where: { currentQuantity: { gt: 0 }, status: 'ACTIVE', ...branchFilter },
          select: { id: true, batchNumber: true, currentQuantity: true, expiryDate: true, branchId: true },
        },
      },
    });

    return this.serialize(medicines);
  }

  async getValuationReport(user?: AuthUser) {
    const branchFilter = await this.buildBranchFilter(user);

    const batches = await this.prisma.medicineBatch.findMany({
      where: { currentQuantity: { gt: 0 }, ...branchFilter },
      include: {
        medicine: { select: { id: true, name: true, generic: true, categoryId: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    let totalCostValuation = 0;
    let totalRetailValuation = 0;
    let totalUnits = 0;

    const breakdown = batches.map((b) => {
      const costTotal = b.currentQuantity * Number(b.costPrice);
      const retailTotal = b.currentQuantity * Number(b.sellingPrice || b.costPrice);
      totalCostValuation += costTotal;
      totalRetailValuation += retailTotal;
      totalUnits += b.currentQuantity;

      return {
        batchId: b.id.toString(),
        medicineName: b.medicine.name,
        batchNumber: b.batchNumber,
        currentQuantity: b.currentQuantity,
        costPrice: Number(b.costPrice),
        sellingPrice: Number(b.sellingPrice || b.costPrice),
        costTotal: Math.round(costTotal * 100) / 100,
        retailTotal: Math.round(retailTotal * 100) / 100,
        branchId: b.branch?.id ? b.branch.id.toString() : null,
        branchName: b.branch?.name || null,
      };
    });

    return {
      totalUnits,
      totalCostValuation: Math.round(totalCostValuation * 100) / 100,
      totalRetailValuation: Math.round(totalRetailValuation * 100) / 100,
      potentialProfit: Math.round((totalRetailValuation - totalCostValuation) * 100) / 100,
      breakdown,
    };
  }
}
