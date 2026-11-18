import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  UserCheck,
  CreditCard,
  Building2,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { DashboardHeader } from '../components/DashboardHeader';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { DashboardSection } from '../components/DashboardSection';
import { DashboardEmptyState } from '../components/DashboardEmptyState';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { DashboardSkeletonCards } from '../components/DashboardSkeleton';
import type { Appointment, FreeSlot } from '../../../types/appointment';
import type { Doctor } from '../../../types/doctor';

export const ReceptionistDashboard: React.FC = () => {
  const { token, apiBaseUrl, currentUser, userBranches, activeBranchId } = useAuth();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [doctorSlots, setDoctorSlots] = useState<FreeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState<boolean>(false);
  const [totalPatients, setTotalPatients] = useState<number>(0);

  const [queueFilter, setQueueFilter] = useState<'all' | 'expected' | 'waiting' | 'completed'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);

  const activeBranch = userBranches.find((b) => String(b.id) === String(activeBranchId)) || {
    name: 'Main Campus',
    code: 'MAIN',
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Fetch appointments, doctors, and patient counts
  const fetchReceptionData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Today's Outpatient Appointments
      const aptsUrl = new URL(`${apiBaseUrl}/api/v1/appointments`);
      aptsUrl.searchParams.set('date', todayStr);
      aptsUrl.searchParams.set('limit', '100');
      if (activeBranchId) aptsUrl.searchParams.set('branchId', activeBranchId);

      const aptsPromise = fetch(aptsUrl.toString(), { headers }).then((r) => r.json());

      // 2. Fetch Active Doctors Roster
      const docsUrl = new URL(`${apiBaseUrl}/api/v1/doctors`);
      docsUrl.searchParams.set('limit', '50');
      if (activeBranchId) docsUrl.searchParams.set('branchId', activeBranchId);

      const docsPromise = fetch(docsUrl.toString(), { headers }).then((r) => r.json());

      // 3. Fetch Overview Counts for Total Patients
      const overviewPromise = fetch(`${apiBaseUrl}/api/v1/dashboard/overview?period=today`, { headers })
        .then((r) => r.json())
        .catch(() => ({ success: false }));

      const [aptsRes, docsRes, overviewRes] = await Promise.all([
        aptsPromise,
        docsPromise,
        overviewPromise,
      ]);

      if (aptsRes.success) {
        const list = Array.isArray(aptsRes.data)
          ? aptsRes.data
          : aptsRes.data?.items || aptsRes.data?.data || [];
        setAppointments(list);
      } else {
        setError(aptsRes.error?.message || aptsRes.message || 'Failed to load daily appointment schedule.');
      }

      if (docsRes.success) {
        const docList = Array.isArray(docsRes.data)
          ? docsRes.data
          : docsRes.data?.items || docsRes.data?.data || [];
        setDoctorsList(docList);
        if (docList.length > 0 && !selectedDoctorId) {
          setSelectedDoctorId(String(docList[0].id));
        }
      }

      if (overviewRes.success && overviewRes.data?.patients?.totalRegistered) {
        setTotalPatients(overviewRes.data.patients.totalRegistered);
      }
    } catch {
      setError('Unable to communicate with the front desk operations service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiBaseUrl, todayStr, activeBranchId, selectedDoctorId]);

  useEffect(() => {
    fetchReceptionData();
  }, [fetchReceptionData]);

  // Load free slots when doctor selection changes
  useEffect(() => {
    if (!token || !selectedDoctorId) {
      setDoctorSlots([]);
      return;
    }

    const fetchSlots = async () => {
      setSlotsLoading(true);
      try {
        const url = new URL(`${apiBaseUrl}/api/v1/appointments/free-slots`);
        url.searchParams.set('doctor', selectedDoctorId);
        url.searchParams.set('date', todayStr);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data)) {
          setDoctorSlots(data.data);
        } else {
          setDoctorSlots([]);
        }
      } catch {
        setDoctorSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchSlots();
  }, [token, apiBaseUrl, selectedDoctorId, todayStr]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchReceptionData();
  };

  // Instant Check-In Action
  const handleCheckInPatient = async (appointmentId: string, patientName: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'arrived' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCheckInSuccess(`Patient ${patientName} checked in successfully. Doctor notified.`);
        setTimeout(() => setCheckInSuccess(null), 4000);
        // Refresh local appointments state
        setAppointments((prev) =>
          prev.map((a) => (a.id === appointmentId ? { ...a, status: 'arrived' } : a))
        );
      } else {
        alert(data.error?.message || 'Failed to update check-in status.');
      }
    } catch {
      alert('Network error updating check-in status.');
    }
  };

  // Derived counts
  const expectedCount = useMemo(() => {
    return appointments.filter((a) => (a.status || '').toLowerCase() === 'scheduled').length;
  }, [appointments]);

  const waitingCount = useMemo(() => {
    return appointments.filter((a) => {
      const s = (a.status || '').toLowerCase();
      return s === 'arrived' || s === 'waiting';
    }).length;
  }, [appointments]);

  const inConsultCount = useMemo(() => {
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

  // Filtered queue
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const s = (apt.status || 'scheduled').toLowerCase();
      if (queueFilter === 'expected') return s === 'scheduled';
      if (queueFilter === 'waiting') return s === 'arrived' || s === 'waiting';
      if (queueFilter === 'completed') return s === 'completed' || s === 'visited';
      return true;
    });
  }, [appointments, queueFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Front-Desk Header */}
      <DashboardHeader
        title="Front Desk & Outpatient Reception"
        subtitle="Manage patient arrivals, intake check-ins, registration, and consultant room schedule"
        userName={currentUser?.name}
        userRole="Front Desk Officer"
        branchName={activeBranch.name}
        branchCode={activeBranch.code}
        icon={Users}
        onRefresh={handleManualRefresh}
        isRefreshing={refreshing}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate('/patients')}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
            >
              <Users size={14} />
              <span>Register Patient</span>
            </button>
            <button
              onClick={() => navigate('/appointments', { state: { initialAction: 'book' } })}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
            >
              <Plus size={14} />
              <span>Book Appointment</span>
            </button>
          </div>
        }
      />

      {/* Check-In Success Toast Banner */}
      {checkInSuccess && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 10,
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} style={{ color: '#059669' }} />
          <span>{checkInSuccess}</span>
        </div>
      )}

      {/* Error State */}
      {error && <DashboardErrorState message={error} onRetry={fetchReceptionData} />}

      {/* Front Desk KPI Cards (6 Key Front-Desk Metrics) */}
      {loading && appointments.length === 0 ? (
        <DashboardSkeletonCards count={6} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }}
        >
          {/* 1. Today's Total Appointments */}
          <DashboardMetricCard
            title="Today's Appointments"
            value={appointments.length}
            subtext="Total booked outpatient visits"
            icon={Calendar}
            variant="primary"
          />

          {/* 2. Expected Arrivals */}
          <DashboardMetricCard
            title="Expected Arrivals"
            value={expectedCount}
            subtext="Yet to arrive at clinic"
            icon={Clock}
            variant="amber"
          />

          {/* 3. Checked-In & Waiting */}
          <DashboardMetricCard
            title="In Waiting Area"
            value={waitingCount}
            subtext="Checked in & ready"
            icon={UserCheck}
            variant="teal"
            badge={waitingCount > 0 ? 'Active Queue' : undefined}
          />

          {/* 4. In Consultation */}
          <DashboardMetricCard
            title="In Consultation"
            value={inConsultCount}
            subtext="Currently with clinician"
            icon={Stethoscope}
            variant="primary"
          />

          {/* 5. Completed Visits */}
          <DashboardMetricCard
            title="Completed Visits"
            value={completedCount}
            subtext="Finished consultations"
            icon={CheckCircle2}
            variant="emerald"
          />

          {/* 6. Total Patient Registry */}
          <DashboardMetricCard
            title="Patient Master Registry"
            value={totalPatients.toLocaleString()}
            subtext="Total registered patients"
            icon={Users}
            variant="slate"
            onClick={() => navigate('/patients')}
          />
        </div>
      )}

      {/* Main Grid: Patient Arrival Queue & Consultant Slot Availability */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
        {/* Outpatient Arrival Queue */}
        <DashboardSection
          title="Patient Arrival & Check-In Queue"
          subtitle="Real-time intake queue with instant patient arrival confirmation"
          icon={Clock}
          badge={`${filteredAppointments.length} visits`}
          action={
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
              <button
                className={`btn ${queueFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: 11.5, border: 'none', borderRadius: 6 }}
                onClick={() => setQueueFilter('all')}
              >
                All ({appointments.length})
              </button>
              <button
                className={`btn ${queueFilter === 'expected' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: 11.5, border: 'none', borderRadius: 6 }}
                onClick={() => setQueueFilter('expected')}
              >
                Expected ({expectedCount})
              </button>
              <button
                className={`btn ${queueFilter === 'waiting' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: 11.5, border: 'none', borderRadius: 6 }}
                onClick={() => setQueueFilter('waiting')}
              >
                Waiting ({waitingCount})
              </button>
              <button
                className={`btn ${queueFilter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: 11.5, border: 'none', borderRadius: 6 }}
                onClick={() => setQueueFilter('completed')}
              >
                Done ({completedCount})
              </button>
            </div>
          }
          noPadding
        >
          {filteredAppointments.length === 0 ? (
            <DashboardEmptyState
              icon={Calendar}
              title="No Patient Arrivals Found"
              description="No patients match the selected queue filter for today's appointment schedule."
              actionText="Book New Appointment"
              onAction={() => navigate('/appointments', { state: { initialAction: 'book' } })}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 14px' }}>Time</th>
                    <th style={{ padding: '10px 14px' }}>Patient</th>
                    <th style={{ padding: '10px 14px' }}>Doctor</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Front Desk Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((apt) => {
                    const s = (apt.status || 'scheduled').toLowerCase();
                    const isScheduled = s === 'scheduled';
                    const isWaiting = s === 'arrived' || s === 'waiting';
                    const isCompleted = s === 'completed' || s === 'visited';

                    return (
                      <tr key={apt.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontWeight: 700, color: '#0284c7' }}>
                            {apt.timeSlot || apt.sTime?.split(' ')[1] || '09:00'}
                          </span>
                        </td>

                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                            {apt.patient?.name || `Patient #${apt.patientId}`}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            MRN #{apt.patient?.patientId || apt.patientId} {apt.patient?.phone ? `• ${apt.patient.phone}` : ''}
                          </div>
                        </td>

                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{apt.doctor?.name || `Doctor #${apt.doctorId}`}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {apt.doctor?.department || 'General Medicine'}
                          </div>
                        </td>

                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 9999,
                              textTransform: 'uppercase',
                              background: isWaiting
                                ? '#ccfbf1'
                                : isCompleted
                                  ? '#dcfce7'
                                  : isScheduled
                                    ? '#fef3c7'
                                    : '#f1f5f9',
                              color: isWaiting
                                ? '#0f766e'
                                : isCompleted
                                  ? '#15803d'
                                  : isScheduled
                                    ? '#b45309'
                                    : '#475569',
                            }}
                          >
                            {apt.status || 'scheduled'}
                          </span>
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          {isScheduled ? (
                            <button
                              className="btn btn-primary"
                              style={{ padding: '4px 10px', fontSize: 11.5, borderRadius: 6 }}
                              onClick={() => handleCheckInPatient(apt.id, apt.patient?.name || 'Patient')}
                              title="Mark patient as arrived in waiting area"
                            >
                              Check In
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: 11.5, borderRadius: 6 }}
                              onClick={() => navigate('/appointments')}
                            >
                              Details
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DashboardSection>

        {/* Doctor Consultation Slot Availability */}
        <DashboardSection
          title="Consultant Slot Availability"
          subtitle="Real-time consultation slot lookup for walk-in appointment booking"
          icon={Stethoscope}
        >
          <div style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
              Select Consultant:
            </label>
            <select
              className="form-select"
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
            >
              {doctorsList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.department ? d.department.replace(/_\d{10,}/g, '') : 'General'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
              Available Consultation Slots (Today, {todayStr}):
            </div>

            {slotsLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Querying clinic schedule...
              </div>
            ) : doctorSlots.length === 0 ? (
              <div style={{ padding: 16, background: 'var(--bg-subtle)', borderRadius: 8, textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
                No free slots available for this doctor today.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {doctorSlots.map((slot, idx) => (
                  <button
                    key={idx}
                    className="btn btn-secondary"
                    style={{
                      padding: '6px 4px',
                      fontSize: 12,
                      fontWeight: 700,
                      background: '#f0fdf4',
                      borderColor: '#bbf7d0',
                      color: '#15803d',
                      textAlign: 'center',
                    }}
                    onClick={() => {
                      const doc = doctorsList.find((d) => String(d.id) === selectedDoctorId);
                      navigate('/appointments', {
                        state: {
                          doctor: doc,
                          initialAction: 'book',
                        },
                      });
                    }}
                    title={`Click to book appointment at ${slot.start}`}
                  >
                    {slot.start}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DashboardSection>
      </div>

      {/* Front-Desk Quick Operations Bar */}
      <DashboardSection title="Front Desk Operational Shortcuts" subtitle="Fast links to daily reception management workflows" icon={Building2}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <button
            onClick={() => navigate('/patients')}
            className="btn btn-secondary"
            style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <Users size={18} style={{ color: '#0284c7' }} />
            <span>Search Patient Records</span>
          </button>

          <button
            onClick={() => navigate('/appointments')}
            className="btn btn-secondary"
            style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <Calendar size={18} style={{ color: '#7c3aed' }} />
            <span>Full Appointment Calendar</span>
          </button>

          <button
            onClick={() => navigate('/billing')}
            className="btn btn-secondary"
            style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <CreditCard size={18} style={{ color: '#dc2626' }} />
            <span>Raise Patient Invoice</span>
          </button>

          <button
            onClick={() => navigate('/doctors')}
            className="btn btn-secondary"
            style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', fontSize: 13 }}
          >
            <Stethoscope size={18} style={{ color: '#059669' }} />
            <span>Consultant Roster</span>
          </button>
        </div>
      </DashboardSection>
    </div>
  );
};
