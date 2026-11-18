import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stethoscope,
  Clock,
  CheckCircle2,
  Calendar,
  Pill,
  Microscope,
  Radio,
  BedDouble,
  Filter,
  AlertCircle,
  FileText,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardHeader } from '../components/DashboardHeader';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { DashboardSection } from '../components/DashboardSection';
import { DashboardEmptyState } from '../components/DashboardEmptyState';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { DashboardSkeletonCards } from '../components/DashboardSkeleton';
import type { Appointment } from '../../../types/appointment';

interface DoctorWorkloadMetrics {
  doctorId: string | null;
  message?: string;
  appointments: {
    total: number;
    completed: number;
    items: Appointment[];
  };
  consultations: {
    pendingDrafts: number;
    completed: number;
  };
}

export const DoctorDashboard: React.FC = () => {
  const { token, apiBaseUrl, currentUser, userBranches, activeBranchId } = useAuth();
  const navigate = useNavigate();

  const [workload, setWorkload] = useState<DoctorWorkloadMetrics | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [queueFilter, setQueueFilter] = useState<'all' | 'waiting' | 'in_consultation' | 'completed'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [missingDoctorProfile, setMissingDoctorProfile] = useState<boolean>(false);

  const activeBranch = userBranches.find((b) => String(b.id) === String(activeBranchId)) || {
    name: 'Main Campus',
    code: 'MAIN',
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const fetchDoctorData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Doctor Workload (resolves doctor by ionUserId on backend)
      const workloadRes = await fetch(`${apiBaseUrl}/api/v1/dashboard/doctor-workload?period=today`, {
        headers,
      }).then((r) => r.json());

      if (workloadRes.success && workloadRes.data) {
        if (!workloadRes.data.doctorId) {
          setMissingDoctorProfile(true);
        } else {
          setMissingDoctorProfile(false);
          setWorkload(workloadRes.data);

          // 2. Fetch full appointments list for this doctor today (with populated patient details)
          const aptsUrl = new URL(`${apiBaseUrl}/api/v1/appointments`);
          aptsUrl.searchParams.set('doctor', String(workloadRes.data.doctorId));
          aptsUrl.searchParams.set('date', todayStr);
          aptsUrl.searchParams.set('limit', '50');

          const aptsRes = await fetch(aptsUrl.toString(), { headers }).then((r) => r.json());
          if (aptsRes.success) {
            const list = Array.isArray(aptsRes.data)
              ? aptsRes.data
              : aptsRes.data?.items || aptsRes.data?.data || [];
            setAppointments(list);
          }
        }
      } else {
        setError(workloadRes.error?.message || workloadRes.message || 'Failed to load clinician workload.');
      }
    } catch {
      setError('Unable to reach clinical workbench services.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiBaseUrl, todayStr]);

  useEffect(() => {
    fetchDoctorData();
  }, [fetchDoctorData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchDoctorData();
  };

  // Filtered queue
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const s = (apt.status || '').toLowerCase();
      if (queueFilter === 'waiting') {
        return s === 'arrived' || s === 'waiting';
      }
      if (queueFilter === 'in_consultation') {
        return s === 'in consultation' || s === 'in_consultation' || s === 'consulting';
      }
      if (queueFilter === 'completed') {
        return s === 'completed' || s === 'visited';
      }
      return true;
    });
  }, [appointments, queueFilter]);

  // Derived counts
  const waitingCount = useMemo(() => {
    return appointments.filter((a) => {
      const s = (a.status || '').toLowerCase();
      return s === 'arrived' || s === 'waiting';
    }).length;
  }, [appointments]);

  const inConsultationCount = useMemo(() => {
    return appointments.filter((a) => {
      const s = (a.status || '').toLowerCase();
      return s === 'in consultation' || s === 'in_consultation' || s === 'consulting';
    }).length;
  }, [appointments]);

  const completedCount = useMemo(() => {
    return appointments.filter((a) => {
      const s = (a.status || '').toLowerCase();
      return s === 'completed' || s === 'visited';
    }).length;
  }, [appointments]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Clinician Header */}
      <DashboardHeader
        title="My Clinical Workbench & Patient Queue"
        subtitle="Manage your daily OPD outpatient schedule, start consultations, and track pending clinical notes"
        userName={currentUser?.name}
        userRole="Consultant Clinician"
        branchName={activeBranch.name}
        branchCode={activeBranch.code}
        icon={Stethoscope}
        onRefresh={handleManualRefresh}
        isRefreshing={refreshing}
      />

      {/* Missing Doctor Profile Notice */}
      {missingDoctorProfile && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 12,
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            color: '#92400e',
          }}
        >
          <AlertCircle size={22} style={{ color: '#d97706', flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: 14, display: 'block', marginBottom: 2 }}>
              Doctor Record Not Linked
            </strong>
            <span style={{ fontSize: 13, lineHeight: 1.4 }}>
              Your login account ({currentUser?.email}) does not currently have a linked practitioner profile in the doctor register.
              Please ask an administrator to assign your user account to your consultant profile in the Medical Staff roster.
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && <DashboardErrorState message={error} onRetry={fetchDoctorData} />}

      {/* Doctor Clinical KPI Cards */}
      {loading && !workload ? (
        <DashboardSkeletonCards count={5} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {/* 1. Today's Booked Visits */}
          <DashboardMetricCard
            title="Today's OPD Visits"
            value={appointments.length}
            subtext="Total booked consultations"
            icon={Calendar}
            variant="primary"
          />

          {/* 2. Waiting Patients */}
          <DashboardMetricCard
            title="Waiting in Clinic"
            value={waitingCount}
            subtext="Arrived & ready for intake"
            icon={Clock}
            variant="teal"
            badge={waitingCount > 0 ? 'Urgent Queue' : undefined}
          />

          {/* 3. In Progress */}
          <DashboardMetricCard
            title="In Consultation"
            value={inConsultationCount}
            subtext="Currently examining"
            icon={Activity}
            variant="amber"
          />

          {/* 4. Completed Visits */}
          <DashboardMetricCard
            title="Completed Visits"
            value={completedCount}
            subtext="Concluded today"
            icon={CheckCircle2}
            variant="emerald"
          />

          {/* 5. Pending Draft Notes */}
          <DashboardMetricCard
            title="Pending Draft Notes"
            value={workload?.consultations.pendingDrafts || 0}
            subtext="Unsaved clinical documentation"
            icon={FileText}
            variant={workload?.consultations.pendingDrafts ? 'rose' : 'slate'}
          />
        </div>
      )}

      {/* OPD Patient Queue Table */}
      <DashboardSection
        title="Today's Outpatient Queue"
        subtitle="Chronological patient appointment list for clinical examination"
        icon={Clock}
        badge={`${filteredAppointments.length} patients`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
              <button
                className={`btn ${queueFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: 11.5, border: 'none', borderRadius: 6 }}
                onClick={() => setQueueFilter('all')}
              >
                All ({appointments.length})
              </button>
              <button
                className={`btn ${queueFilter === 'waiting' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: 11.5, border: 'none', borderRadius: 6 }}
                onClick={() => setQueueFilter('waiting')}
              >
                Waiting ({waitingCount})
              </button>
              <button
                className={`btn ${queueFilter === 'in_consultation' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: 11.5, border: 'none', borderRadius: 6 }}
                onClick={() => setQueueFilter('in_consultation')}
              >
                In Consult ({inConsultationCount})
              </button>
              <button
                className={`btn ${queueFilter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: 11.5, border: 'none', borderRadius: 6 }}
                onClick={() => setQueueFilter('completed')}
              >
                Completed ({completedCount})
              </button>
            </div>
          </div>
        }
        noPadding
      >
        {filteredAppointments.length === 0 ? (
          <DashboardEmptyState
            icon={Calendar}
            title={queueFilter === 'all' ? 'No Appointments Scheduled' : `No Patients in "${queueFilter}" Status`}
            description="You have no patients currently scheduled matching this queue filter for today."
            actionText="Refresh Schedule"
            onAction={fetchDoctorData}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 18px' }}>Slot Time</th>
                  <th style={{ padding: '12px 18px' }}>Patient Details</th>
                  <th style={{ padding: '12px 18px' }}>Reason / Notes</th>
                  <th style={{ padding: '12px 18px' }}>Vitals</th>
                  <th style={{ padding: '12px 18px' }}>Status</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Clinical Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((apt) => {
                  const s = (apt.status || 'scheduled').toLowerCase();
                  const isWaiting = s === 'arrived' || s === 'waiting';
                  const isInConsult = s === 'in consultation' || s === 'in_consultation' || s === 'consulting';
                  const isCompleted = s === 'completed' || s === 'visited';

                  return (
                    <tr
                      key={apt.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: isInConsult ? '#f0f9ff' : isWaiting ? '#f0fdf4' : 'transparent',
                      }}
                    >
                      {/* Slot Time */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0284c7' }}>
                          <Clock size={14} />
                          <span>{apt.timeSlot || apt.sTime?.split(' ')[1] || '09:00'}</span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{apt.date}</span>
                      </td>

                      {/* Patient Details */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 13.5 }}>
                          {apt.patient?.name || `Patient #${apt.patientId}`}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                          <span>MRN: <strong>#{apt.patient?.patientId || apt.patientId}</strong></span>
                          {apt.patient?.phone && <span>• {apt.patient.phone}</span>}
                        </div>
                      </td>

                      {/* Reason / Notes */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)', maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {apt.remarks || 'Outpatient consultation'}
                        </div>
                      </td>

                      {/* Vitals */}
                      <td style={{ padding: '14px 18px', fontSize: 12 }}>
                        {apt.bp || apt.pulse || apt.temperature ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {apt.bp && <span style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>BP: {apt.bp}</span>}
                            {apt.pulse && <span style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>HR: {apt.pulse}</span>}
                            {apt.temperature && <span style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>{apt.temperature}</span>}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not recorded</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: 9999,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            background: isInConsult
                              ? '#dbeafe'
                              : isWaiting
                                ? '#ccfbf1'
                                : isCompleted
                                  ? '#dcfce7'
                                  : '#fef3c7',
                            color: isInConsult
                              ? '#1d4ed8'
                              : isWaiting
                                ? '#0f766e'
                                : isCompleted
                                  ? '#15803d'
                                  : '#b45309',
                          }}
                        >
                          {apt.status || 'scheduled'}
                        </span>
                      </td>

                      {/* Clinical Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => navigate('/consultations', { state: { appointment: apt } })}
                          >
                            <Stethoscope size={14} />
                            <span>{isCompleted ? 'Review Consult' : 'Start Consult'}</span>
                          </button>

                          <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', fontSize: 12, borderRadius: 6 }}
                            onClick={() =>
                              navigate('/prescriptions', {
                                state: { patientId: apt.patientId, doctorId: apt.doctorId },
                              })
                            }
                            title="Issue Prescription"
                          >
                            <Pill size={14} style={{ color: '#059669' }} />
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

      {/* Clinical Workbench Quick Actions */}
      <DashboardSection title="Clinical Direct Workspaces" subtitle="Rapid shortcuts to specialized diagnostic and inpatient modules" icon={Stethoscope}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <button
            onClick={() => navigate('/consultations')}
            className="btn btn-secondary"
            style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <Stethoscope size={18} style={{ color: '#0284c7' }} />
            <span>Consultation Archive</span>
          </button>

          <button
            onClick={() => navigate('/prescriptions')}
            className="btn btn-secondary"
            style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <Pill size={18} style={{ color: '#059669' }} />
            <span>Prescription Records</span>
          </button>

          <button
            onClick={() => navigate('/laboratory')}
            className="btn btn-secondary"
            style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <Microscope size={18} style={{ color: '#d97706' }} />
            <span>Laboratory Results</span>
          </button>

          <button
            onClick={() => navigate('/radiology')}
            className="btn btn-secondary"
            style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <Radio size={18} style={{ color: '#7c3aed' }} />
            <span>Radiology & PACS</span>
          </button>

          <button
            onClick={() => navigate('/inpatient')}
            className="btn btn-secondary"
            style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <BedDouble size={18} style={{ color: '#e11d48' }} />
            <span>Inpatient Ward Rounds</span>
          </button>
        </div>
      </DashboardSection>
    </div>
  );
};
