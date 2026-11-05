import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle,
  Video,
  X,
  AlertCircle,
  Stethoscope,
  Filter,
} from 'lucide-react';
import type { Appointment, CreateAppointmentDto, FreeSlot } from '../../types/appointment';
import type { Patient } from '../../types/patient';
import type { Doctor } from '../../types/doctor';

interface AppointmentWorkspaceProps {
  token: string;
  apiBaseUrl: string;
  activeBranchId?: string;
  initialPatient?: Patient | null;
  initialDoctor?: Doctor | null;
  onStartConsultation?: (appointment: Appointment) => void;
  initialAction?: 'book' | null;
}

export const AppointmentWorkspace: React.FC<AppointmentWorkspaceProps> = ({
  token,
  apiBaseUrl,
  activeBranchId,
  initialPatient,
  initialDoctor,
  onStartConsultation,
  initialAction,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterDate, setFilterDate] = useState(todayStr);
  const [filterDoctor, setFilterDoctor] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Booking Modal State
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookPatientSearch, setBookPatientSearch] = useState('');
  const [searchedPatients, setSearchedPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatient || null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(initialDoctor ? initialDoctor.id : '');
  const [bookingDate, setBookingDate] = useState(todayStr);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [freeSlots, setFreeSlots] = useState<FreeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [isVideo, setIsVideo] = useState(false);
  const [bp, setBp] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperature, setTemperature] = useState('');
  const [weight, setWeight] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Open book modal automatically if initial patient or doctor is provided or initialAction is 'book'
  useEffect(() => {
    if (initialPatient) {
      setSelectedPatient(initialPatient);
      setShowBookModal(true);
    }
    if (initialDoctor) {
      setSelectedDoctorId(initialDoctor.id);
      setShowBookModal(true);
    }
    if (initialAction === 'book') {
      setShowBookModal(true);
    }
  }, [initialPatient, initialDoctor, initialAction]);

  // Load doctors for dropdowns
  const fetchDoctors = useCallback(async () => {
    if (!token) return;
    try {
      const url = new URL(`${apiBaseUrl}/api/v1/doctors`);
      url.searchParams.set('limit', '100');
      if (activeBranchId) url.searchParams.set('branchId', activeBranchId);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDoctorsList(data.data.data || []);
      }
    } catch {
      // Ignore background doctor lookup errors
    }
  }, [token, apiBaseUrl, activeBranchId]);

  // Load appointments
  const fetchAppointments = useCallback(async (p = page) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${apiBaseUrl}/api/v1/appointments`);
      if (filterDate) url.searchParams.set('date', filterDate);
      if (filterDoctor) url.searchParams.set('doctor', filterDoctor);
      if (filterStatus) url.searchParams.set('status', filterStatus);
      url.searchParams.set('page', String(p));
      url.searchParams.set('limit', '25');

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setAppointments(data.data.data || []);
        setTotal(data.data.total || 0);
        setTotalPages(data.data.totalPages || 1);
      } else {
        setError(data.error?.message || data.message || 'Failed to fetch appointments.');
      }
    } catch {
      setError('Network communication error with appointment service.');
    } finally {
      setLoading(false);
    }
  }, [token, apiBaseUrl, filterDate, filterDoctor, filterStatus, page]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  useEffect(() => {
    fetchAppointments(1);
  }, [fetchAppointments]);

  // Patient search in booking modal
  useEffect(() => {
    if (!token || !bookPatientSearch.trim() || bookPatientSearch.length < 2) {
      setSearchedPatients([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const url = new URL(`${apiBaseUrl}/api/v1/patients`);
        url.searchParams.set('q', bookPatientSearch.trim());
        url.searchParams.set('limit', '5');
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setSearchedPatients(data.data.data || []);
        }
      } catch {
        setSearchedPatients([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [token, apiBaseUrl, bookPatientSearch]);

  // Fetch free slots when doctor or date changes in modal
  useEffect(() => {
    if (!token || !selectedDoctorId || !bookingDate) {
      setFreeSlots([]);
      return;
    }
    const fetchSlots = async () => {
      setSlotsLoading(true);
      try {
        const url = new URL(`${apiBaseUrl}/api/v1/appointments/free-slots`);
        url.searchParams.set('doctor', selectedDoctorId);
        url.searchParams.set('date', bookingDate);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data)) {
          setFreeSlots(data.data);
          if (data.data.length > 0) {
            setSelectedSlot(data.data[0].start);
          } else {
            setSelectedSlot('');
          }
        } else {
          setFreeSlots([]);
          setSelectedSlot('');
        }
      } catch {
        setFreeSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };
    fetchSlots();
  }, [token, apiBaseUrl, selectedDoctorId, bookingDate]);

  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchAppointments(page);
      } else {
        alert(data.error?.message || 'Failed to update appointment status.');
      }
    } catch {
      alert('Network error updating appointment status.');
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      setBookingError('Please select a patient.');
      return;
    }
    if (!selectedDoctorId) {
      setBookingError('Please select a doctor.');
      return;
    }
    if (!selectedSlot) {
      setBookingError('Please choose an available appointment time slot.');
      return;
    }

    setBookingSubmitting(true);
    setBookingError(null);

    try {
      const payload: CreateAppointmentDto = {
        patient: selectedPatient.id,
        doctor: selectedDoctorId,
        date: bookingDate,
        start: selectedSlot,
        minutes: durationMinutes,
        status: 'scheduled',
        remarks: remarks.trim() || undefined,
        video: isVideo,
        b_p: bp.trim() || undefined,
        pulse: pulse.trim() || undefined,
        temprature: temperature.trim() || undefined,
        weight: weight.trim() || undefined,
        branchId: activeBranchId ? Number(activeBranchId) : undefined,
      };

      const res = await fetch(`${apiBaseUrl}/api/v1/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setShowBookModal(false);
        setRemarks('');
        setBp('');
        setPulse('');
        setTemperature('');
        setWeight('');
        setIsVideo(false);
        fetchAppointments(1);
      } else {
        const msg = data.error?.message || data.message || 'Booking failed.';
        setBookingError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setBookingError('Network communication error with scheduling engine.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={22} style={{ color: '#0284c7' }} />
            Outpatient Clinic Schedule & Visits
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Real-time appointment calendar, slot availability, patient check-ins, and consultation intake
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            if (!selectedDoctorId && doctorsList.length > 0) {
              setSelectedDoctorId(doctorsList[0].id);
            }
            setShowBookModal(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Plus size={16} /> Book Appointment
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={16} style={{ color: '#64748b' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Date:</span>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto', padding: '6px 10px' }}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Stethoscope size={16} style={{ color: '#64748b' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Doctor:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 10px' }}
              value={filterDoctor}
              onChange={(e) => setFilterDoctor(e.target.value)}
            >
              <option value="">All Consultants</option>
              {doctorsList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.department || 'General'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={16} style={{ color: '#64748b' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Status:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 10px' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="arrived">Arrived (In Waiting Area)</option>
              <option value="in consultation">In Consultation</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => {
              setFilterDate(todayStr);
              setFilterDoctor('');
              setFilterStatus('');
            }}
            style={{ marginLeft: 'auto', fontSize: 12 }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, background: '#fee2e2', color: '#b91c1c', fontSize: 13 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Appointment Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            Scheduled Visits: <strong style={{ color: 'var(--text-main)' }}>{total}</strong>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Date: <strong>{filterDate || 'All dates'}</strong>
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 16px' }}>Slot Time</th>
                <th style={{ padding: '10px 16px' }}>Patient</th>
                <th style={{ padding: '10px 16px' }}>Attending Doctor</th>
                <th style={{ padding: '10px 16px' }}>Vitals</th>
                <th style={{ padding: '10px 16px' }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'right' }}>Clinical Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading appointment schedule...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No appointments scheduled for this selection.
                  </td>
                </tr>
              ) : (
                appointments.map((apt) => (
                  <tr key={apt.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={14} />
                        {apt.timeSlot || apt.sTime?.split(' ')[1] || 'TBD'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {apt.date}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{apt.patient?.name || `Patient #${apt.patientId}`}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        MRN #{apt.patient?.patientId || apt.patientId} {apt.patient?.phone ? `• ${apt.patient.phone}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{apt.doctor?.name || `Doctor #${apt.doctorId}`}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {apt.doctor?.department || 'General'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>
                      {apt.bp || apt.temperature ? (
                        <div>
                          {apt.bp && <span>BP: <strong>{apt.bp}</strong> </span>}
                          {apt.pulse && <span>HR: <strong>{apt.pulse}</strong> </span>}
                          {apt.temperature && <div>Temp: {apt.temperature}</div>}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Pending Intake</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        className={`badge ${
                          apt.status === 'completed'
                            ? 'badge-success'
                            : apt.status === 'in consultation'
                            ? 'badge'
                            : apt.status === 'arrived'
                            ? 'badge-warning'
                            : apt.status === 'cancelled'
                            ? 'badge-danger'
                            : 'badge'
                        }`}
                        style={{
                          textTransform: 'capitalize',
                          background: apt.status === 'in consultation' ? '#e0f2fe' : undefined,
                          color: apt.status === 'in consultation' ? '#0369a1' : undefined,
                          fontWeight: 600,
                        }}
                      >
                        {apt.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {apt.videoUrl && (
                          <a
                            href={apt.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 12, color: '#0284c7' }}
                            title="Join Telemedicine Video Call"
                          >
                            <Video size={14} /> Telemedicine
                          </a>
                        )}

                        {apt.status === 'scheduled' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 12, color: '#d97706' }}
                            onClick={() => handleStatusChange(apt.id, 'arrived')}
                            title="Mark Patient as Arrived at Clinic"
                          >
                            <CheckCircle size={14} /> Check In
                          </button>
                        )}

                        {(apt.status === 'arrived' || apt.status === 'scheduled') && onStartConsultation && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => {
                              handleStatusChange(apt.id, 'in consultation');
                              onStartConsultation(apt);
                            }}
                            title="Begin Doctor Consultation"
                          >
                            <Stethoscope size={14} /> Consult
                          </button>
                        )}

                        {apt.status === 'in consultation' && onStartConsultation && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 8px', fontSize: 12, background: '#0284c7' }}
                            onClick={() => onStartConsultation(apt)}
                            title="Resume Active Consultation"
                          >
                            <Stethoscope size={14} /> Resume
                          </button>
                        )}

                        {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 12, color: '#ef4444' }}
                            onClick={() => {
                              if (confirm('Cancel this scheduled appointment?')) {
                                handleStatusChange(apt.id, 'cancelled');
                              }
                            }}
                            title="Cancel Appointment"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              className="btn btn-secondary"
              disabled={page <= 1 || loading}
              onClick={() => {
                const prev = Math.max(1, page - 1);
                setPage(prev);
                fetchAppointments(prev);
              }}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => {
                const next = Math.min(totalPages, page + 1);
                setPage(next);
                fetchAppointments(next);
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {showBookModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16
        }}>
          <div className="card" style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 28, position: 'relative' }}>
            <button
              onClick={() => setShowBookModal(false)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={20} style={{ color: '#0284c7' }} />
              Book Outpatient Consultation
            </h3>

            {bookingError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
                <AlertCircle size={16} />
                <span>{bookingError}</span>
              </div>
            )}

            <form onSubmit={handleBookAppointment}>
              {/* Step 1: Patient Selection */}
              <div className="form-group">
                <label className="form-label">1. Select Patient *</label>
                {selectedPatient ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#e0f2fe', borderRadius: 8, border: '1px solid #bae6fd' }}>
                    <div>
                      <strong style={{ color: '#0369a1' }}>{selectedPatient.name}</strong>
                      <span style={{ fontSize: 12, color: '#0284c7', marginLeft: 8 }}>MRN #{selectedPatient.patientId || selectedPatient.id}</span>
                      {selectedPatient.phone && <span style={{ fontSize: 12, color: '#0284c7', marginLeft: 8 }}>• {selectedPatient.phone}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(null)}
                      style={{ fontSize: 12, color: '#0284c7', textDecoration: 'underline' }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search patient by MRN or name..."
                      value={bookPatientSearch}
                      onChange={(e) => setBookPatientSearch(e.target.value)}
                    />
                    {searchedPatients.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        zIndex: 10,
                        maxHeight: 180,
                        overflowY: 'auto'
                      }}>
                        {searchedPatients.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedPatient(p);
                              setBookPatientSearch('');
                              setSearchedPatients([]);
                            }}
                            style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 13 }}
                          >
                            <strong>{p.name}</strong> <span style={{ color: '#0284c7' }}>#{p.patientId || p.id}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{p.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Doctor and Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">2. Attending Doctor *</label>
                  <select
                    className="form-select"
                    required
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                  >
                    <option value="">Select Doctor</option>
                    {doctorsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.department || 'General'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Appointment Date *</label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Step 3: Available Free Slot Picker */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>3. Available Consultation Slots</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Duration:</span>
                    <select
                      className="form-select"
                      style={{ width: 'auto', padding: '2px 6px', fontSize: 11 }}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 15)}
                    >
                      <option value="15">15 mins</option>
                      <option value="30">30 mins</option>
                      <option value="45">45 mins</option>
                    </select>
                  </div>
                </div>

                {slotsLoading ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Checking clinic schedule...
                  </div>
                ) : freeSlots.length === 0 ? (
                  <div style={{ padding: 14, background: '#fffbeb', borderRadius: 6, border: '1px solid #fef3c7', fontSize: 13, color: '#92400e' }}>
                    No free consultation slots available for this doctor on {bookingDate}. Please select another date.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 130, overflowY: 'auto', padding: 4 }}>
                    {freeSlots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlot(slot.start)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          border: '1px solid',
                          borderColor: selectedSlot === slot.start ? '#0284c7' : 'var(--border-color)',
                          background: selectedSlot === slot.start ? '#0284c7' : 'var(--bg-subtle)',
                          color: selectedSlot === slot.start ? '#fff' : 'var(--text-main)',
                          cursor: 'pointer'
                        }}
                      >
                        {slot.start}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preliminary Vitals Intake */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14, marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-main)' }}>
                  Preliminary Vitals (Optional)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Blood Pressure</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="120/80"
                      value={bp}
                      onChange={(e) => setBp(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Pulse (bpm)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="72"
                      value={pulse}
                      onChange={(e) => setPulse(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Temp</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="98.6 F"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Weight</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="70 kg"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Remarks & Telemedicine */}
              <div className="form-group">
                <label className="form-label">Chief Complaint / Remarks</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Patient reason for visit..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <input
                  type="checkbox"
                  id="telemedicine-check"
                  checked={isVideo}
                  onChange={(e) => setIsVideo(e.target.checked)}
                />
                <label htmlFor="telemedicine-check" style={{ fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Video size={14} style={{ color: '#0284c7' }} /> Enable Jitsi Telemedicine Video Room
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowBookModal(false)}
                  disabled={bookingSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={bookingSubmitting || !selectedSlot}>
                  {bookingSubmitting ? 'Confirming...' : `Confirm Booking for ${selectedSlot || '...'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
