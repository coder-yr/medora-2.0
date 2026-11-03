import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { BranchAuthorizationService } from '../../common/services/branch-authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardFilterDto } from './dto/dashboard.dto';

export interface DateRange {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  // In-memory cache for high-compute branch comparison and financial statement aggregates
  private readonly cache = new Map<string, { expiresAt: number; data: any }>();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly branchAuth?: BranchAuthorizationService,
  ) {}

  /**
   * Standardizes date range boundaries to inclusive UTC start and end
   */
  public parseDateRange(dto: DashboardFilterDto): DateRange {
    const period = dto.period || 'today';
    const now = new Date();

    if (period === 'custom') {
      if (!dto.startDate || !dto.endDate) {
        throw new BadRequestException('startDate and endDate are required when period is custom');
      }
      const start = new Date(`${dto.startDate}T00:00:00.000Z`);
      const end = new Date(`${dto.endDate}T23:59:59.999Z`);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestException('Invalid date provided');
      }
      if (start > end) {
        throw new BadRequestException('startDate cannot be after endDate');
      }
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 366) {
        throw new BadRequestException('Date range cannot exceed 366 days');
      }
      return {
        start,
        end,
        startStr: dto.startDate,
        endStr: dto.endDate,
      };
    }

    const toDateStr = (d: Date) => d.toISOString().split('T')[0];

    if (period === 'today') {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      const str = toDateStr(now);
      return { start, end, startStr: str, endStr: str };
    }

    if (period === 'yesterday') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const start = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0));
      const end = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999));
      const str = toDateStr(yesterday);
      return { start, end, startStr: str, endStr: str };
    }

    if (period === 'last7Days') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end: now, startStr: toDateStr(start), endStr: toDateStr(now) };
    }

    if (period === 'last30Days') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end: now, startStr: toDateStr(start), endStr: toDateStr(now) };
    }

    if (period === 'currentMonth') {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      return { start, end: now, startStr: toDateStr(start), endStr: toDateStr(now) };
    }

    if (period === 'previousMonth') {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
      return { start, end, startStr: toDateStr(start), endStr: toDateStr(end) };
    }

    return { start: new Date(0), end: now, startStr: '1970-01-01', endStr: toDateStr(now) };
  }

  /**
   * Resolves authorized branch scope and prevents cross-branch access tampering
   */
  public resolveBranchFilter(
    requestedBranchId?: string,
    userBranchId?: bigint | null,
    isGlobalAdmin = false,
  ): bigint | null {
    if (requestedBranchId && requestedBranchId !== 'all') {
      const reqId = BigInt(requestedBranchId);
      if (!isGlobalAdmin && userBranchId && reqId !== userBranchId) {
        throw new ForbiddenException('Access to external branch analytics denied');
      }
      return reqId;
    }

    if (isGlobalAdmin) {
      return null; // Global view across all branches
    }

    return userBranchId || null;
  }

  // ===========================================================================
  // 1. EXECUTIVE & OPERATIONAL OVERVIEW
  // ===========================================================================

  async getExecutiveOverview(
    filterDto: DashboardFilterDto,
    userBranchId?: bigint | null,
    isGlobalAdmin = false,
    canViewFinancials = false,
  ) {
    const { start, end, startStr, endStr } = this.parseDateRange(filterDto);
    const branchId = this.resolveBranchFilter(filterDto.branchId, userBranchId, isGlobalAdmin);

    const branchFilter = branchId ? { branchId } : {};

    // 1. Patient Registrations
    const [totalPatients, newPatientsInPeriod] = await Promise.all([
      this.prisma.patient.count(),
      this.prisma.patient.count({
        where: {
          createdAt: { gte: start, lte: end },
        },
      }),
    ]);

    // 2. Appointments & Consultations (date string in Appointment vs timestamp in Consultation)
    const [totalAppointments, completedAppointments, cancelledAppointments, completedConsultations] =
      await Promise.all([
        this.prisma.appointment.count({
          where: {
            ...branchFilter,
            date: { gte: startStr, lte: endStr },
          },
        }),
        this.prisma.appointment.count({
          where: {
            ...branchFilter,
            date: { gte: startStr, lte: endStr },
            status: { in: ['Visited', 'Completed'] },
          },
        }),
        this.prisma.appointment.count({
          where: {
            ...branchFilter,
            date: { gte: startStr, lte: endStr },
            status: 'Cancelled',
          },
        }),
        this.prisma.consultation.count({
          where: {
            ...(branchId ? { appointment: { branchId } } : {}),
            status: 'completed',
            createdAt: { gte: start, lte: end },
          },
        }),
      ]);

    const activeAppointments = totalAppointments - cancelledAppointments;
    const appointmentCompletionRate =
      activeAppointments > 0
        ? Math.round((completedAppointments / activeAppointments) * 1000) / 10
        : 0;

    // 3. Inpatient Census & Bed Occupancy
    const [activeAdmissions, totalBeds, occupiedBeds] = await Promise.all([
      this.prisma.admission.count({
        where: {
          ...branchFilter,
          status: 'ADMITTED',
        },
      }),
      this.prisma.bed.count({
        where: {
          status: { in: ['AVAILABLE', 'OCCUPIED', 'RESERVED'] },
        },
      }),
      this.prisma.bed.count({
        where: {
          status: 'OCCUPIED',
        },
      }),
    ]);

    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0;

    // 4. Authoritative Batch Inventory (Pharmacy)
    const lowStockMedicines = await this.prisma.medicine.count({
      where: {
        isActive: true,
        batches: {
          none: {
            currentQuantity: { gt: 10 },
          },
        },
      },
    });

    const sixtyDaysAhead = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const nearExpiryBatches = await this.prisma.medicineBatch.count({
      where: {
        currentQuantity: { gt: 0 },
        expiryDate: { lte: sixtyDaysAhead },
      },
    });

    // 5. Diagnostics Queues
    const [pendingLabOrders, pendingRadiologyStudies] = await Promise.all([
      this.prisma.lab.count({
        where: {
          ...(branchId ? { appointment: { branchId } } : {}),
          status: { in: ['PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'requested', 'ordered'] },
        },
      }),
      this.prisma.radiologyOrder.count({
        where: {
          ...branchFilter,
          status: { in: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'ordered'] },
        },
      }),
    ]);

    // 6. Financial Summary (Strictly restricted to authorized roles via Payment and CashTransaction models)
    let financialSummary: any = null;
    if (canViewFinancials) {
      const [paymentAgg, cashInAgg, nonCashInAgg, pendingReconciliation] = await Promise.all([
        this.prisma.payment.aggregate({
          where: {
            ...branchFilter,
            createdAt: { gte: start, lte: end },
          },
          _sum: {
            grossTotal: true,
            amountReceived: true,
            discount: true,
          },
        }),
        this.prisma.cashTransaction.aggregate({
          where: {
            isCash: true,
            direction: 'IN',
            createdAt: { gte: start, lte: end },
            shift: branchFilter,
          },
          _sum: { amount: true },
        }),
        this.prisma.cashTransaction.aggregate({
          where: {
            isCash: false,
            direction: 'IN',
            createdAt: { gte: start, lte: end },
            shift: branchFilter,
          },
          _sum: { amount: true },
        }),
        this.prisma.cashierShift.count({
          where: {
            ...branchFilter,
            status: { in: ['OPEN', 'CLOSED_PENDING_APPROVAL'] },
          },
        }),
      ]);

      const totalBilled = Number(paymentAgg._sum.grossTotal || 0);
      const totalDiscount = Number(paymentAgg._sum.discount || 0);
      const netRevenue = Math.max(0, totalBilled - totalDiscount);
      const totalPaid = Number(paymentAgg._sum.amountReceived || 0);
      const accountsReceivable = Math.max(0, netRevenue - totalPaid);

      financialSummary = {
        recognizedRevenue: netRevenue,
        cashCollections: Number(cashInAgg._sum.amount || 0),
        nonCashCollections: Number(nonCashInAgg._sum.amount || 0),
        accountsReceivable,
        openOrPendingShifts: pendingReconciliation,
      };
    }

    // 7. Notification Outbox Queue Health
    const deadLetterCount = await this.prisma.notificationOutbox.count({
      where: {
        ...(branchId ? { notification: { branchId } } : {}),
        status: 'DEAD_LETTER',
      },
    });

    return {
      period: filterDto.period || 'today',
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      branchScope: branchId ? branchId.toString() : 'GLOBAL_ALL_BRANCHES',
      patients: {
        totalRegistered: totalPatients,
        newInPeriod: newPatientsInPeriod,
      },
      appointments: {
        total: totalAppointments,
        completed: completedAppointments,
        cancelled: cancelledAppointments,
        completionRatePercent: appointmentCompletionRate,
        consultationsCompleted: completedConsultations,
      },
      inpatient: {
        activeAdmissions,
        totalBeds,
        occupiedBeds,
        occupancyRatePercent: occupancyRate,
      },
      pharmacy: {
        lowStockMedicines,
        nearExpiryBatches,
      },
      diagnostics: {
        pendingLabOrders,
        pendingRadiologyStudies,
      },
      financial: financialSummary,
      notifications: {
        deadLetterJobs: deadLetterCount,
        queueStatus: deadLetterCount > 10 ? 'DEGRADED' : 'HEALTHY',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ===========================================================================
  // 2. CLINICAL WORKLOAD (DOCTOR PERSONA)
  // ===========================================================================

  async getDoctorWorkload(
    doctorId: bigint,
    filterDto: DashboardFilterDto,
    userBranchId?: bigint | null,
  ) {
    const { start, end, startStr, endStr } = this.parseDateRange(filterDto);

    const [todayAppointments, completedVisits, pendingConsultations, totalConsultations] =
      await Promise.all([
        this.prisma.appointment.findMany({
          where: {
            doctorId,
            date: { gte: startStr, lte: endStr },
          },
          select: {
            id: true,
            patientId: true,
            status: true,
            date: true,
            sTime: true,
            eTime: true,
            remarks: true,
          },
          orderBy: { id: 'asc' },
          take: 50,
        }),
        this.prisma.appointment.count({
          where: {
            doctorId,
            date: { gte: startStr, lte: endStr },
            status: { in: ['Visited', 'Completed'] },
          },
        }),
        this.prisma.consultation.count({
          where: {
            doctorId,
            status: 'DRAFT',
            createdAt: { gte: start, lte: end },
          },
        }),
        this.prisma.consultation.count({
          where: {
            doctorId,
            status: 'COMPLETED',
            createdAt: { gte: start, lte: end },
          },
        }),
      ]);

    return {
      doctorId: doctorId.toString(),
      period: filterDto.period || 'today',
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      appointments: {
        total: todayAppointments.length,
        completed: completedVisits,
        items: todayAppointments.map((a) => ({
          ...a,
          id: a.id.toString(),
          patientId: a.patientId.toString(),
        })),
      },
      consultations: {
        pendingDrafts: pendingConsultations,
        completed: totalConsultations,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ===========================================================================
  // 3. MULTI-BRANCH COMPARISON ANALYTICS
  // ===========================================================================

  async getBranchComparison(filterDto: DashboardFilterDto, user?: any) {
    const { start, end, startStr, endStr } = this.parseDateRange(filterDto);

    const accessibleBranches = this.branchAuth && user ? await this.branchAuth.resolveAccessibleBranchIds(user) : null;
    const isGlobal = !accessibleBranches;
    const canViewFinancial =
      !user ||
      user.group === 'Admin' ||
      user.role === 'Admin' ||
      user.permissions?.includes(HospitalPermission.DASHBOARD_FINANCIAL_VIEW);

    const authScope = isGlobal ? 'global' : accessibleBranches.map((id) => id.toString()).sort().join('_');
    const finScope = canViewFinancial ? 'fin' : 'nofin';
    const cacheKey = `branch_comparison_${authScope}_${finScope}_${startStr}_${endStr}`;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const branches = await this.prisma.hospitalBranch.findMany({
      where: {
        active: true,
        ...(accessibleBranches ? { id: { in: accessibleBranches } } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
      },
      orderBy: { code: 'asc' },
    });

    const comparisons = await Promise.all(
      branches.map(async (branch) => {
        const [appCount, admCount, paymentSum] = await Promise.all([
          this.prisma.appointment.count({
            where: {
              branchId: branch.id,
              date: { gte: startStr, lte: endStr },
            },
          }),
          this.prisma.admission.count({
            where: {
              branchId: branch.id,
              admissionDate: { gte: start, lte: end },
            },
          }),
          canViewFinancial
            ? this.prisma.payment.aggregate({
                where: {
                  branchId: branch.id,
                  createdAt: { gte: start, lte: end },
                },
                _sum: {
                  grossTotal: true,
                  discount: true,
                },
              })
            : Promise.resolve({ _sum: { grossTotal: null, discount: null } }),
        ]);

        const totalBilled = Number(paymentSum._sum.grossTotal || 0);
        const discount = Number(paymentSum._sum.discount || 0);
        const netRevenue = canViewFinancial ? Math.max(0, totalBilled - discount) : null;

        return {
          branchId: branch.id.toString(),
          branchName: branch.name,
          branchCode: branch.code,
          address: branch.address,
          appointmentsCount: appCount,
          admissionsCount: admCount,
          netRevenue,
        };
      }),
    );

    const result = {
      period: filterDto.period || 'today',
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      branches: comparisons,
      generatedAt: new Date().toISOString(),
    };

    this.cache.set(cacheKey, { expiresAt: Date.now() + this.CACHE_TTL_MS, data: result });
    return result;
  }

  // ===========================================================================
  // 4. ACTIONABLE OPERATIONAL ALERTS
  // ===========================================================================

  async getOperationalAlerts(userBranchId?: bigint | null, isGlobalAdmin = false) {
    const branchFilter = isGlobalAdmin ? {} : userBranchId ? { branchId: userBranchId } : {};

    const [
      stuckCashShifts,
      unverifiedLabResults,
      deadLetterOutbox,
      lowStockBatches,
    ] = await Promise.all([
      this.prisma.cashierShift.count({
        where: {
          ...branchFilter,
          status: 'CLOSED_PENDING_APPROVAL',
        },
      }),
      this.prisma.lab.count({
        where: {
          ...(branchFilter.branchId ? { appointment: { branchId: branchFilter.branchId } } : {}),
          status: 'SAMPLE_COLLECTED',
        },
      }),
      this.prisma.notificationOutbox.count({
        where: {
          ...(branchFilter.branchId ? { notification: { branchId: branchFilter.branchId } } : {}),
          status: 'DEAD_LETTER',
        },
      }),
      this.prisma.medicineBatch.count({
        where: {
          currentQuantity: { lte: 5, gt: 0 },
        },
      }),
    ]);

    const alerts: Array<{
      id: string;
      level: 'INFO' | 'WARNING' | 'CRITICAL';
      category: string;
      title: string;
      description: string;
      count: number;
    }> = [];

    if (stuckCashShifts > 0) {
      alerts.push({
        id: 'CASHIER_APPROVAL_PENDING',
        level: 'WARNING',
        category: 'FINANCE',
        title: 'Cashier Shifts Awaiting Approval',
        description: `${stuckCashShifts} cashier shift(s) are closed and pending supervisory verification.`,
        count: stuckCashShifts,
      });
    }

    if (unverifiedLabResults > 0) {
      alerts.push({
        id: 'LAB_SAMPLES_PENDING',
        level: 'WARNING',
        category: 'LABORATORY',
        title: 'Diagnostic Samples Pending Analysis',
        description: `${unverifiedLabResults} specimen sample(s) collected but not yet verified or released.`,
        count: unverifiedLabResults,
      });
    }

    if (deadLetterOutbox > 0) {
      alerts.push({
        id: 'NOTIF_DEAD_LETTER',
        level: 'CRITICAL',
        category: 'NOTIFICATIONS',
        title: 'Notification Dead-Letter Failure',
        description: `${deadLetterOutbox} outbox notification job(s) failed permanently and require manual retry.`,
        count: deadLetterOutbox,
      });
    }

    if (lowStockBatches > 0) {
      alerts.push({
        id: 'PHARMACY_LOW_STOCK',
        level: 'INFO',
        category: 'PHARMACY',
        title: 'Critically Low Medication Batches',
        description: `${lowStockBatches} pharmaceutical batch(es) have 5 or fewer units remaining.`,
        count: lowStockBatches,
      });
    }

    return {
      alerts,
      totalAlerts: alerts.length,
      checkedAt: new Date().toISOString(),
    };
  }
}
