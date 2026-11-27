import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  CalendarCheck,
  Download,
  IndianRupee,
  Microscope,
  Package,
  RefreshCw,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  BarComparisonChart,
  DonutBreakdownChart,
  formatIndianNumber,
  formatINR,
  TrendLineChart,
} from './AnalyticsCharts';

type PeriodKey = 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'last90Days' | 'custom';
type GranularityKey = 'day' | 'week' | 'month';
type AnalyticsTab =
  | 'overview'
  | 'patients'
  | 'appointments'
  | 'doctors'
  | 'finance'
  | 'laboratory'
  | 'pharmacy'
  | 'follow-ups'
  | 'branches';

interface OverviewResponse {
  meta: {
    organizationId: string;
    timezone: string;
    currency: string;
    period: string;
    startDate: string;
    endDate: string;
    dayCount: number;
    branchCount: number;
  };
  cumulativeKpis: {
    totalRegisteredPatients: number;
    activeDoctors: number;
  };
  periodKpis: {
    newPatients: number;
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
    averageDailyAppointments: number;
    followUpsDue: number;
    totalInvoicedAmount: number | null;
    totalCollectedPayments: number | null;
    outstandingInvoiceBalance: number | null;
  };
}

interface PatientsResponse {
  summary: {
    totalRegisteredPatients: number;
    newPatientsInPeriod: number;
    activePatientsInPeriod: number;
    newVisitingPatients: number;
    returningVisitingPatients: number;
  };
  registrationTrend: Array<{ date: string; count: number }>;
  revisitTrend: Array<{ date: string; newPatients: number; returningPatients: number }>;
  branchDistribution: Array<{ branchId: string; branchName: string; branchCode: string; patientCount: number }>;
  ageGroupDistribution: Array<{ group: string; count: number }>;
  genderDistribution: Array<{ gender: string; count: number }>;
}

interface AppointmentsResponse {
  meta: {
    noShowDenominatorDefinition: string;
  };
  summary: {
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
    noShowDenominator: number;
    noShowRatePercent: number;
    workingDaysWithAppointments: number;
    averageAppointmentsPerWorkingDay: number;
  };
  volumeTrend: Array<{
    date: string;
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    scheduled: number;
  }>;
  statusDistribution: Array<{ status: string; count: number }>;
  typeDistribution: Array<{ type: string; count: number }>;
  peakHours: Array<{ hour: number; label: string; count: number }>;
  doctorVolume: Array<{ doctorId: string; doctorName: string; department: string; count: number }>;
  branchVolume: Array<{ branchId: string; branchName: string; count: number }>;
}

interface DoctorsResponse {
  meta: { notice: string };
  doctors: Array<{
    doctorId: string;
    doctorName: string;
    department: string;
    totalAppointments: number;
    completedAppointments: number;
    completedConsultations: number;
    cancelledAppointments: number;
    noShowCount: number;
    averageDailyConsultationVolume: number;
    appointmentCompletionRatePercent: number;
  }>;
  consultationTrend: Array<{ date: string; count: number }>;
}

interface FinanceResponse {
  meta: {
    formulas: Record<string, string>;
  };
  summary: {
    grossFinalizedInvoiceAmount: number;
    totalCollectedPayments: number;
    refundTotals: number;
    netCollectedRevenue: number;
    outstandingBalance: number;
    invoiceCount: number;
    averageInvoiceValue: number;
  };
  revenueTrend: Array<{ date: string; invoiced: number; collected: number; refunded: number }>;
  paymentMethodDistribution: Array<{ method: string; amount: number; count: number }>;
  serviceCategoryRevenue: Array<{ category: string; amount: number }>;
  branchRevenue: Array<{ branchId: string; branchName: string; collectedAmount: number }>;
  doctorRevenue: Array<{ doctorId: string; doctorName: string; attributedBilledAmount: number }>;
}

interface LaboratoryResponse {
  summary: {
    totalLabOrders: number;
    completedReports: number;
    pendingReports: number;
    averageTurnaroundHours: number;
    rejectedSamples: number;
    recollectionCount: number;
  };
  ordersByStatus: Array<{ status: string; count: number }>;
  testsByCategory: Array<{ category: string; count: number }>;
  branchActivity: Array<{ branchId: string; branchName: string; orderCount: number }>;
}

interface PharmacyResponse {
  summary: {
    medicineCatalogueCount: number;
    lowStockMedicineCount: number;
    expiringBatchCount: number;
    expiredBatchCount: number;
    dispensingCount: number;
    dispensingUnits: number;
    pharmacyRevenue: number;
    stockCostValuation: number;
    stockRetailValuation: number;
    purchaseOrderTotal: number;
    goodsReceivedTotal: number;
  };
  salesTrend: Array<{ date: string; revenue: number; dispensations: number }>;
  receivingTrend: Array<{ date: string; amount: number }>;
  branchStockDistribution: Array<{ branchId: string; branchName: string; totalUnits: number; costValuation: number }>;
}

interface FollowUpsResponse {
  clinicalFollowUps: {
    totalFollowUps: number;
    scheduledFollowUps: number;
    completedFollowUps: number;
    missedFollowUps: number;
    cancelledFollowUps: number;
    upcomingFollowUps: number;
    completionRatePercent: number;
  };
  notificationDeliveryEvidence: {
    totalProviderAttempts: number;
    successCount: number;
    failureCount: number;
    deliverySuccessRatePercent: number;
    byChannel: Array<{ channel: string; success: number; failure: number }>;
  };
}

interface BranchesResponse {
  branches: Array<{
    branchId: string;
    branchName: string;
    branchCode: string;
    registeredPatients: number;
    appointmentsInPeriod: number;
    completedAppointments: number;
    labOrdersInPeriod: number;
    collectedRevenue: number | null;
  }>;
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface DoctorOption {
  id: string;
  name: string;
  department?: string;
}

const STATUS_COLORS = ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#64748b'];

const KpiCard: React.FC<{
  label: string;
  value: string;
  badge: 'Cumulative' | 'Date Range';
  subtext?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}> = ({ label, value, badge, subtext, tone = 'default' }) => {
  const toneBorder =
    tone === 'success'
      ? 'border-l-emerald-500'
      : tone === 'warning'
        ? 'border-l-amber-500'
        : tone === 'danger'
          ? 'border-l-rose-500'
          : tone === 'info'
            ? 'border-l-sky-500'
            : 'border-l-slate-300';

  return (
    <div
      className={`rounded-xl border border-slate-200 border-l-4 ${toneBorder} bg-white p-4 shadow-sm`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            badge === 'Cumulative'
              ? 'bg-slate-100 text-slate-600'
              : 'bg-sky-50 text-sky-700'
          }`}
        >
          {badge}
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      {subtext && <div className="mt-1 text-[11px] text-slate-500">{subtext}</div>}
    </div>
  );
};

export const ClinicAnalyticsWorkspace: React.FC = () => {
  const { token, apiBaseUrl, userPermissions, userRole, activeBranchId } = useAuth();

  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [period, setPeriod] = useState<PeriodKey>('last30Days');
  const [granularity, setGranularity] = useState<GranularityKey>('day');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState<string>(activeBranchId || 'all');
  const [doctorId, setDoctorId] = useState<string>('');

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [overviewData, setOverviewData] = useState<OverviewResponse | null>(null);
  const [patientsData, setPatientsData] = useState<PatientsResponse | null>(null);
  const [appointmentsData, setAppointmentsData] = useState<AppointmentsResponse | null>(null);
  const [doctorsData, setDoctorsData] = useState<DoctorsResponse | null>(null);
  const [financeData, setFinanceData] = useState<FinanceResponse | null>(null);
  const [labData, setLabData] = useState<LaboratoryResponse | null>(null);
  const [pharmacyData, setPharmacyData] = useState<PharmacyResponse | null>(null);
  const [followUpsData, setFollowUpsData] = useState<FollowUpsResponse | null>(null);
  const [branchesData, setBranchesData] = useState<BranchesResponse | null>(null);

  const perms = useMemo(() => new Set(userPermissions || []), [userPermissions]);
  const isAdmin =
    userRole === 'Hospital Admin' ||
    userRole === 'Organization Admin' ||
    userRole === 'Clinic Admin';
  const canFinance =
    isAdmin ||
    userRole === 'Accountant' ||
    perms.has('dashboard_financial_view') ||
    perms.has('financial_reports');
  const canLab = isAdmin || userRole === 'Laboratorist' || perms.has('lab_reports');
  const canPharmacy = isAdmin || userRole === 'Pharmacist' || perms.has('pharmacy_reports');
  const canBranches = isAdmin || perms.has('dashboard_branch_compare');
  const isDoctorOnly = userRole === 'Doctor' && !isAdmin;

  const availableTabs = useMemo(() => {
    const tabs: Array<{ id: AnalyticsTab; label: string; icon: React.FC<{ className?: string }> }> = [
      { id: 'overview', label: 'Overview', icon: BarChart3 },
      { id: 'patients', label: 'Patients', icon: Users },
      { id: 'appointments', label: 'Appointments', icon: Calendar },
      { id: 'doctors', label: 'Doctors', icon: Stethoscope },
    ];
    if (canFinance) tabs.push({ id: 'finance', label: 'Finance', icon: IndianRupee });
    if (canLab) tabs.push({ id: 'laboratory', label: 'Laboratory', icon: Microscope });
    if (canPharmacy) tabs.push({ id: 'pharmacy', label: 'Pharmacy', icon: Package });
    tabs.push({ id: 'follow-ups', label: 'Follow-ups', icon: CalendarCheck });
    if (canBranches) tabs.push({ id: 'branches', label: 'Branches', icon: Building2 });
    return tabs;
  }, [canFinance, canLab, canPharmacy, canBranches]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('period', period);
    params.set('granularity', granularity);
    if (period === 'custom') {
      params.set('startDate', startDate);
      params.set('endDate', endDate);
    }
    if (branchId && branchId !== 'all') params.set('branchId', branchId);
    if (doctorId && !isDoctorOnly) params.set('doctorId', doctorId);
    return params.toString();
  }, [period, granularity, startDate, endDate, branchId, doctorId, isDoctorOnly]);

  const fetchJson = useCallback(
    async <T,>(path: string): Promise<T> => {
      const res = await fetch(`${apiBaseUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || `Request failed (${res.status})`);
      }
      return (json?.data !== undefined ? json.data : json) as T;
    },
    [apiBaseUrl, token],
  );

  // Load filter metadata (branches & doctors)
  useEffect(() => {
    if (!token) return;
    const loadMetadata = async () => {
      try {
        const branchList = await fetchJson<Array<{ id: string; name: string; code: string }>>(
          '/branches',
        ).catch(() => []);
        if (Array.isArray(branchList)) {
          setBranches(branchList.map((b) => ({ id: String(b.id), name: b.name, code: b.code })));
        }
        if (!isDoctorOnly) {
          const docRes = await fetchJson<{ data?: DoctorOption[] } | DoctorOption[]>(
            '/doctors?limit=100',
          ).catch(() => []);
          const list = Array.isArray(docRes) ? docRes : docRes?.data || [];
          setDoctors(list.map((d) => ({ id: String(d.id), name: d.name, department: d.department })));
        }
      } catch {
        // Non-fatal metadata load failure
      }
    };
    loadMetadata();
  }, [token, fetchJson, isDoctorOnly]);

  const loadTab = useCallback(async () => {
    if (!token) return;
    if (period === 'custom' && (!startDate || !endDate)) return;

    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'overview') {
        const [ov, appts, fin] = await Promise.all([
          fetchJson<OverviewResponse>(`/analytics/overview?${queryParams}`),
          fetchJson<AppointmentsResponse>(`/analytics/appointments?${queryParams}`),
          canFinance
            ? fetchJson<FinanceResponse>(`/analytics/finance?${queryParams}`).catch(() => null)
            : Promise.resolve(null),
        ]);
        setOverviewData(ov);
        setAppointmentsData(appts);
        if (fin) setFinanceData(fin);
      } else if (activeTab === 'patients') {
        setPatientsData(await fetchJson<PatientsResponse>(`/analytics/patients?${queryParams}`));
      } else if (activeTab === 'appointments') {
        setAppointmentsData(
          await fetchJson<AppointmentsResponse>(`/analytics/appointments?${queryParams}`),
        );
      } else if (activeTab === 'doctors') {
        setDoctorsData(await fetchJson<DoctorsResponse>(`/analytics/doctors?${queryParams}`));
      } else if (activeTab === 'finance') {
        setFinanceData(await fetchJson<FinanceResponse>(`/analytics/finance?${queryParams}`));
      } else if (activeTab === 'laboratory') {
        setLabData(await fetchJson<LaboratoryResponse>(`/analytics/laboratory?${queryParams}`));
      } else if (activeTab === 'pharmacy') {
        setPharmacyData(await fetchJson<PharmacyResponse>(`/analytics/pharmacy?${queryParams}`));
      } else if (activeTab === 'follow-ups') {
        setFollowUpsData(await fetchJson<FollowUpsResponse>(`/analytics/follow-ups?${queryParams}`));
      } else if (activeTab === 'branches') {
        setBranchesData(await fetchJson<BranchesResponse>(`/analytics/branches?${queryParams}`));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clinic analytics.');
    } finally {
      setLoading(false);
    }
  }, [token, activeTab, queryParams, period, startDate, endDate, fetchJson, canFinance]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  const handleExportCsv = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/analytics/export?domain=${activeTab}&${queryParams}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.message || 'CSV export failed.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medora-analytics-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-sky-600" />
            <h1 className="text-xl font-bold text-slate-900">
              Clinic Analytics &amp; Business Intelligence
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Authoritative operational, clinical, diagnostic, pharmacy, and financial intelligence
            {overviewData?.meta ? ` • Timezone: ${overviewData.meta.timezone}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadTab}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Date Range
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodKey)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-sky-500 focus:outline-none"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7Days">Last 7 Days</option>
            <option value="last30Days">Last 30 Days</option>
            <option value="last90Days">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {period === 'custom' && (
          <>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Trend Granularity
          </label>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as GranularityKey)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-sky-500 focus:outline-none"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Branch Scope
          </label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-sky-500 focus:outline-none"
          >
            {isAdmin && <option value="all">All Authorized Branches</option>}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>

        {!isDoctorOnly && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Doctor Filter
            </label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-sky-500 focus:outline-none"
            >
              <option value="">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Domain Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
        {availableTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
          ))}
        </div>
      )}

      {/* 1. OVERVIEW TAB */}
      {!loading && activeTab === 'overview' && overviewData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total Registered Patients"
              value={formatIndianNumber(overviewData.cumulativeKpis.totalRegisteredPatients)}
              badge="Cumulative"
              tone="info"
            />
            <KpiCard
              label="Active Doctors"
              value={formatIndianNumber(overviewData.cumulativeKpis.activeDoctors)}
              badge="Cumulative"
            />
            <KpiCard
              label="New Patients"
              value={formatIndianNumber(overviewData.periodKpis.newPatients)}
              badge="Date Range"
              tone="success"
            />
            <KpiCard
              label="Total Appointments"
              value={formatIndianNumber(overviewData.periodKpis.totalAppointments)}
              badge="Date Range"
              subtext={`Avg ${overviewData.periodKpis.averageDailyAppointments} / day`}
            />
            <KpiCard
              label="Completed Appointments"
              value={formatIndianNumber(overviewData.periodKpis.completedAppointments)}
              badge="Date Range"
              tone="success"
            />
            <KpiCard
              label="Cancelled Appointments"
              value={formatIndianNumber(overviewData.periodKpis.cancelledAppointments)}
              badge="Date Range"
              tone="warning"
            />
            <KpiCard
              label="No-Show Appointments"
              value={formatIndianNumber(overviewData.periodKpis.noShowAppointments)}
              badge="Date Range"
              tone="danger"
            />
            <KpiCard
              label="Follow-ups Due"
              value={formatIndianNumber(overviewData.periodKpis.followUpsDue)}
              badge="Date Range"
              tone="info"
            />
          </div>

          {canFinance && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard
                label="Total Invoiced Amount"
                value={formatINR(overviewData.periodKpis.totalInvoicedAmount)}
                badge="Date Range"
                subtext="Finalized non-draft, non-cancelled invoices"
              />
              <KpiCard
                label="Total Collected Payments"
                value={formatINR(overviewData.periodKpis.totalCollectedPayments)}
                badge="Date Range"
                tone="success"
                subtext="Actual settled receipts"
              />
              <KpiCard
                label="Outstanding Invoice Balance"
                value={formatINR(overviewData.periodKpis.outstandingInvoiceBalance)}
                badge="Cumulative"
                tone="warning"
                subtext="Unsettled receivable balance"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {appointmentsData && (
              <TrendLineChart
                title="Appointment Volume Trend"
                subtitle="Completed vs Cancelled vs No-Show"
                data={appointmentsData.volumeTrend}
                xKey="date"
                series={[
                  { key: 'total', label: 'Total', color: '#0284c7' },
                  { key: 'completed', label: 'Completed', color: '#10b981' },
                  { key: 'cancelled', label: 'Cancelled', color: '#f59e0b' },
                ]}
              />
            )}
            {canFinance && financeData && (
              <TrendLineChart
                title="Revenue Trend (Invoiced vs Collected)"
                subtitle="INR currency • Authoritative Phase 10.5.6 ledger"
                data={financeData.revenueTrend}
                xKey="date"
                valueFormatter={formatINR}
                series={[
                  { key: 'invoiced', label: 'Invoiced', color: '#6366f1' },
                  { key: 'collected', label: 'Collected', color: '#10b981' },
                  { key: 'refunded', label: 'Refunded', color: '#ef4444' },
                ]}
              />
            )}
          </div>
        </div>
      )}

      {/* 2. PATIENTS TAB */}
      {!loading && activeTab === 'patients' && patientsData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total Registered Patients"
              value={formatIndianNumber(patientsData.summary.totalRegisteredPatients)}
              badge="Cumulative"
              tone="info"
            />
            <KpiCard
              label="New Registrations"
              value={formatIndianNumber(patientsData.summary.newPatientsInPeriod)}
              badge="Date Range"
              tone="success"
            />
            <KpiCard
              label="New Visiting Patients"
              value={formatIndianNumber(patientsData.summary.newVisitingPatients)}
              badge="Date Range"
            />
            <KpiCard
              label="Returning Visiting Patients"
              value={formatIndianNumber(patientsData.summary.returningVisitingPatients)}
              badge="Date Range"
              tone="info"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TrendLineChart
              title="Patient Registration Trend"
              data={patientsData.registrationTrend}
              xKey="date"
              series={[{ key: 'count', label: 'New Patients', color: '#0284c7' }]}
            />
            <TrendLineChart
              title="New vs Returning Patient Visits"
              data={patientsData.revisitTrend}
              xKey="date"
              series={[
                { key: 'newPatients', label: 'New', color: '#10b981' },
                { key: 'returningPatients', label: 'Returning', color: '#6366f1' },
              ]}
            />
            <DonutBreakdownChart
              title="Age-Group Distribution"
              subtitle="Reliable recorded ages only; missing values grouped as Unknown"
              segments={patientsData.ageGroupDistribution.map((a, idx) => ({
                label: a.group,
                value: a.count,
                color: STATUS_COLORS[idx % STATUS_COLORS.length],
              }))}
            />
            <DonutBreakdownChart
              title="Gender Distribution"
              segments={patientsData.genderDistribution.map((g, idx) => ({
                label: g.gender,
                value: g.count,
                color: STATUS_COLORS[idx % STATUS_COLORS.length],
              }))}
            />
          </div>

          <BarComparisonChart
            title="Patient Distribution by Branch"
            items={patientsData.branchDistribution.map((b) => ({
              label: `${b.branchName} (${b.branchCode})`,
              value: b.patientCount,
            }))}
          />
        </div>
      )}

      {/* 3. APPOINTMENTS TAB */}
      {!loading && activeTab === 'appointments' && appointmentsData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total Appointments"
              value={formatIndianNumber(appointmentsData.summary.totalAppointments)}
              badge="Date Range"
            />
            <KpiCard
              label="Completed"
              value={formatIndianNumber(appointmentsData.summary.completedAppointments)}
              badge="Date Range"
              tone="success"
            />
            <KpiCard
              label="No-Show Rate"
              value={`${appointmentsData.summary.noShowRatePercent}%`}
              badge="Date Range"
              tone="danger"
              subtext={`${appointmentsData.summary.noShowAppointments} of ${appointmentsData.summary.noShowDenominator} eligible`}
            />
            <KpiCard
              label="Avg / Working Day"
              value={formatIndianNumber(appointmentsData.summary.averageAppointmentsPerWorkingDay)}
              badge="Date Range"
              subtext={`${appointmentsData.summary.workingDaysWithAppointments} active days`}
            />
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-900">
            <strong>No-Show Denominator Definition:</strong>{' '}
            {appointmentsData.meta.noShowDenominatorDefinition}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TrendLineChart
              title="Appointment Volume Trend"
              data={appointmentsData.volumeTrend}
              xKey="date"
              series={[
                { key: 'total', label: 'Total', color: '#0284c7' },
                { key: 'completed', label: 'Completed', color: '#10b981' },
                { key: 'cancelled', label: 'Cancelled', color: '#f59e0b' },
                { key: 'noShow', label: 'No-Show', color: '#ef4444' },
              ]}
            />
            <DonutBreakdownChart
              title="Appointment Status Distribution"
              segments={appointmentsData.statusDistribution.map((s, idx) => ({
                label: s.status,
                value: s.count,
                color: STATUS_COLORS[idx % STATUS_COLORS.length],
              }))}
            />
            <BarComparisonChart
              title="Peak Appointment Hours"
              items={appointmentsData.peakHours.map((h) => ({
                label: h.label,
                value: h.count,
              }))}
              barColor="#6366f1"
            />
            <BarComparisonChart
              title="Doctor-wise Appointment Volume"
              items={appointmentsData.doctorVolume.slice(0, 10).map((d) => ({
                label: `${d.doctorName} (${d.department})`,
                value: d.count,
              }))}
            />
          </div>
        </div>
      )}

      {/* 4. DOCTORS TAB */}
      {!loading && activeTab === 'doctors' && doctorsData && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700">
            <strong>Operational Scope:</strong> {doctorsData.meta.notice}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BarComparisonChart
              title="Doctor Workload (Total Appointments)"
              items={doctorsData.doctors.map((d) => ({
                label: d.doctorName,
                value: d.totalAppointments,
              }))}
            />
            <TrendLineChart
              title="Completed Consultation Trend"
              data={doctorsData.consultationTrend}
              xKey="date"
              series={[{ key: 'count', label: 'Completed Consultations', color: '#10b981' }]}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Doctor</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 text-right">Appointments</th>
                  <th className="px-4 py-3 text-right">Completed Consults</th>
                  <th className="px-4 py-3 text-right">Cancelled</th>
                  <th className="px-4 py-3 text-right">No-Show</th>
                  <th className="px-4 py-3 text-right">Avg / Day</th>
                  <th className="px-4 py-3 text-right">Completion %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doctorsData.doctors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No doctor operational records found for the selected scope.
                    </td>
                  </tr>
                ) : (
                  doctorsData.doctors.map((d) => (
                    <tr key={d.doctorId} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-900">{d.doctorName}</td>
                      <td className="px-4 py-3 text-slate-600">{d.department}</td>
                      <td className="px-4 py-3 text-right">{formatIndianNumber(d.totalAppointments)}</td>
                      <td className="px-4 py-3 text-right">{formatIndianNumber(d.completedConsultations)}</td>
                      <td className="px-4 py-3 text-right">{formatIndianNumber(d.cancelledAppointments)}</td>
                      <td className="px-4 py-3 text-right">{formatIndianNumber(d.noShowCount)}</td>
                      <td className="px-4 py-3 text-right">{d.averageDailyConsultationVolume}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        {d.appointmentCompletionRatePercent}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. FINANCE TAB */}
      {!loading && activeTab === 'finance' && financeData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Gross Finalized Invoices"
              value={formatINR(financeData.summary.grossFinalizedInvoiceAmount)}
              badge="Date Range"
              subtext={`${formatIndianNumber(financeData.summary.invoiceCount)} invoices • Avg ${formatINR(financeData.summary.averageInvoiceValue)}`}
            />
            <KpiCard
              label="Total Collected Payments"
              value={formatINR(financeData.summary.totalCollectedPayments)}
              badge="Date Range"
              tone="success"
              subtext={`Net after refunds: ${formatINR(financeData.summary.netCollectedRevenue)}`}
            />
            <KpiCard
              label="Refund Totals"
              value={formatINR(financeData.summary.refundTotals)}
              badge="Date Range"
              tone="danger"
            />
            <KpiCard
              label="Outstanding Receivable Balance"
              value={formatINR(financeData.summary.outstandingBalance)}
              badge="Cumulative"
              tone="warning"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TrendLineChart
              title="Revenue Trend (Invoiced, Collected & Refunds)"
              data={financeData.revenueTrend}
              xKey="date"
              valueFormatter={formatINR}
              series={[
                { key: 'invoiced', label: 'Invoiced', color: '#6366f1' },
                { key: 'collected', label: 'Collected', color: '#10b981' },
                { key: 'refunded', label: 'Refunded', color: '#ef4444' },
              ]}
            />
            <DonutBreakdownChart
              title="Payment Method Distribution"
              valueFormatter={formatINR}
              segments={financeData.paymentMethodDistribution.map((m, idx) => ({
                label: `${m.method} (${m.count})`,
                value: m.amount,
                color: STATUS_COLORS[idx % STATUS_COLORS.length],
              }))}
            />
            <BarComparisonChart
              title="Service Category Revenue"
              valueFormatter={formatINR}
              items={financeData.serviceCategoryRevenue.map((c) => ({
                label: c.category,
                value: c.amount,
              }))}
            />
            <BarComparisonChart
              title="Branch-wise Collected Revenue"
              valueFormatter={formatINR}
              items={financeData.branchRevenue.map((b) => ({
                label: b.branchName,
                value: b.collectedAmount,
              }))}
              barColor="#10b981"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-600">
            <div className="font-semibold text-slate-800">Authoritative Financial Formulas</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {Object.entries(financeData.meta.formulas).map(([k, v]) => (
                <li key={k}>
                  <span className="font-medium text-slate-800">{k}:</span> {v}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 6. LABORATORY TAB */}
      {!loading && activeTab === 'laboratory' && labData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Total Lab Orders"
              value={formatIndianNumber(labData.summary.totalLabOrders)}
              badge="Date Range"
            />
            <KpiCard
              label="Completed Reports"
              value={formatIndianNumber(labData.summary.completedReports)}
              badge="Date Range"
              tone="success"
              subtext={`${formatIndianNumber(labData.summary.pendingReports)} pending`}
            />
            <KpiCard
              label="Average Turnaround Time"
              value={`${labData.summary.averageTurnaroundHours} hrs`}
              badge="Date Range"
              tone="info"
            />
            <KpiCard
              label="Rejected Samples"
              value={formatIndianNumber(labData.summary.rejectedSamples)}
              badge="Date Range"
              tone="danger"
            />
            <KpiCard
              label="Recollection Count"
              value={formatIndianNumber(labData.summary.recollectionCount)}
              badge="Date Range"
              tone="warning"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DonutBreakdownChart
              title="Laboratory Orders by Status"
              segments={labData.ordersByStatus.map((s, idx) => ({
                label: s.status,
                value: s.count,
                color: STATUS_COLORS[idx % STATUS_COLORS.length],
              }))}
            />
            <BarComparisonChart
              title="Tests by Category"
              items={labData.testsByCategory.slice(0, 10).map((c) => ({
                label: c.category,
                value: c.count,
              }))}
            />
          </div>
        </div>
      )}

      {/* 7. PHARMACY TAB */}
      {!loading && activeTab === 'pharmacy' && pharmacyData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Active Medicine Catalogue"
              value={formatIndianNumber(pharmacyData.summary.medicineCatalogueCount)}
              badge="Cumulative"
            />
            <KpiCard
              label="Low-Stock Medicines"
              value={formatIndianNumber(pharmacyData.summary.lowStockMedicineCount)}
              badge="Cumulative"
              tone="warning"
            />
            <KpiCard
              label="Expiring Batches (60d)"
              value={formatIndianNumber(pharmacyData.summary.expiringBatchCount)}
              badge="Cumulative"
              tone="warning"
              subtext={`${pharmacyData.summary.expiredBatchCount} expired with stock`}
            />
            <KpiCard
              label="Stock Cost Valuation"
              value={formatINR(pharmacyData.summary.stockCostValuation)}
              badge="Cumulative"
              tone="info"
              subtext={`Retail: ${formatINR(pharmacyData.summary.stockRetailValuation)}`}
            />
            <KpiCard
              label="Pharmacy Revenue"
              value={formatINR(pharmacyData.summary.pharmacyRevenue)}
              badge="Date Range"
              tone="success"
              subtext={`${formatIndianNumber(pharmacyData.summary.dispensingCount)} dispensations (${formatIndianNumber(pharmacyData.summary.dispensingUnits)} units)`}
            />
            <KpiCard
              label="Goods Received (GRN)"
              value={formatINR(pharmacyData.summary.goodsReceivedTotal)}
              badge="Date Range"
              subtext={`PO Total: ${formatINR(pharmacyData.summary.purchaseOrderTotal)}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TrendLineChart
              title="Pharmacy Sales Trend"
              data={pharmacyData.salesTrend}
              xKey="date"
              valueFormatter={formatINR}
              series={[{ key: 'revenue', label: 'Dispensing Revenue', color: '#10b981' }]}
            />
            <BarComparisonChart
              title="Branch Stock Valuation (Cost)"
              valueFormatter={formatINR}
              items={pharmacyData.branchStockDistribution.map((b) => ({
                label: `${b.branchName} (${formatIndianNumber(b.totalUnits)} units)`,
                value: b.costValuation,
              }))}
            />
          </div>
        </div>
      )}

      {/* 8. FOLLOW-UPS TAB */}
      {!loading && activeTab === 'follow-ups' && followUpsData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label="Scheduled Follow-ups"
              value={formatIndianNumber(followUpsData.clinicalFollowUps.scheduledFollowUps)}
              badge="Date Range"
              tone="info"
            />
            <KpiCard
              label="Completed Follow-ups"
              value={formatIndianNumber(followUpsData.clinicalFollowUps.completedFollowUps)}
              badge="Date Range"
              tone="success"
            />
            <KpiCard
              label="Missed Follow-ups"
              value={formatIndianNumber(followUpsData.clinicalFollowUps.missedFollowUps)}
              badge="Date Range"
              tone="danger"
            />
            <KpiCard
              label="Upcoming Follow-ups"
              value={formatIndianNumber(followUpsData.clinicalFollowUps.upcomingFollowUps)}
              badge="Date Range"
            />
            <KpiCard
              label="Completion Rate"
              value={`${followUpsData.clinicalFollowUps.completionRatePercent}%`}
              badge="Date Range"
              tone="success"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DonutBreakdownChart
              title="Clinical Follow-up Outcomes"
              segments={[
                {
                  label: 'Completed',
                  value: followUpsData.clinicalFollowUps.completedFollowUps,
                  color: '#10b981',
                },
                {
                  label: 'Scheduled',
                  value: followUpsData.clinicalFollowUps.scheduledFollowUps,
                  color: '#0284c7',
                },
                {
                  label: 'Missed',
                  value: followUpsData.clinicalFollowUps.missedFollowUps,
                  color: '#ef4444',
                },
              ]}
            />

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                Notification Provider Delivery Evidence
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Measured exclusively from actual provider delivery records (queued outbox items excluded).
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">Attempts</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    {formatIndianNumber(followUpsData.notificationDeliveryEvidence.totalProviderAttempts)}
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3">
                  <div className="text-[11px] text-emerald-700">Delivered</div>
                  <div className="mt-1 text-lg font-bold text-emerald-800">
                    {formatIndianNumber(followUpsData.notificationDeliveryEvidence.successCount)}
                  </div>
                </div>
                <div className="rounded-lg bg-rose-50 p-3">
                  <div className="text-[11px] text-rose-700">Failed</div>
                  <div className="mt-1 text-lg font-bold text-rose-800">
                    {formatIndianNumber(followUpsData.notificationDeliveryEvidence.failureCount)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. BRANCHES TAB */}
      {!loading && activeTab === 'branches' && branchesData && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3 text-right">Registered Patients</th>
                <th className="px-4 py-3 text-right">Appointments</th>
                <th className="px-4 py-3 text-right">Completed</th>
                <th className="px-4 py-3 text-right">Lab Orders</th>
                <th className="px-4 py-3 text-right">Collected Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branchesData.branches.map((b) => (
                <tr key={b.branchId} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-900">{b.branchName}</td>
                  <td className="px-4 py-3 text-slate-500">{b.branchCode}</td>
                  <td className="px-4 py-3 text-right">{formatIndianNumber(b.registeredPatients)}</td>
                  <td className="px-4 py-3 text-right">{formatIndianNumber(b.appointmentsInPeriod)}</td>
                  <td className="px-4 py-3 text-right">{formatIndianNumber(b.completedAppointments)}</td>
                  <td className="px-4 py-3 text-right">{formatIndianNumber(b.labOrdersInPeriod)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    {b.collectedRevenue !== null ? formatINR(b.collectedRevenue) : 'Restricted'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
