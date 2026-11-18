import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Microscope,
  FlaskConical,
  TestTube2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Activity,
  FileCheck,
  Search,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardHeader } from '../components/DashboardHeader';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { DashboardSection } from '../components/DashboardSection';
import { DashboardAlert } from '../components/DashboardAlert';
import { DashboardEmptyState } from '../components/DashboardEmptyState';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { DashboardSkeletonCards } from '../components/DashboardSkeleton';
import type { LabDashboardMetrics, LabOrder, LabSample } from '../../../types/laboratory';

export const LaboratoristDashboard: React.FC = () => {
  const { token, apiBaseUrl, currentUser, userBranches, activeBranchId } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<LabDashboardMetrics | null>(null);
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [samplesQueue, setSamplesQueue] = useState<LabSample[]>([]);

  const [stageFilter, setStageFilter] = useState<'all' | 'pending_collection' | 'processing' | 'verification' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeBranch = userBranches.find((b) => String(b.id) === String(activeBranchId)) || {
    name: 'Main Campus',
    code: 'MAIN',
  };

  const fetchLabData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Laboratory Dashboard KPIs
      const metricsRes = await fetch(`${apiBaseUrl}/api/v1/lab/dashboard`, { headers }).then((r) => r.json());
      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data.metrics || metricsRes.data);
      }

      // 2. Fetch Laboratory Orders Queue
      const ordersRes = await fetch(`${apiBaseUrl}/api/v1/lab/orders?limit=50`, { headers }).then((r) => r.json());
      if (ordersRes.success) {
        const list = Array.isArray(ordersRes.data)
          ? ordersRes.data
          : ordersRes.data?.items || ordersRes.data?.data || [];
        setOrders(list);
      }

      // 3. Fetch Sample Collection Queue
      const samplesRes = await fetch(`${apiBaseUrl}/api/v1/lab/samples/queue`, { headers }).then((r) => r.json());
      if (samplesRes.success) {
        const sList = Array.isArray(samplesRes.data)
          ? samplesRes.data
          : samplesRes.data?.items || samplesRes.data?.data || [];
        setSamplesQueue(sList);
      }
    } catch {
      setError('Unable to load Laboratory Information System services. Please check network connectivity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiBaseUrl]);

  useEffect(() => {
    fetchLabData();
  }, [fetchLabData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchLabData();
  };

  // Filter orders by workflow stage & search query
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const status = (order.status || '').toUpperCase();

      let matchesStage = true;
      if (stageFilter === 'pending_collection') {
        matchesStage = ['REQUESTED', 'ORDERED', 'SAMPLE_PENDING'].includes(status);
      } else if (stageFilter === 'processing') {
        matchesStage = ['SAMPLE_COLLECTED', 'SAMPLE_RECEIVED', 'PROCESSING'].includes(status);
      } else if (stageFilter === 'verification') {
        matchesStage = ['RESULT_ENTERED', 'PARTIAL'].includes(status);
      } else if (stageFilter === 'completed') {
        matchesStage = ['REPORTED', 'COMPLETED', 'VERIFIED'].includes(status);
      }

      if (!matchesStage) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pName = (order.patientName || order.patient?.name || '').toLowerCase();
        const pMrn = String(order.patient?.patientId || order.patientId || '').toLowerCase();
        const orderNum = String(order.orderNumber || order.id || '').toLowerCase();
        const category = (order.categoryName || order.category || '').toLowerCase();
        return pName.includes(q) || pMrn.includes(q) || orderNum.includes(q) || category.includes(q);
      }

      return true;
    });
  }, [orders, stageFilter, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Header */}
      <DashboardHeader
        title="Laboratory Information System (LIS) Cockpit"
        subtitle="Manage diagnostic test requisitions, specimen accessioning, parameter entry, and clinical report validation."
        userName={currentUser?.name || 'Laboratorist'}
        userRole="Laboratorist"
        branchName={activeBranch.name}
        branchCode={activeBranch.code}
        icon={Microscope}
        onRefresh={handleManualRefresh}
        isRefreshing={refreshing}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => navigate('/laboratory')}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
            >
              <FlaskConical size={16} />
              Open LIS Workspace
            </button>
          </div>
        }
      />

      {/* 2. Urgent / Rejected Specimens Alert */}
      {metrics && metrics.rejectedSamples > 0 && (
        <DashboardAlert
          type="danger"
          title={`Specimen Rejection Notice: ${metrics.rejectedSamples} samples rejected`}
          message="Hemolyzed, clotted, or insufficient specimen volume rejected by accessioning requires clinician recollection."
          actionText="Inspect Sample Queue"
          onAction={() => navigate('/laboratory')}
        />
      )}

      {error && <DashboardErrorState title="Laboratory Diagnostics Error" message={error} onRetry={fetchLabData} />}

      {/* 3. KPI Metrics Banner (6 Cards) */}
      {loading ? (
        <DashboardSkeletonCards count={6} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {/* Card 1: Pending Orders */}
          <DashboardMetricCard
            title="Pending Test Orders"
            value={metrics?.pendingOrders ?? 0}
            subtext="Requisitions awaiting specimen"
            icon={ClipboardList}
            variant="primary"
            onClick={() => setStageFilter('pending_collection')}
          />

          {/* Card 2: Awaiting Collection */}
          <DashboardMetricCard
            title="Awaiting Collection"
            value={metrics?.sampleCollectionQueue ?? samplesQueue.length}
            subtext="Patients in phlebotomy queue"
            icon={TestTube2}
            variant="amber"
            onClick={() => setStageFilter('pending_collection')}
          />

          {/* Card 3: In Processing */}
          <DashboardMetricCard
            title="Tests In Progress"
            value={metrics?.processingQueue ?? 0}
            subtext="Analyzer processing underway"
            icon={FlaskConical}
            variant="purple"
            onClick={() => setStageFilter('processing')}
          />

          {/* Card 4: Awaiting Verification */}
          <DashboardMetricCard
            title="Awaiting Verification"
            value={metrics?.awaitingVerification ?? 0}
            subtext="Results recorded, pending pathologist"
            icon={FileCheck}
            variant={metrics && metrics.awaitingVerification > 0 ? 'amber' : 'slate'}
            badge={metrics && metrics.awaitingVerification > 0 ? 'Urgent' : undefined}
            onClick={() => setStageFilter('verification')}
          />

          {/* Card 5: Completed Reports */}
          <DashboardMetricCard
            title="Completed Reports"
            value={metrics?.completedReports ?? 0}
            subtext="Validated results issued"
            icon={CheckCircle2}
            variant="emerald"
            badge="Today"
            onClick={() => setStageFilter('completed')}
          />

          {/* Card 6: Specimen Exceptions */}
          <DashboardMetricCard
            title="Specimen Exceptions"
            value={metrics?.rejectedSamples ?? 0}
            subtext="Re-collection indicated"
            icon={AlertTriangle}
            variant={metrics && metrics.rejectedSamples > 0 ? 'rose' : 'slate'}
            badge={metrics && metrics.rejectedSamples > 0 ? 'Review' : undefined}
          />
        </div>
      )}

      {/* 4. Main Operational Layout: LIS Work Queue & Specimen Accessioning */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1.2fr)', gap: 20 }}>
        {/* LEFT COLUMN: Multi-Stage LIS Work Queue */}
        <DashboardSection
          title="Clinical Laboratory Work Queue"
          subtitle="Track diagnostic tests from requisition, accessioning, analyzer results to pathologist validation"
          icon={ClipboardList}
          badge={filteredOrders.length}
          action={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(
                [
                  { id: 'all', label: 'All Orders' },
                  { id: 'pending_collection', label: 'Collection' },
                  { id: 'processing', label: 'Processing' },
                  { id: 'verification', label: 'Verification' },
                  { id: 'completed', label: 'Completed' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStageFilter(tab.id)}
                  className={`btn ${stageFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          }
          noPadding
        >
          {/* Quick Search */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: '#f8fafc' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search orders by patient name, MRN, order #, or test name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 32, fontSize: 12, height: 34 }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading diagnostic test queue...
            </div>
          ) : filteredOrders.length === 0 ? (
            <DashboardEmptyState
              title={`No orders found in '${stageFilter.replace(/_/g, ' ')}' stage`}
              description="New laboratory requisitions ordered by outpatient doctors or inpatient wards will show here."
              icon={CheckCircle2}
              actionText="Refresh Diagnostics"
              onAction={handleManualRefresh}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Order #</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Patient & MRN</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Test / Panel</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Priority</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.slice(0, 10).map((ord) => {
                    const priority = (ord.priority || 'ROUTINE').toUpperCase();
                    const status = (ord.status || 'ORDERED').toUpperCase();

                    const isStat = priority === 'STAT';
                    const isUrgent = priority === 'URGENT';

                    const isCompleted = ['REPORTED', 'COMPLETED', 'VERIFIED'].includes(status);
                    const isResultEntered = status === 'RESULT_ENTERED';

                    return (
                      <tr key={ord.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0284c7' }}>
                          #{ord.orderNumber || ord.id}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {ord.patientName || ord.patient?.name || 'Walk-in Patient'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            MRN #{ord.patient?.patientId || ord.patientId}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {ord.categoryName || ord.category || 'Diagnostic Panel'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Dr. {ord.doctorName || ord.doctor?.name || 'Attending Clinician'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            className="badge"
                            style={{
                              background: isStat ? '#fee2e2' : isUrgent ? '#fef3c7' : '#f1f5f9',
                              color: isStat ? '#b91c1c' : isUrgent ? '#b45309' : '#475569',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {priority}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            className="badge"
                            style={{
                              background: isCompleted ? '#d1fae5' : isResultEntered ? '#fef3c7' : '#e0f2fe',
                              color: isCompleted ? '#065f46' : isResultEntered ? '#92400e' : '#0369a1',
                              padding: '3px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <button
                            onClick={() => navigate('/laboratory')}
                            className="btn btn-primary"
                            style={{
                              padding: '4px 10px',
                              fontSize: 12,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <span>{isResultEntered ? 'Verify' : isCompleted ? 'View' : 'Process'}</span>
                            <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredOrders.length > 10 && (
                <div style={{ padding: '12px 16px', textAlign: 'center', borderTop: '1px solid var(--border-color)', background: '#fafbfc' }}>
                  <button
                    onClick={() => navigate('/laboratory')}
                    className="btn btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    View all {filteredOrders.length} orders in Laboratory Workspace
                  </button>
                </div>
              )}
            </div>
          )}
        </DashboardSection>

        {/* RIGHT COLUMN: Specimen Accessioning & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Specimen Accessioning Tracker */}
          <DashboardSection
            title="Specimen Accessioning Queue"
            subtitle="Phlebotomy collection and analyzer intake log"
            icon={TestTube2}
            badge={samplesQueue.length}
            noPadding
          >
            {samplesQueue.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={30} style={{ color: '#10b981', margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 600 }}>No samples pending accessioning</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>All collected specimen tubes have been routed.</div>
              </div>
            ) : (
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {samplesQueue.slice(0, 8).map((sample) => (
                    <div
                      key={sample.id}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0284c7' }}>
                          {sample.sampleNumber}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-main)', marginTop: 2 }}>
                          {sample.sampleType} • Order #{sample.labId}
                        </div>
                        {sample.lab?.patientName && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Patient: {sample.lab.patientName}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span
                          className="badge"
                          style={{
                            background: sample.status === 'COLLECTED' ? '#e0f2fe' : '#fef3c7',
                            color: sample.status === 'COLLECTED' ? '#0369a1' : '#b45309',
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {sample.status}
                        </span>
                        <div style={{ marginTop: 4 }}>
                          <button
                            onClick={() => navigate('/laboratory')}
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                          >
                            Receive
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DashboardSection>

          {/* Laboratory Fast Actions */}
          <DashboardSection title="Laboratory Workflows" icon={Activity}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <button
                onClick={() => navigate('/laboratory')}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  padding: '10px 12px',
                  justifyContent: 'flex-start',
                }}
              >
                <TestTube2 size={15} style={{ color: '#0284c7' }} />
                <span>Sample Intake</span>
              </button>

              <button
                onClick={() => navigate('/laboratory')}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  padding: '10px 12px',
                  justifyContent: 'flex-start',
                }}
              >
                <FlaskConical size={15} style={{ color: '#7c3aed' }} />
                <span>Enter Results</span>
              </button>

              <button
                onClick={() => navigate('/laboratory')}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  padding: '10px 12px',
                  justifyContent: 'flex-start',
                }}
              >
                <FileCheck size={15} style={{ color: '#10b981' }} />
                <span>Verify Reports</span>
              </button>

              <button
                onClick={() => navigate('/laboratory')}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  padding: '10px 12px',
                  justifyContent: 'flex-start',
                }}
              >
                <ClipboardList size={15} style={{ color: '#f59e0b' }} />
                <span>Test Formulary</span>
              </button>
            </div>
          </DashboardSection>
        </div>
      </div>
    </div>
  );
};
