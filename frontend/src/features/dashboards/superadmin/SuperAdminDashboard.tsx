import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Building2,
  Users,
  Settings,
  Activity,
  Layers,
  FileText,
  Bell,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardHeader } from '../components/DashboardHeader';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { DashboardSection } from '../components/DashboardSection';
import { DashboardAlert } from '../components/DashboardAlert';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { DashboardSkeletonCards } from '../components/DashboardSkeleton';

interface BranchComparisonItem {
  branchId: string;
  branchName: string;
  branchCode: string;
  address?: string;
  appointmentCount?: number;
  appointmentsCount?: number;
  admissionCount?: number;
  admissionsCount?: number;
  grossRevenue?: number;
  netRevenue?: number | null;
}

interface OperationalAlertItem {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  message: string;
  count: number;
  actionRoute: string;
}

interface ExecutiveOverviewData {
  period: string;
  patients: { totalRegistered: number; newInPeriod: number };
  appointments: { total: number; completed: number; completionRatePercent: number };
  inpatient: { activeAdmissions: number; totalBeds: number; occupiedBeds: number; occupancyRatePercent: number };
  financial?: {
    recognizedRevenue: number;
    cashCollections: number;
    nonCashCollections: number;
    accountsReceivable: number;
  } | null;
  notifications: { deadLetterJobs: number; queueStatus: string };
  generatedAt: string;
}

export const SuperAdminDashboard: React.FC = () => {
  const { token, apiBaseUrl, currentUser, userRole } = useAuth();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'currentMonth'>('today');
  const [overview, setOverview] = useState<ExecutiveOverviewData | null>(null);
  const [branchComparison, setBranchComparison] = useState<BranchComparisonItem[]>([]);
  const [alerts, setAlerts] = useState<OperationalAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchGlobalData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Global Overview (unrestricted, no branchId filter)
      const overviewPromise = fetch(`${apiBaseUrl}/api/v1/dashboard/overview?period=${period}`, { headers })
        .then((res) => res.json())
        .catch(() => ({ success: false, data: null }));

      // 2. Multi-Branch Comparative Performance
      const branchPromise = fetch(`${apiBaseUrl}/api/v1/dashboard/branch-comparison?period=${period}`, { headers })
        .then((res) => res.json())
        .catch(() => ({ success: false, data: { branches: [] } }));

      // 3. System-Wide Operational Alerts
      const alertsPromise = fetch(`${apiBaseUrl}/api/v1/dashboard/operational-alerts`, { headers })
        .then((res) => res.json())
        .catch(() => ({ success: false, data: [] }));

      const [overviewRes, branchRes, alertsRes] = await Promise.all([
        overviewPromise,
        branchPromise,
        alertsPromise,
      ]);

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      }

      if (branchRes.success && Array.isArray(branchRes.data?.branches)) {
        setBranchComparison(branchRes.data.branches);
      }

      if (alertsRes.success && Array.isArray(alertsRes.data?.alerts)) {
        setAlerts(alertsRes.data.alerts);
      } else if (Array.isArray(alertsRes.data)) {
        setAlerts(alertsRes.data);
      }
    } catch {
      setError('Unable to communicate with the global hospital governance service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiBaseUrl, period]);

  useEffect(() => {
    fetchGlobalData();
  }, [fetchGlobalData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchGlobalData();
  };

  const totalNetworkRevenue = branchComparison.reduce(
    (acc, b) => acc + Number(b.netRevenue ?? b.grossRevenue ?? 0),
    0
  );
  const totalNetworkAppointments = branchComparison.reduce(
    (acc, b) => acc + Number(b.appointmentsCount ?? b.appointmentCount ?? 0),
    0
  );
  const totalNetworkAdmissions = branchComparison.reduce(
    (acc, b) => acc + Number(b.admissionsCount ?? b.admissionCount ?? 0),
    0
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Header */}
      <DashboardHeader
        title="Super Administrator Governance Cockpit"
        subtitle="Global hospital network oversight, multi-branch comparisons, system configuration, and audit logs"
        userName={currentUser?.name}
        userRole={userRole}
        branchName="Global Governance"
        branchCode="GLOBAL"
        icon={Shield}
        onRefresh={handleManualRefresh}
        isRefreshing={refreshing}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Audit Period:</span>
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
      {error && <DashboardErrorState message={error} onRetry={fetchGlobalData} />}

      {/* Global Alerts Banner */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.slice(0, 3).map((alert) => (
            <DashboardAlert
              key={alert.id}
              type={alert.severity === 'CRITICAL' ? 'danger' : 'warning'}
              title={`[Global Governance] ${alert.title}`}
              message={alert.message}
              actionText="Investigate"
              onAction={() => alert.actionRoute && navigate(alert.actionRoute)}
            />
          ))}
        </div>
      )}

      {/* Global Executive Metric Cards */}
      {loading && !overview ? (
        <DashboardSkeletonCards count={6} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <DashboardMetricCard
            title="Total Registered Patients"
            value={overview?.patients?.totalRegistered?.toLocaleString() || '0'}
            subtext={`+${overview?.patients?.newInPeriod || 0} registered in ${period}`}
            icon={Users}
            variant="primary"
            onClick={() => navigate('/patients')}
          />
          <DashboardMetricCard
            title="Active Hospital Branches"
            value={branchComparison.length > 0 ? String(branchComparison.length) : '2'}
            subtext="Multi-campus operational federation"
            icon={Building2}
            variant="teal"
            onClick={() => navigate('/settings')}
          />
          <DashboardMetricCard
            title="Network Gross Revenue"
            value={`PKR ${(overview?.financial?.recognizedRevenue || totalNetworkRevenue || 0).toLocaleString()}`}
            subtext="Consolidated recognized billings"
            icon={DollarSign}
            variant="emerald"
            onClick={() => navigate('/accounting')}
          />
          <DashboardMetricCard
            title="Consolidated Appointments"
            value={overview?.appointments?.total || totalNetworkAppointments || 0}
            subtext={`${overview?.appointments?.completionRatePercent ?? 100}% clinical completion`}
            icon={Activity}
            variant="purple"
            onClick={() => navigate('/appointments')}
          />
          <DashboardMetricCard
            title="Total IPD Inpatients"
            value={overview?.inpatient?.activeAdmissions || totalNetworkAdmissions || 0}
            subtext={`${overview?.inpatient?.occupancyRatePercent ?? 0}% global bed occupancy`}
            icon={Layers}
            variant="amber"
            onClick={() => navigate('/inpatient')}
          />
          <DashboardMetricCard
            title="System Background Jobs"
            value={overview?.notifications?.queueStatus || 'HEALTHY'}
            subtext={`${overview?.notifications?.deadLetterJobs || 0} dead-letter queue items`}
            icon={Bell}
            variant="purple"
            onClick={() => navigate('/notifications')}
          />
        </div>
      )}

      {/* Multi-Branch Comparative Performance Table */}
      <DashboardSection
        title="Hospital Network Comparative Performance"
        subtitle="Real-time clinical throughput and financial comparison across registered campuses"
        icon={Building2}
        action={
          <button onClick={() => navigate('/settings')} className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>
            <Settings size={13} style={{ marginRight: 6 }} /> Manage Branches
          </button>
        }
      >
        {branchComparison.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No branch comparison data recorded for period: {period}.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>Branch Name</th>
                  <th style={{ padding: '10px 14px' }}>Code</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Appointments</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>IPD Admissions</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Gross Billings</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Net Revenue</th>
                </tr>
              </thead>
              <tbody>
                {branchComparison.map((b) => {
                  const appointments = Number(b.appointmentsCount ?? b.appointmentCount ?? 0);
                  const admissions = Number(b.admissionsCount ?? b.admissionCount ?? 0);
                  const grossRev = Number(b.grossRevenue ?? b.netRevenue ?? 0);
                  const netRev = Number(b.netRevenue ?? 0);
                  return (
                    <tr key={b.branchId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{b.branchName}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className="badge badge-neutral" style={{ fontSize: 11 }}>{b.branchCode}</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>{appointments.toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>{admissions.toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                        PKR {grossRev.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                        PKR {netRev.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      {/* System Governance Quick Actions */}
      <DashboardSection
        title="Global Administration & System Governance"
        subtitle="Direct administrative shortcuts to system settings, hospital branding, staff directory, and accounting"
        icon={Settings}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <button
            onClick={() => navigate('/settings')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, padding: 12 }}
          >
            <Building2 size={18} style={{ color: '#0284c7' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Hospital Settings & Branches</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Configure multi-campus details</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/staff')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, padding: 12 }}
          >
            <Users size={18} style={{ color: '#8b5cf6' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Staff & Workforce Directory</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Manage employee assignments</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/accounting')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, padding: 12 }}
          >
            <FileText size={18} style={{ color: '#10b981' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>General Accounting & COA</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Audit ledger & trial balance</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/notifications')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, padding: 12 }}
          >
            <Bell size={18} style={{ color: '#f59e0b' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Notification System Engine</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Monitor delivery & outbox</div>
            </div>
          </button>
        </div>
      </DashboardSection>
    </div>
  );
};
