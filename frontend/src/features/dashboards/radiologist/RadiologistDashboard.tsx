import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio,
  Clock,
  CheckCircle2,
  Play,
  FileText,
  Search,
  Calendar,
  Layers,
  Info,
  ShieldCheck,
  Eye,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardHeader } from '../components/DashboardHeader';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { DashboardSection } from '../components/DashboardSection';
import { DashboardAlert } from '../components/DashboardAlert';
import { DashboardEmptyState } from '../components/DashboardEmptyState';
import { DashboardSkeletonCards } from '../components/DashboardSkeleton';
import type { RadiologyDashboardMetrics, RadiologyOrder } from '../../../types/radiology';

export const RadiologistDashboard: React.FC = () => {
  const { token, apiBaseUrl, currentUser, userBranches, activeBranchId, userPermissions, userRole } = useAuth();
  const navigate = useNavigate();

  const hasPermission = useCallback(
    (perm: string) => userRole === 'Super Admin' || userPermissions.includes(perm),
    [userRole, userPermissions],
  );

  const [metrics, setMetrics] = useState<RadiologyDashboardMetrics['metrics'] | null>(null);
  const [orders, setOrders] = useState<RadiologyOrder[]>([]);

  const [selectedModality, setSelectedModality] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'reporting' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [actionInProgressId, setActionInProgressId] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'info' | 'danger'; message: string } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeBranch = userBranches.find((b) => String(b.id) === String(activeBranchId)) || {
    name: 'Main Campus',
    code: 'MAIN',
  };

  const fetchRadiologyData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Radiology Dashboard KPIs
      const metricsRes = await fetch(`${apiBaseUrl}/api/v1/radiology/dashboard`, { headers }).then((r) => r.json());
      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data.metrics || metricsRes.data);
      }

      // 2. Fetch Radiology Orders Queue
      const ordersRes = await fetch(`${apiBaseUrl}/api/v1/radiology/orders?limit=50`, { headers }).then((r) => r.json());
      if (ordersRes.success) {
        const list = Array.isArray(ordersRes.data)
          ? ordersRes.data
          : ordersRes.data?.items || ordersRes.data?.data || [];
        setOrders(list);
      }
    } catch {
      setError('Unable to load Radiology Information System (RIS) services. Please verify network connectivity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiBaseUrl]);

  useEffect(() => {
    fetchRadiologyData();
  }, [fetchRadiologyData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchRadiologyData();
  };

  // Quick Action: Advance Study Pipeline (e.g. Start Scan, Complete Scan)
  const handleAdvanceStudy = async (orderId: number, nextAction: 'start' | 'complete' | 'verify') => {
    if (!token) return;
    setActionInProgressId(orderId);
    setActionFeedback(null);

    try {
      let endpoint = '';
      let payload = {};

      if (nextAction === 'start') {
        endpoint = `${apiBaseUrl}/api/v1/radiology/orders/${orderId}/start`;
        payload = { equipmentRoom: 'Imaging Suite 1' };
      } else if (nextAction === 'complete') {
        endpoint = `${apiBaseUrl}/api/v1/radiology/orders/${orderId}/complete`;
        payload = { notes: 'Scan acquired successfully.' };
      } else if (nextAction === 'verify') {
        endpoint = `${apiBaseUrl}/api/v1/radiology/orders/${orderId}/verify`;
        payload = { verifiedNotes: 'Findings and impression verified.' };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.success || res.status === 200 || res.id) {
        setActionFeedback({
          type: 'info',
          message: `Order #${orderId} successfully advanced to next stage (${nextAction}).`,
        });
        fetchRadiologyData();
      } else {
        setActionFeedback({
          type: 'danger',
          message: res.error?.message || `Failed to perform ${nextAction} on Order #${orderId}.`,
        });
      }
    } catch {
      setActionFeedback({
        type: 'danger',
        message: `Network error while executing action for Order #${orderId}.`,
      });
    } finally {
      setActionInProgressId(null);
    }
  };

  // Filter orders by modality, status and search query
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const status = (order.status || '').toLowerCase();
      const modality = (order.modality || order.radiologyExam?.modality || '').toLowerCase();

      // Modality filter
      if (selectedModality !== 'all' && modality !== selectedModality) {
        return false;
      }

      // Status filter
      let matchesStatus = true;
      if (statusFilter === 'pending') {
        matchesStatus = ['ordered', 'scheduled'].includes(status);
      } else if (statusFilter === 'in_progress') {
        matchesStatus = ['arrived', 'in_progress'].includes(status);
      } else if (statusFilter === 'reporting') {
        matchesStatus = ['done', 'report_pending'].includes(status);
      } else if (statusFilter === 'completed') {
        matchesStatus = ['reported', 'verified', 'completed'].includes(status);
      }

      if (!matchesStatus) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pName = (order.patient?.name || '').toLowerCase();
        const pMrn = String(order.patient?.patientId || order.patientId || '').toLowerCase();
        const orderNum = String(order.orderNumber || order.id || '').toLowerCase();
        const exam = (order.examName || order.radiologyExam?.name || '').toLowerCase();
        const doctor = (order.doctor?.name || '').toLowerCase();

        return (
          pName.includes(q) ||
          pMrn.includes(q) ||
          orderNum.includes(q) ||
          exam.includes(q) ||
          doctor.includes(q)
        );
      }

      return true;
    });
  }, [orders, selectedModality, statusFilter, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* 1. Header Banner */}
      <DashboardHeader
        title="Diagnostic Imaging & Radiology Cockpit"
        subtitle="Imaging study requisitions, multi-modality worklists, and diagnostic interpretation reporting."
        userName={currentUser?.name}
        userRole="Radiologist"
        branchName={activeBranch.name}
        branchCode={activeBranch.code}
        icon={Radio}
        onRefresh={handleManualRefresh}
        isRefreshing={refreshing}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate('/radiology')}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Radio size={15} />
              Open RIS Workspace
            </button>
          </div>
        }
      />

      {/* 2. PACS/DICOM Integration Status Notice */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderLeft: '4px solid #0284c7',
          backgroundColor: '#f0f9ff',
        }}
      >
        <Info size={20} style={{ color: '#0284c7', flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: '#0369a1' }}>
          <strong>PACS-Ready Architecture:</strong> Medora RIS tracks requisition workflows, modality schedules, scan states, and structured interpretations in real-time. Direct DICOM Web / Orthanc PACS viewer integration is pending; local study metadata and turnaround logs remain fully active.
        </div>
      </div>

      {/* Action feedback / error notification */}
      {actionFeedback && (
        <DashboardAlert
          type={actionFeedback.type}
          title={actionFeedback.type === 'info' ? 'Action Completed' : 'Operation Notice'}
          message={actionFeedback.message}
          onDismiss={() => setActionFeedback(null)}
        />
      )}

      {error && (
        <DashboardAlert
          type="danger"
          title="RIS Diagnostic Notice"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {/* 3. Imaging Key Performance Indicators (6 Cards) */}
      {loading ? (
        <DashboardSkeletonCards count={6} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 16,
          }}
        >
          <DashboardMetricCard
            title="Pending Requisitions"
            value={metrics?.pendingOrders ?? 0}
            subtext="Awaiting scan scheduling"
            icon={Clock}
            variant="amber"
            badge="Orders"
            onClick={() => setStatusFilter('pending')}
          />

          <DashboardMetricCard
            title="Scheduled Today"
            value={metrics?.scheduledToday ?? 0}
            subtext="Acquisitions slated for today"
            icon={Calendar}
            variant="primary"
            badge="Today"
          />

          <DashboardMetricCard
            title="Scans in Progress"
            value={(metrics?.inProgress ?? 0) + (metrics?.awaitingExamination ?? 0)}
            subtext="Active examination suites"
            icon={Play}
            variant="teal"
            badge="Active"
            onClick={() => setStatusFilter('in_progress')}
          />

          <DashboardMetricCard
            title="Pending Interpretation"
            value={metrics?.reportsPending ?? 0}
            subtext="Scans acquired; report pending"
            icon={FileText}
            variant="purple"
            badge="Reporting"
            onClick={() => setStatusFilter('reporting')}
          />

          <DashboardMetricCard
            title="Quality Review"
            value={metrics?.awaitingVerification ?? 0}
            subtext="Reports awaiting verification"
            icon={ShieldCheck}
            variant="rose"
            badge="Verification"
          />

          <DashboardMetricCard
            title="Completed Studies"
            value={metrics?.completedReports ?? 0}
            subtext="Verified reports today"
            icon={CheckCircle2}
            variant="emerald"
            badge="Finalized"
            onClick={() => setStatusFilter('completed')}
          />
        </div>
      )}

      {/* 4. Diagnostic Imaging Worklist */}
      <DashboardSection
        title="Diagnostic Imaging Worklist"
        subtitle="Filter exams by imaging modality, clinical priority, and workflow progression."
        badge={`${filteredOrders.length} EXAMS`}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Status Filter Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-card-header)', borderRadius: 6, padding: 2 }}>
              <button
                onClick={() => setStatusFilter('all')}
                style={{
                  border: 'none',
                  background: statusFilter === 'all' ? 'var(--bg-card)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: statusFilter === 'all' ? 700 : 500,
                  cursor: 'pointer',
                  color: statusFilter === 'all' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                style={{
                  border: 'none',
                  background: statusFilter === 'pending' ? 'var(--bg-card)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: statusFilter === 'pending' ? 700 : 500,
                  cursor: 'pointer',
                  color: statusFilter === 'pending' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter('in_progress')}
                style={{
                  border: 'none',
                  background: statusFilter === 'in_progress' ? 'var(--bg-card)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: statusFilter === 'in_progress' ? 700 : 500,
                  cursor: 'pointer',
                  color: statusFilter === 'in_progress' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                In Progress
              </button>
              <button
                onClick={() => setStatusFilter('reporting')}
                style={{
                  border: 'none',
                  background: statusFilter === 'reporting' ? 'var(--bg-card)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: statusFilter === 'reporting' ? 700 : 500,
                  cursor: 'pointer',
                  color: statusFilter === 'reporting' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                Reporting
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                style={{
                  border: 'none',
                  background: statusFilter === 'completed' ? 'var(--bg-card)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: statusFilter === 'completed' ? 700 : 500,
                  cursor: 'pointer',
                  color: statusFilter === 'completed' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                Completed
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: 220 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 9,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Search patient, study, exam..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px 5px 28px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                }}
              />
            </div>
          </div>
        }
      >
        {/* Modality Filter Chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {[
            { id: 'all', label: 'All Modalities' },
            { id: 'xray', label: 'X-Ray (XR)' },
            { id: 'ct', label: 'Computed Tomography (CT)' },
            { id: 'mri', label: 'Magnetic Resonance (MRI)' },
            { id: 'ultrasound', label: 'Ultrasound (US)' },
            { id: 'mammography', label: 'Mammography' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedModality(m.id)}
              style={{
                border: 'none',
                background: selectedModality === m.id ? 'var(--primary)' : 'var(--bg-card-header)',
                color: selectedModality === m.id ? '#fff' : 'var(--text-main)',
                padding: '4px 10px',
                borderRadius: 14,
                fontSize: 12,
                fontWeight: selectedModality === m.id ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading diagnostic imaging worklist...
          </div>
        ) : filteredOrders.length === 0 ? (
          <DashboardEmptyState
            title="No imaging orders found"
            description={
              searchQuery
                ? `No orders match query "${searchQuery}".`
                : 'There are currently no imaging studies matching the selected filters.'
            }
            icon={Radio}
            actionText="Open RIS Order Entry"
            onAction={() => navigate('/radiology')}
          />
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Order # / Date</th>
                  <th style={{ padding: '10px 12px' }}>Patient Details</th>
                  <th style={{ padding: '10px 12px' }}>Modality & Exam</th>
                  <th style={{ padding: '10px 12px' }}>Referring Doctor</th>
                  <th style={{ padding: '10px 12px' }}>Priority</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Workflow Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((ord) => {
                  const status = (ord.status || '').toLowerCase();
                  const modality = (ord.modality || ord.radiologyExam?.modality || 'XR').toUpperCase();
                  const isUrgent = ord.urgent || ord.urgency === 'urgent' || ord.urgency === 'stat';

                  return (
                    <tr
                      key={ord.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isUrgent ? '#fff1f2' : 'transparent',
                      }}
                    >
                      {/* Order # and Date */}
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        <div>{ord.orderNumber || `RAD-${ord.id}`}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                          {ord.orderDate ? new Date(ord.orderDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>

                      {/* Patient Details */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {ord.patient?.name || `Patient #${ord.patientId}`}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          MRN: {ord.patient?.patientId || `PAT-${ord.patientId}`}
                          {ord.patient?.sex ? ` • ${ord.patient.sex}` : ''}
                        </div>
                      </td>

                      {/* Modality & Exam */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 4,
                              backgroundColor: '#e0f2fe',
                              color: '#0284c7',
                            }}
                          >
                            {modality}
                          </span>
                          <span style={{ fontWeight: 600 }}>
                            {ord.examName || ord.radiologyExam?.name || 'General Radiograph'}
                          </span>
                        </div>
                        {ord.clinicalIndication && (
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              marginTop: 2,
                              maxWidth: 240,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={ord.clinicalIndication}
                          >
                            Ind: {ord.clinicalIndication}
                          </div>
                        )}
                      </td>

                      {/* Referring Doctor */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 500 }}>{ord.doctor?.name || 'Attending Physician'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {ord.doctor?.department || 'Clinical Medicine'}
                        </div>
                      </td>

                      {/* Priority */}
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            backgroundColor:
                              ord.urgency === 'stat'
                                ? '#fee2e2'
                                : ord.urgency === 'urgent'
                                ? '#fef3c7'
                                : '#f1f5f9',
                            color:
                              ord.urgency === 'stat'
                                ? '#dc2626'
                                : ord.urgency === 'urgent'
                                ? '#d97706'
                                : '#475569',
                          }}
                        >
                          {ord.urgency || (ord.urgent ? 'URGENT' : 'ROUTINE')}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            textTransform: 'uppercase',
                            backgroundColor:
                              status === 'reported' || status === 'completed' || status === 'verified'
                                ? '#dcfce7'
                                : status === 'in_progress' || status === 'arrived'
                                ? '#ccfbf1'
                                : status === 'done'
                                ? '#ede9fe'
                                : '#fef3c7',
                            color:
                              status === 'reported' || status === 'completed' || status === 'verified'
                                ? '#15803d'
                                : status === 'in_progress' || status === 'arrived'
                                ? '#0f766e'
                                : status === 'done'
                                ? '#7c3aed'
                                : '#b45309',
                          }}
                        >
                          {status}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {status === 'ordered' || status === 'scheduled' ? (
                            <button
                              onClick={() => handleAdvanceStudy(ord.id, 'start')}
                              disabled={actionInProgressId === ord.id || !hasPermission('radiology_process')}
                              className="btn btn-primary"
                              style={{ fontSize: 11, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                              title="Start Scan Acquisition"
                            >
                              <Play size={11} />
                              {actionInProgressId === ord.id ? 'Starting...' : 'Start Scan'}
                            </button>
                          ) : status === 'arrived' || status === 'in_progress' ? (
                            <button
                              onClick={() => handleAdvanceStudy(ord.id, 'complete')}
                              disabled={actionInProgressId === ord.id || !hasPermission('radiology_process')}
                              className="btn btn-primary"
                              style={{
                                fontSize: 11,
                                padding: '4px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: '#0d9488',
                                borderColor: '#0d9488',
                              }}
                              title="Complete Scan Acquisition"
                            >
                              <CheckCircle2 size={11} />
                              {actionInProgressId === ord.id ? 'Completing...' : 'Complete Scan'}
                            </button>
                          ) : status === 'done' ? (
                            <button
                              onClick={() => navigate('/radiology')}
                              className="btn btn-primary"
                              style={{
                                fontSize: 11,
                                padding: '4px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: '#7c3aed',
                                borderColor: '#7c3aed',
                              }}
                              title="Enter findings and clinical impression"
                            >
                              <FileText size={11} />
                              Enter Findings
                            </button>
                          ) : status === 'reported' ? (
                            <button
                              onClick={() => handleAdvanceStudy(ord.id, 'verify')}
                              disabled={actionInProgressId === ord.id || !hasPermission('radiology_verify')}
                              className="btn btn-primary"
                              style={{ fontSize: 11, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                              title="Verify Report Quality"
                            >
                              <ShieldCheck size={11} />
                              {actionInProgressId === ord.id ? 'Verifying...' : 'Verify'}
                            </button>
                          ) : (
                            <button
                              onClick={() => navigate('/radiology')}
                              className="btn btn-secondary"
                              style={{ fontSize: 11, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <Eye size={11} />
                              View
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      {/* 5. Quick RIS Navigation */}
      <DashboardSection
        title="Radiology & RIS Workspaces"
        subtitle="Quick access to diagnostic imaging formulary, orders, and turnaround metrics."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
          }}
        >
          <div
            className="card"
            style={{ padding: 16, cursor: 'pointer' }}
            onClick={() => navigate('/radiology')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7',
                }}
              >
                <Radio size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Imaging Orders & Scheduler</h4>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Create new diagnostic imaging requisitions, schedule scanning slots, and track equipment rooms.
            </p>
          </div>

          <div
            className="card"
            style={{ padding: 16, cursor: 'pointer' }}
            onClick={() => navigate('/radiology')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#ede9fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#7c3aed',
                }}
              >
                <Layers size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Modality Exam Catalogue</h4>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Maintain standard radiologic exam definitions, preparation instructions, and pricing tiers.
            </p>
          </div>

          <div
            className="card"
            style={{ padding: 16, cursor: 'pointer' }}
            onClick={() => navigate('/consultations')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#d1fae5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#059669',
                }}
              >
                <Stethoscope size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Clinical Consultations</h4>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Review outpatient clinical encounters, physician notes, and differential diagnoses.
            </p>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
};
