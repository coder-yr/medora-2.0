import React, { useState, useEffect, useCallback } from 'react';
import {
  Pill,
  Plus,
  Trash2,
  Search,
  Printer,
  CheckCircle,
  AlertCircle,
  FileText
} from 'lucide-react';
import type { Prescription, MedicineItem, CreatePrescriptionDto } from '../../types/prescription';
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
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
  const [validity, setValidity] = useState('14 days');
  const [items, setItems] = useState<MedicineItem[]>([
    { name: '', dosage: '1+0+1', duration: '5 days', instructions: 'After meals' },
  ]);

  // Catalog search state
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

  // Selected for print
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  // Load doctors
  useEffect(() => {
    if (!token) return;
    fetch(`${apiBaseUrl}/api/v1/doctors?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.data) {
          setDoctorsList(data.data.data);
          if (!selectedDoctorId && data.data.data.length > 0) {
            setSelectedDoctorId(String(data.data.data[0].id));
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
        if (data.success && data.data?.data) {
          setPatientsList(data.data.data);
        }
      } catch {
        setPatientsList([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [patientSearch, token, apiBaseUrl]);

  // Medicine search
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
      if (data.success && data.data?.data) {
        setPrescriptions(data.data.data);
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
    setItems([...items, { name: '', dosage: '1+0+1', duration: '5 days', instructions: 'After meals' }]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    try {
      const payload: CreatePrescriptionDto = {
        patientId: Number(selectedPatient.id),
        doctorId: Number(selectedDoctorId),
        date,
        symptom: symptom.trim() || undefined,
        advice: advice.trim() || undefined,
        note: note.trim() || undefined,
        validity,
        items: items
          .filter((i) => i.name.trim())
          .map((i) => ({
            medicineId: i.medicineId ? Number(i.medicineId) : undefined,
            name: i.name.trim(),
            dosage: i.dosage.trim(),
            duration: i.duration.trim(),
            instructions: i.instructions.trim(),
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
        setNotification({ type: 'success', message: 'Prescription issued successfully.' });
        setSymptom('');
        setAdvice('');
        setNote('');
        setItems([{ name: '', dosage: '1+0+1', duration: '5 days', instructions: 'After meals' }]);
        fetchPrescriptions();
      } else {
        const errorMsg = data.error?.message || data.message || 'Validation error.';
        setNotification({ type: 'error', message: Array.isArray(errorMsg) ? errorMsg.join('; ') : errorMsg });
      }
    } catch {
      setNotification({ type: 'error', message: 'Failed to communicate with hospital API.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently remove this prescription?')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/prescriptions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: 'Prescription deleted.' });
        fetchPrescriptions();
      } else {
        setNotification({ type: 'error', message: data.error?.message || 'Delete restricted to Administrators.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error deleting prescription.' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pill size={22} style={{ color: '#0284c7' }} />
            Prescription Management & Digital Rx Registry
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Issue prescriptions, search formulary, and print branded clinical medication slips
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
            background: notification.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: notification.type === 'success' ? '#166534' : '#b91c1c',
            fontSize: 13,
          }}
        >
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="main-grid">
        {/* Prescription Creation Form */}
        <section className="card">
          <h3 className="card-title">
            <Plus size={18} style={{ color: '#0284c7' }} /> Issue New Prescription
          </h3>

          <form onSubmit={handleSubmit}>
            {/* Patient Search & Selection */}
            <div className="form-group">
              <label className="form-label">Patient *</label>
              {selectedPatient ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#e0f2fe', borderRadius: 6 }}>
                  <div>
                    <strong style={{ color: '#0369a1' }}>{selectedPatient.name}</strong>
                    <span style={{ fontSize: 12, color: '#0284c7', marginLeft: 6 }}>MRN #{selectedPatient.patientId || selectedPatient.id}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPatient(null)}
                    style={{ fontSize: 11, color: '#0284c7', textDecoration: 'underline' }}
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
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                  {patientsList.length > 0 && (
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
                          style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 12 }}
                        >
                          <strong>{p.name}</strong> <span style={{ color: '#0284c7' }}>#{p.patientId || p.id}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Doctor and Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Prescribing Doctor *</label>
                <select
                  className="form-select"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  required
                >
                  <option value="">Select Doctor</option>
                  {doctorsList.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Presenting Symptoms</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Dry cough, high fever"
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Doctor Advice</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="e.g. Bed rest, avoid cold fluids"
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
              />
            </div>

            {/* Medicine Items */}
            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>Prescribed Medicines (Rx)</label>
                <button type="button" className="btn btn-secondary" onClick={addItem} style={{ fontSize: 11, padding: '4px 8px' }}>
                  <Plus size={12} /> Add Medicine
                </button>
              </div>

              {items.map((item, index) => (
                <div key={index} style={{ background: 'var(--bg-subtle)', padding: 10, borderRadius: 6, marginBottom: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Medicine name..."
                      value={item.name}
                      onChange={(e) => {
                        updateItem(index, 'name', e.target.value);
                        setCatalogQuery(e.target.value);
                        setActiveItemIndex(index);
                      }}
                      required
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        style={{ color: '#ef4444', background: 'none' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    {activeItemIndex === index && catalogResults.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        zIndex: 20,
                        maxHeight: 140,
                        overflowY: 'auto'
                      }}>
                        {catalogResults.map((med) => (
                          <div
                            key={med.id}
                            onClick={() => selectCatalogMedicine(index, med)}
                            style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 12 }}
                          >
                            <strong>{med.name}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Dosage (1+0+1)"
                      value={item.dosage}
                      onChange={(e) => updateItem(index, 'dosage', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Duration"
                      value={item.duration}
                      onChange={(e) => updateItem(index, 'duration', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Instructions"
                      value={item.instructions}
                      onChange={(e) => updateItem(index, 'instructions', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Rx Validity</label>
                <input
                  type="text"
                  className="form-input"
                  value={validity}
                  onChange={(e) => setValidity(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Internal Note</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }}>
              Issue Prescription
            </button>
          </form>
        </section>

        {/* Prescription Registry Table */}
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              <FileText size={18} style={{ color: '#0284c7' }} /> Issued Prescriptions Registry
            </h3>

            <div style={{ position: 'relative', width: 220 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by drug..."
                value={searchDrug}
                onChange={(e) => {
                  setSearchDrug(e.target.value);
                  fetchPrescriptions(e.target.value);
                }}
                style={{ paddingLeft: 30, padding: '4px 8px 4px 30px', fontSize: 12 }}
              />
              <Search size={14} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Rx #</th>
                  <th style={{ padding: '8px 12px' }}>Patient</th>
                  <th style={{ padding: '8px 12px' }}>Doctor</th>
                  <th style={{ padding: '8px 12px' }}>Medications</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading prescriptions...
                    </td>
                  </tr>
                ) : prescriptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No prescriptions found.
                    </td>
                  </tr>
                ) : (
                  prescriptions.map((rx) => (
                    <tr key={rx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0284c7' }}>
                        #{rx.id}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600 }}>{rx.patient?.name || `Patient #${rx.patientId}`}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>MRN #{rx.patient?.patientId || rx.patientId}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div>{rx.doctor?.name || `Doctor #${rx.doctorId}`}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rx.doctor?.department || ''}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ maxWidth: 220, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rx.medicine || (rx.items && rx.items.map((i) => i.name).join(', ')) || 'No summary'}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => setSelectedPrescription(rx)}
                            title="Print Prescription Slip"
                          >
                            <Printer size={14} />
                          </button>
                          {userRole === 'Admin' && (
                            <button
                              className="btn btn-danger"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => handleDelete(rx.id)}
                              title="Delete Prescription (Admin)"
                            >
                              <Trash2 size={14} />
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
        </section>
      </div>

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
          <div className="card" style={{ maxWidth: 640, width: '100%', background: '#fff', color: '#000', padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0284c7' }}>MEDORA HOSPITAL</h2>
                <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>Trusted Clinical Care & Pharmacy</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>PRESCRIPTION</h3>
                <p style={{ margin: 0, fontSize: 12 }}>Rx No: #{selectedPrescription.id}</p>
                <p style={{ margin: 0, fontSize: 12 }}>Date: {selectedPrescription.date}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, fontSize: 13, background: '#f8fafc', padding: 12, borderRadius: 6 }}>
              <div>
                <p><strong>Patient:</strong> {selectedPrescription.patient?.name || `Patient #${selectedPrescription.patientId}`}</p>
                <p><strong>MRN:</strong> {selectedPrescription.patient?.patientId || 'N/A'}</p>
              </div>
              <div>
                <p><strong>Doctor:</strong> {selectedPrescription.doctor?.name || `Doctor #${selectedPrescription.doctorId}`}</p>
                <p><strong>Specialty:</strong> {selectedPrescription.doctor?.department || 'General'}</p>
              </div>
            </div>

            {selectedPrescription.symptom && (
              <div style={{ marginBottom: 14, fontSize: 13 }}>
                <strong>Clinical Presentation / Symptoms:</strong> {selectedPrescription.symptom}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'serif', marginBottom: 8 }}>℞</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '6px 0' }}>Medicine Name</th>
                    <th style={{ padding: '6px 0' }}>Dosage</th>
                    <th style={{ padding: '6px 0' }}>Duration</th>
                    <th style={{ padding: '6px 0' }}>Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPrescription.items && selectedPrescription.items.length > 0 ? (
                    selectedPrescription.items.map((it) => (
                      <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 0', fontWeight: 600 }}>{it.name}</td>
                        <td style={{ padding: '8px 0' }}>{it.dosage || '-'}</td>
                        <td style={{ padding: '8px 0' }}>{it.duration || '-'}</td>
                        <td style={{ padding: '8px 0', color: '#475569' }}>{it.instructions || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '8px 0' }}>{selectedPrescription.medicine || 'No items itemized'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedPrescription.advice && (
              <div style={{ marginBottom: 20, fontSize: 13, background: '#fffbeb', padding: 10, borderRadius: 6, border: '1px solid #fef3c7' }}>
                <strong>Doctor's Advice:</strong> {selectedPrescription.advice}
              </div>
            )}

            <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 12 }}>
              <div>
                <p>Validity: {selectedPrescription.validity || '30 days'}</p>
                <p style={{ color: '#64748b' }}>Generated by Medora 2.0</p>
              </div>
              <div style={{ textAlign: 'center', borderTop: '1px solid #000', width: 160, paddingTop: 4 }}>
                Doctor Signature
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }} className="no-print">
              <button className="btn btn-secondary" onClick={() => setSelectedPrescription(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Print Prescription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
