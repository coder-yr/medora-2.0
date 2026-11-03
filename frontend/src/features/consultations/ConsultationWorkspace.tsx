import React, { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope,
  Save,
  CheckCircle2,
  Printer,
  AlertTriangle,
  Plus,
  Trash2,
  Pill,
  CreditCard,
} from 'lucide-react';
import type {
  VisitConsultationContext,
  SaveConsultationDto,
  ConsultTemplate
} from '../../types/consultation';
import type { Appointment } from '../../types/appointment';
import type { MedicineItem } from '../../types/prescription';

interface ConsultationWorkspaceProps {
  token: string;
  apiBaseUrl: string;
  activeBranchId?: string;
  activeAppointment?: Appointment | null;
  onNavigateToBilling?: (patientId: string, doctorId?: string) => void;
}

export const ConsultationWorkspace: React.FC<ConsultationWorkspaceProps> = ({
  token,
  apiBaseUrl,
  activeAppointment,
  onNavigateToBilling,
}) => {
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>(
    activeAppointment ? String(activeAppointment.id) : ''
  );
  const [waitingAppointments, setWaitingAppointments] = useState<Appointment[]>([]);
  const [context, setContext] = useState<VisitConsultationContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [bp, setBp] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperature, setTemperature] = useState('');
  const [weight, setWeight] = useState('');
  const [presentingComplaint, setPresentingComplaint] = useState('');
  const [historyNotes, setHistoryNotes] = useState('');
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [plan, setPlan] = useState('');
  const [allergies, setAllergies] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  // Prescription Items
  const [rxItems, setRxItems] = useState<MedicineItem[]>([
    { name: '', dosage: '1+0+1', duration: '5 days', instructions: 'After meals' },
  ]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [activeCatalogRow, setActiveCatalogRow] = useState<number | null>(null);

  // Print Summary Modal
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Fetch waiting appointments for selection if not preloaded
  const fetchWaitingAppointments = useCallback(async () => {
    if (!token) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const url = new URL(`${apiBaseUrl}/api/v1/appointments`);
      url.searchParams.set('date', today);
      url.searchParams.set('limit', '50');
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data?.data)) {
        const waiting = data.data.data.filter(
          (a: Appointment) => a.status === 'in consultation' || a.status === 'arrived' || a.status === 'scheduled'
        );
        setWaitingAppointments(waiting);
        if (!selectedAppointmentId && waiting.length > 0) {
          setSelectedAppointmentId(String(waiting[0].id));
        }
      }
    } catch {
      // Ignore background waiting list error
    }
  }, [token, apiBaseUrl, selectedAppointmentId]);

  useEffect(() => {
    fetchWaitingAppointments();
  }, [fetchWaitingAppointments]);

  // When activeAppointment prop changes, update selected appointment ID
  useEffect(() => {
    if (activeAppointment) {
      setSelectedAppointmentId(String(activeAppointment.id));
    }
  }, [activeAppointment]);

  // Load visit context whenever selectedAppointmentId changes
  const fetchVisitContext = useCallback(async (aptId: string) => {
    if (!token || !aptId) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/consultations/visit/${aptId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const ctx: VisitConsultationContext = data.data;
        setContext(ctx);

        // Prepopulate form fields
        setBp(ctx.visit.bp || '');
        setPulse(ctx.visit.pulse || '');
        setTemperature(ctx.visit.temperature || '');
        setWeight(ctx.visit.weight || '');

        setPresentingComplaint(ctx.consultation.presentingComplaint || '');
        setHistoryNotes(ctx.consultation.history || '');
        setProvisionalDiagnosis(ctx.consultation.provisionalDiagnosis || '');
        setDiagnosis(ctx.consultation.diagnosis || '');
        setPlan(ctx.consultation.plan || '');
        setAllergies(ctx.consultation.allergies || '');
        setFollowUpDate(ctx.consultation.followUpDate || '');
        setFollowUpNotes(ctx.consultation.followUpNotes || '');
      } else {
        setNotification({
          type: 'error',
          message: data.error?.message || data.message || 'Unable to load clinical encounter context.',
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error connecting to consultation service.' });
    } finally {
      setLoading(false);
    }
  }, [token, apiBaseUrl]);

  useEffect(() => {
    if (selectedAppointmentId) {
      fetchVisitContext(selectedAppointmentId);
    }
  }, [selectedAppointmentId, fetchVisitContext]);

  // Medicine Search with Debounce
  useEffect(() => {
    if (!token || !catalogQuery.trim() || activeCatalogRow === null) {
      setCatalogResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/v1/prescriptions/medicines/search?q=${encodeURIComponent(catalogQuery)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setCatalogResults(data.data);
        }
      } catch {
        setCatalogResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [catalogQuery, token, activeCatalogRow, apiBaseUrl]);

  const addRxItem = () => {
    setRxItems([...rxItems, { name: '', dosage: '1+0+1', duration: '5 days', instructions: 'After meals' }]);
  };

  const removeRxItem = (idx: number) => {
    if (rxItems.length > 1) {
      setRxItems(rxItems.filter((_, i) => i !== idx));
    }
  };

  const updateRxItem = (idx: number, field: keyof MedicineItem, val: any) => {
    const next = [...rxItems];
    next[idx] = { ...next[idx], [field]: val };
    setRxItems(next);
  };

  const selectMedicine = (idx: number, med: { id: string | number; name: string }) => {
    updateRxItem(idx, 'medicineId', Number(med.id));
    updateRxItem(idx, 'name', med.name);
    setCatalogQuery('');
    setCatalogResults([]);
    setActiveCatalogRow(null);
  };

  const handleApplyTemplate = (tpl: ConsultTemplate) => {
    if (tpl.fields.presenting_complaint) setPresentingComplaint(tpl.fields.presenting_complaint);
    if (tpl.fields.history) setHistoryNotes(tpl.fields.history);
    if (tpl.fields.provisional_diagnosis) setProvisionalDiagnosis(tpl.fields.provisional_diagnosis);
    if (tpl.fields.diagnosis) setDiagnosis(tpl.fields.diagnosis);
    if (tpl.fields.plan) setPlan(tpl.fields.plan);
  };

  const handleSave = async (action: 'save' | 'complete') => {
    if (!selectedAppointmentId) return;
    setSaving(true);
    setNotification(null);

    try {
      const payload: SaveConsultationDto = {
        action,
        b_p: bp.trim() || undefined,
        pulse: pulse.trim() || undefined,
        temprature: temperature.trim() || undefined,
        weight: weight.trim() || undefined,
        presenting_complaint: presentingComplaint.trim() || undefined,
        history: historyNotes.trim() || undefined,
        provisional_diagnosis: provisionalDiagnosis.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        plan: plan.trim() || undefined,
        allergies: allergies.trim() || undefined,
        follow_up_date: followUpDate || undefined,
        follow_up_notes: followUpNotes.trim() || undefined,
      };

      const res = await fetch(`${apiBaseUrl}/api/v1/consultations/visit/${selectedAppointmentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Also save prescription if medicine items are filled
        const validRxItems = rxItems.filter((i) => i.name.trim().length > 0);
        if (validRxItems.length > 0 && context) {
          try {
            await fetch(`${apiBaseUrl}/api/v1/prescriptions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                patientId: Number(context.patient.id),
                doctorId: context.doctor?.id ? Number(context.doctor.id) : 1,
                date: new Date().toISOString().split('T')[0],
                symptom: presentingComplaint,
                advice: plan,
                items: validRxItems.map((i) => ({
                  medicineId: i.medicineId ? Number(i.medicineId) : undefined,
                  name: i.name.trim(),
                  dosage: i.dosage,
                  duration: i.duration,
                  instructions: i.instructions,
                })),
              }),
            });
          } catch {
            // Log rx save failure but keep consultation
          }
        }

        setNotification({
          type: 'success',
          message:
            action === 'complete'
              ? 'Consultation successfully completed and visit finalized.'
              : 'Consultation draft saved successfully.',
        });
        fetchVisitContext(selectedAppointmentId);
      } else {
        const msg = data.error?.message || data.message || 'Failed to save consultation.';
        setNotification({ type: 'error', message: Array.isArray(msg) ? msg.join(', ') : msg });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network communication error.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header & Patient Queue Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stethoscope size={22} style={{ color: '#0284c7' }} />
            Doctor Clinical Consultation Workspace
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            EHR encounter notes, carry-forward allergies, physical examination, and Rx management
          </p>
        </div>

        {/* Visit Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Active Visit:</span>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px', fontWeight: 600 }}
            value={selectedAppointmentId}
            onChange={(e) => setSelectedAppointmentId(e.target.value)}
          >
            {waitingAppointments.length === 0 ? (
              <option value="">No waiting patients today</option>
            ) : (
              waitingAppointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.timeSlot || 'Visit'} — {a.patient?.name || `Patient #${a.patientId}`} [{a.status}]
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {notification && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderRadius: 8,
            background: notification.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: notification.type === 'success' ? '#166534' : '#b91c1c',
            fontSize: 13,
          }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading clinical encounter context...
        </div>
      ) : !context ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Please select a waiting patient appointment from the dropdown above to begin consultation.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          {/* Patient Demographic Banner */}
          <div className="card" style={{ background: '#f8fafc', borderLeft: '4px solid #0284c7', padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                  {context.patient.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{context.patient.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span className="badge badge-success">MRN #{context.patient.patientId || context.patient.id}</span>
                    <span>{context.patient.age ? `${context.patient.age} yrs` : ''} {context.patient.sex || ''}</span>
                    {context.patient.phone && <span>• Phone: {context.patient.phone}</span>}
                  </div>
                </div>
              </div>

              {/* Carry-forward allergy warning badge */}
              {allergies && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                  <AlertTriangle size={14} />
                  <span>Allergies: {allergies}</span>
                </div>
              )}

              {/* Template quick loader */}
              {context.templates.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Note Template:</span>
                  <select
                    className="form-select"
                    style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                    onChange={(e) => {
                      const t = context.templates.find((x) => x.id === e.target.value);
                      if (t) handleApplyTemplate(t);
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Apply Template...</option>
                    {context.templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Vitals Intake Card */}
          <div className="card">
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
              Visit Vitals & Triage
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Blood Pressure</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="120/80"
                  value={bp}
                  onChange={(e) => setBp(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Pulse (bpm)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="72"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Temperature</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="98.6 F"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Weight (kg)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="70 kg"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Known Allergies</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Penicillin, NSAIDs"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Clinical Encounter Documentation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>
                Presenting Complaint & Clinical History
              </h4>
              <div className="form-group">
                <label className="form-label">Presenting Complaint *</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Chief symptoms described by patient..."
                  value={presentingComplaint}
                  onChange={(e) => setPresentingComplaint(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">History of Presenting Illness (HPI)</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Onset, duration, severity, progression..."
                  value={historyNotes}
                  onChange={(e) => setHistoryNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="card">
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>
                Diagnosis & Assessment
              </h4>
              <div className="form-group">
                <label className="form-label">Provisional / Differential Diagnosis</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Viral URTI, Suspected Gastritis"
                  value={provisionalDiagnosis}
                  onChange={(e) => setProvisionalDiagnosis(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Final Confirmed Diagnosis</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acute Upper Respiratory Tract Infection"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Clinical Management Plan</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Advised investigations, dietary advice, lifestyle instructions..."
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Integrated Prescription Authoring */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Pill size={16} style={{ color: '#0284c7' }} />
                Prescribed Medications (Rx)
              </h4>
              <button type="button" className="btn btn-secondary" onClick={addRxItem} style={{ fontSize: 12 }}>
                <Plus size={14} /> Add Medicine
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Medicine Name</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', width: 140 }}>Dosage</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', width: 120 }}>Duration</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Instructions</th>
                  <th style={{ padding: '8px 12px', width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rxItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px 12px', position: 'relative' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Search or enter medicine name..."
                        value={item.name}
                        onChange={(e) => {
                          updateRxItem(idx, 'name', e.target.value);
                          setCatalogQuery(e.target.value);
                          setActiveCatalogRow(idx);
                        }}
                      />
                      {activeCatalogRow === idx && catalogResults.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 12,
                          right: 12,
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          zIndex: 20,
                          maxHeight: 160,
                          overflowY: 'auto'
                        }}>
                          {catalogResults.map((med) => (
                            <div
                              key={med.id}
                              onClick={() => selectMedicine(idx, med)}
                              style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 12 }}
                            >
                              <strong>{med.name}</strong> <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{med.genericName || ''}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={item.dosage}
                        placeholder="1+0+1"
                        onChange={(e) => updateRxItem(idx, 'dosage', e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={item.duration}
                        placeholder="5 days"
                        onChange={(e) => updateRxItem(idx, 'duration', e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={item.instructions}
                        placeholder="After meals"
                        onChange={(e) => updateRxItem(idx, 'instructions', e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {rxItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRxItem(idx)}
                          style={{ color: '#ef4444', background: 'none' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Follow-up & Final Actions */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Follow-up Date:</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: 'auto', padding: '6px 10px' }}
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="Follow-up instructions..."
                style={{ width: 240 }}
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPrintModal(true)}
              >
                <Printer size={16} /> Print Note
              </button>

              {onNavigateToBilling && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ color: '#16a34a' }}
                  onClick={() => onNavigateToBilling(context.patient.id, context.doctor?.id)}
                >
                  <CreditCard size={16} /> Bill Patient
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSave('save')}
                disabled={saving}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Draft'}
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSave('complete')}
                disabled={saving}
              >
                <CheckCircle2 size={16} /> {saving ? 'Finalizing...' : 'Complete Visit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Clinical Note Modal */}
      {showPrintModal && context && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16
        }}>
          <div className="card" style={{ maxWidth: 640, width: '100%', background: '#fff', color: '#000', padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0284c7' }}>MEDORA HOSPITAL</h2>
                <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>Outpatient Clinical Encounter Record</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>CLINICAL NOTE</h3>
                <p style={{ margin: 0, fontSize: 12 }}>Date: {new Date().toISOString().split('T')[0]}</p>
                <p style={{ margin: 0, fontSize: 12 }}>Visit ID: #{selectedAppointmentId}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
              <div>
                <strong>Patient:</strong> {context.patient.name} ({context.patient.age ? `${context.patient.age}y` : ''} {context.patient.sex || ''})<br />
                <strong>MRN:</strong> #{context.patient.patientId || context.patient.id}
              </div>
              <div>
                <strong>Attending Doctor:</strong> {context.doctor?.name || 'Consultant'}<br />
                <strong>Specialty:</strong> {context.doctor?.department || 'General Practice'}
              </div>
            </div>

            {(bp || pulse || temperature || weight) && (
              <div style={{ marginBottom: 14, fontSize: 13 }}>
                <strong>Vitals: </strong>
                {bp && <span>BP: {bp} | </span>}
                {pulse && <span>Pulse: {pulse} bpm | </span>}
                {temperature && <span>Temp: {temperature} | </span>}
                {weight && <span>Weight: {weight}</span>}
              </div>
            )}

            {presentingComplaint && (
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>Presenting Complaint:</strong> {presentingComplaint}
              </div>
            )}

            {historyNotes && (
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>Clinical History:</strong> {historyNotes}
              </div>
            )}

            {diagnosis && (
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>Diagnosis:</strong> <u>{diagnosis}</u>
              </div>
            )}

            {plan && (
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <strong>Management Plan:</strong> {plan}
              </div>
            )}

            {rxItems.some((i) => i.name.trim()) && (
              <div style={{ marginBottom: 16, marginTop: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'serif' }}>℞ Prescribed Medications</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 6 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
                      <th style={{ padding: '4px 0' }}>Medicine</th>
                      <th style={{ padding: '4px 0' }}>Dosage</th>
                      <th style={{ padding: '4px 0' }}>Duration</th>
                      <th style={{ padding: '4px 0' }}>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rxItems.filter((i) => i.name.trim()).map((i, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 0', fontWeight: 600 }}>{i.name}</td>
                        <td style={{ padding: '6px 0' }}>{i.dosage}</td>
                        <td style={{ padding: '6px 0' }}>{i.duration}</td>
                        <td style={{ padding: '6px 0' }}>{i.instructions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {followUpDate && (
              <div style={{ fontSize: 13, marginTop: 12 }}>
                <strong>Next Review Date:</strong> {followUpDate} {followUpNotes ? `(${followUpNotes})` : ''}
              </div>
            )}

            <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 12 }}>
              <div style={{ color: '#64748b' }}>Generated securely by Medora 2.0</div>
              <div style={{ textAlign: 'center', borderTop: '1px solid #000', width: 160, paddingTop: 4 }}>
                Doctor Signature
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }} className="no-print">
              <button className="btn btn-secondary" onClick={() => setShowPrintModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Print Clinical Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
