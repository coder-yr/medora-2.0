import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar,
  Stethoscope,
  BedDouble,
  CreditCard,
  Building2,
  IndianRupee,
  Boxes,
  Microscope,
  UserCheck,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardHeader } from '../components/DashboardHeader';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { DashboardSection } from '../components/DashboardSection';
import { DashboardAlert } from '../components/DashboardAlert';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { DashboardSkeletonCards } from '../components/DashboardSkeleton';

interface ExecutiveOverviewData {
  period: string;
  dateRange: { start: string; end: string };
  branchScope: string;
  patients: { totalRegistered: number; newInPeriod: number };
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    completionRatePercent: number;
    consultationsCompleted: number;
  };
  inpatient: {
    activeAdmissions: number;
    totalBeds: number;
    occupiedBeds: number;
    occupancyRatePercent: number;
  };
  pharmacy: { lowStockMedicines: number; nearExpiryBatches: number };
  diagnostics: { pendingLabOrders: number; pendingRadiologyStudies: number };
  financial?: {
    recognizedRevenue: number;
    cashCollections: number;
    nonCashCollections: number;
    accountsReceivable: number;
    openOrPendingShifts: number;
  } | null;
  notifications: { deadLetterJobs: number; queueStatus: string };
  generatedAt: string;
}

interface OperationalAlertItem {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  message: string;
  count: number;
  actionRoute: string;
}

export const HospitalAdminDashboard: React.FC = () => {
  const { token, apiBaseUrl, currentUser, userRole, userBranches, activeBranchId } = useAuth();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'currentMonth'>('today');
  const [overview, setOverview] = useState<ExecutiveOverviewData | null>(null);
  const [alerts, setAlerts] = useState<OperationalAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const activeBranch = userBranches.find((b) => String(b.id) === String(activeBranchId)) || {
    name: 'Main Campus',
    code: 'MAIN',
  };

  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Executive Overview scoped to the active branch
      const overviewUrl = new URL(`${apiBaseUrl}/api/v1/dashboard/overview`);
      overviewUrl.searchParams.set('period', period);
      if (activeBranchId) overviewUrl.searchParams.set('branchId', activeBranchId);

      const overviewPromise = fetch(overviewUrl.toString(), { headers }).then((res) => res.json());

      // 2. Fetch Operational Alerts
      const alertsPromise = fetch(`${apiBaseUrl}/api/v1/dashboard/operational-alerts`, { headers })
        .then((res) => res.json())
        .catch(() => ({ success: false, data: [] }));

      const [overviewRes, alertsRes] = await Promise.all([overviewPromise, alertsPromise]);

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      } else {
        setError(overviewRes.error?.message || overviewRes.message || 'Failed to retrieve hospital operational overview.');
      }

      if (alertsRes.success && Array.isArray(alertsRes.data?.alerts)) {
        setAlerts(alertsRes.data.alerts);
      } else if (Array.isArray(alertsRes.data)) {
        setAlerts(alertsRes.data);
      }
    } catch {
      setError('Unable to communicate with the hospital analytics service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiBaseUrl, period, activeBranchId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Header */}
      <DashboardHeader
        title="Hospital Operations Administration"
        subtitle="Branch-scoped operational capacity, department coordination, and administrative performance"
        userName={currentUser?.name}
        userRole={userRole}
        branchName={activeBranch.name}
        branchCode={activeBranch.code}
        icon={Building2}
        onRefresh={handleManualRefresh}
        isRefreshing={refreshing}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Period:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '5px 10px', fontSize: 12.5, fontWeight: 600 }}
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7Days">Last 7 Days</option>
              <option value="last30Days">Last 30 Days</option>
              <option value="currentMonth">Current Month</option>
            </select>
          </div>
        }
      />

      {/* Scope Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          background: 'var(--surface-subtle, #f8fafc)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: 8,
          fontSize: 13,
          color: 'var(--text-muted, #64748b)',
        }}
      >
        <Building2 size={16} style={{ color: '#0284c7' }} />
        <span>
          Operational Scope: <strong>{activeBranch.name} ({activeBranch.code})</strong>. You have administrative authority over all clinical, diagnostic, and financial units within this facility.
        </span>
      </div>

      {/* Error State */}
      {error && <DashboardErrorState message={error} onRetry={fetchDashboardData} />}

      {/* Operational Alerts Banner Bar */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.slice(0, 3).map((alert) => (
            <DashboardAlert
              key={alert.id}
              type={alert.severity === 'CRITICAL' ? 'danger' : 'warning'}
              title={alert.title}
              message={alert.message}
              actionText="Inspect Module"
              onAction={() => alert.actionRoute && navigate(alert.actionRoute)}
            />
          ))}
        </div>
      )}

      {/* Core Operational Metric Cards */}
      {loading && !overview ? (
        <DashboardSkeletonCards count={8} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {/* 1. Registered Patients */}
          <DashboardMetricCard
            title="Total Registered Patients"
            value={overview?.patients?.totalRegistered != null ? overview.patients.totalRegistered.toLocaleString() : '0'}
            subtext={`+${overview?.patients?.newInPeriod || 0} registered in ${period}`}
            icon={Users}
            variant="primary"
            onClick={() => navigate('/patients')}
          />

          {/* 2. Today's Appointments */}
          <DashboardMetricCard
            title="Scheduled Appointments"
            value={overview?.appointments?.total ?? 0}
            subtext={`${overview?.appointments?.completionRatePercent ?? 0}% clinical completion`}
            icon={Calendar}
            variant="teal"
            onClick={() => navigate('/appointments')}
          />

          {/* 3. Completed Consultations */}
          <DashboardMetricCard
            title="Completed Consultations"
            value={overview?.appointments?.consultationsCompleted ?? 0}
            subtext={`${overview?.appointments?.completed || 0} visits completed`}
            icon={Stethoscope}
            variant="emerald"
            onClick={() => navigate('/consultations')}
          />

          {/* 4. Inpatient Admissions */}
          <DashboardMetricCard
            title="Active IPD Inpatients"
            value={overview?.inpatient?.activeAdmissions ?? 0}
            subtext={`${overview?.inpatient?.occupiedBeds || 0}/${overview?.inpatient?.totalBeds || 0} beds (${overview?.inpatient?.occupancyRatePercent ?? 0}%)`}
            icon={BedDouble}
            variant="amber"
            onClick={() => navigate('/inpatient')}
          />

          {/* 5. Recognized Revenue */}
          <DashboardMetricCard
            title="Recognized Revenue"
            value={overview?.financial ? `₹${overview.financial.recognizedRevenue.toLocaleString()}` : '₹0'}
            subtext={`₹${(overview?.financial?.cashCollections || 0).toLocaleString()} collected cash`}
            icon={CreditCard}
            variant="purple"
            onClick={() => navigate('/billing')}
          />

          {/* 6. Outstanding Receivables */}
          <DashboardMetricCard
            title="Accounts Receivable"
            value={overview?.financial ? `₹${overview.financial.accountsReceivable.toLocaleString()}` : '₹0'}
            subtext="Unsettled patient invoices"
            icon={IndianRupee}
            variant="rose"
            onClick={() => navigate('/billing')}
          />

          {/* 7. Low Stock Medicines */}
          <DashboardMetricCard
            title="Low Stock Medicines"
            value={overview?.pharmacy?.lowStockMedicines ?? 0}
            subtext={`${overview?.pharmacy?.nearExpiryBatches || 0} batches near expiry`}
            icon={Boxes}
            variant="rose"
            onClick={() => navigate('/pharmacy')}
          />

          {/* 8. Pending Diagnostics */}
          <DashboardMetricCard
            title="Pending Diagnostic Tests"
            value={(overview?.diagnostics?.pendingLabOrders || 0) + (overview?.diagnostics?.pendingRadiologyStudies || 0)}
            subtext={`${overview?.diagnostics?.pendingLabOrders || 0} lab, ${overview?.diagnostics?.pendingRadiologyStudies || 0} radiology`}
            icon={Microscope}
            variant="teal"
            onClick={() => navigate('/laboratory')}
          />
        </div>
      )}

      {/* Department Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Clinical Operations Summary */}
        <DashboardSection title="Clinical Operations" subtitle="Outpatient & Inpatient care capacity" icon={Stethoscope}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-subtle, #f8fafc)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Bed Occupancy Rate</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: (overview?.inpatient?.occupancyRatePercent || 0) > 85 ? '#dc2626' : '#059669' }}>
                {overview?.inpatient?.occupancyRatePercent ?? 0}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-subtle, #f8fafc)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Available Inpatient Beds</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                {Math.max(0, (overview?.inpatient?.totalBeds || 0) - (overview?.inpatient?.occupiedBeds || 0))} Beds
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-subtle, #f8fafc)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Appointment Completion Rate</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0284c7' }}>
                {overview?.appointments?.completionRatePercent ?? 0}%
              </span>
            </div>
          </div>
        </DashboardSection>

        {/* Pharmacy & Diagnostics Summary */}
        <DashboardSection title="Pharmacy & Diagnostics" subtitle="Ancillary unit throughput & inventory alerts" icon={Boxes}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-subtle, #f8fafc)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Critical Stock Items</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: (overview?.pharmacy?.lowStockMedicines || 0) > 0 ? '#dc2626' : '#059669' }}>
                {overview?.pharmacy?.lowStockMedicines ?? 0} SKUs
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-subtle, #f8fafc)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pending Lab Specimens</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0284c7' }}>
                {overview?.diagnostics?.pendingLabOrders ?? 0} orders
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-subtle, #f8fafc)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pending Radiology Studies</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed' }}>
                {overview?.diagnostics?.pendingRadiologyStudies ?? 0} studies
              </span>
            </div>
          </div>
        </DashboardSection>
      </div>

      {/* Administrative Quick Actions Bar */}
      <DashboardSection title="Branch Administrative Workflows" subtitle="One-click access to hospital management modules" icon={Building2}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <button
            onClick={() => navigate('/patients')}
            className="btn btn-secondary"
            style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <Users size={16} style={{ color: '#0284c7' }} />
            <span>Register Patient</span>
          </button>

          <button
            onClick={() => navigate('/appointments')}
            className="btn btn-secondary"
            style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <Calendar size={16} style={{ color: '#7c3aed' }} />
            <span>Book Appointment</span>
          </button>

          <button
            onClick={() => navigate('/doctors')}
            className="btn btn-secondary"
            style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <Stethoscope size={16} style={{ color: '#059669' }} />
            <span>Consultant Roster</span>
          </button>

          <button
            onClick={() => navigate('/staff')}
            className="btn btn-secondary"
            style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <UserCheck size={16} style={{ color: '#d97706' }} />
            <span>Staff Directory</span>
          </button>

          <button
            onClick={() => navigate('/inpatient')}
            className="btn btn-secondary"
            style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <BedDouble size={16} style={{ color: '#e11d48' }} />
            <span>Ward & Bed Setup</span>
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="btn btn-secondary"
            style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <Settings size={16} style={{ color: '#475569' }} />
            <span>Branch Settings</span>
          </button>
        </div>
      </DashboardSection>
    </div>
  );
};
