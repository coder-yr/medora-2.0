import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BedDouble,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  HeartPulse,
  Search,
  Users,
  Building2,
  Pill,
  Microscope,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardHeader } from '../components/DashboardHeader';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { DashboardSection } from '../components/DashboardSection';
import { DashboardAlert } from '../components/DashboardAlert';
import { DashboardEmptyState } from '../components/DashboardEmptyState';
import { DashboardSkeletonCards } from '../components/DashboardSkeleton';
import type { InpatientDashboardMetrics, Admission, Bed } from '../../../types/inpatient';

export const NurseDashboard: React.FC = () => {
  const { token, apiBaseUrl, currentUser, userBranches, activeBranchId, userPermissions, userRole } = useAuth();
  const navigate = useNavigate();

  const hasPermission = useCallback(
    (perm: string) => userRole === 'Admin' || userPermissions.includes(perm),
    [userRole, userPermissions],
  );

  const [metrics, setMetrics] = useState<InpatientDashboardMetrics | null>(null);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [cleaningBeds, setCleaningBeds] = useState<Bed[]>([]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'admitted' | 'discharge_pending' | 'cleaning'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sanitizingBedId, setSanitizingBedId] = useState<string | number | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeBranch = userBranches.find((b) => String(b.id) === String(activeBranchId)) || {
    name: 'Main Campus',
    code: 'MAIN',
  };

  const fetchNurseData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Inpatient & Ward KPIs
      const metricsRes = await fetch(`${apiBaseUrl}/api/v1/inpatient/dashboard`, { headers }).then((r) => r.json());
      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      }

      // 2. Fetch Active Admissions Worklist
      const admissionsRes = await fetch(`${apiBaseUrl}/api/v1/inpatient/admissions?limit=50`, { headers }).then((r) => r.json());
      if (admissionsRes.success) {
        const list = Array.isArray(admissionsRes.data)
          ? admissionsRes.data
          : admissionsRes.data?.items || admissionsRes.data?.data || [];
        setAdmissions(list);
      }

      // 3. Fetch Beds in Cleaning / Sanitization Status
      const bedsRes = await fetch(`${apiBaseUrl}/api/v1/inpatient/beds?status=CLEANING`, { headers }).then((r) => r.json());
      if (bedsRes.success) {
        const bList = Array.isArray(bedsRes.data)
          ? bedsRes.data
          : bedsRes.data?.items || bedsRes.data?.data || [];
        setCleaningBeds(bList);
      }
    } catch {
      setError('Unable to load Inpatient Nursing & Bed Management services. Please check network connectivity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiBaseUrl]);

  useEffect(() => {
    fetchNurseData();
  }, [fetchNurseData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchNurseData();
  };

  // Quick Action: Release Bed from Cleaning to Available
  const handleMarkBedReady = async (bedId: string | number, bedNumber: string) => {
    if (!token) return;
    setSanitizingBedId(bedId);
    setActionSuccessMessage(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/inpatient/beds/${bedId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'AVAILABLE' }),
      }).then((r) => r.json());

      if (res.success || res.status === 200 || res.id) {
        setActionSuccessMessage(`Bed #${bedNumber} sanitized and marked AVAILABLE for admission.`);
        // Refresh local beds and metrics
        fetchNurseData();
      } else {
        setError(res.error?.message || `Failed to update status for Bed #${bedNumber}.`);
      }
    } catch {
      setError(`Network error while releasing Bed #${bedNumber}.`);
    } finally {
      setSanitizingBedId(null);
    }
  };

  // Filter admissions by status and search query
  const filteredAdmissions = useMemo(() => {
    return admissions.filter((adm) => {
      const status = (adm.status || '').toUpperCase();

      let matchesFilter = true;
      if (statusFilter === 'admitted') {
        matchesFilter = ['ADMITTED', 'TRANSFERRED'].includes(status);
      } else if (statusFilter === 'discharge_pending') {
        matchesFilter = status === 'DISCHARGE_PENDING';
      }

      if (!matchesFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pName = (adm.patient?.name || '').toLowerCase();
        const pMrn = String(adm.patient?.patientId || adm.patientId || '').toLowerCase();
        const admNum = String(adm.admissionNumber || adm.id || '').toLowerCase();
        const bedNum = String(adm.bed?.number || '').toLowerCase();
        const docName = (adm.attendingDoctor?.name || '').toLowerCase();
        const diag = (adm.diagnosis || '').toLowerCase();

        return (
          pName.includes(q) ||
          pMrn.includes(q) ||
          admNum.includes(q) ||
          bedNum.includes(q) ||
          docName.includes(q) ||
          diag.includes(q)
        );
      }

      return true;
    });
  }, [admissions, statusFilter, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* 1. Header Banner */}
      <DashboardHeader
        title="Nursing & Inpatient Care Cockpit"
        subtitle="Live ward capacity, bed sanitization queues, and admitted patient care management."
        userName={currentUser?.name}
        userRole="Nurse"
        branchName={activeBranch.name}
        branchCode={activeBranch.code}
        icon={BedDouble}
        onRefresh={handleManualRefresh}
        isRefreshing={refreshing}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate('/inpatient')}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Building2 size={15} />
              Inpatient Workspace
            </button>
            <button
              onClick={() => navigate('/appointments')}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <HeartPulse size={15} />
              Vitals & Triage
            </button>
          </div>
        }
      />

      {/* Action feedback / error notification */}
      {actionSuccessMessage && (
        <DashboardAlert
          type="info"
          title="Bed Sanitization Complete"
          message={actionSuccessMessage}
          onDismiss={() => setActionSuccessMessage(null)}
        />
      )}

      {error && (
        <DashboardAlert
          type="danger"
          title="Clinical Operations Notice"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {/* 2. Nursing Key Performance Indicators (6 Cards) */}
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
            title="Bed Occupancy"
            value={`${metrics?.occupancyRate ?? metrics?.occupancyPercentage ?? 0}%`}
            subtext={`${metrics?.occupiedBeds ?? 0} of ${metrics?.totalBeds ?? 0} active beds`}
            icon={Activity}
            variant="primary"
            badge="Live Ward"
          />

          <DashboardMetricCard
            title="Ready for Admission"
            value={metrics?.availableBeds ?? 0}
            subtext="Immediate allocatable capacity"
            icon={CheckCircle2}
            variant="emerald"
            badge="Available"
            onClick={() => navigate('/inpatient')}
          />

          <DashboardMetricCard
            title="Sanitization / Cleaning"
            value={metrics?.cleaningBeds ?? cleaningBeds.length}
            subtext="Pending nurse turnaround"
            icon={Sparkles}
            variant="amber"
            badge="Turnaround"
            onClick={() => setStatusFilter('cleaning')}
          />

          <DashboardMetricCard
            title="Admitted Inpatients"
            value={metrics?.activeAdmissionsCount ?? metrics?.activeAdmissions ?? admissions.length}
            subtext="Current care worklist"
            icon={Users}
            variant="teal"
            badge="In Care"
          />

          <DashboardMetricCard
            title="Expected Discharges"
            value={metrics?.expectedDischargesTodayCount ?? metrics?.expectedDischargesToday ?? 0}
            subtext="Scheduled release today"
            icon={Clock}
            variant="purple"
            badge="Today"
            onClick={() => setStatusFilter('discharge_pending')}
          />

          <DashboardMetricCard
            title="Active Wards"
            value={metrics?.totalWards ?? 12}
            subtext="Operational nursing units"
            icon={Building2}
            variant="slate"
            badge="Wards"
          />
        </div>
      )}

      {/* 3. Bed Sanitization & Turnaround Priority Queue */}
      {cleaningBeds.length > 0 && (
        <DashboardSection
          title="Bed Sanitization Queue"
          subtitle="Beds recently vacated requiring nursing inspection and release to available status."
          badge={`${cleaningBeds.length} PENDING CLEAN`}
          action={
            <button
              onClick={() => navigate('/inpatient')}
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              View All Beds
            </button>
          }
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            {cleaningBeds.map((bed) => (
              <div
                key={bed.id}
                className="card"
                style={{
                  padding: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderLeft: '4px solid #f59e0b',
                  backgroundColor: '#fffbeb',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <BedDouble size={16} style={{ color: '#d97706' }} />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Bed #{bed.number}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Ward: <strong>{bed.category?.category || 'General Ward'}</strong>
                  </div>
                  {bed.description && (
                    <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
                      {bed.description}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleMarkBedReady(bed.id, bed.number)}
                  disabled={sanitizingBedId === bed.id || !hasPermission('inpatient_bed_manage')}
                  className="btn btn-primary"
                  style={{
                    fontSize: 12,
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#059669',
                    borderColor: '#059669',
                  }}
                  title={
                    !hasPermission('inpatient_bed_manage')
                      ? 'Requires Bed Manage permission'
                      : 'Release bed for patient admission'
                  }
                >
                  <Sparkles size={14} />
                  {sanitizingBedId === bed.id ? 'Updating...' : 'Mark Clean'}
                </button>
              </div>
            ))}
          </div>
        </DashboardSection>
      )}

      {/* 4. Inpatient Care Worklist (Admitted Patients) */}
      <DashboardSection
        title="Inpatient Care Worklist"
        subtitle="Real-time register of patients admitted across hospital wards."
        badge={`${filteredAdmissions.length} ADMISSIONS`}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-card-header)', borderRadius: 6, padding: 2 }}>
              <button
                onClick={() => setStatusFilter('all')}
                style={{
                  border: 'none',
                  background: statusFilter === 'all' ? 'var(--bg-card)' : 'transparent',
                  padding: '4px 10px',
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
                onClick={() => setStatusFilter('admitted')}
                style={{
                  border: 'none',
                  background: statusFilter === 'admitted' ? 'var(--bg-card)' : 'transparent',
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: statusFilter === 'admitted' ? 700 : 500,
                  cursor: 'pointer',
                  color: statusFilter === 'admitted' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                Admitted
              </button>
              <button
                onClick={() => setStatusFilter('discharge_pending')}
                style={{
                  border: 'none',
                  background: statusFilter === 'discharge_pending' ? 'var(--bg-card)' : 'transparent',
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: statusFilter === 'discharge_pending' ? 700 : 500,
                  cursor: 'pointer',
                  color: statusFilter === 'discharge_pending' ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                Discharge Pending
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
                placeholder="Search patient, bed, MRN..."
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
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading patient care worklist...
          </div>
        ) : filteredAdmissions.length === 0 ? (
          <DashboardEmptyState
            title="No admitted patients found"
            description={
              searchQuery
                ? `No patient records match query "${searchQuery}".`
                : 'There are currently no patients in this admission filter category.'
            }
            icon={BedDouble}
            actionText="Open Inpatient Admission"
            onAction={() => navigate('/inpatient')}
          />
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Admission #</th>
                  <th style={{ padding: '10px 12px' }}>Patient Details</th>
                  <th style={{ padding: '10px 12px' }}>Ward & Bed</th>
                  <th style={{ padding: '10px 12px' }}>Attending Doctor</th>
                  <th style={{ padding: '10px 12px' }}>Diagnosis / Reason</th>
                  <th style={{ padding: '10px 12px' }}>Care Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmissions.map((adm) => {
                  const status = (adm.status || '').toUpperCase();
                  const isPendingDischarge = status === 'DISCHARGE_PENDING';
                  const isAdmitted = status === 'ADMITTED' || status === 'TRANSFERRED';

                  return (
                    <tr
                      key={adm.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isPendingDischarge ? '#faf5ff' : 'transparent',
                      }}
                    >
                      {/* Admission # & Date */}
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        <div>{adm.admissionNumber || `ADM-${adm.id}`}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                          {adm.admissionDate ? new Date(adm.admissionDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>

                      {/* Patient Name & MRN */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {adm.patient?.name || `Patient #${adm.patientId}`}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          MRN: {adm.patient?.patientId || `PAT-${adm.patientId}`}
                          {adm.patient?.sex ? ` • ${adm.patient.sex}` : ''}
                          {adm.patient?.age ? ` • ${adm.patient.age}y` : ''}
                        </div>
                      </td>

                      {/* Ward & Bed */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <BedDouble size={14} style={{ color: 'var(--primary)' }} />
                          <span style={{ fontWeight: 600 }}>Bed #{adm.bed?.number || adm.bedId}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {adm.ward?.category || adm.ward?.name || 'General Ward'}
                        </div>
                      </td>

                      {/* Attending Doctor */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 500 }}>
                          {adm.attendingDoctor?.name || 'Assigned Clinician'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {adm.attendingDoctor?.department || 'Medical Staff'}
                        </div>
                      </td>

                      {/* Provisional Diagnosis */}
                      <td style={{ padding: '10px 12px', maxWidth: 220 }}>
                        <div
                          style={{
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={adm.diagnosis || adm.admissionReason || 'Under observation'}
                        >
                          {adm.diagnosis || adm.admissionReason || 'Clinical observation'}
                        </div>
                        {adm.admissionType && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#475569',
                              backgroundColor: '#f1f5f9',
                              padding: '1px 5px',
                              borderRadius: 4,
                              textTransform: 'uppercase',
                            }}
                          >
                            {adm.admissionType}
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: isPendingDischarge
                              ? '#ede9fe'
                              : isAdmitted
                              ? '#dcfce7'
                              : '#f1f5f9',
                            color: isPendingDischarge
                              ? '#7c3aed'
                              : isAdmitted
                              ? '#15803d'
                              : '#475569',
                          }}
                        >
                          {isPendingDischarge && <Clock size={11} />}
                          {isAdmitted && <CheckCircle2 size={11} />}
                          {status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => navigate('/inpatient')}
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            title="Inspect patient admission folio and care details"
                          >
                            Care Details
                          </button>
                          <button
                            onClick={() => navigate('/appointments')}
                            className="btn btn-primary"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            title="Record vitals"
                          >
                            Vitals
                          </button>
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

      {/* 5. Clinical Workflow Quick Navigation */}
      <DashboardSection
        title="Nursing Operations & Clinical Hubs"
        subtitle="Quickly navigate to verified hospital clinical subsystems."
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
            onClick={() => navigate('/inpatient')}
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
                <BedDouble size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Inpatient & Bed Allocation</h4>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Manage ward capacity, transfer patients between beds, and process discharge folios.
            </p>
          </div>

          <div
            className="card"
            style={{ padding: 16, cursor: 'pointer' }}
            onClick={() => navigate('/appointments')}
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
                <HeartPulse size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Triage & Vital Signs</h4>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Record temperature, pulse, blood pressure, SpO2, and triage incoming patients.
            </p>
          </div>

          <div
            className="card"
            style={{ padding: 16, cursor: 'pointer' }}
            onClick={() => navigate('/pharmacy')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                }}
              >
                <Pill size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Medication Administration</h4>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Review dispensed medications, dosages, and verify prescription schedules.
            </p>
          </div>

          <div
            className="card"
            style={{ padding: 16, cursor: 'pointer' }}
            onClick={() => navigate('/laboratory')}
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
                <Microscope size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Lab Sample Collection</h4>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Track lab requisitions, collect phlebotomy samples, and dispatch specimens to pathology.
            </p>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
};
