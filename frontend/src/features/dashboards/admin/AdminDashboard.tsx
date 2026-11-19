import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar,
  Stethoscope,
  BedDouble,
  CreditCard,
  AlertTriangle,
  Building2,
  DollarSign,
  Boxes,
  Microscope,
  Radio,
  UserCheck,
  Settings,
  Activity,
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

interface BranchComparisonItem {
  branchId: string;
  branchName: string;
  branchCode: string;
  appointmentCount: number;
  admissionCount: number;
  grossRevenue: number;
  netRevenue: number;
}

export const AdminDashboard: React.FC = () => {
  const { token, apiBaseUrl, currentUser, userRole, userBranches, activeBranchId } = useAuth();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'currentMonth'>('today');
  const [overview, setOverview] = useState<ExecutiveOverviewData | null>(null);
  const [alerts, setAlerts] = useState<OperationalAlertItem[]>([]);
  const [branchComparison, setBranchComparison] = useState<BranchComparisonItem[]>([]);
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

      // 1. Fetch Executive Overview
      const overviewUrl = new URL(`${apiBaseUrl}/api/v1/dashboard/overview`);
      overviewUrl.searchParams.set('period', period);
      if (activeBranchId) overviewUrl.searchParams.set('branchId', activeBranchId);

      const overviewPromise = fetch(overviewUrl.toString(), { headers }).then((res) => res.json());

      // 2. Fetch Operational Alerts
      const alertsPromise = fetch(`${apiBaseUrl}/api/v1/dashboard/operational-alerts`, { headers })
        .then((res) => res.json())
        .catch(() => ({ success: false, data: [] }));

      // 3. Fetch Branch Comparison (if multi-branch access)
      const branchPromise = fetch(`${apiBaseUrl}/api/v1/dashboard/branch-comparison?period=${period}`, { headers })
        .then((res) => res.json())
        .catch(() => ({ success: false, data: { branches: [] } }));

      const [overviewRes, alertsRes, branchRes] = await Promise.all([
        overviewPromise,
        alertsPromise,
        branchPromise,
      ]);

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      } else {
        setError(overviewRes.error?.message || overviewRes.message || 'Failed to retrieve executive overview.');
      }

      if (alertsRes.success && Array.isArray(alertsRes.data?.alerts)) {
        setAlerts(alertsRes.data.alerts);
      } else if (Array.isArray(alertsRes.data)) {
        setAlerts(alertsRes.data);
      }

      if (branchRes.success && Array.isArray(branchRes.data?.branches)) {
        setBranchComparison(branchRes.data.branches);
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
        title="Hospital Executive Governance"
        subtitle="Hospital-wide operational capacity, clinical throughput, and executive performance"
        userName={currentUser?.name}
        userRole={userRole}
        branchName={activeBranch.name}
        branchCode={activeBranch.code}
        icon={Activity}
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

      {/* Executive Metric Cards (8 Core Hospital KPIs) */}
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
            value={overview?.patients.totalRegistered.toLocaleString()}
            subtext={`+${overview?.patients.newInPeriod || 0} registered in ${period}`}
            icon={Users}
            variant="primary"
            onClick={() => navigate('/patients')}
          />

          {/* 2. Today's Appointments */}
          <DashboardMetricCard
            title="Scheduled Appointments"
            value={overview?.appointments.total}
            subtext={`${overview?.appointments.completionRatePercent ?? 0}% clinical completion`}
            icon={Calendar}
            variant="teal"
            onClick={() => navigate('/appointments')}
          />

          {/* 3. Completed Consultations */}
          <DashboardMetricCard
            title="Completed Consultations"
            value={overview?.appointments.consultationsCompleted}
            subtext={`${overview?.appointments.completed || 0} visits completed`}
            icon={Stethoscope}
            variant="emerald"
            onClick={() => navigate('/consultations')}
          />

          {/* 4. Inpatient Admissions */}
          <DashboardMetricCard
            title="Active IPD Inpatients"
            value={overview?.inpatient.activeAdmissions}
            subtext={`${overview?.inpatient.occupiedBeds || 0} occupied of ${overview?.inpatient.totalBeds || 0} beds`}
            icon={BedDouble}
            variant="purple"
            onClick={() => navigate('/inpatient')}
          />

          {/* 5. Bed Occupancy Rate */}
          <DashboardMetricCard
            title="Ward Bed Occupancy"
            value={`${(() => {
              const rate = overview?.inpatient.occupancyRatePercent;
              if (typeof rate === 'number' && Number.isFinite(rate)) return rate;
              const total = overview?.inpatient.totalBeds || 0;
              const occupied = overview?.inpatient.occupiedBeds || 0;
              return total > 0 ? Math.round((occupied / total) * 100 * 10) / 10 : 0;
            })()}%`}
            subtext="Allocated hospital bed capacity"
            icon={BedDouble}
            variant={
              (overview?.inpatient.occupancyRatePercent ?? 0) > 85
                ? 'rose'
                : (overview?.inpatient.occupancyRatePercent ?? 0) > 60
                  ? 'amber'
                  : 'teal'
            }
            onClick={() => navigate('/inpatient')}
          />

          {/* 6. Recognized Net Revenue */}
          <DashboardMetricCard
            title="Recognized Net Revenue"
            value={
              overview?.financial
                ? `PKR ${overview.financial.recognizedRevenue.toLocaleString()}`
                : 'Restricted'
            }
            subtext={
              overview?.financial
                ? `Cash collections: PKR ${overview.financial.cashCollections.toLocaleString()}`
                : 'Financial authorization required'
            }
            icon={CreditCard}
            variant="primary"
            onClick={() => navigate('/billing')}
          />

          {/* 7. Accounts Receivable */}
          <DashboardMetricCard
            title="Accounts Receivable"
            value={
              overview?.financial
                ? `PKR ${overview.financial.accountsReceivable.toLocaleString()}`
                : 'Restricted'
            }
            subtext={
              overview?.financial
                ? `${overview.financial.openOrPendingShifts || 0} shifts pending close`
                : 'Financial authorization required'
            }
            icon={DollarSign}
            variant={overview?.financial && overview.financial.accountsReceivable > 0 ? 'amber' : 'emerald'}
            onClick={() => navigate('/billing')}
          />

          {/* 8. Queue & Operational Alerts */}
          <DashboardMetricCard
            title="Operational Alerts"
            value={alerts.length}
            subtext={`Queue Status: ${overview?.notifications.queueStatus || 'HEALTHY'}`}
            icon={AlertTriangle}
            variant={alerts.length > 0 ? 'rose' : 'emerald'}
          />
        </div>
      )}

      {/* Two Column Layout: Operational Highlights & Multi-Branch Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        {/* Operational Modules Throughput */}
        <DashboardSection
          title="Clinical & Diagnostic Throughput"
          subtitle="Real-time pending orders across pharmacy, laboratories, and radiology"
          icon={Activity}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div
              style={{
                padding: '14px',
                background: 'var(--bg-subtle)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
              }}
              onClick={() => navigate('/laboratory')}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Microscope size={18} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{overview?.diagnostics.pendingLabOrders || 0}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pending Lab Orders</div>
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                background: 'var(--bg-subtle)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
              }}
              onClick={() => navigate('/radiology')}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Radio size={18} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{overview?.diagnostics.pendingRadiologyStudies || 0}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pending RIS Studies</div>
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                background: 'var(--bg-subtle)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
              }}
              onClick={() => navigate('/pharmacy')}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Boxes size={18} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{overview?.pharmacy.lowStockMedicines || 0}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Low Stock Medicines</div>
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                background: 'var(--bg-subtle)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
              }}
              onClick={() => navigate('/pharmacy')}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Boxes size={18} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{overview?.pharmacy.nearExpiryBatches || 0}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Near-Expiry Batches</div>
              </div>
            </div>
          </div>
        </DashboardSection>

        {/* Multi-Branch Performance Table */}
        {branchComparison.length > 0 && (
          <DashboardSection
            title="Multi-Branch Performance"
            subtitle="Cross-campus comparison of patient visits, admissions, and financial volume"
            icon={Building2}
            noPadding
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 16px' }}>Campus / Branch</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Visits</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Admissions</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Net Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {branchComparison.map((b) => (
                    <tr key={b.branchId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{b.branchName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>[{b.branchCode}]</div>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>
                        {b.appointmentCount}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>
                        {b.admissionCount}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                        PKR {b.netRevenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardSection>
        )}
      </div>

      {/* Executive Quick Actions Bar */}
      <DashboardSection title="Hospital Operations & Quick Management" subtitle="One-click access to administrative workflows" icon={Building2}>
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
            <span>Hospital Settings</span>
          </button>
        </div>
      </DashboardSection>
    </div>
  );
};
