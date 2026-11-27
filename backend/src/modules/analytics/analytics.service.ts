import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { AuthUser } from '../../common/types/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  AnalyticsDomain,
  AnalyticsFilterDto,
  AnalyticsGranularity,
} from './dto/analytics-filter.dto';

export interface OrgDateRange {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  todayStr: string;
  dayCount: number;
  timezone: string;
}

export interface TenantScope {
  organizationId: bigint;
  timezone: string;
  currency: string;
  branchIds: bigint[];
  branches: Array<{ id: bigint; name: string; code: string }>;
  isGlobalAdmin: boolean;
  forcedDoctorId: bigint | null;
  canViewFinancials: boolean;
}

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

const COMPLETED_APPT_STATUSES = ['visited', 'completed'];
const CANCELLED_APPT_STATUSES = ['cancelled', 'canceled'];
const NO_SHOW_APPT_STATUSES = ['no-show', 'no_show', 'no show', 'noshow'];
const EXCLUDED_INVOICE_STATUSES = ['CANCELLED', 'DRAFT', 'cancelled', 'draft'];
const VALID_PAYMENT_STATUSES = ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'];

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly CACHE_TTL_MS = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // TENANT, BRANCH, ROLE & TIMEZONE RESOLUTION
  // ===========================================================================

  public async resolveTenantScope(
    user: AuthUser,
    filter: AnalyticsFilterDto,
  ): Promise<TenantScope> {
    if (!user.organizationId) {
      throw new ForbiddenException(
        'Organization context is required to access clinic analytics.',
      );
    }

    const organizationId = BigInt(user.organizationId);

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        settings: {
          select: {
            defaultTimezone: true,
            defaultCurrency: true,
          },
        },
      },
    });

    if (!org || org.deletedAt !== null || org.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Analytics access denied: organization is suspended or inactive.',
      );
    }

    const timezone = org.settings?.defaultTimezone || 'Asia/Kolkata';
    const currency = org.settings?.defaultCurrency || 'INR';

    const isGlobalAdmin =
      user.group === 'Admin' ||
      (Array.isArray(user.permissions) &&
        user.permissions.includes(HospitalPermission.BRANCH_VIEW_ALL));

    const canViewFinancials =
      user.group === 'Admin' ||
      user.group === 'Accountant' ||
      (Array.isArray(user.permissions) &&
        (user.permissions.includes(HospitalPermission.DASHBOARD_FINANCIAL_VIEW) ||
          user.permissions.includes(HospitalPermission.FINANCIAL_REPORTS)));

    const orgBranches = await this.prisma.hospitalBranch.findMany({
      where: { organizationId, deletedAt: null, active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    if (orgBranches.length === 0) {
      throw new ForbiddenException(
        'No active branches configured for this organization.',
      );
    }

    const orgBranchMap = new Map<string, { id: bigint; name: string; code: string }>();
    for (const b of orgBranches) {
      orgBranchMap.set(b.id.toString(), b);
    }

    let authorizedBranches = orgBranches;
    if (!isGlobalAdmin) {
      const memberships = await this.prisma.userBranchMembership.findMany({
        where: { userId: BigInt(user.id) },
        select: { branchId: true },
      });
      const allowedSet = new Set<string>(
        memberships.map((m) => m.branchId.toString()),
      );
      if (user.branchId) {
        allowedSet.add(user.branchId.toString());
      }
      authorizedBranches = orgBranches.filter((b) =>
        allowedSet.has(b.id.toString()),
      );
      if (authorizedBranches.length === 0) {
        throw new ForbiddenException(
          'User is not authorized for any branch in this organization.',
        );
      }
    }

    let selectedBranches = authorizedBranches;
    if (filter.branchId && filter.branchId !== 'all') {
      let reqBranchId: bigint;
      try {
        reqBranchId = BigInt(filter.branchId.trim());
      } catch {
        throw new BadRequestException(`Invalid branchId: "${filter.branchId}"`);
      }

      if (!orgBranchMap.has(reqBranchId.toString())) {
        throw new ForbiddenException(
          'Requested branch does not belong to your organization.',
        );
      }

      const isAuthorized = authorizedBranches.some((b) => b.id === reqBranchId);
      if (!isAuthorized) {
        throw new ForbiddenException(
          'You are not authorized to access analytics for this branch.',
        );
      }
      selectedBranches = [orgBranchMap.get(reqBranchId.toString())!];
    }

    let forcedDoctorId: bigint | null = null;
    if (user.group === 'Doctor' && !isGlobalAdmin) {
      const doc = await this.prisma.doctor.findFirst({
        where: {
          branchId: { in: orgBranches.map((b) => b.id) },
          OR: [
            { ionUserId: user.id.toString() },
            ...(user.email ? [{ email: user.email }] : []),
          ],
        },
        select: { id: true },
      });
      if (!doc) {
        throw new ForbiddenException(
          'Doctor profile not linked to current user account.',
        );
      }
      if (filter.doctorId && BigInt(filter.doctorId) !== doc.id) {
        throw new ForbiddenException(
          'Doctors may only view their own operational metrics.',
        );
      }
      forcedDoctorId = doc.id;
    } else if (filter.doctorId) {
      try {
        forcedDoctorId = BigInt(filter.doctorId.trim());
      } catch {
        throw new BadRequestException(`Invalid doctorId: "${filter.doctorId}"`);
      }
    }

    return {
      organizationId,
      timezone,
      currency,
      branchIds: selectedBranches.map((b) => b.id),
      branches: selectedBranches,
      isGlobalAdmin,
      forcedDoctorId,
      canViewFinancials,
    };
  }

  /**
   * Computes inclusive UTC Date bounds aligned to the organization's local timezone.
   */
  public parseOrgDateRange(
    filter: AnalyticsFilterDto,
    timezone: string,
    now: Date = new Date(),
  ): OrgDateRange {
    const safeTz = this.validateTimezone(timezone);
    const todayStr = this.formatDateInTimezone(now, safeTz);
    const period = filter.period || 'last30Days';

    let startStr: string;
    let endStr: string;

    if (period === 'custom') {
      if (!filter.startDate || !filter.endDate) {
        throw new BadRequestException(
          'startDate and endDate are required when period is custom.',
        );
      }
      startStr = filter.startDate;
      endStr = filter.endDate;
    } else if (period === 'today') {
      startStr = todayStr;
      endStr = todayStr;
    } else if (period === 'yesterday') {
      startStr = this.shiftDateStr(todayStr, -1);
      endStr = startStr;
    } else if (period === 'last7Days') {
      startStr = this.shiftDateStr(todayStr, -6);
      endStr = todayStr;
    } else if (period === 'last30Days') {
      startStr = this.shiftDateStr(todayStr, -29);
      endStr = todayStr;
    } else if (period === 'last90Days') {
      startStr = this.shiftDateStr(todayStr, -89);
      endStr = todayStr;
    } else {
      startStr = this.shiftDateStr(todayStr, -29);
      endStr = todayStr;
    }

    const start = this.zonedLocalToUtcDate(startStr, '00:00:00.000', safeTz);
    const end = this.zonedLocalToUtcDate(endStr, '23:59:59.999', safeTz);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date range.');
    }
    if (start > end) {
      throw new BadRequestException('startDate cannot be after endDate.');
    }

    const dayCount = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
    if (dayCount > 366) {
      throw new BadRequestException('Date range cannot exceed 366 days.');
    }

    return {
      start,
      end,
      startStr,
      endStr,
      todayStr,
      dayCount,
      timezone: safeTz,
    };
  }

  private validateTimezone(tz: string): string {
    try {
      Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
      return tz;
    } catch {
      return 'Asia/Kolkata';
    }
  }

  private formatDateInTimezone(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private shiftDateStr(dateStr: string, deltaDays: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
    return utc.toISOString().slice(0, 10);
  }

  private zonedLocalToUtcDate(
    dateStr: string,
    timeStr: string,
    timezone: string,
  ): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hms, msPart] = timeStr.split('.');
    const [hour, minute, second] = hms.split(':').map(Number);
    const ms = Number(msPart || 0);

    const utcGuess = new Date(
      Date.UTC(year, month - 1, day, hour, minute, second, ms),
    );
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(utcGuess);

    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') {
        map[p.type] = Number(p.value);
      }
    }
    const tzHour = map.hour === 24 ? 0 : map.hour;
    const asUtc = Date.UTC(
      map.year,
      map.month - 1,
      map.day,
      tzHour,
      map.minute,
      map.second,
      ms,
    );
    const offsetMs = asUtc - utcGuess.getTime();
    return new Date(utcGuess.getTime() - offsetMs);
  }

  private buildCacheKey(
    domain: string,
    scope: TenantScope,
    range: OrgDateRange,
    extra = '',
  ): string {
    const branchKey = scope.branchIds.map((b) => b.toString()).join(',');
    const docKey = scope.forcedDoctorId ? scope.forcedDoctorId.toString() : 'all';
    return `${scope.organizationId.toString()}:${domain}:${branchKey}:${docKey}:${range.startStr}:${range.endStr}:${extra}`;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCached<T>(key: string, data: T): void {
    this.cache.set(key, { expiresAt: Date.now() + this.CACHE_TTL_MS, data });
  }

  private async withCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.getCached<T>(key);
    if (cached !== null) return cached;
    const data = await fn();
    this.setCached(key, data);
    return data;
  }

  private round2(val: number | Prisma.Decimal | null | undefined): number {
    if (val === null || val === undefined) return 0;
    const num = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100) / 100;
  }

  private toBucketKey(
    dateStr: string,
    granularity: AnalyticsGranularity,
  ): string {
    if (granularity === 'month') {
      return dateStr.slice(0, 7); // YYYY-MM
    }
    if (granularity === 'week') {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      const dayOfWeek = dt.getUTCDay(); // 0=Sun..6=Sat
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      dt.setUTCDate(dt.getUTCDate() + diffToMonday);
      return dt.toISOString().slice(0, 10);
    }
    return dateStr;
  }

  // ===========================================================================
  // 1. CLINIC OVERVIEW DASHBOARD
  // ===========================================================================

  async getOverview(user: AuthUser, filter: AnalyticsFilterDto) {
    const scope = await this.resolveTenantScope(user, filter);
    const range = this.parseOrgDateRange(filter, scope.timezone);
    const cacheKey = this.buildCacheKey(
      'overview',
      scope,
      range,
      scope.canViewFinancials ? 'fin1' : 'fin0',
    );
    return this.withCache(cacheKey, async () => {

    const branchWhere = { branchId: { in: scope.branchIds } };
    const doctorApptWhere = scope.forcedDoctorId
      ? { doctorId: scope.forcedDoctorId }
      : {};

    const [
      totalRegisteredPatients,
      newPatients,
      appointmentsInPeriod,
      followUpsDue,
      activeDoctors,
    ] = await Promise.all([
      // Cumulative
      this.prisma.patient.count({
        where: branchWhere,
      }),
      // Date-range
      this.prisma.patient.count({
        where: {
          ...branchWhere,
          createdAt: { gte: range.start, lte: range.end },
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          ...branchWhere,
          ...doctorApptWhere,
          date: { gte: range.startStr, lte: range.endStr },
        },
        select: { status: true, date: true },
      }),
      this.prisma.followUp.count({
        where: {
          organizationId: scope.organizationId,
          ...branchWhere,
          ...doctorApptWhere,
          status: { in: ['SCHEDULED', 'REMINDER_PENDING', 'REMINDER_SENT'] },
          dueDate: { gte: range.start, lte: range.end },
        },
      }),
      this.prisma.doctor.count({
        where: {
          ...branchWhere,
          ...(scope.forcedDoctorId ? { id: scope.forcedDoctorId } : {}),
        },
      }),
    ]);

    let completedAppointments = 0;
    let cancelledAppointments = 0;
    let noShowAppointments = 0;

    for (const apt of appointmentsInPeriod) {
      const s = (apt.status || '').toLowerCase();
      if (COMPLETED_APPT_STATUSES.includes(s)) {
        completedAppointments += 1;
      } else if (CANCELLED_APPT_STATUSES.includes(s)) {
        cancelledAppointments += 1;
      } else if (
        NO_SHOW_APPT_STATUSES.includes(s) &&
        apt.date <= range.todayStr
      ) {
        noShowAppointments += 1;
      }
    }

    const totalAppointments = appointmentsInPeriod.length;
    const averageDailyAppointments = this.round2(
      totalAppointments / range.dayCount,
    );

    let totalInvoicedAmount: number | null = null;
    let totalCollectedPayments: number | null = null;
    let outstandingInvoiceBalance: number | null = null;

    if (scope.canViewFinancials) {
      const fin = await this.computeFinancialTotals(scope, range);
      totalInvoicedAmount = fin.grossFinalizedInvoiceAmount;
      totalCollectedPayments = fin.totalCollectedPayments;
      outstandingInvoiceBalance = fin.outstandingBalance;
    }

    const result = {
      meta: {
        organizationId: scope.organizationId.toString(),
        timezone: scope.timezone,
        currency: scope.currency,
        period: filter.period || 'last30Days',
        startDate: range.startStr,
        endDate: range.endStr,
        dayCount: range.dayCount,
        branchCount: scope.branchIds.length,
      },
      cumulativeKpis: {
        totalRegisteredPatients,
        activeDoctors,
      },
      periodKpis: {
        newPatients,
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowAppointments,
        averageDailyAppointments,
        followUpsDue,
        totalInvoicedAmount,
        totalCollectedPayments,
        outstandingInvoiceBalance,
      },
    };

      return result;
    });
  }

  // ===========================================================================
  // 2. PATIENT ANALYTICS
  // ===========================================================================

  async getPatientAnalytics(user: AuthUser, filter: AnalyticsFilterDto) {
    const scope = await this.resolveTenantScope(user, filter);
    const range = this.parseOrgDateRange(filter, scope.timezone);
    const granularity = filter.granularity || 'day';
    const cacheKey = this.buildCacheKey('patients', scope, range, granularity);
    return this.withCache(cacheKey, async () => {

    const branchWhere = { branchId: { in: scope.branchIds } };

    const [allPatients, periodAppointments] = await Promise.all([
      this.prisma.patient.findMany({
        where: branchWhere,
        select: {
          id: true,
          branchId: true,
          age: true,
          birthdate: true,
          sex: true,
          createdAt: true,
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          ...branchWhere,
          date: { gte: range.startStr, lte: range.endStr },
          status: { notIn: ['cancelled', 'Cancelled', 'CANCELED'] },
        },
        select: {
          patientId: true,
          date: true,
          visitType: true,
        },
      }),
    ]);

    const patientCreatedMap = new Map<string, Date | null>();
    const branchDistMap = new Map<string, number>();
    const ageBuckets: Record<string, number> = {
      '0-17': 0,
      '18-35': 0,
      '36-50': 0,
      '51-65': 0,
      '65+': 0,
      Unknown: 0,
    };
    const genderDist: Record<string, number> = {
      Male: 0,
      Female: 0,
      Other: 0,
      Unknown: 0,
    };
    const trendMap = new Map<string, number>();
    let newPatientsCount = 0;

    for (const p of allPatients) {
      patientCreatedMap.set(p.id.toString(), p.createdAt);
      const bKey = p.branchId ? p.branchId.toString() : 'unassigned';
      branchDistMap.set(bKey, (branchDistMap.get(bKey) || 0) + 1);

      // Age classification (reliable numeric or birthdate only; never infer)
      const ageNum = this.extractReliableAge(p.age, p.birthdate);
      if (ageNum === null) {
        ageBuckets.Unknown += 1;
      } else if (ageNum <= 17) {
        ageBuckets['0-17'] += 1;
      } else if (ageNum <= 35) {
        ageBuckets['18-35'] += 1;
      } else if (ageNum <= 50) {
        ageBuckets['36-50'] += 1;
      } else if (ageNum <= 65) {
        ageBuckets['51-65'] += 1;
      } else {
        ageBuckets['65+'] += 1;
      }

      // Gender classification
      const sex = (p.sex || '').trim().toLowerCase();
      if (sex === 'male' || sex === 'm') {
        genderDist.Male += 1;
      } else if (sex === 'female' || sex === 'f') {
        genderDist.Female += 1;
      } else if (sex === 'other' || sex === 'non-binary') {
        genderDist.Other += 1;
      } else {
        genderDist.Unknown += 1;
      }

      if (p.createdAt && p.createdAt >= range.start && p.createdAt <= range.end) {
        newPatientsCount += 1;
        const localDate = this.formatDateInTimezone(p.createdAt, scope.timezone);
        const bucket = this.toBucketKey(localDate, granularity);
        trendMap.set(bucket, (trendMap.get(bucket) || 0) + 1);
      }
    }

    // New vs Returning patients with active appointments in period
    const seenPatients = new Set<string>();
    const revisitTrendMap = new Map<
      string,
      { newPatients: number; returningPatients: number }
    >();
    let newVisitingPatients = 0;
    let returningVisitingPatients = 0;

    for (const apt of periodAppointments) {
      const pid = apt.patientId.toString();
      const created = patientCreatedMap.get(pid);
      const isNew =
        created !== null &&
        created !== undefined &&
        created >= range.start &&
        created <= range.end;

      const bucket = this.toBucketKey(apt.date, granularity);
      const entry = revisitTrendMap.get(bucket) || {
        newPatients: 0,
        returningPatients: 0,
      };
      if (isNew) {
        entry.newPatients += 1;
      } else {
        entry.returningPatients += 1;
      }
      revisitTrendMap.set(bucket, entry);

      if (!seenPatients.has(pid)) {
        seenPatients.add(pid);
        if (isNew) newVisitingPatients += 1;
        else returningVisitingPatients += 1;
      }
    }

    const registrationTrend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const revisitTrend = Array.from(revisitTrendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, val]) => ({
        date,
        newPatients: val.newPatients,
        returningPatients: val.returningPatients,
      }));

    const branchDistribution = scope.branches.map((b) => ({
      branchId: b.id.toString(),
      branchName: b.name,
      branchCode: b.code,
      patientCount: branchDistMap.get(b.id.toString()) || 0,
    }));

    const result = {
      meta: {
        startDate: range.startStr,
        endDate: range.endStr,
        timezone: scope.timezone,
        granularity,
      },
      summary: {
        totalRegisteredPatients: allPatients.length,
        newPatientsInPeriod: newPatientsCount,
        activePatientsInPeriod: seenPatients.size,
        newVisitingPatients,
        returningVisitingPatients,
      },
      registrationTrend,
      revisitTrend,
      branchDistribution,
      ageGroupDistribution: Object.entries(ageBuckets).map(([group, count]) => ({
        group,
        count,
      })),
      genderDistribution: Object.entries(genderDist).map(([gender, count]) => ({
        gender,
        count,
      })),
    };

      return result;
    });
  }

  private extractReliableAge(
    ageStr: string | null,
    birthdateStr: string | null,
  ): number | null {
    if (ageStr) {
      const parsed = Number.parseInt(ageStr.trim(), 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 125) {
        return parsed;
      }
    }
    if (birthdateStr) {
      const bd = new Date(birthdateStr);
      if (!isNaN(bd.getTime())) {
        const diffYears = Math.floor(
          (Date.now() - bd.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
        );
        if (diffYears >= 0 && diffYears <= 125) {
          return diffYears;
        }
      }
    }
    return null;
  }

  // ===========================================================================
  // 3. APPOINTMENT ANALYTICS
  // ===========================================================================

  async getAppointmentAnalytics(user: AuthUser, filter: AnalyticsFilterDto) {
    const scope = await this.resolveTenantScope(user, filter);
    const range = this.parseOrgDateRange(filter, scope.timezone);
    const granularity = filter.granularity || 'day';
    const cacheKey = this.buildCacheKey('appointments', scope, range, granularity);
    return this.withCache(cacheKey, async () => {

    const appointments = await this.prisma.appointment.findMany({
      where: {
        branchId: { in: scope.branchIds },
        ...(scope.forcedDoctorId ? { doctorId: scope.forcedDoctorId } : {}),
        date: { gte: range.startStr, lte: range.endStr },
      },
      select: {
        id: true,
        date: true,
        sTime: true,
        status: true,
        visitType: true,
        mode: true,
        doctorId: true,
        branchId: true,
        doctor: { select: { id: true, name: true, department: true } },
      },
    });

    const trendMap = new Map<
      string,
      {
        total: number;
        completed: number;
        cancelled: number;
        noShow: number;
        scheduled: number;
      }
    >();
    const statusCounts: Record<string, number> = {
      Completed: 0,
      Cancelled: 0,
      'No-Show': 0,
      Scheduled: 0,
      'Checked-In / In-Progress': 0,
    };
    const typeCounts = new Map<string, number>();
    const hourCounts = new Map<number, number>();
    const doctorVolumeMap = new Map<
      string,
      { doctorId: string; doctorName: string; department: string; count: number }
    >();
    const branchVolumeMap = new Map<string, number>();
    const activeWorkingDays = new Set<string>();

    let completed = 0;
    let cancelled = 0;
    let noShow = 0;
    let futureScheduled = 0;

    for (const apt of appointments) {
      activeWorkingDays.add(apt.date);
      const s = (apt.status || '').toLowerCase();
      const isFuture = apt.date > range.todayStr;

      const bucket = this.toBucketKey(apt.date, granularity);
      const tEntry = trendMap.get(bucket) || {
        total: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        scheduled: 0,
      };
      tEntry.total += 1;

      if (COMPLETED_APPT_STATUSES.includes(s)) {
        completed += 1;
        tEntry.completed += 1;
        statusCounts.Completed += 1;
      } else if (CANCELLED_APPT_STATUSES.includes(s)) {
        cancelled += 1;
        tEntry.cancelled += 1;
        statusCounts.Cancelled += 1;
      } else if (NO_SHOW_APPT_STATUSES.includes(s) && !isFuture) {
        noShow += 1;
        tEntry.noShow += 1;
        statusCounts['No-Show'] += 1;
      } else if (['checked_in', 'in_consultation', 'called_in', 'waiting'].includes(s)) {
        tEntry.scheduled += 1;
        statusCounts['Checked-In / In-Progress'] += 1;
      } else {
        if (isFuture) futureScheduled += 1;
        tEntry.scheduled += 1;
        statusCounts.Scheduled += 1;
      }
      trendMap.set(bucket, tEntry);

      const typeLabel = `${apt.visitType || 'first_visit'} (${apt.mode || 'in_person'})`;
      typeCounts.set(typeLabel, (typeCounts.get(typeLabel) || 0) + 1);

      // Peak hour from sTime ("YYYY-MM-DD HH:mm:ss" or "HH:mm")
      const hourMatch = /(\d{2}):\d{2}/.exec(apt.sTime || '');
      if (hourMatch) {
        const hr = Number.parseInt(hourMatch[1], 10);
        if (hr >= 0 && hr <= 23) {
          hourCounts.set(hr, (hourCounts.get(hr) || 0) + 1);
        }
      }

      const dId = apt.doctorId.toString();
      const docEntry = doctorVolumeMap.get(dId) || {
        doctorId: dId,
        doctorName: apt.doctor?.name || `Doctor #${dId}`,
        department: apt.doctor?.department || 'General',
        count: 0,
      };
      docEntry.count += 1;
      doctorVolumeMap.set(dId, docEntry);

      const bKey = apt.branchId ? apt.branchId.toString() : 'unassigned';
      branchVolumeMap.set(bKey, (branchVolumeMap.get(bKey) || 0) + 1);
    }

    const total = appointments.length;
    // Explicit No-Show Denominator: total appointments excluding cancelled and future appointments
    const noShowDenominator = Math.max(0, total - cancelled - futureScheduled);
    const noShowRate =
      noShowDenominator > 0
        ? this.round2((noShow / noShowDenominator) * 100)
        : 0;

    const workingDaysCount = activeWorkingDays.size;
    const avgPerWorkingDay =
      workingDaysCount > 0 ? this.round2(total / workingDaysCount) : 0;

    const result = {
      meta: {
        startDate: range.startStr,
        endDate: range.endStr,
        granularity,
        noShowDenominatorDefinition:
          'Total appointments in range minus cancelled appointments minus future scheduled appointments (date > today)',
      },
      summary: {
        totalAppointments: total,
        completedAppointments: completed,
        cancelledAppointments: cancelled,
        noShowAppointments: noShow,
        noShowDenominator,
        noShowRatePercent: noShowRate,
        workingDaysWithAppointments: workingDaysCount,
        averageAppointmentsPerWorkingDay: avgPerWorkingDay,
      },
      volumeTrend: Array.from(trendMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, val]) => ({ date, ...val })),
      statusDistribution: Object.entries(statusCounts)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({ status, count })),
      typeDistribution: Array.from(typeCounts.entries()).map(([type, count]) => ({
        type,
        count,
      })),
      peakHours: Array.from(hourCounts.entries())
        .sort(([a], [b]) => a - b)
        .map(([hour, count]) => ({
          hour,
          label: `${hour.toString().padStart(2, '0')}:00`,
          count,
        })),
      doctorVolume: Array.from(doctorVolumeMap.values()).sort(
        (a, b) => b.count - a.count,
      ),
      branchVolume: scope.branches.map((b) => ({
        branchId: b.id.toString(),
        branchName: b.name,
        branchCode: b.code,
        count: branchVolumeMap.get(b.id.toString()) || 0,
      })),
    };

      return result;
    });
  }

  // ===========================================================================
  // 4. DOCTOR OPERATIONAL ANALYTICS
  // ===========================================================================

  async getDoctorAnalytics(user: AuthUser, filter: AnalyticsFilterDto) {
    const scope = await this.resolveTenantScope(user, filter);
    const range = this.parseOrgDateRange(filter, scope.timezone);
    const cacheKey = this.buildCacheKey('doctors', scope, range);
    return this.withCache(cacheKey, async () => {

    const branchWhere = { branchId: { in: scope.branchIds } };
    const doctorWhere = scope.forcedDoctorId
      ? { id: scope.forcedDoctorId }
      : {};

    const [doctors, appointments, consultations] = await Promise.all([
      this.prisma.doctor.findMany({
        where: { ...branchWhere, ...doctorWhere },
        select: { id: true, name: true, department: true, branchId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: {
          ...branchWhere,
          ...(scope.forcedDoctorId ? { doctorId: scope.forcedDoctorId } : {}),
          date: { gte: range.startStr, lte: range.endStr },
        },
        select: { doctorId: true, status: true, date: true },
      }),
      this.prisma.consultation.findMany({
        where: {
          ...branchWhere,
          ...(scope.forcedDoctorId ? { doctorId: scope.forcedDoctorId } : {}),
          status: { in: ['completed', 'signed', 'COMPLETED', 'SIGNED'] },
          createdAt: { gte: range.start, lte: range.end },
        },
        select: { doctorId: true, createdAt: true },
      }),
    ]);

    const metricsMap = new Map<
      string,
      {
        doctorId: string;
        doctorName: string;
        department: string;
        totalAppointments: number;
        completedAppointments: number;
        completedConsultations: number;
        cancelledAppointments: number;
        noShowCount: number;
      }
    >();

    for (const d of doctors) {
      metricsMap.set(d.id.toString(), {
        doctorId: d.id.toString(),
        doctorName: d.name,
        department: d.department || 'General',
        totalAppointments: 0,
        completedAppointments: 0,
        completedConsultations: 0,
        cancelledAppointments: 0,
        noShowCount: 0,
      });
    }

    for (const apt of appointments) {
      const key = apt.doctorId.toString();
      const entry = metricsMap.get(key);
      if (!entry) continue;
      entry.totalAppointments += 1;
      const s = (apt.status || '').toLowerCase();
      if (COMPLETED_APPT_STATUSES.includes(s)) {
        entry.completedAppointments += 1;
      } else if (CANCELLED_APPT_STATUSES.includes(s)) {
        entry.cancelledAppointments += 1;
      } else if (
        NO_SHOW_APPT_STATUSES.includes(s) &&
        apt.date <= range.todayStr
      ) {
        entry.noShowCount += 1;
      }
    }

    const consultTrendMap = new Map<string, number>();
    for (const c of consultations) {
      if (c.doctorId) {
        const entry = metricsMap.get(c.doctorId.toString());
        if (entry) entry.completedConsultations += 1;
      }
      if (c.createdAt) {
        const localDate = this.formatDateInTimezone(c.createdAt, scope.timezone);
        consultTrendMap.set(localDate, (consultTrendMap.get(localDate) || 0) + 1);
      }
    }

    const doctorOperationalMetrics = Array.from(metricsMap.values()).map((m) => {
      const activeAppts = Math.max(
        0,
        m.totalAppointments - m.cancelledAppointments,
      );
      const completionRate =
        activeAppts > 0
          ? this.round2((m.completedAppointments / activeAppts) * 100)
          : 0;
      const averageDailyConsultationVolume = this.round2(
        m.completedConsultations / range.dayCount,
      );
      return {
        ...m,
        averageDailyConsultationVolume,
        appointmentCompletionRatePercent: completionRate,
      };
    });

    const result = {
      meta: {
        startDate: range.startStr,
        endDate: range.endStr,
        notice:
          'Operational workload insights only; not clinical performance rankings.',
      },
      doctors: doctorOperationalMetrics,
      consultationTrend: Array.from(consultTrendMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
    };

      return result;
    });
  }

  // ===========================================================================
  // 5. FINANCIAL ANALYTICS (Phase 10.5.6 Authoritative Models & Decimal-Safe)
  // ===========================================================================

  private async computeFinancialTotals(
    scope: TenantScope,
    range: OrgDateRange,
  ) {
    const branchFilter = { branchId: { in: scope.branchIds } };

    const [invoicesInPeriod, paymentsInPeriod, refundsInPeriod, allUnsettledInvoices] =
      await Promise.all([
        this.prisma.payment.findMany({
          where: {
            organizationId: scope.organizationId,
            ...branchFilter,
            status: { notIn: EXCLUDED_INVOICE_STATUSES },
            date: { gte: range.startStr, lte: range.endStr },
          },
          select: {
            id: true,
            grossTotal: true,
            date: true,
            branchId: true,
            status: true,
          },
        }),
        this.prisma.invoicePayment.findMany({
          where: {
            organizationId: scope.organizationId,
            ...branchFilter,
            status: { in: VALID_PAYMENT_STATUSES },
            createdAt: { gte: range.start, lte: range.end },
          },
          select: {
            id: true,
            amount: true,
            method: true,
            branchId: true,
            createdAt: true,
          },
        }),
        this.prisma.invoiceRefund.findMany({
          where: {
            organizationId: scope.organizationId,
            ...branchFilter,
            refundedAt: { gte: range.start, lte: range.end },
          },
          select: {
            id: true,
            amount: true,
            refundedAt: true,
            branchId: true,
          },
        }),
        // Outstanding balance computed across all finalized non-cancelled/non-draft/non-refunded invoices in scope
        this.prisma.payment.findMany({
          where: {
            organizationId: scope.organizationId,
            ...branchFilter,
            status: {
              notIn: [...EXCLUDED_INVOICE_STATUSES, 'REFUNDED', 'paid', 'PAID'],
            },
          },
          select: {
            id: true,
            grossTotal: true,
            payments: {
              where: { status: { in: VALID_PAYMENT_STATUSES } },
              select: { amount: true },
            },
            refunds: {
              select: { amount: true },
            },
          },
        }),
      ]);

    let grossFinalizedDec = new Prisma.Decimal(0);
    for (const inv of invoicesInPeriod) {
      grossFinalizedDec = grossFinalizedDec.plus(inv.grossTotal);
    }

    let totalCollectedDec = new Prisma.Decimal(0);
    for (const pay of paymentsInPeriod) {
      totalCollectedDec = totalCollectedDec.plus(pay.amount);
    }

    let totalRefundsDec = new Prisma.Decimal(0);
    for (const ref of refundsInPeriod) {
      totalRefundsDec = totalRefundsDec.plus(ref.amount);
    }

    let outstandingDec = new Prisma.Decimal(0);
    for (const inv of allUnsettledInvoices) {
      let paidDec = new Prisma.Decimal(0);
      for (const p of inv.payments) {
        paidDec = paidDec.plus(p.amount);
      }
      let refDec = new Prisma.Decimal(0);
      for (const r of inv.refunds) {
        refDec = refDec.plus(r.amount);
      }
      const netPaid = paidDec.minus(refDec);
      const effectivePaid = netPaid.greaterThan(0) ? netPaid : new Prisma.Decimal(0);
      const bal = inv.grossTotal.minus(effectivePaid);
      if (bal.greaterThan(0.004)) {
        outstandingDec = outstandingDec.plus(bal);
      }
    }

    const netCollectedDec = totalCollectedDec.minus(totalRefundsDec);

    return {
      grossFinalizedInvoiceAmount: this.round2(grossFinalizedDec),
      totalCollectedPayments: this.round2(totalCollectedDec),
      refundTotals: this.round2(totalRefundsDec),
      netCollectedRevenue: this.round2(netCollectedDec),
      outstandingBalance: this.round2(outstandingDec),
      invoiceCount: invoicesInPeriod.length,
      invoicesInPeriod,
      paymentsInPeriod,
      refundsInPeriod,
    };
  }

  async getFinanceAnalytics(user: AuthUser, filter: AnalyticsFilterDto) {
    const scope = await this.resolveTenantScope(user, filter);
    if (!scope.canViewFinancials) {
      throw new ForbiddenException(
        'Insufficient permissions to access financial analytics.',
      );
    }

    const range = this.parseOrgDateRange(filter, scope.timezone);
    const granularity = filter.granularity || 'day';
    const cacheKey = this.buildCacheKey('finance', scope, range, granularity);
    return this.withCache(cacheKey, async () => {

    const fin = await this.computeFinancialTotals(scope, range);

    const invoiceIds = fin.invoicesInPeriod.map((i) => i.id);
    const lineItems =
      invoiceIds.length > 0
        ? await this.prisma.invoiceItem.findMany({
            where: { paymentId: { in: invoiceIds } },
            select: {
              lineTotal: true,
              paymentCategory: { select: { category: true } },
              doctor: { select: { id: true, name: true } },
            },
          })
        : [];

    // Daily/Monthly trends for invoiced vs collected vs refunds
    const trendMap = new Map<
      string,
      { invoiced: Prisma.Decimal; collected: Prisma.Decimal; refunded: Prisma.Decimal }
    >();
    const ensureTrend = (bucket: string) => {
      let entry = trendMap.get(bucket);
      if (!entry) {
        entry = {
          invoiced: new Prisma.Decimal(0),
          collected: new Prisma.Decimal(0),
          refunded: new Prisma.Decimal(0),
        };
        trendMap.set(bucket, entry);
      }
      return entry;
    };

    const branchRevMap = new Map<string, Prisma.Decimal>();
    for (const inv of fin.invoicesInPeriod) {
      const bucket = this.toBucketKey(inv.date, granularity);
      const t = ensureTrend(bucket);
      t.invoiced = t.invoiced.plus(inv.grossTotal);
    }

    const methodMap = new Map<string, { amount: Prisma.Decimal; count: number }>();
    for (const pay of fin.paymentsInPeriod) {
      const localDate = pay.createdAt
        ? this.formatDateInTimezone(pay.createdAt, scope.timezone)
        : range.startStr;
      const bucket = this.toBucketKey(localDate, granularity);
      const t = ensureTrend(bucket);
      t.collected = t.collected.plus(pay.amount);

      const mName = (pay.method || 'Cash').trim();
      const mEntry = methodMap.get(mName) || {
        amount: new Prisma.Decimal(0),
        count: 0,
      };
      mEntry.amount = mEntry.amount.plus(pay.amount);
      mEntry.count += 1;
      methodMap.set(mName, mEntry);

      const bKey = pay.branchId ? pay.branchId.toString() : 'unassigned';
      branchRevMap.set(
        bKey,
        (branchRevMap.get(bKey) || new Prisma.Decimal(0)).plus(pay.amount),
      );
    }

    for (const ref of fin.refundsInPeriod) {
      const localDate = this.formatDateInTimezone(ref.refundedAt, scope.timezone);
      const bucket = this.toBucketKey(localDate, granularity);
      const t = ensureTrend(bucket);
      t.refunded = t.refunded.plus(ref.amount);
    }

    const categoryMap = new Map<string, Prisma.Decimal>();
    const doctorRevMap = new Map<
      string,
      { doctorId: string; doctorName: string; amount: Prisma.Decimal }
    >();

    for (const item of lineItems) {
      const catName = item.paymentCategory?.category || 'General Services';
      categoryMap.set(
        catName,
        (categoryMap.get(catName) || new Prisma.Decimal(0)).plus(item.lineTotal),
      );

      if (item.doctor) {
        const dKey = item.doctor.id.toString();
        const dEntry = doctorRevMap.get(dKey) || {
          doctorId: dKey,
          doctorName: item.doctor.name,
          amount: new Prisma.Decimal(0),
        };
        dEntry.amount = dEntry.amount.plus(item.lineTotal);
        doctorRevMap.set(dKey, dEntry);
      }
    }

    const averageInvoiceValue =
      fin.invoiceCount > 0
        ? this.round2(fin.grossFinalizedInvoiceAmount / fin.invoiceCount)
        : 0;

    const result = {
      meta: {
        currency: scope.currency,
        startDate: range.startStr,
        endDate: range.endStr,
        granularity,
        formulas: {
          grossFinalizedInvoiceAmount:
            'SUM(Payment.grossTotal) WHERE status NOT IN (CANCELLED, DRAFT)',
          totalCollectedPayments:
            'SUM(InvoicePayment.amount) WHERE status IN (COMPLETED, PARTIALLY_REFUNDED, REFUNDED)',
          refundTotals: 'SUM(InvoiceRefund.amount)',
          netCollectedRevenue: 'totalCollectedPayments - refundTotals',
          outstandingBalance:
            'SUM(MAX(0, grossTotal - (collected - refunded))) across unsettled non-cancelled/non-draft invoices',
        },
      },
      summary: {
        grossFinalizedInvoiceAmount: fin.grossFinalizedInvoiceAmount,
        totalCollectedPayments: fin.totalCollectedPayments,
        refundTotals: fin.refundTotals,
        netCollectedRevenue: fin.netCollectedRevenue,
        outstandingBalance: fin.outstandingBalance,
        invoiceCount: fin.invoiceCount,
        averageInvoiceValue,
      },
      revenueTrend: Array.from(trendMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, val]) => ({
          date,
          invoiced: this.round2(val.invoiced),
          collected: this.round2(val.collected),
          refunded: this.round2(val.refunded),
        })),
      paymentMethodDistribution: Array.from(methodMap.entries()).map(
        ([method, val]) => ({
          method,
          amount: this.round2(val.amount),
          count: val.count,
        }),
      ),
      serviceCategoryRevenue: Array.from(categoryMap.entries())
        .map(([category, val]) => ({
          category,
          amount: this.round2(val),
        }))
        .sort((a, b) => b.amount - a.amount),
      branchRevenue: scope.branches.map((b) => ({
        branchId: b.id.toString(),
        branchName: b.name,
        branchCode: b.code,
        collectedAmount: this.round2(branchRevMap.get(b.id.toString())),
      })),
      doctorRevenue: Array.from(doctorRevMap.values())
        .map((d) => ({
          doctorId: d.doctorId,
          doctorName: d.doctorName,
          attributedBilledAmount: this.round2(d.amount),
        }))
        .sort((a, b) => b.attributedBilledAmount - a.attributedBilledAmount),
    };

      return result;
    });
  }

  // ===========================================================================
  // 6. LABORATORY ANALYTICS (Phase 10.5.5)
  // ===========================================================================

  async getLaboratoryAnalytics(user: AuthUser, filter: AnalyticsFilterDto) {
    const scope = await this.resolveTenantScope(user, filter);
    const range = this.parseOrgDateRange(filter, scope.timezone);
    const cacheKey = this.buildCacheKey('laboratory', scope, range);
    return this.withCache(cacheKey, async () => {

    const orders = await this.prisma.lab.findMany({
      where: {
        organizationId: scope.organizationId,
        branchId: { in: scope.branchIds },
        ...(scope.forcedDoctorId ? { doctorId: scope.forcedDoctorId } : {}),
        createdAt: { gte: range.start, lte: range.end },
      },
      select: {
        id: true,
        status: true,
        branchId: true,
        categoryName: true,
        createdAt: true,
        verifiedAt: true,
        approvedAt: true,
        completedAt: true,
        samples: {
          select: {
            status: true,
            isRecollection: true,
            rejectedAt: true,
          },
        },
      },
    });

    const statusMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    const branchActivityMap = new Map<string, number>();

    let completedReports = 0;
    let pendingReports = 0;
    let tatTotalHours = 0;
    let tatCount = 0;
    let rejectedSamples = 0;
    let recollectionCount = 0;

    for (const o of orders) {
      const s = (o.status || 'UNKNOWN').toUpperCase();
      statusMap.set(s, (statusMap.get(s) || 0) + 1);

      if (['COMPLETED', 'APPROVED', 'VERIFIED'].includes(s)) {
        completedReports += 1;
        const finishAt = o.approvedAt || o.completedAt || o.verifiedAt;
        if (finishAt && o.createdAt && finishAt >= o.createdAt) {
          const hrs =
            (finishAt.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60);
          tatTotalHours += hrs;
          tatCount += 1;
        }
      } else if (s !== 'CANCELLED') {
        pendingReports += 1;
      }

      const cats = (o.categoryName || 'Uncategorized')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      for (const cat of cats.length > 0 ? cats : ['Uncategorized']) {
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
      }

      const bKey = o.branchId ? o.branchId.toString() : 'unassigned';
      branchActivityMap.set(bKey, (branchActivityMap.get(bKey) || 0) + 1);

      for (const sample of o.samples) {
        if (sample.status === 'REJECTED' || sample.rejectedAt !== null) {
          rejectedSamples += 1;
        }
        if (sample.isRecollection) {
          recollectionCount += 1;
        }
      }
    }

    const result = {
      meta: {
        startDate: range.startStr,
        endDate: range.endStr,
      },
      summary: {
        totalLabOrders: orders.length,
        completedReports,
        pendingReports,
        averageTurnaroundHours:
          tatCount > 0 ? this.round2(tatTotalHours / tatCount) : 0,
        rejectedSamples,
        recollectionCount,
      },
      ordersByStatus: Array.from(statusMap.entries()).map(([status, count]) => ({
        status,
        count,
      })),
      testsByCategory: Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      branchActivity: scope.branches.map((b) => ({
        branchId: b.id.toString(),
        branchName: b.name,
        branchCode: b.code,
        orderCount: branchActivityMap.get(b.id.toString()) || 0,
      })),
    };

      return result;
    });
  }

  // ===========================================================================
  // 7. PHARMACY ANALYTICS (Phase 10.5.7 Authoritative Inventory Rules)
  // ===========================================================================

  async getPharmacyAnalytics(user: AuthUser, filter: AnalyticsFilterDto) {
    const scope = await this.resolveTenantScope(user, filter);
    const range = this.parseOrgDateRange(filter, scope.timezone);
    const granularity = filter.granularity || 'day';
    const cacheKey = this.buildCacheKey('pharmacy', scope, range, granularity);
    return this.withCache(cacheKey, async () => {

    const now = new Date();
    const sixtyDaysAhead = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const branchWhere = {
      organizationId: scope.organizationId,
      branchId: { in: scope.branchIds },
    };

    const [
      activeMedicines,
      batches,
      dispensations,
      goodsReceipts,
      purchaseOrders,
    ] = await Promise.all([
      this.prisma.medicine.findMany({
        where: { isActive: true },
        select: { id: true, name: true, reorderLevel: true },
      }),
      this.prisma.medicineBatch.findMany({
        where: branchWhere,
        select: {
          id: true,
          medicineId: true,
          branchId: true,
          currentQuantity: true,
          costPrice: true,
          sellingPrice: true,
          expiryDate: true,
          status: true,
        },
      }),
      this.prisma.pharmacyDispensation.findMany({
        where: {
          ...branchWhere,
          status: 'COMPLETED',
          createdAt: { gte: range.start, lte: range.end },
        },
        select: {
          id: true,
          totalAmount: true,
          createdAt: true,
          items: { select: { quantity: true } },
        },
      }),
      this.prisma.goodsReceipt.findMany({
        where: {
          ...branchWhere,
          createdAt: { gte: range.start, lte: range.end },
        },
        select: { totalAmount: true, createdAt: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          ...branchWhere,
          status: { not: 'CANCELLED' },
          createdAt: { gte: range.start, lte: range.end },
        },
        select: { totalAmount: true, status: true },
      }),
    ]);

    const medQtyMap = new Map<string, number>();
    let expiringBatchCount = 0;
    let expiredBatchCount = 0;
    let costValuationDec = new Prisma.Decimal(0);
    let retailValuationDec = new Prisma.Decimal(0);
    const branchStockMap = new Map<
      string,
      { units: number; costValue: Prisma.Decimal }
    >();

    for (const b of batches) {
      const isExpired = b.status === 'EXPIRED' || b.expiryDate < now;
      if (b.currentQuantity > 0 && isExpired) {
        expiredBatchCount += 1;
      } else if (
        b.status === 'ACTIVE' &&
        b.currentQuantity > 0 &&
        b.expiryDate >= now &&
        b.expiryDate <= sixtyDaysAhead
      ) {
        expiringBatchCount += 1;
      }

      if (b.status === 'ACTIVE' && b.currentQuantity > 0 && !isExpired) {
        const mKey = b.medicineId.toString();
        medQtyMap.set(mKey, (medQtyMap.get(mKey) || 0) + b.currentQuantity);

        const qtyDec = new Prisma.Decimal(b.currentQuantity);
        const batchCost = qtyDec.times(b.costPrice);
        const unitSell = b.sellingPrice ?? b.costPrice;
        const batchRetail = qtyDec.times(unitSell);

        costValuationDec = costValuationDec.plus(batchCost);
        retailValuationDec = retailValuationDec.plus(batchRetail);

        const brKey = b.branchId ? b.branchId.toString() : 'unassigned';
        const brEntry = branchStockMap.get(brKey) || {
          units: 0,
          costValue: new Prisma.Decimal(0),
        };
        brEntry.units += b.currentQuantity;
        brEntry.costValue = brEntry.costValue.plus(batchCost);
        branchStockMap.set(brKey, brEntry);
      }
    }

    let lowStockMedicineCount = 0;
    for (const med of activeMedicines) {
      const qty = medQtyMap.get(med.id.toString()) || 0;
      if (qty <= med.reorderLevel) {
        lowStockMedicineCount += 1;
      }
    }

    let dispensingUnits = 0;
    let pharmacyRevenueDec = new Prisma.Decimal(0);
    const salesTrendMap = new Map<
      string,
      { revenue: Prisma.Decimal; dispensations: number }
    >();

    for (const d of dispensations) {
      pharmacyRevenueDec = pharmacyRevenueDec.plus(d.totalAmount);
      for (const item of d.items) {
        dispensingUnits += item.quantity;
      }
      if (d.createdAt) {
        const localDate = this.formatDateInTimezone(d.createdAt, scope.timezone);
        const bucket = this.toBucketKey(localDate, granularity);
        const sEntry = salesTrendMap.get(bucket) || {
          revenue: new Prisma.Decimal(0),
          dispensations: 0,
        };
        sEntry.revenue = sEntry.revenue.plus(d.totalAmount);
        sEntry.dispensations += 1;
        salesTrendMap.set(bucket, sEntry);
      }
    }

    let receivedTotalDec = new Prisma.Decimal(0);
    const receivingTrendMap = new Map<string, Prisma.Decimal>();
    for (const gr of goodsReceipts) {
      receivedTotalDec = receivedTotalDec.plus(gr.totalAmount);
      if (gr.createdAt) {
        const localDate = this.formatDateInTimezone(gr.createdAt, scope.timezone);
        const bucket = this.toBucketKey(localDate, granularity);
        receivingTrendMap.set(
          bucket,
          (receivingTrendMap.get(bucket) || new Prisma.Decimal(0)).plus(
            gr.totalAmount,
          ),
        );
      }
    }

    let poTotalDec = new Prisma.Decimal(0);
    for (const po of purchaseOrders) {
      poTotalDec = poTotalDec.plus(po.totalAmount);
    }

    const result = {
      meta: {
        currency: scope.currency,
        startDate: range.startStr,
        endDate: range.endStr,
        granularity,
      },
      summary: {
        medicineCatalogueCount: activeMedicines.length,
        lowStockMedicineCount,
        expiringBatchCount,
        expiredBatchCount,
        dispensingCount: dispensations.length,
        dispensingUnits,
        pharmacyRevenue: this.round2(pharmacyRevenueDec),
        stockCostValuation: this.round2(costValuationDec),
        stockRetailValuation: this.round2(retailValuationDec),
        purchaseOrderTotal: this.round2(poTotalDec),
        goodsReceivedTotal: this.round2(receivedTotalDec),
      },
      salesTrend: Array.from(salesTrendMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, val]) => ({
          date,
          revenue: this.round2(val.revenue),
          dispensations: val.dispensations,
        })),
      receivingTrend: Array.from(receivingTrendMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, val]) => ({
          date,
          amount: this.round2(val),
        })),
      branchStockDistribution: scope.branches.map((b) => {
        const entry = branchStockMap.get(b.id.toString());
        return {
          branchId: b.id.toString(),
          branchName: b.name,
          branchCode: b.code,
          totalUnits: entry?.units || 0,
          costValuation: this.round2(entry?.costValue),
        };
      }),
    };

      return result;
    });
  }

  // ===========================================================================
  // 8. FOLLOW-UP & NOTIFICATION DELIVERY ANALYTICS (Phase 10.5.8)
  // ===========================================================================

  async getFollowUpAnalytics(user: AuthUser, filter: AnalyticsFilterDto) {
    const scope = await this.resolveTenantScope(user, filter);
    const range = this.parseOrgDateRange(filter, scope.timezone);
    const cacheKey = this.buildCacheKey('follow-ups', scope, range);
    return this.withCache(cacheKey, async () => {

    const todayDate = this.zonedLocalToUtcDate(
      range.todayStr,
      '00:00:00.000',
      scope.timezone,
    );

    const [followUps, deliveries] = await Promise.all([
      this.prisma.followUp.findMany({
        where: {
          organizationId: scope.organizationId,
          branchId: { in: scope.branchIds },
          ...(scope.forcedDoctorId ? { doctorId: scope.forcedDoctorId } : {}),
          dueDate: { gte: range.start, lte: range.end },
        },
        select: { status: true, dueDate: true, priority: true },
      }),
      // Authoritative provider delivery evidence only (NOT queued outbox items)
      this.prisma.notificationDelivery.findMany({
        where: {
          notification: {
            organizationId: scope.organizationId,
            branchId: { in: scope.branchIds },
          },
          sentAt: { gte: range.start, lte: range.end },
        },
        select: { status: true, channel: true },
      }),
    ]);

    let scheduled = 0;
    let completed = 0;
    let missed = 0;
    let cancelled = 0;
    let upcoming = 0;

    for (const f of followUps) {
      if (f.status === 'COMPLETED') {
        completed += 1;
      } else if (f.status === 'MISSED') {
        missed += 1;
      } else if (f.status === 'CANCELLED') {
        cancelled += 1;
      } else {
        scheduled += 1;
        if (f.dueDate >= todayDate) {
          upcoming += 1;
        }
      }
    }

    const followUpDenominator = scheduled + completed + missed;
    const followUpCompletionRate =
      followUpDenominator > 0
        ? this.round2((completed / followUpDenominator) * 100)
        : 0;

    let deliverySuccess = 0;
    let deliveryFailure = 0;
    const channelStats = new Map<
      string,
      { success: number; failure: number }
    >();

    for (const d of deliveries) {
      const ch = d.channel || 'UNKNOWN';
      const entry = channelStats.get(ch) || { success: 0, failure: 0 };
      if (d.status === 'SUCCESS') {
        deliverySuccess += 1;
        entry.success += 1;
      } else {
        deliveryFailure += 1;
        entry.failure += 1;
      }
      channelStats.set(ch, entry);
    }

    const totalDeliveries = deliverySuccess + deliveryFailure;
    const deliverySuccessRate =
      totalDeliveries > 0
        ? this.round2((deliverySuccess / totalDeliveries) * 100)
        : 0;

    const result = {
      meta: {
        startDate: range.startStr,
        endDate: range.endStr,
      },
      clinicalFollowUps: {
        totalFollowUps: followUps.length,
        scheduledFollowUps: scheduled,
        completedFollowUps: completed,
        missedFollowUps: missed,
        cancelledFollowUps: cancelled,
        upcomingFollowUps: upcoming,
        completionRatePercent: followUpCompletionRate,
      },
      notificationDeliveryEvidence: {
        totalProviderAttempts: totalDeliveries,
        successCount: deliverySuccess,
        failureCount: deliveryFailure,
        deliverySuccessRatePercent: deliverySuccessRate,
        byChannel: Array.from(channelStats.entries()).map(([channel, val]) => ({
          channel,
          success: val.success,
          failure: val.failure,
        })),
      },
    };

      return result;
    });
  }

  // ===========================================================================
  // 9. BRANCH COMPARISON ANALYTICS
  // ===========================================================================

  async getBranchAnalytics(user: AuthUser, filter: AnalyticsFilterDto) {
    const scope = await this.resolveTenantScope(user, filter);
    const range = this.parseOrgDateRange(filter, scope.timezone);
    const cacheKey = this.buildCacheKey('branches', scope, range);
    return this.withCache(cacheKey, async () => {

    const branchIds = scope.branches.map((b) => b.id);

    const [patientsByBranch, apptsByBranch, labsByBranch, paymentsByBranch] =
      await Promise.all([
        this.prisma.patient.groupBy({
          by: ['branchId'],
          where: { branchId: { in: branchIds } },
          _count: { _all: true },
        }),
        this.prisma.appointment.findMany({
          where: {
            branchId: { in: branchIds },
            date: { gte: range.startStr, lte: range.endStr },
          },
          select: { branchId: true, status: true },
        }),
        this.prisma.lab.groupBy({
          by: ['branchId'],
          where: {
            organizationId: scope.organizationId,
            branchId: { in: branchIds },
            createdAt: { gte: range.start, lte: range.end },
          },
          _count: { _all: true },
        }),
        scope.canViewFinancials
          ? this.prisma.invoicePayment.groupBy({
              by: ['branchId'],
              where: {
                organizationId: scope.organizationId,
                branchId: { in: branchIds },
                status: { in: VALID_PAYMENT_STATUSES },
                createdAt: { gte: range.start, lte: range.end },
              },
              _sum: { amount: true },
            })
          : Promise.resolve([]),
      ]);

    const patientCountMap = new Map<string, number>();
    for (const p of patientsByBranch) {
      if (p.branchId) patientCountMap.set(p.branchId.toString(), p._count._all);
    }

    const labCountMap = new Map<string, number>();
    for (const l of labsByBranch) {
      if (l.branchId) labCountMap.set(l.branchId.toString(), l._count._all);
    }

    const revMap = new Map<string, number>();
    for (const pay of paymentsByBranch) {
      if (pay.branchId) {
        revMap.set(pay.branchId.toString(), this.round2(pay._sum.amount));
      }
    }

    const apptMap = new Map<string, { total: number; completed: number }>();
    for (const a of apptsByBranch) {
      if (!a.branchId) continue;
      const key = a.branchId.toString();
      const entry = apptMap.get(key) || { total: 0, completed: 0 };
      entry.total += 1;
      if (COMPLETED_APPT_STATUSES.includes((a.status || '').toLowerCase())) {
        entry.completed += 1;
      }
      apptMap.set(key, entry);
    }

    const branches = scope.branches.map((b) => {
      const idStr = b.id.toString();
      const appt = apptMap.get(idStr) || { total: 0, completed: 0 };
      return {
        branchId: idStr,
        branchName: b.name,
        branchCode: b.code,
        registeredPatients: patientCountMap.get(idStr) || 0,
        appointmentsInPeriod: appt.total,
        completedAppointments: appt.completed,
        labOrdersInPeriod: labCountMap.get(idStr) || 0,
        collectedRevenue: scope.canViewFinancials ? revMap.get(idStr) || 0 : null,
      };
    });

    const result = {
      meta: {
        startDate: range.startStr,
        endDate: range.endStr,
        currency: scope.currency,
      },
      branches,
    };

      return result;
    });
  }

  // ===========================================================================
  // 10. AUTHORIZED CSV EXPORT WITH FORMULA-INJECTION PROTECTION
  // ===========================================================================

  private sanitizeCsvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    let str = String(value).replace(/\r?\n/g, ' ');
    // Neutralize CSV formula injection (=, +, -, @, tab, CR)
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    if (str.includes(',') || str.includes('"') || str.includes("'")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private buildCsv(headers: string[], rows: Array<Array<unknown>>): string {
    const lines = [headers.map((h) => this.sanitizeCsvCell(h)).join(',')];
    for (const row of rows) {
      lines.push(row.map((cell) => this.sanitizeCsvCell(cell)).join(','));
    }
    return lines.join('\r\n');
  }

  async exportAnalyticsCsv(
    user: AuthUser,
    domain: AnalyticsDomain,
    filter: AnalyticsFilterDto,
  ): Promise<{ filename: string; csv: string }> {
    const scope = await this.resolveTenantScope(user, filter);
    const range = this.parseOrgDateRange(filter, scope.timezone);

    // Audit export attempt
    try {
      await this.prisma.platformAuditLog.create({
        data: {
          actorUserId: BigInt(user.id),
          actorEmail: user.email,
          actorRole: user.group,
          action: 'ANALYTICS_CSV_EXPORT',
          targetType: 'AnalyticsDomain',
          targetId: domain,
          details: {
            organizationId: scope.organizationId.toString(),
            branchIds: scope.branchIds.map((b) => b.toString()),
            startDate: range.startStr,
            endDate: range.endStr,
          },
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to audit analytics export: ${err}`);
    }

    let csv = '';
    if (domain === 'finance') {
      const data = await this.getFinanceAnalytics(user, filter);
      csv = this.buildCsv(
        ['Date', 'Invoiced (INR)', 'Collected (INR)', 'Refunded (INR)'],
        data.revenueTrend.map((r) => [r.date, r.invoiced, r.collected, r.refunded]),
      );
    } else if (domain === 'appointments') {
      const data = await this.getAppointmentAnalytics(user, filter);
      csv = this.buildCsv(
        ['Date', 'Total', 'Completed', 'Cancelled', 'No-Show', 'Scheduled'],
        data.volumeTrend.map((r) => [
          r.date,
          r.total,
          r.completed,
          r.cancelled,
          r.noShow,
          r.scheduled,
        ]),
      );
    } else if (domain === 'doctors') {
      const data = await this.getDoctorAnalytics(user, filter);
      csv = this.buildCsv(
        [
          'Doctor',
          'Department',
          'Total Appointments',
          'Completed Consultations',
          'Cancelled',
          'No-Show',
          'Avg Daily Consultations',
          'Completion Rate %',
        ],
        data.doctors.map((d) => [
          d.doctorName,
          d.department,
          d.totalAppointments,
          d.completedConsultations,
          d.cancelledAppointments,
          d.noShowCount,
          d.averageDailyConsultationVolume,
          d.appointmentCompletionRatePercent,
        ]),
      );
    } else if (domain === 'patients') {
      const data = await this.getPatientAnalytics(user, filter);
      csv = this.buildCsv(
        ['Date', 'New Registrations'],
        data.registrationTrend.map((r) => [r.date, r.count]),
      );
    } else if (domain === 'laboratory') {
      const data = await this.getLaboratoryAnalytics(user, filter);
      csv = this.buildCsv(
        ['Category', 'Order Count'],
        data.testsByCategory.map((c) => [c.category, c.count]),
      );
    } else if (domain === 'pharmacy') {
      const data = await this.getPharmacyAnalytics(user, filter);
      csv = this.buildCsv(
        ['Branch', 'Code', 'Total Units', 'Cost Valuation (INR)'],
        data.branchStockDistribution.map((b) => [
          b.branchName,
          b.branchCode,
          b.totalUnits,
          b.costValuation,
        ]),
      );
    } else if (domain === 'follow-ups') {
      const data = await this.getFollowUpAnalytics(user, filter);
      csv = this.buildCsv(
        ['Metric', 'Value'],
        [
          ['Total Follow-ups', data.clinicalFollowUps.totalFollowUps],
          ['Scheduled', data.clinicalFollowUps.scheduledFollowUps],
          ['Completed', data.clinicalFollowUps.completedFollowUps],
          ['Missed', data.clinicalFollowUps.missedFollowUps],
          ['Upcoming', data.clinicalFollowUps.upcomingFollowUps],
          ['Completion Rate %', data.clinicalFollowUps.completionRatePercent],
          [
            'Provider Delivery Success %',
            data.notificationDeliveryEvidence.deliverySuccessRatePercent,
          ],
        ],
      );
    } else if (domain === 'branches') {
      const data = await this.getBranchAnalytics(user, filter);
      csv = this.buildCsv(
        [
          'Branch',
          'Code',
          'Registered Patients',
          'Appointments',
          'Completed Appointments',
          'Lab Orders',
          'Collected Revenue (INR)',
        ],
        data.branches.map((b) => [
          b.branchName,
          b.branchCode,
          b.registeredPatients,
          b.appointmentsInPeriod,
          b.completedAppointments,
          b.labOrdersInPeriod,
          b.collectedRevenue ?? 'Restricted',
        ]),
      );
    } else {
      const data = await this.getOverview(user, filter);
      const p = data.periodKpis as Record<string, unknown>;
      const c = data.cumulativeKpis as Record<string, unknown>;
      csv = this.buildCsv(
        ['Metric', 'Type', 'Value'],
        [
          ['Total Registered Patients', 'Cumulative', c.totalRegisteredPatients],
          ['Active Doctors', 'Cumulative', c.activeDoctors],
          ['New Patients', 'Date Range', p.newPatients],
          ['Total Appointments', 'Date Range', p.totalAppointments],
          ['Completed Appointments', 'Date Range', p.completedAppointments],
          ['Cancelled Appointments', 'Date Range', p.cancelledAppointments],
          ['No-Show Appointments', 'Date Range', p.noShowAppointments],
          ['Average Daily Appointments', 'Date Range', p.averageDailyAppointments],
          ['Follow-ups Due', 'Date Range', p.followUpsDue],
          [
            'Total Invoiced Amount',
            'Date Range',
            p.totalInvoicedAmount ?? 'Restricted',
          ],
          [
            'Total Collected Payments',
            'Date Range',
            p.totalCollectedPayments ?? 'Restricted',
          ],
          [
            'Outstanding Invoice Balance',
            'Cumulative Unsettled',
            p.outstandingInvoiceBalance ?? 'Restricted',
          ],
        ],
      );
    }

    return {
      filename: `medora-analytics-${domain}-${range.startStr}-to-${range.endStr}.csv`,
      csv,
    };
  }
}
