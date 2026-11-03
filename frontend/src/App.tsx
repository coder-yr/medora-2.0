import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Search,
  Pill,
  Printer,
  CheckCircle,
  AlertCircle,
  Shield,
  Stethoscope,
  Boxes,
  Microscope,
} from 'lucide-react';

import { MedicineCatalogue } from './components/MedicineCatalogue';
import { PharmacyWorkspace } from './components/PharmacyWorkspace';
import { LaboratoryWorkspace } from './components/LaboratoryWorkspace';
import { RadiologyWorkspace } from './features/radiology/RadiologyWorkspace';
import { InpatientWorkspace } from './components/InpatientWorkspace';
import { CashierWorkspace } from './components/CashierWorkspace';
import { StaffWorkspace } from './components/StaffWorkspace';
import { AccountingWorkspace } from './components/AccountingWorkspace';
import { SettingsWorkspace } from './components/SettingsWorkspace';
import { NotificationCenter } from './features/notifications/NotificationCenter';
import { NotificationAdminWorkspace } from './features/notifications/NotificationAdminWorkspace';
import { DashboardWorkspace } from './features/dashboard/DashboardWorkspace';
import { Radio, BedDouble, DollarSign, Users, BookOpen, Building2, GitBranch, Bell, LayoutDashboard } from 'lucide-react';

interface MedicineItem {
  medicineId?: number | null;
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
}

interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  symptom: string | null;
  advice: string | null;
  state: string | null;
  medicine: string | null;
  validity: string | null;
  note: string | null;
  patient?: { id: string; name: string; patientId: string; phone: string };
  doctor?: { id: string; name: string; department: string };
  items: Array<{
    id: string;
    medicineId: string | null;
    name: string;
    dosage: string | null;
    duration: string | null;
    instructions: string | null;
  }>;
  createdAt: string;
}

const isDev = import.meta.env.DEV;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isDev ? 'http://localhost:3000' : '');

export function App() {
  const [activeModule, setActiveModule] = useState<'dashboard' | 'notifications' | 'settings' | 'accounting' | 'staff' | 'inpatient' | 'cashier' | 'radiology' | 'laboratory' | 'pharmacy' | 'medicines' | 'prescriptions'>('dashboard');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchDrug, setSearchDrug] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auth & Token simulation (Development only)
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('medora_access_token') || '');
  const [userRole, setUserRole] = useState<'Doctor' | 'Admin' | 'Accountant' | 'Pharmacist' | 'Laboratorist' | 'Receptionist'>('Accountant');

  // Multi-branch state
  const [userBranches, setUserBranches] = useState<Array<{ id: string; name: string; code: string; active: boolean }>>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>(() => localStorage.getItem('medora_active_branch') || '1');

  // Form state
  const [patientId, setPatientId] = useState('1');
  const [doctorId, setDoctorId] = useState('1');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [symptom, setSymptom] = useState('');
  const [advice, setAdvice] = useState('');
  const [note, setNote] = useState('');
  const [validity, setValidity] = useState('14 days');
  const [items, setItems] = useState<MedicineItem[]>([
    { name: '', dosage: '1+0+1', duration: '5 days', instructions: 'After meals' }
  ]);

  // Catalog search state
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState<any[]>([]);

  // Selected for print
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  // Authenticate on mount
  useEffect(() => {
    const existing = sessionStorage.getItem('medora_access_token');
    if (existing) {
      setToken(existing);
      fetchPrescriptions(existing);
      return;
    }

    if (isDev) {
      loginAs(userRole);
    }
  }, [userRole]);

  // Load user accessible branches when token changes
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/v1/branches/my-branches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        const branches = json.data || json;
        if (Array.isArray(branches)) {
          setUserBranches(branches);
          if (branches.length > 0 && !branches.some((b) => String(b.id) === String(activeBranchId))) {
            setActiveBranchId(String(branches[0].id));
            localStorage.setItem('medora_active_branch', String(branches[0].id));
          } else if (branches.length === 0) {
            setActiveBranchId('');
            localStorage.removeItem('medora_active_branch');
          }
        }
      })
      .catch((err) => console.error('Failed to fetch user branches:', err));
  }, [token]);

  const handleBranchSelect = (newBranchId: string) => {
    if (userBranches.length > 0 && !userBranches.some((b) => String(b.id) === String(newBranchId))) {
      console.warn(`Access denied: User does not belong to branch ${newBranchId}`);
      return;
    }
    setActiveBranchId(newBranchId);
    localStorage.setItem('medora_active_branch', newBranchId);
  };

  const loginAs = async (role: 'Doctor' | 'Admin' | 'Accountant' | 'Pharmacist' | 'Laboratorist' | 'Receptionist') => {
    if (!isDev) {
      // In production, authentication is handled through the dedicated login screen
      return;
    }

    try {
      let email = 'admin.test@medora.hospital';
      if (role === 'Accountant') email = 'accountant.test@medora.hospital';
      if (role === 'Doctor') email = 'doctor.test@medora.hospital';
      if (role === 'Pharmacist') email = 'pharmacist.test@medora.hospital';
      if (role === 'Laboratorist') email = 'laboratorist.test@medora.hospital';
      if (role === 'Receptionist') email = 'receptionist.test@medora.hospital';

      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'ValidPassword123!' })
      });
      const data = await res.json();
      if (data.success && data.data?.accessToken) {
        setToken(data.data.accessToken);
        sessionStorage.setItem('medora_access_token', data.data.accessToken);
        fetchPrescriptions(data.data.accessToken);
      }
    } catch {
      // Backend may be offline during unit inspection, display graceful fallback
    }
  };

  const fetchPrescriptions = async (authToken = token, drug = searchDrug) => {
    if (!authToken) return;
    setLoading(true);
    try {
      const base = API_BASE_URL ? `${API_BASE_URL}/api/v1/prescriptions` : '/api/v1/prescriptions';
      const url = new URL(base, window.location.origin);
      if (drug.trim()) url.searchParams.set('drug', drug.trim());
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${authToken}` }
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
  };

  // Medicine search
  useEffect(() => {
    if (!token || !catalogQuery.trim()) {
      setCatalogResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/prescriptions/medicines/search?q=${encodeURIComponent(catalogQuery)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setCatalogResults(data.data);
        }
      } catch {
        setCatalogResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [catalogQuery, token]);

  const addItem = () => {
    setItems([...items, { name: '', dosage: '1+0+1', duration: '5 days', instructions: 'After meals' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof MedicineItem, val: string | number | null) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: val };
    setItems(next);
  };

  const selectCatalogMedicine = (index: number, med: { id: string; name: string }) => {
    updateItem(index, 'medicineId', Number(med.id));
    updateItem(index, 'name', med.name);
    setCatalogQuery('');
    setCatalogResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setNotification({ type: 'error', message: 'Not authenticated with hospital backend.' });
      return;
    }

    try {
      const payload = {
        patientId: Number(patientId),
        doctorId: Number(doctorId),
        date,
        symptom,
        advice,
        note,
        validity,
        items: items.map(i => ({
          medicineId: i.medicineId ? Number(i.medicineId) : undefined,
          name: i.name.trim(),
          dosage: i.dosage.trim(),
          duration: i.duration.trim(),
          instructions: i.instructions.trim(),
        }))
      };

      const res = await fetch(`${API_BASE_URL}/api/v1/prescriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setNotification({ type: 'success', message: 'Prescription issued successfully.' });
        // Reset form
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
      const res = await fetch(`${API_BASE_URL}/api/v1/prescriptions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
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
    <div className="app-container">
      {/* Hospital Header */}
      <header className="app-header no-print">
        <div className="brand-title">
          <div style={{ background: '#0284c7', color: '#fff', padding: 8, borderRadius: 8 }}>
            <Stethoscope size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, margin: 0, fontWeight: 700 }}>Medora 2.0 Clinical Hub</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Hospital Prescription & Medication Management</p>
          </div>
          <span className="brand-badge">Rx Module</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Active Branch Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
            <GitBranch size={16} style={{ color: '#0284c7' }} />
            <span style={{ fontWeight: 600 }}>Branch:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '4px 8px', fontWeight: 600 }}
              value={activeBranchId}
              onChange={(e) => handleBranchSelect(e.target.value)}
            >
              {userBranches.length > 0 ? (
                userBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} [{b.code}]
                  </option>
                ))
              ) : (
                <option value="1">Main Campus [MAIN]</option>
              )}
            </select>
          </div>

          {/* Notifications Center Bell */}
          <NotificationCenter token={token} apiBaseUrl={API_BASE_URL} />

          {isDev ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
              <Shield size={16} />
              <span>Dev Persona:</span>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '4px 8px' }}
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as any)}
              >
                <option value="Admin">Administrator (All Permissions & Settings)</option>
                <option value="Accountant">Accountant (General Ledger, COA, Expenses)</option>
                <option value="Receptionist">Receptionist / Cashier (POS & Drawer)</option>
                <option value="Laboratorist">Laboratorist (LIS Specimen/Analysis)</option>
                <option value="Doctor">Doctor (Prescribe/View)</option>
                <option value="Pharmacist">Pharmacist (Catalogue/Stock)</option>
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
              <Shield size={16} />
              <span>Session Authenticated</span>
            </div>
          )}
        </div>
      </header>

      {/* Module Switcher Navigation */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }} className="no-print">
        <button
          className={`btn ${activeModule === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveModule('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
        >
          <LayoutDashboard size={18} /> Executive Dashboard
        </button>
        <button
          className={`btn ${activeModule === 'notifications' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveModule('notifications')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
        >
          <Bell size={18} /> Notifications & Outbox
        </button>
        <button
          className={`btn ${activeModule === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveModule('settings')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
        >
          <Building2 size={18} /> Hospital Settings & Branches
        </button>
        <button
          className={`btn ${activeModule === 'accounting' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveModule('accounting')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
        >
          <BookOpen size={18} /> General Accounting & Ledger
        </button>
        <button
          className={`btn ${activeModule === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveModule('staff')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
        >
          <Users size={18} /> Staff Registers & HR Directory
        </button>
        <button
          className={`btn ${activeModule === 'inpatient' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveModule('inpatient')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
        >
          <BedDouble size={18} /> Inpatient & Bed Management (IPD)
        </button>
        <button
          className={`btn ${activeModule === 'cashier' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveModule('cashier')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
        >
          <DollarSign size={18} /> Cashier & Shift Close (POS)
        </button>
        <button
          className={`btn ${activeModule === 'radiology' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveModule('radiology')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
        >
          <Radio size={18} /> Radiology & Imaging (RIS)
        </button>
        <button
          className={`btn ${activeModule === 'laboratory' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveModule('laboratory')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
        >
          <Microscope size={18} /> Laboratory & Diagnostics (LIS)
        </button>
        <button
          className={`btn ${activeModule === 'pharmacy' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveModule('pharmacy')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
        >
          <Boxes size={18} /> Pharmacy & Inventory System
        </button>
        <button
          className={`btn ${activeModule === 'medicines' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveModule('medicines')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
        >
          <Pill size={18} /> Medicine & Pharmacy Catalogue
        </button>
        <button
          className={`btn ${activeModule === 'prescriptions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveModule('prescriptions')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
        >
          <Stethoscope size={18} /> Outpatient Prescriptions
        </button>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className="no-print"
          style={{
            padding: '12px 16px',
            borderRadius: 6,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: notification.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            color: notification.type === 'success' ? 'var(--success)' : 'var(--danger)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span style={{ fontSize: 14, fontWeight: 500 }}>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} style={{ color: 'inherit', fontWeight: 'bold' }}>×</button>
        </div>
      )}

      {/* Executive & Operational Dashboard Workspace */}
      {activeModule === 'dashboard' && (
        <DashboardWorkspace
          token={token}
          userRole={userRole}
          activeBranchId={activeBranchId}
          apiBaseUrl={API_BASE_URL}
          onNavigateToModule={(mod) => setActiveModule(mod as any)}
        />
      )}

      {/* Notifications & Outbox Workspace */}
      {activeModule === 'notifications' && (
        <NotificationAdminWorkspace
          token={token}
          activeBranchId={activeBranchId}
          apiBaseUrl={API_BASE_URL}
        />
      )}

      {/* Hospital Settings & Multi-Branch Management View */}
      {activeModule === 'settings' && (
        <SettingsWorkspace
          token={token}
          activeBranchId={activeBranchId}
          onBranchChange={handleBranchSelect}
        />
      )}

      {/* General Accounting, Chart of Accounts & Expense Ledger View */}
      {activeModule === 'accounting' && (
        <AccountingWorkspace
          token={token}
        />
      )}

      {/* Staff Registers & HR Directory View */}
      {activeModule === 'staff' && (
        <StaffWorkspace
          token={token}
          userRole={userRole}
        />
      )}

      {/* Inpatient & Bed Management (IPD) View */}
      {activeModule === 'inpatient' && (
        <InpatientWorkspace
          apiBaseUrl={API_BASE_URL}
          token={token}
          userRole={userRole}
          onNotification={(type, message) => setNotification({ type, message })}
        />
      )}

      {/* Cashier, Shift Close & Treasury View */}
      {activeModule === 'cashier' && (
        <CashierWorkspace
          token={token}
          userRole={userRole}
        />
      )}

      {/* Radiology Information System (RIS) View */}
      {activeModule === 'radiology' && (
        <RadiologyWorkspace
          token={token}
          userRole={userRole}
        />
      )}

      {/* Laboratory Information System (LIS) View */}
      {activeModule === 'laboratory' && (
        <LaboratoryWorkspace
          token={token}
          userRole={userRole}
        />
      )}

      {/* Pharmacy & Inventory Management View */}
      {activeModule === 'pharmacy' && (
        <PharmacyWorkspace
          apiBaseUrl={API_BASE_URL}
          token={token}
          userRole={userRole as any}
          onNotification={(type, message) => setNotification({ type, message })}
        />
      )}

      {/* Medicine Catalogue View */}
      {activeModule === 'medicines' && (
        <MedicineCatalogue
          apiBaseUrl={API_BASE_URL}
          token={token}
          userRole={userRole as any}
          onNotification={(type, message) => setNotification({ type, message })}
        />
      )}

      {/* Outpatient Prescriptions Grid */}
      {activeModule === 'prescriptions' && (
        <div className="main-grid no-print">
        {/* Prescription Authoring Form */}
        <section className="card">
          <h2 className="card-title">
            <Plus size={18} /> Write New Prescription
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Patient ID</label>
                <input
                  type="number"
                  className="form-input"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Doctor ID</label>
                <input
                  type="number"
                  className="form-input"
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  required
                />
              </div>
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

            <div className="form-group">
              <label className="form-label">Presenting Symptoms</label>
              <input
                type="text"
                placeholder="e.g. Fever, persistent cough"
                className="form-input"
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
              />
            </div>

            {/* Prescribed Medications */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>Medication Regimen *</label>
                <button type="button" onClick={addItem} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }}>
                  <Plus size={12} /> Add Drug
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="med-row">
                  <div>
                    <input
                      type="text"
                      placeholder="Search or type drug..."
                      className="form-input"
                      value={item.name}
                      onChange={(e) => {
                        updateItem(idx, 'name', e.target.value);
                        setCatalogQuery(e.target.value);
                      }}
                      required
                    />
                    {catalogResults.length > 0 && catalogQuery && (
                      <div style={{
                        position: 'absolute',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        zIndex: 10,
                        maxHeight: 160,
                        overflowY: 'auto',
                        boxShadow: 'var(--shadow-md)',
                        width: 240,
                      }}>
                        {catalogResults.map((med) => (
                          <div
                            key={med.id}
                            style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-color)' }}
                            onClick={() => selectCatalogMedicine(idx, med)}
                          >
                            <strong>{med.name}</strong> <span style={{ color: 'var(--text-muted)' }}>({med.generic})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="Dosage (1+0+1)"
                    className="form-input"
                    value={item.dosage}
                    onChange={(e) => updateItem(idx, 'dosage', e.target.value)}
                  />

                  <input
                    type="text"
                    placeholder="Duration"
                    className="form-input"
                    value={item.duration}
                    onChange={(e) => updateItem(idx, 'duration', e.target.value)}
                  />

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      style={{ color: 'var(--danger)', padding: 4 }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label">Clinical Advice</label>
              <textarea
                rows={2}
                placeholder="Doctor's advice, diet, precautions..."
                className="form-textarea"
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Dispensing Notes / Validity</label>
              <input
                type="text"
                placeholder="Validity: e.g. 14 days"
                className="form-input"
                value={validity}
                onChange={(e) => setValidity(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
              <FileText size={16} /> Issue Prescription
            </button>
          </form>
        </section>

        {/* Prescription Register */}
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="card-title" style={{ margin: 0 }}>
              <FileText size={18} /> Outpatient Prescriptions
            </h2>
            <div style={{ width: 280 }} className="search-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Filter by drug name..."
                value={searchDrug}
                onChange={(e) => {
                  setSearchDrug(e.target.value);
                  fetchPrescriptions(token, e.target.value);
                }}
              />
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Loading prescriptions...</p>
          ) : prescriptions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              <Pill size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p>No prescriptions match your criteria.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rx #</th>
                    <th>Date</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Prescribed Regimen</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((rx) => (
                    <tr key={rx.id}>
                      <td style={{ fontWeight: 600 }}>#{rx.id}</td>
                      <td>{rx.date}</td>
                      <td>
                        <strong>{rx.patient?.name || `Patient #${rx.patientId}`}</strong>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>MRN: {rx.patient?.patientId || '-'}</div>
                      </td>
                      <td>
                        <div>{rx.doctor?.name || `Doctor #${rx.doctorId}`}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rx.doctor?.department || ''}</div>
                      </td>
                      <td>
                        <div style={{ maxWidth: 300 }}>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{rx.medicine || 'No summary'}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-success">{rx.state || 'issued'}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      )}

      {/* Printable Clinical Slip Modal */}
      {selectedPrescription && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 640,
              width: '100%',
              background: '#fff',
              color: '#000',
              padding: 32,
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
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
                  {selectedPrescription.items.map((it) => (
                    <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 0', fontWeight: 600 }}>{it.name}</td>
                      <td style={{ padding: '8px 0' }}>{it.dosage || '-'}</td>
                      <td style={{ padding: '8px 0' }}>{it.duration || '-'}</td>
                      <td style={{ padding: '8px 0', color: '#475569' }}>{it.instructions || '-'}</td>
                    </tr>
                  ))}
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
}

export default App;
