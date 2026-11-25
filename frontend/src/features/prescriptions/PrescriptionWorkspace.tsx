import React, { useState, useEffect, useCallback } from 'react';
import {
  Pill,
  Plus,
  Trash2,
  Search,
  Printer,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Ban,
  Edit3,
  Clock,
  Check,
  X
} from 'lucide-react';
import type {
  Prescription,
  MedicineItem,
  CreatePrescriptionDto,
  SignPrescriptionDto,
  CancelPrescriptionDto,
  AmendPrescriptionDto,
} from '../../types/prescription';
import type { Patient } from '../../types/patient';
import type { Doctor } from '../../types/doctor';

interface PrescriptionWorkspaceProps {
  token: string;
  apiBaseUrl: string;
  userRole?: string;
  initialPatientId?: string | null;
  initialDoctorId?: string | null;
}

export const PrescriptionWorkspace: React.FC<PrescriptionWorkspaceProps> = ({
  token,
  apiBaseUrl,
  userRole,
  initialPatientId,
  initialDoctorId,
}) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchDrug, setSearchDrug] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Doctors and Patients lists
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Form State
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(initialDoctorId || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [symptom, setSymptom] = useState('');
  const [advice, setAdvice] = useState('');
  const [note, setNote] = useState('');
  const [validity, setValidity] = useState('30 days');
  const [items, setItems] = useState<MedicineItem[]>([
    {
      name: '',
      dosage: '500mg',
      route: 'Oral',
      frequency: 'BD (Twice daily)',
      timing: 'After food',
      duration: '5 days',
      quantityPrescribed: 10,
      unit: 'tablets',
      refills: 0,
      instructions: 'Take with plenty of water',
    },
  ]);

  // Catalog search state
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

  // Modal states
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [cancelModalRx, setCancelModalRx] = useState<Prescription | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [amendModalRx, setAmendModalRx] = useState<Prescription | null>(null);
  const [amendReason, setAmendReason] = useState('');
  const [amendSection, setAmendSection] = useState('MEDICATION_DOSAGE');
  const [amendNewNotes, setAmendNewNotes] = useState('');
  const [signModalRx, setSignModalRx] = useState<Prescription | null>(null);
  const [signatureNotes, setSignatureNotes] = useState('');

  // Load doctors
  useEffect(() => {
    if (!token) return;
    fetch(`${apiBaseUrl}/api/v1/doctors?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          const docList = Array.isArray(data.data) ? data.data : (data.data?.items || data.data?.data || []);
          setDoctorsList(docList);
          if (!selectedDoctorId && docList.length > 0) {
            setSelectedDoctorId(String(docList[0].id));
          }
        }
      })
      .catch(() => {});
  }, [token, apiBaseUrl]);

  // Initial Patient Preload
  useEffect(() => {
    if (initialPatientId && token) {
      fetch(`${apiBaseUrl}/api/v1/patients/${initialPatientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setSelectedPatient(data.data);
          }
        })
        .catch(() => {});
    }
  }, [initialPatientId, token, apiBaseUrl]);

  // Search patients
  useEffect(() => {
    if (!token || !patientSearch.trim() || patientSearch.length < 2) {
      setPatientsList([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/patients?q=${encodeURIComponent(patientSearch.trim())}&limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.data) {
          const patList = Array.isArray(data.data) ? data.data : (data.data?.items || data.data?.data || []);
          setPatientsList(patList);
        }
      } catch {
        setPatientsList([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [patientSearch, token, apiBaseUrl]);

  // Medicine catalog search
  useEffect(() => {
    if (!token || !catalogQuery.trim() || activeItemIndex === null) {
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
  }, [catalogQuery, token, activeItemIndex, apiBaseUrl]);

  const fetchPrescriptions = useCallback(async (drug = searchDrug) => {
    if (!token) return;
    setLoading(true);
    try {
      const url = new URL(`${apiBaseUrl}/api/v1/prescriptions`);
      if (drug.trim()) url.searchParams.set('drug', drug.trim());
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        const rxList = Array.isArray(data.data) ? data.data : (data.data?.items || data.data?.data || []);
        setPrescriptions(rxList);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  }, [token, apiBaseUrl, searchDrug]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const addItem = () => {
    setItems([
      ...items,
      {
        name: '',
        dosage: '500mg',
        route: 'Oral',
        frequency: 'BD (Twice daily)',
        timing: 'After food',
        duration: '5 days',
        quantityPrescribed: 10,
        unit: 'tablets',
        refills: 0,
        instructions: 'After meals',
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof MedicineItem, val: any) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: val };
    setItems(next);
  };

  const selectCatalogMedicine = (index: number, med: { id: string | number; name: string }) => {
    updateItem(index, 'medicineId', Number(med.id));
    updateItem(index, 'name', med.name);
    setCatalogQuery('');
    setCatalogResults([]);
    setActiveItemIndex(null);
  };

  // Check if item conflicts with patient allergies
  const checkAllergyConflict = (drugName: string): string | null => {
    if (!selectedPatient || !selectedPatient.allergies || !drugName.trim()) return null;
    const allergiesStr = selectedPatient.allergies.toLowerCase();
    if (allergiesStr === 'nkda' || allergiesStr === 'none' || allergiesStr === 'nil' || allergiesStr.includes('no known')) {
      return null;
    }
    const drug = drugName.toLowerCase();
    const tokens = allergiesStr.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
    for (const token of tokens) {
      if (token.length > 2 && (drug.includes(token) || token.includes(drug))) {
        return `Conflicts with recorded allergy: "${token}"`;
      }
    }
    return null;
  };

  const handleSubmit = async (signImmediately: boolean = false) => {
    if (!token) {
      setNotification({ type: 'error', message: 'Not authenticated with hospital backend.' });
      return;
    }
    if (!selectedPatient) {
      setNotification({ type: 'error', message: 'Please select a patient to prescribe medications.' });
      return;
    }
    if (!selectedDoctorId) {
      setNotification({ type: 'error', message: 'Please select an issuing doctor.' });
      return;
    }

    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      setNotification({ type: 'error', message: 'Add at least one medicine item to the prescription.' });
      return;
    }

    try {
      const payload: CreatePrescriptionDto = {
        patientId: Number(selectedPatient.id),
        doctorId: Number(selectedDoctorId),
        date,
        symptom: symptom.trim() || undefined,
        advice: advice.trim() || undefined,
        note: note.trim() || undefined,
        validity,
        status: signImmediately ? 'SIGNED' : 'DRAFT',
        signImmediately,
        items: validItems.map((i) => ({
          medicineId: i.medicineId ? Number(i.medicineId) : undefined,
          name: i.name.trim(),
          dosage: i.dosage?.trim() || undefined,
          duration: i.duration?.trim() || undefined,
          instructions: i.instructions?.trim() || undefined,
          quantityPrescribed: Number(i.quantityPrescribed) || 1,
          unit: i.unit?.trim() || 'tablets',
          route: i.route?.trim() || 'Oral',
          frequency: i.frequency?.trim() || 'BD',
          timing: i.timing?.trim() || 'After food',
          refills: Number(i.refills) || 0,
        })),
      };

      const res = await fetch(`${apiBaseUrl}/api/v1/prescriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        const createdRx = data.data;
        const msg = signImmediately
          ? `Prescription #${createdRx.prescriptionNumber || createdRx.id} digitally signed & issued.`
          : `Prescription #${createdRx.prescriptionNumber || createdRx.id} saved as DRAFT.`;

        if (createdRx.allergyAlerts && createdRx.allergyAlerts.length > 0) {
          setNotification({ type: 'warning', message: `${msg} Alerts: ${createdRx.allergyAlerts.join('; ')}` });
        } else {
          setNotification({ type: 'success', message: msg });
        }

        setSymptom('');
        setAdvice('');
        setNote('');
        setItems([
          {
            name: '',
            dosage: '500mg',
            route: 'Oral',
            frequency: 'BD (Twice daily)',
            timing: 'After food',
            duration: '5 days',
            quantityPrescribed: 10,
            unit: 'tablets',
            refills: 0,
            instructions: 'After meals',
          },
        ]);
        fetchPrescriptions();
      } else {
        const errorMsg = data.error?.message || data.message || 'Validation error.';
        setNotification({ type: 'error', message: Array.isArray(errorMsg) ? errorMsg.join('; ') : errorMsg });
      }
    } catch {
      setNotification({ type: 'error', message: 'Failed to communicate with hospital API.' });
    }
  };

  const handleSignConfirm = async () => {
    if (!signModalRx) return;
    try {
      const dto: SignPrescriptionDto = {
        signatureNotes: signatureNotes.trim() || undefined,
      };
      const res = await fetch(`${apiBaseUrl}/api/v1/prescriptions/${signModalRx.id}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dto),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: `Prescription #${signModalRx.prescriptionNumber || signModalRx.id} signed successfully.` });
        setSignModalRx(null);
        setSignatureNotes('');
        fetchPrescriptions();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Failed to sign prescription.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error signing prescription.' });
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelModalRx || !cancelReason.trim()) return;
    try {
      const dto: CancelPrescriptionDto = { reason: cancelReason.trim() };
      const res = await fetch(`${apiBaseUrl}/api/v1/prescriptions/${cancelModalRx.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dto),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: `Prescription #${cancelModalRx.prescriptionNumber || cancelModalRx.id} cancelled.` });
        setCancelModalRx(null);
        setCancelReason('');
        fetchPrescriptions();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Failed to cancel prescription.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error cancelling prescription.' });
    }
  };

  const handleAmendConfirm = async () => {
    if (!amendModalRx || !amendReason.trim() || !amendNewNotes.trim()) return;
    try {
      const dto: AmendPrescriptionDto = {
        reason: amendReason.trim(),
        amendedSection: amendSection,
        newNotes: amendNewNotes.trim(),
      };
      const res = await fetch(`${apiBaseUrl}/api/v1/prescriptions/${amendModalRx.id}/amend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dto),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: `Amendment recorded on Prescription #${amendModalRx.prescriptionNumber || amendModalRx.id}.` });
        setAmendModalRx(null);
        setAmendReason('');
        setAmendNewNotes('');
        fetchPrescriptions();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Failed to amend prescription.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error amending prescription.' });
    }
  };

  const filteredPrescriptions = prescriptions.filter((rx) => {
    if (!statusFilter) return true;
    return (rx.status || '').toUpperCase() === statusFilter.toUpperCase();
  });

  const getStatusBadge = (status: string) => {
    const s = (status || 'DRAFT').toUpperCase();
    if (s === 'SIGNED') {
      return <span style={{ padding: '3px 8px', borderRadius: 4, background: '#dcfce7', color: '#166534', fontSize: 11, fontWeight: 700 }}>SIGNED</span>;
    }
    if (s === 'PARTIALLY_DISPENSED') {
      return <span style={{ padding: '3px 8px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1', fontSize: 11, fontWeight: 700 }}>PARTIALLY DISPENSED</span>;
    }
    if (s === 'DISPENSED') {
      return <span style={{ padding: '3px 8px', borderRadius: 4, background: '#f3e8ff', color: '#6b21a8', fontSize: 11, fontWeight: 700 }}>DISPENSED</span>;
    }
    if (s === 'CANCELLED') {
      return <span style={{ padding: '3px 8px', borderRadius: 4, background: '#fee2e2', color: '#991b1b', fontSize: 11, fontWeight: 700 }}>CANCELLED</span>;
    }
    return <span style={{ padding: '3px 8px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700 }}>DRAFT</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pill size={22} style={{ color: '#0284c7' }} />
            Prescription Management & Clinical Rx Workspace
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Digital prescription writing, allergy awareness, immutable signing, pharmacy synchronization & amendments
          </p>
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
            background: notification.type === 'success' ? '#dcfce7' : notification.type === 'warning' ? '#fef3c7' : '#fee2e2',
            color: notification.type === 'success' ? '#166534' : notification.type === 'warning' ? '#92400e' : '#b91c1c',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {notification.type === 'success' ? <CheckCircle size={18} /> : notification.type === 'warning' ? <AlertTriangle size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="main-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr', gap: 20 }}>
        {/* Prescription Creation Form */}
        <section className="card" style={{ padding: 20 }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px 0', fontSize: 16 }}>
            <Plus size={18} style={{ color: '#0284c7' }} /> Issue New Clinical Prescription
          </h3>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(true); }}>
            {/* Patient Search & Selection */}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Patient *</label>
              {selectedPatient ? (
                <div style={{ padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ color: '#0369a1', fontSize: 14 }}>{selectedPatient.name}</strong>
                      <span style={{ fontSize: 12, color: '#0284c7', marginLeft: 8 }}>MRN #{selectedPatient.patientId || selectedPatient.id}</span>
                      <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>• {selectedPatient.sex || 'Unknown sex'}, {selectedPatient.age || 'Unknown age'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(null)}
                      style={{ fontSize: 11, color: '#0284c7', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Change Patient
                    </button>
                  </div>

                  {/* Allergy Awareness Box */}
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e0f2fe' }}>
                    {selectedPatient.allergies && selectedPatient.allergies.toUpperCase() !== 'UNKNOWN' ? (
                      selectedPatient.allergies.toUpperCase().includes('NKDA') || selectedPatient.allergies.toLowerCase().includes('no known') ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                          <ShieldCheck size={13} /> NKDA (No Known Drug Allergies)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
                          <AlertTriangle size={14} style={{ color: '#dc2626' }} />
                          <span><strong>Known Allergies:</strong> {selectedPatient.allergies}</span>
                        </div>
                      )
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
                        <AlertTriangle size={14} style={{ color: '#d97706' }} />
                        <span><strong>Allergy Status UNKNOWN:</strong> Clinical allergy inquiry advised before issuing medicines.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search patient by MRN or name..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                  {patientsList.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--bg-card, #fff)',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      borderRadius: 6,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 30,
                      maxHeight: 160,
                      overflowY: 'auto'
                    }}>
                      {patientsList.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPatient(p);
                            setPatientSearch('');
                            setPatientsList([]);
                          }}
                          style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 12 }}
                        >
                          <strong>{p.name}</strong> <span style={{ color: '#0284c7' }}>#{p.patientId || p.id}</span>
                          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>({p.allergies ? `Allergies: ${p.allergies}` : 'Allergy: UNKNOWN'})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Doctor and Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Prescribing Doctor *</label>
                <select
                  className="form-select"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  required
                >
                  <option value="">Select Doctor</option>
                  {doctorsList.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} {d.department ? `(${d.department})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Prescription Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Presenting Complaints</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Dry cough, pyrexia for 3 days"
                  value={symptom}
                  onChange={(e) => setSymptom(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Doctor Medical Advice</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Bed rest, abundant hydration"
                  value={advice}
                  onChange={(e) => setAdvice(e.target.value)}
                />
              </div>
            </div>

            {/* Prescribed Medicines (Rx) */}
            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Pill size={15} style={{ color: '#0284c7' }} /> Prescribed Medicines (Rx Formulations)
                </label>
                <button type="button" className="btn btn-secondary" onClick={addItem} style={{ fontSize: 11, padding: '4px 8px' }}>
                  <Plus size={12} /> Add Item
                </button>
              </div>

              {items.map((item, index) => {
                const allergyWarning = checkAllergyConflict(item.name);
                return (
                  <div key={index} style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, position: 'relative' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Search or enter medicine name..."
                          value={item.name}
                          onChange={(e) => {
                            updateItem(index, 'name', e.target.value);
                            setCatalogQuery(e.target.value);
                            setActiveItemIndex(index);
                          }}
                          required
                        />

                        {activeItemIndex === index && catalogResults.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#fff',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 40,
                            maxHeight: 160,
                            overflowY: 'auto'
                          }}>
                            {catalogResults.map((med) => (
                              <div
                                key={med.id}
                                onClick={() => selectCatalogMedicine(index, med)}
                                style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 12 }}
                              >
                                <strong>{med.name}</strong> {med.generic && <span style={{ color: '#64748b' }}>({med.generic})</span>}
                                {med.quantity !== undefined && (
                                  <span style={{ float: 'right', color: med.quantity > 0 ? '#16a34a' : '#dc2626', fontSize: 11 }}>
                                    {med.quantity} in stock
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {allergyWarning && (
                      <div style={{ marginBottom: 8, padding: '4px 8px', background: '#fee2e2', color: '#b91c1c', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={13} /> {allergyWarning}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                      <div>
                        <label style={{ fontSize: 10, color: '#64748b' }}>Dosage / Strength</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. 500mg"
                          value={item.dosage}
                          onChange={(e) => updateItem(index, 'dosage', e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: '#64748b' }}>Route</label>
                        <select
                          className="form-select"
                          value={item.route || 'Oral'}
                          onChange={(e) => updateItem(index, 'route', e.target.value)}
                        >
                          <option value="Oral">Oral</option>
                          <option value="IV">IV (Intravenous)</option>
                          <option value="IM">IM (Intramuscular)</option>
                          <option value="SC">SC (Subcutaneous)</option>
                          <option value="Topical">Topical</option>
                          <option value="Inhalation">Inhalation</option>
                          <option value="Sublingual">Sublingual</option>
                          <option value="Ophthalmic">Ophthalmic</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: '#64748b' }}>Frequency</label>
                        <select
                          className="form-select"
                          value={item.frequency || 'BD (Twice daily)'}
                          onChange={(e) => updateItem(index, 'frequency', e.target.value)}
                        >
                          <option value="OD (Once daily)">OD (Once daily)</option>
                          <option value="BD (Twice daily)">BD (Twice daily)</option>
                          <option value="TDS (Thrice daily)">TDS (Thrice daily)</option>
                          <option value="QID (Four times daily)">QID (Four times daily)</option>
                          <option value="PRN (As needed)">PRN (As needed)</option>
                          <option value="STAT (Immediately)">STAT (Immediately)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: '#64748b' }}>Timing</label>
                        <select
                          className="form-select"
                          value={item.timing || 'After food'}
                          onChange={(e) => updateItem(index, 'timing', e.target.value)}
                        >
                          <option value="After food">After food</option>
                          <option value="Before food">Before food</option>
                          <option value="With food">With food</option>
                          <option value="Empty stomach">Empty stomach</option>
                          <option value="Bedtime">Bedtime</option>
                          <option value="As directed">As directed</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                      <div>
                        <label style={{ fontSize: 10, color: '#64748b' }}>Duration</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. 5 days"
                          value={item.duration}
                          onChange={(e) => updateItem(index, 'duration', e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: '#64748b' }}>Quantity Prescribed</label>
                        <input
                          type="number"
                          min="1"
                          className="form-input"
                          value={item.quantityPrescribed || 1}
                          onChange={(e) => updateItem(index, 'quantityPrescribed', parseInt(e.target.value, 10) || 1)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: '#64748b' }}>Unit</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="tablets / ml"
                          value={item.unit || 'tablets'}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: '#64748b' }}>Refills</label>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          value={item.refills || 0}
                          onChange={(e) => updateItem(index, 'refills', parseInt(e.target.value, 10) || 0)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Validity Period</label>
                <input
                  type="text"
                  className="form-input"
                  value={validity}
                  onChange={(e) => setValidity(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Internal Clinic Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Notes for pharmacy or nursing"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            {/* Action Buttons: Draft vs Sign & Issue */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSubmit(false)}
                style={{ padding: '8px 14px', fontSize: 13 }}
              >
                Save as Draft
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSubmit(true)}
                style={{ padding: '8px 14px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <ShieldCheck size={16} /> Sign & Issue Prescription
              </button>
            </div>
          </form>
        </section>

        {/* Prescription Registry Table */}
        <section className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
              <FileText size={18} style={{ color: '#0284c7' }} /> Prescription Registry
            </h3>

            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ fontSize: 12, padding: '4px 8px' }}
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SIGNED">Signed</option>
                <option value="PARTIALLY_DISPENSED">Partially Dispensed</option>
                <option value="DISPENSED">Dispensed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <div style={{ position: 'relative', width: 180 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Filter drug..."
                  value={searchDrug}
                  onChange={(e) => {
                    setSearchDrug(e.target.value);
                    fetchPrescriptions(e.target.value);
                  }}
                  style={{ paddingLeft: 28, padding: '4px 8px 4px 28px', fontSize: 12 }}
                />
                <Search size={14} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} />
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '8px 10px' }}>Rx # & Status</th>
                  <th style={{ padding: '8px 10px' }}>Patient</th>
                  <th style={{ padding: '8px 10px' }}>Doctor</th>
                  <th style={{ padding: '8px 10px' }}>Regimen</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                      Loading clinical prescriptions...
                    </td>
                  </tr>
                ) : filteredPrescriptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                      No prescriptions found.
                    </td>
                  </tr>
                ) : (
                  filteredPrescriptions.map((rx) => (
                    <tr key={rx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 700, color: '#0284c7' }}>{rx.prescriptionNumber || `RX-${rx.id}`}</div>
                        <div style={{ marginTop: 3 }}>{getStatusBadge(rx.status)}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{rx.date}</div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 600 }}>{rx.patient?.name || `Patient #${rx.patientId}`}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>MRN #{rx.patient?.patientId || rx.patientId}</div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div>{rx.doctor?.name || `Doctor #${rx.doctorId}`}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{rx.doctor?.department || ''}</div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ maxWidth: 200, fontSize: 11, color: '#334155' }}>
                          {rx.medicine || (rx.items && rx.items.map((i) => i.name).join(', ')) || 'No items'}
                        </div>
                        {rx.items && rx.items.length > 0 && (
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                            {rx.items.length} item{rx.items.length > 1 ? 's' : ''} prescribed
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {/* Sign button if Draft */}
                          {rx.status === 'DRAFT' && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '3px 6px', fontSize: 11, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}
                              onClick={() => setSignModalRx(rx)}
                              title="Sign prescription"
                            >
                              <ShieldCheck size={12} /> Sign
                            </button>
                          )}

                          {/* Amend button if Signed/Dispensed */}
                          {(rx.status === 'SIGNED' || rx.status === 'PARTIALLY_DISPENSED' || rx.status === 'DISPENSED') && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '3px 6px', fontSize: 11 }}
                              onClick={() => setAmendModalRx(rx)}
                              title="Amend prescription"
                            >
                              <Edit3 size={12} /> Amend
                            </button>
                          )}

                          {/* Cancel button if active */}
                          {rx.status !== 'CANCELLED' && rx.status !== 'DISPENSED' && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '3px 6px', fontSize: 11, color: '#dc2626' }}
                              onClick={() => setCancelModalRx(rx)}
                              title="Cancel prescription"
                            >
                              <Ban size={12} /> Cancel
                            </button>
                          )}

                          {/* Print / View */}
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '3px 6px', fontSize: 11 }}
                            onClick={() => setSelectedPrescription(rx)}
                            title="Print Prescription Slip"
                          >
                            <Printer size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Digital Sign Modal */}
      {signModalRx && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16,
        }}>
          <div className="card" style={{ maxWidth: 460, width: '100%', background: '#fff', padding: 24, borderRadius: 8 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6, color: '#0f766e' }}>
              <ShieldCheck size={18} /> Sign & Lock Prescription
            </h3>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
              Digitally signing prescription <strong>#{signModalRx.prescriptionNumber || signModalRx.id}</strong> locks the medication regimen and authorizes dispensing at the hospital pharmacy.
            </p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Clinician Sign-off Remarks (Optional)</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="e.g. Cross-checked with patient baseline creatinine"
                value={signatureNotes}
                onChange={(e) => setSignatureNotes(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setSignModalRx(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSignConfirm}>Confirm Digital Signature</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Prescription Modal */}
      {cancelModalRx && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16,
        }}>
          <div className="card" style={{ maxWidth: 460, width: '100%', background: '#fff', padding: 24, borderRadius: 8 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626' }}>
              <Ban size={18} /> Cancel Prescription
            </h3>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
              Cancelling prescription <strong>#{cancelModalRx.prescriptionNumber || cancelModalRx.id}</strong> invalidates it immediately. Please provide clinical justification.
            </p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Cancellation Reason *</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="e.g. Patient allergic reaction or therapy discontinued"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setCancelModalRx(null)}>Close</button>
              <button
                className="btn btn-danger"
                disabled={!cancelReason.trim()}
                onClick={handleCancelConfirm}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Amend Prescription Modal */}
      {amendModalRx && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16,
        }}>
          <div className="card" style={{ maxWidth: 500, width: '100%', background: '#fff', padding: 24, borderRadius: 8 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6, color: '#0369a1' }}>
              <Edit3 size={18} /> Clinical Amendment Addendum
            </h3>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
              Signed prescriptions cannot be modified directly to preserve audit integrity. Record an auditable clinical amendment for Prescription <strong>#{amendModalRx.prescriptionNumber || amendModalRx.id}</strong>.
            </p>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Amended Section</label>
              <select
                className="form-select"
                value={amendSection}
                onChange={(e) => setAmendSection(e.target.value)}
              >
                <option value="MEDICATION_DOSAGE">Medication Dosage / Frequency</option>
                <option value="DURATION">Duration / Quantity</option>
                <option value="INSTRUCTIONS">Administration Instructions</option>
                <option value="ADVICE">General Medical Advice</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Reason for Amendment *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Dose titration based on lab report"
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 12 }}>New Clinical Addendum / Notes *</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Specify the replacement regimen, new instructions, or addendum details"
                value={amendNewNotes}
                onChange={(e) => setAmendNewNotes(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setAmendModalRx(null)}>Close</button>
              <button
                className="btn btn-primary"
                disabled={!amendReason.trim() || !amendNewNotes.trim()}
                onClick={handleAmendConfirm}
              >
                Record Amendment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Clinical Slip Modal */}
      {selectedPrescription && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16,
        }}>
          <div className="card" style={{ maxWidth: 680, width: '100%', background: '#fff', color: '#000', padding: 36, maxHeight: '90vh', overflowY: 'auto', borderRadius: 8 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0284c7' }}>MEDORA HEALTHCARE CLINIC</h2>
                <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>Outpatient Department & Clinical Pharmacy</p>
                <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#64748b' }}>Ph: +92-51-1234567 • Email: clinic@medora.health</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '0.5px' }}>OUTPATIENT PRESCRIPTION</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, fontWeight: 700, color: '#0369a1' }}>
                  {selectedPrescription.prescriptionNumber || `RX-${selectedPrescription.id}`}
                </p>
                <p style={{ margin: 0, fontSize: 11 }}>Date: {selectedPrescription.date}</p>
                <div style={{ marginTop: 4 }}>{getStatusBadge(selectedPrescription.status)}</div>
              </div>
            </div>

            {/* Patient & Doctor Banner */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 18, fontSize: 12, background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <div>
                <p style={{ margin: '0 0 4px 0' }}><strong>Patient:</strong> {selectedPrescription.patient?.name || `Patient #${selectedPrescription.patientId}`}</p>
                <p style={{ margin: '0 0 4px 0' }}><strong>MRN:</strong> {selectedPrescription.patient?.patientId || 'N/A'}</p>
                <p style={{ margin: '0 0 4px 0' }}><strong>Demographics:</strong> {selectedPrescription.patient?.gender || 'N/A'}, {selectedPrescription.patient?.age || 'N/A'} yrs</p>
                <p style={{ margin: 0 }}>
                  <strong>Allergies: </strong>
                  {selectedPrescription.patient?.allergies ? (
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{selectedPrescription.patient.allergies}</span>
                  ) : (
                    <span style={{ color: '#d97706' }}>Not Recorded / UNKNOWN</span>
                  )}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0' }}><strong>Prescribing Doctor:</strong> {selectedPrescription.doctor?.name || `Doctor #${selectedPrescription.doctorId}`}</p>
                <p style={{ margin: '0 0 4px 0' }}><strong>Department:</strong> {selectedPrescription.doctor?.department || 'General OPD'}</p>
                <p style={{ margin: '0 0 4px 0' }}><strong>Qualifications:</strong> {selectedPrescription.doctor?.qualifications || 'MBBS'}</p>
                {selectedPrescription.signedAt && (
                  <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>
                    ✓ Digitally Signed: {new Date(selectedPrescription.signedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {selectedPrescription.symptom && (
              <div style={{ marginBottom: 12, fontSize: 12 }}>
                <strong>Presenting Complaints:</strong> {selectedPrescription.symptom}
              </div>
            )}

            {/* Formulations Table */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'serif', color: '#0284c7', marginBottom: 6 }}>℞</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #0f172a', textAlign: 'left', background: '#f1f5f9' }}>
                    <th style={{ padding: '6px 8px' }}>#</th>
                    <th style={{ padding: '6px 8px' }}>Medication & Formulation</th>
                    <th style={{ padding: '6px 8px' }}>Dose / Route</th>
                    <th style={{ padding: '6px 8px' }}>Frequency & Timing</th>
                    <th style={{ padding: '6px 8px' }}>Duration</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPrescription.items && selectedPrescription.items.length > 0 ? (
                    selectedPrescription.items.map((it, idx) => (
                      <tr key={it.id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '8px' }}>
                          <strong style={{ fontSize: 13 }}>{it.name}</strong>
                          {it.instructions && <div style={{ fontSize: 11, color: '#475569' }}>{it.instructions}</div>}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <div>{it.dosage || '-'}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{it.route || 'Oral'}</div>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <div>{it.frequency || '-'}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{it.timing || '-'}</div>
                        </td>
                        <td style={{ padding: '8px' }}>{it.duration || '-'}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                          {it.quantityPrescribed || 1} {it.unit || ''}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '12px 8px', textAlign: 'center', color: '#64748b' }}>
                        {selectedPrescription.medicine || 'No itemized medications'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedPrescription.advice && (
              <div style={{ marginBottom: 16, fontSize: 12, background: '#fffbeb', padding: 10, borderRadius: 6, border: '1px solid #fef3c7' }}>
                <strong>Physician's Advice & Lifestyle Guidance:</strong> {selectedPrescription.advice}
              </div>
            )}

            {/* Amendments block if any */}
            {selectedPrescription.amendments && selectedPrescription.amendments.length > 0 && (
              <div style={{ marginBottom: 16, padding: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11 }}>
                <strong style={{ color: '#166534' }}>Clinical Addenda & Amendments:</strong>
                {selectedPrescription.amendments.map((a) => (
                  <div key={a.id} style={{ marginTop: 4, color: '#14532d' }}>
                    • [{new Date(a.createdAt).toLocaleDateString()}] ({a.amendedSection}): {a.reason} — <em>{a.newNotes}</em>
                  </div>
                ))}
              </div>
            )}

            {/* Signature Block */}
            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 11 }}>
              <div>
                <p style={{ margin: '0 0 2px 0' }}>Prescription Validity: {selectedPrescription.validity || '30 days'}</p>
                <p style={{ margin: 0, color: '#64748b' }}>Medora 2.0 Secure Clinical System • Confidential</p>
              </div>
              <div style={{ textAlign: 'center', borderTop: '1px solid #0f172a', width: 200, paddingTop: 6 }}>
                <div style={{ fontWeight: 600 }}>{selectedPrescription.doctor?.name || 'Dr. Nadia Aslam'}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Licensed Medical Practitioner</div>
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }} className="no-print">
              <button className="btn btn-secondary" onClick={() => setSelectedPrescription(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Print Prescription Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
