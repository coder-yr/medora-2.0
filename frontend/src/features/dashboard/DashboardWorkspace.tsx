import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  BedDouble,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  GitBranch,
  Pill,
  Microscope,
  Bell,
  Stethoscope,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import type {
  ExecutiveOverviewData,
  DoctorWorkloadData,
  BranchComparisonData,
  OperationalAlertsData,
  DashboardPeriod,
} from '../../types/dashboard';

interface DashboardWorkspaceProps {
  token: string | null;
  userRole?: string;
  activeBranchId?: string | null;
  apiBaseUrl?: string;
  onNavigateToModule?: (moduleKey: string) => void;
}

export const DashboardWorkspace: React.FC<DashboardWorkspaceProps> = ({
  token,
  userRole = 'Admin',
  activeBranchId,
  apiBaseUrl = 'https://medora-20-backend.vercel.app',
  onNavigateToModule,
}) => {
  const [period, setPeriod] = useState<DashboardPeriod>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [overview, setOverview] = useState<ExecutiveOverviewData | null>(null);
  const [doctorWorkload, setDoctorWorkload] = useState<DoctorWorkloadData | null>(null);
  const [branchComparison, setBranchComparison] = useState<BranchComparisonData | null>(null);
  const [alertsData, setAlertsData] = useState<OperationalAlertsData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'doctor' | 'alerts'>('overview');

  const isDoctor = userRole === 'Doctor';
  const isAdmin = userRole === 'Admin';

  const fetchDashboardData = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('period', period);
      if (period === 'custom' && startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }
      if (activeBranchId && activeBranchId !== 'all') {
        params.append('branchId', activeBranchId);
      }

      // 1. Executive overview
      const overviewRes = await fetch(`${apiBaseUrl}/api/v1/dashboard/overview?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (overviewRes.ok) {
        const json = await overviewRes.json();
        setOverview(json.data ?? json);
      }

      // 2. Doctor Workload (if doctor persona or viewing doctor tab)
      if (isDoctor || isAdmin) {
        const docRes = await fetch(`${apiBaseUrl}/api/v1/dashboard/doctor-workload?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (docRes.ok) {
          const json = await docRes.json();
          setDoctorWorkload(json.data ?? json);
        }
      }

      // 3. Operational Alerts
      const alertsRes = await fetch(`${apiBaseUrl}/api/v1/dashboard/operational-alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (alertsRes.ok) {
        const json = await alertsRes.json();
        setAlertsData(json.data ?? json);
      }

      // 4. Multi-Branch Comparison (if admin)
      if (isAdmin) {
        const compRes = await fetch(`${apiBaseUrl}/api/v1/dashboard/branch-comparison?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (compRes.ok) {
          const json = await compRes.json();
          setBranchComparison(json.data ?? json);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token, period, startDate, endDate, activeBranchId, userRole]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header & Filter Strip */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={22} style={{ color: '#2563eb' }} />
            {isDoctor ? 'Doctor Clinical Workbench' : 'Hospital Executive & Operational Dashboard'}
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
            Unified real-time clinical, operational, bed occupancy, and financial metrics across branches.
          </p>
        </div>

        {/* Date Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Period:</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7Days">Last 7 Days</option>
              <option value="last30Days">Last 30 Days</option>
              <option value="currentMonth">Current Month</option>
              <option value="previousMonth">Previous Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {period === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}
              />
              <span style={{ fontSize: 12, color: '#6b7280' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#ffffff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Actionable Operational Alerts Strip */}
      {alertsData && alertsData.alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alertsData.alerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderRadius: 8,
                background:
                  alert.level === 'CRITICAL' ? '#fef2f2' : alert.level === 'WARNING' ? '#fffbeb' : '#eff6ff',
                border:
                  alert.level === 'CRITICAL'
                    ? '1px solid #fecaca'
                    : alert.level === 'WARNING'
                    ? '1px solid #fef3c7'
                    : '1px solid #dbeafe',
                color:
                  alert.level === 'CRITICAL' ? '#991b1b' : alert.level === 'WARNING' ? '#92400e' : '#1e40af',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={18} />
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{alert.title}</span>
                  <span style={{ margin: '0 8px', color: '#9ca3af' }}>|</span>
                  <span style={{ fontSize: 12 }}>{alert.description}</span>
                </div>
              </div>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{alert.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 2 }}>
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'overview' ? '#2563eb' : '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Activity size={16} /> Operational Overview
        </button>

        {(isDoctor || isAdmin) && (
          <button
            type="button"
            onClick={() => setActiveTab('doctor')}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'doctor' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'doctor' ? '#2563eb' : '#6b7280',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Stethoscope size={16} /> Doctor Workload
          </button>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('branches')}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'branches' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'branches' ? '#2563eb' : '#6b7280',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <GitBranch size={16} /> Multi-Branch Comparison
          </button>
        )}
      </div>

      {/* TAB 1: EXECUTIVE & OPERATIONAL OVERVIEW */}
      {activeTab === 'overview' && overview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Main KPI Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {/* Patients Card */}
            <div
              style={{ background: '#ffffff', padding: 18, borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer' }}
              onClick={() => onNavigateToModule?.('prescriptions')}
              title="Click to view outpatient visits"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Patients (Period)</span>
                <Users size={18} style={{ color: '#2563eb' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginTop: 8 }}>
                {overview.patients.newInPeriod}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Total Registered: {overview.patients.totalRegistered}
              </div>
            </div>

            {/* Appointments Card */}
            <div
              style={{ background: '#ffffff', padding: 18, borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer' }}
              onClick={() => onNavigateToModule?.('prescriptions')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Appointments</span>
                <Calendar size={18} style={{ color: '#059669' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginTop: 8 }}>
                {overview.appointments.completed} / {overview.appointments.total}
              </div>
              <div style={{ fontSize: 12, color: '#059669', marginTop: 4, fontWeight: 500 }}>
                {overview.appointments.completionRatePercent}% Completion Rate
              </div>
            </div>

            {/* Inpatient Census Card */}
            <div
              style={{ background: '#ffffff', padding: 18, borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer' }}
              onClick={() => onNavigateToModule?.('inpatient')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Inpatient Census</span>
                <BedDouble size={18} style={{ color: '#7c3aed' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginTop: 8 }}>
                {overview.inpatient.activeAdmissions} Patients
              </div>
              <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 4, fontWeight: 500 }}>
                {overview.inpatient.occupancyRatePercent}% Bed Occupancy ({overview.inpatient.occupiedBeds}/{overview.inpatient.totalBeds})
              </div>
            </div>

            {/* Financial Summary Card (If Authorized) */}
            {overview.financial ? (
              <div
                style={{ background: '#ffffff', padding: 18, borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer' }}
                onClick={() => onNavigateToModule?.('accounting')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Recognized Revenue</span>
                  <DollarSign size={18} style={{ color: '#d97706' }} />
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginTop: 8 }}>
                  ${overview.financial.recognizedRevenue.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>
                  Cash Collections: ${overview.financial.cashCollections.toLocaleString()}
                </div>
              </div>
            ) : (
              <div style={{ background: '#f9fafb', padding: 18, borderRadius: 8, border: '1px dashed #d1d5db' }}>
                <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Financial Metrics</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 12 }}>
                  Restricted to administrative & accounting personnel.
                </div>
              </div>
            )}
          </div>

          {/* Department Workloads & Inventory Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            {/* Pharmacy Health Card */}
            <div
              style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 18, cursor: 'pointer' }}
              onClick={() => onNavigateToModule?.('pharmacy')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15, color: '#111827' }}>
                  <Pill size={18} style={{ color: '#2563eb' }} /> Pharmacy Inventory Health
                </div>
                <ArrowUpRight size={16} style={{ color: '#9ca3af' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
                  <span>Low Stock Medicines (Need Reorder):</span>
                  <span style={{ fontWeight: 700, color: overview.pharmacy.lowStockMedicines > 0 ? '#ef4444' : '#10b981' }}>
                    {overview.pharmacy.lowStockMedicines}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
                  <span>Batches Near Expiry (&le; 60 Days):</span>
                  <span style={{ fontWeight: 700, color: overview.pharmacy.nearExpiryBatches > 0 ? '#f59e0b' : '#10b981' }}>
                    {overview.pharmacy.nearExpiryBatches}
                  </span>
                </div>
              </div>
            </div>

            {/* Diagnostics Workloads Card */}
            <div
              style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 18, cursor: 'pointer' }}
              onClick={() => onNavigateToModule?.('laboratory')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15, color: '#111827' }}>
                  <Microscope size={18} style={{ color: '#059669' }} /> Diagnostics & Laboratories
                </div>
                <ArrowUpRight size={16} style={{ color: '#9ca3af' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
                  <span>Pending Laboratory Requisitions:</span>
                  <span style={{ fontWeight: 700, color: '#2563eb' }}>
                    {overview.diagnostics.pendingLabOrders}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
                  <span>Radiology Studies Pending Verification:</span>
                  <span style={{ fontWeight: 700, color: '#7c3aed' }}>
                    {overview.diagnostics.pendingRadiologyStudies}
                  </span>
                </div>
              </div>
            </div>

            {/* Notification Infrastructure Card */}
            <div
              style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 18, cursor: 'pointer' }}
              onClick={() => onNavigateToModule?.('notifications')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15, color: '#111827' }}>
                  <Bell size={18} style={{ color: '#d97706' }} /> Notification Infrastructure
                </div>
                <ArrowUpRight size={16} style={{ color: '#9ca3af' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
                  <span>Background Queue Status:</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: overview.notifications.queueStatus === 'HEALTHY' ? '#10b981' : '#ef4444',
                    }}
                  >
                    {overview.notifications.queueStatus}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
                  <span>Dead-Letter Failed Jobs:</span>
                  <span style={{ fontWeight: 700, color: overview.notifications.deadLetterJobs > 0 ? '#ef4444' : '#10b981' }}>
                    {overview.notifications.deadLetterJobs}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DOCTOR CLINICAL WORKBENCH */}
      {activeTab === 'doctor' && doctorWorkload && (
        <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 20 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stethoscope size={18} style={{ color: '#2563eb' }} />
            Clinical Consultations & Scheduled Visits
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#eff6ff', padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>Scheduled Visits</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e40af', marginTop: 4 }}>
                {doctorWorkload.appointments.total}
              </div>
            </div>
            <div style={{ background: '#f0fdf4', padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>Completed Visits</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#166534', marginTop: 4 }}>
                {doctorWorkload.appointments.completed}
              </div>
            </div>
            <div style={{ background: '#fef3c7', padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>Draft Consultations</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#92400e', marginTop: 4 }}>
                {doctorWorkload.consultations.pendingDrafts}
              </div>
            </div>
            <div style={{ background: '#f5f3ff', padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#5b21b6', fontWeight: 600 }}>Completed Consultations</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#5b21b6', marginTop: 4 }}>
                {doctorWorkload.consultations.completed}
              </div>
            </div>
          </div>

          <h4 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 600, color: '#374151' }}>
            Today's Clinical Appointment Queue
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#4b5563' }}>
                  <th style={{ padding: '8px 12px' }}>Time</th>
                  <th style={{ padding: '8px 12px' }}>Appointment ID</th>
                  <th style={{ padding: '8px 12px' }}>Patient ID</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                  <th style={{ padding: '8px 12px' }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {doctorWorkload.appointments.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>
                      No appointments scheduled for this period.
                    </td>
                  </tr>
                ) : (
                  doctorWorkload.appointments.items.map((app) => (
                    <tr key={app.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#111827' }}>
                        {app.sTime} - {app.eTime}
                      </td>
                      <td style={{ padding: '8px 12px' }}>#{app.id}</td>
                      <td style={{ padding: '8px 12px' }}>Patient #{app.patientId}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontWeight: 600,
                            background:
                              app.status === 'Completed' || app.status === 'Visited'
                                ? '#dcfce7'
                                : app.status === 'Cancelled'
                                ? '#fee2e2'
                                : '#e0e7ff',
                            color:
                              app.status === 'Completed' || app.status === 'Visited'
                                ? '#166534'
                                : app.status === 'Cancelled'
                                ? '#991b1b'
                                : '#3730a3',
                          }}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#6b7280' }}>{app.remarks || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MULTI-BRANCH COMPARISON */}
      {activeTab === 'branches' && branchComparison && (
        <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 20 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitBranch size={18} style={{ color: '#2563eb' }} />
            Cross-Branch Performance Matrix
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#4b5563' }}>
                  <th style={{ padding: '10px 14px' }}>Branch</th>
                  <th style={{ padding: '10px 14px' }}>Code</th>
                  <th style={{ padding: '10px 14px' }}>Appointments</th>
                  <th style={{ padding: '10px 14px' }}>Admissions</th>
                  <th style={{ padding: '10px 14px' }}>Net Revenue</th>
                </tr>
              </thead>
              <tbody>
                {branchComparison.branches.map((b) => (
                  <tr key={b.branchId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>{b.branchName}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, background: '#e5e7eb', padding: '2px 6px', borderRadius: 4 }}>
                        {b.branchCode}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>{b.appointmentsCount}</td>
                    <td style={{ padding: '10px 14px' }}>{b.admissionsCount}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#059669' }}>
                      ${b.netRevenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
