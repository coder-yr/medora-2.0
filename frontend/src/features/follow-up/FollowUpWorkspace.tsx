import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  AlertTriangle,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Search,
  Check,
  Building2,
  BellRing,
} from 'lucide-react';

interface FollowUpItem {
  id: string;
  uuid: string;
  followUpNumber: string;
  dueDate: string;
  dueTime: string | null;
  reason: string;
  priority: 'ROUTINE' | 'URGENT' | 'CRITICAL';
  status: 'SCHEDULED' | 'REMINDER_PENDING' | 'REMINDER_SENT' | 'COMPLETED' | 'CANCELLED' | 'MISSED';
  clinicalNotes: string | null;
  reminderPreference: 'IN_APP' | 'EMAIL' | 'SMS' | 'NONE';
  patient: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  doctor: {
    id: string;
    name: string;
    department: string | null;
  };
  branch: {
    id: string;
    name: string;
    code: string;
  };
}

interface CriticalAlertItem {
  id: string;
  criticalFindings: string;
  escalatedAt: string;
  disclaimer: string;
  patient: { id: string; name: string };
  responsibleClinician?: { id: string; name: string };
  labOrder: { id: string; orderNumber: string };
}

interface FollowUpWorkspaceProps {
  token: string | null;
  apiBaseUrl: string;
  activeBranchId?: string;
}

export const FollowUpWorkspace: React.FC<FollowUpWorkspaceProps> = ({
  token,
  apiBaseUrl,
  activeBranchId,
}) => {
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [ackNotes, setAckNotes] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);

  // New Follow-up Form
  const [formPatientId, setFormPatientId] = useState<string>('');
  const [formDoctorId, setFormDoctorId] = useState<string>('1');
  const [formDueDate, setFormDueDate] = useState<string>('');
  const [formDueTime, setFormDueTime] = useState<string>('');
  const [formReason, setFormReason] = useState<string>('');
  const [formPriority, setFormPriority] = useState<'ROUTINE' | 'URGENT' | 'CRITICAL'>('ROUTINE');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formReminderPref, setFormReminderPref] = useState<'IN_APP' | 'EMAIL' | 'SMS' | 'NONE'>('IN_APP');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Follow-ups
      const fuUrl = new URL(`${apiBaseUrl}/api/v1/follow-ups`);
      if (activeBranchId) fuUrl.searchParams.set('branchId', activeBranchId);
      if (statusFilter !== 'ALL') fuUrl.searchParams.set('status', statusFilter);
      if (priorityFilter !== 'ALL') fuUrl.searchParams.set('priority', priorityFilter);

      const [fuRes, alertRes] = await Promise.all([
        fetch(fuUrl.toString(), { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch(`${apiBaseUrl}/api/v1/notifications/critical-alerts`, { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
      ]);

      const fuList = fuRes.data?.data || fuRes.data || fuRes;
      if (Array.isArray(fuList)) setFollowUps(fuList);

      const alertList = alertRes.data?.data || alertRes.data || alertRes;
      if (Array.isArray(alertList)) setCriticalAlerts(alertList);
    } catch (err: any) {
      console.error('Failed to load follow-up records:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiBaseUrl, activeBranchId, statusFilter, priorityFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleComplete = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/follow-ups/${id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: 'Completed during clinical consultation' }),
      });
      if (res.ok) {
        setNotice('Follow-up marked as completed.');
        setTimeout(() => setNotice(null), 3000);
        void fetchData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancel = async (id: string) => {
    const reason = window.prompt('Enter clinical cancellation reason:');
    if (!reason || !reason.trim()) return;

    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/follow-ups/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setNotice('Follow-up cancelled.');
        setTimeout(() => setNotice(null), 3000);
        void fetchData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAcknowledgeAlert = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/notifications/critical-alerts/${id}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: ackNotes.trim() || 'Acknowledged by clinician' }),
      });
      if (res.ok) {
        setAcknowledgingId(null);
        setAckNotes('');
        setNotice('Critical result alert acknowledged.');
        setTimeout(() => setNotice(null), 3000);
        void fetchData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPatientId || !formDueDate || !formReason) {
      alert('Patient ID, Due Date, and Reason are required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/follow-ups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientId: formPatientId,
          doctorId: formDoctorId,
          branchId: activeBranchId,
          dueDate: formDueDate,
          dueTime: formDueTime || undefined,
          reason: formReason,
          priority: formPriority,
          clinicalNotes: formNotes || undefined,
          reminderPreference: formReminderPref,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || json.message || 'Failed to schedule follow-up.');
      }

      setShowCreateModal(false);
      setNotice('Follow-up scheduled and reminder queued successfully.');
      setTimeout(() => setNotice(null), 3000);
      setFormReason('');
      setFormNotes('');
      void fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredFollowUps = followUps.filter((f) => {
    const matchesSearch =
      f.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.followUpNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.reason?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '4px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: 6, fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CalendarCheck size={14} /> Phase 10.5.8 Clinical Engine
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>
            Follow-ups & Clinical Reminders
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#64748b' }}>
            Schedule patient re-evaluations, track automated reminder deliveries, and acknowledge critical diagnostic alerts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => void fetchData()}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 14px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px', background: '#0284c7', borderColor: '#0369a1' }}
          >
            <Plus size={16} /> Schedule Follow-up
          </button>
        </div>
      </div>

      {notice && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      {/* Critical Laboratory Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: 18, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9f1239', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            <AlertTriangle size={18} /> CRITICAL LABORATORY ALERTS PENDING CLINICAL ACKNOWLEDGEMENT ({criticalAlerts.length})
          </div>
          <p style={{ margin: '0 0 12px 0', fontSize: 12.5, color: '#be123c' }}>
            Electronic notification does not replace direct verbal clinical handoff. Immediate clinical review required.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {criticalAlerts.map((alert) => (
              <div key={alert.id} style={{ background: '#ffffff', border: '1px solid #fda4af', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: '#881337' }}>
                    Patient: {alert.patient?.name} (Order #{alert.labOrder?.orderNumber})
                  </div>
                  <div style={{ fontSize: 12.5, color: '#4c0519', marginTop: 2 }}>
                    <strong>Critical Findings:</strong> {alert.criticalFindings}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#9f1239', marginTop: 2 }}>
                    Escalated: {new Date(alert.escalatedAt).toLocaleString()}
                  </div>
                </div>

                <div>
                  {acknowledgingId === alert.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Acknowledgement clinical notes..."
                        value={ackNotes}
                        onChange={(e) => setAckNotes(e.target.value)}
                        className="form-control"
                        style={{ fontSize: 12, minWidth: 200 }}
                      />
                      <button
                        onClick={() => void handleAcknowledgeAlert(alert.id)}
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '6px 12px', background: '#be123c', borderColor: '#9f1239' }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setAcknowledgingId(null)}
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '6px 10px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAcknowledgingId(alert.id)}
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: '6px 14px', background: '#be123c', borderColor: '#9f1239' }}
                    >
                      Acknowledge & Sign
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '14px 18px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 280 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search by patient, follow-up # or clinical reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 34, fontSize: 13 }}
              />
            </div>

            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: 13, width: 160 }}
            >
              <option value="ALL">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              className="form-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ fontSize: 13, width: 140 }}
            >
              <option value="ALL">All Priorities</option>
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Follow-ups Table Card */}
      <div className="card" style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Follow-up #</th>
                <th style={{ padding: '12px 16px' }}>Patient</th>
                <th style={{ padding: '12px 16px' }}>Due Date & Time</th>
                <th style={{ padding: '12px 16px' }}>Clinician</th>
                <th style={{ padding: '12px 16px' }}>Reason & Priority</th>
                <th style={{ padding: '12px 16px' }}>Reminder Pref</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFollowUps.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                    {loading ? 'Loading clinical follow-up records...' : 'No follow-up evaluations found.'}
                  </td>
                </tr>
              ) : (
                filteredFollowUps.map((fu) => (
                  <tr key={fu.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace' }}>
                      {fu.followUpNumber}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{fu.patient?.name}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{fu.patient?.phone || 'No phone'}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{fu.dueDate}</div>
                      {fu.dueTime && <div style={{ fontSize: 11.5, color: '#64748b' }}>{fu.dueTime}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>
                      {fu.doctor?.name}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ color: '#0f172a' }}>{fu.reason}</div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background:
                            fu.priority === 'CRITICAL'
                              ? '#fee2e2'
                              : fu.priority === 'URGENT'
                                ? '#ffedd5'
                                : '#f1f5f9',
                          color:
                            fu.priority === 'CRITICAL'
                              ? '#b91c1c'
                              : fu.priority === 'URGENT'
                                ? '#c2410c'
                                : '#475569',
                        }}
                      >
                        {fu.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 12, color: '#0284c7', background: '#f0f9ff', padding: '2px 8px', borderRadius: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <BellRing size={12} /> {fu.reminderPreference}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 600,
                          background:
                            fu.status === 'SCHEDULED'
                              ? '#e0f2fe'
                              : fu.status === 'COMPLETED'
                                ? '#dcfce7'
                                : '#fee2e2',
                          color:
                            fu.status === 'SCHEDULED'
                              ? '#0369a1'
                              : fu.status === 'COMPLETED'
                                ? '#15803d'
                                : '#b91c1c',
                        }}
                      >
                        {fu.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {fu.status === 'SCHEDULED' && (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => void handleComplete(fu.id)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 11.5, color: '#15803d', borderColor: '#bbf7d0', background: '#f0fdf4' }}
                            title="Mark Completed"
                          >
                            <Check size={13} /> Complete
                          </button>
                          <button
                            onClick={() => void handleCancel(fu.id)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 11.5, color: '#b91c1c', borderColor: '#fecdd3', background: '#fff1f2' }}
                            title="Cancel Follow-up"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Follow-up Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, maxWidth: 520, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
              Schedule Clinical Follow-up
            </h3>

            <form onSubmit={handleCreateSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Patient ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1, 2, 3..."
                  value={formPatientId}
                  onChange={(e) => setFormPatientId(e.target.value)}
                  className="form-control"
                  style={{ fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="form-control"
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Preferred Time
                  </label>
                  <input
                    type="time"
                    value={formDueTime}
                    onChange={(e) => setFormDueTime(e.target.value)}
                    className="form-control"
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Clinical Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Review blood pressure response to medication"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="form-control"
                  style={{ fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="form-select"
                    style={{ fontSize: 13 }}
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Automated Reminder
                  </label>
                  <select
                    value={formReminderPref}
                    onChange={(e) => setFormReminderPref(e.target.value as any)}
                    className="form-select"
                    style={{ fontSize: 13 }}
                  >
                    <option value="IN_APP">In-App Notification</option>
                    <option value="EMAIL">Email Alert</option>
                    <option value="SMS">SMS Dispatch</option>
                    <option value="NONE">No Automated Reminder</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ fontSize: 13, background: '#0284c7', borderColor: '#0369a1' }}
                >
                  {submitting ? 'Scheduling...' : 'Schedule Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
