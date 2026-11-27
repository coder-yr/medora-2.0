import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  Calendar,
  CreditCard,
  Eye,
  AlertCircle,
  AlertTriangle,
  X,
  FileText,
  Activity,
  Phone,
  Clock,
  Heart,
  Stethoscope,
  Pill,
  CheckCircle2,
  Trash2,
  Edit3,
} from 'lucide-react';
import type {
  Patient,
  CreatePatientDto,
  DuplicateCheckResponse,
  PatientEncounterResponse,
  PatientDocument,
} from '../../types/patient';
import { useAuth } from '../../context/AuthContext';

interface PatientWorkspaceProps {
  token: string;
  apiBaseUrl: string;
  activeBranchId?: string;
  onBookAppointment?: (patient: Patient) => void;
  onRaiseInvoice?: (patient: Patient) => void;
  initialAction?: 'register' | null;
}

export const PatientWorkspace: React.FC<PatientWorkspaceProps> = ({
  token,
  apiBaseUrl,
  activeBranchId,
  onBookAppointment,
  onRaiseInvoice,
  initialAction,
}) => {
  const { userPermissions, userRole } = useAuth();
  const canRegisterPatient =
    userPermissions.includes('patient_add') ||
    userRole === 'Hospital Admin' ||
    userRole === 'Organization Admin' ||
    userRole === 'Clinic Admin';
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawers
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<'demographics' | 'clinical' | 'encounters' | 'documents'>('demographics');

  // Register Form State
  const [formData, setFormData] = useState<CreatePatientDto>({
    name: '',
    fatherName: '',
    email: '',
    phone: '',
    altPhone: '',
    address: '',
    city: '',
    birthdate: '',
    sex: 'male',
    bloodGroup: 'O+',
    cnic: '',
    guardianRelation: '',
    guardianMrn: '',
    mlc: false,
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    allergies: '',
    medicalHistory: '',
    surgicalHistory: '',
    familyHistory: '',
    currentMedications: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Duplicate Detection State
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheckResponse | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [ignoreDuplicateWarning, setIgnoreDuplicateWarning] = useState(false);
  const duplicateCheckTimer = useRef<NodeJS.Timeout | null>(null);

  // Encounter & Document Data for Selected Patient
  const [encounters, setEncounters] = useState<PatientEncounterResponse | null>(null);
  const [loadingEncounters, setLoadingEncounters] = useState(false);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  // Document upload form
  const [showDocForm, setShowDocForm] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('LAB_REPORT');
  const [docUrl, setDocUrl] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);

  // Clinical profile edit mode
  const [editingClinical, setEditingClinical] = useState(false);
  const [clinicalData, setClinicalData] = useState({
    allergies: '',
    medicalHistory: '',
    surgicalHistory: '',
    familyHistory: '',
    currentMedications: '',
  });
  const [savingClinical, setSavingClinical] = useState(false);

  useEffect(() => {
    if (initialAction === 'register') {
      setShowRegisterModal(true);
    }
  }, [initialAction]);

  const fetchPatients = useCallback(async (q = searchQuery, p = page) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${apiBaseUrl}/api/v1/patients`);
      if (q.trim()) url.searchParams.set('q', q.trim());
      url.searchParams.set('page', String(p));
      url.searchParams.set('limit', '15');
      if (activeBranchId) url.searchParams.set('branchId', activeBranchId);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const patientItems = Array.isArray(data.data)
          ? data.data
          : (data.data?.items || data.data?.data || []);
        const totalCount = data.data?.meta?.total ?? data.data?.total ?? patientItems.length;
        const totalPageCount = data.data?.meta?.totalPages ?? data.data?.totalPages ?? 1;

        setPatients(patientItems);
        setTotal(totalCount);
        setTotalPages(totalPageCount);
      } else {
        setError(data.error?.message || data.message || 'Failed to load patients.');
      }
    } catch {
      setError('Network error contacting patient registry service.');
    } finally {
      setLoading(false);
    }
  }, [token, apiBaseUrl, activeBranchId, searchQuery, page]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Debounced duplicate detection
  const performDuplicateCheck = useCallback(
    async (phone?: string, cnic?: string, name?: string, birthdate?: string) => {
      if (!token) return;
      if (!phone && !cnic && !(name && birthdate)) {
        setDuplicateCheck(null);
        return;
      }

      setCheckingDuplicates(true);
      try {
        const url = new URL(`${apiBaseUrl}/api/v1/patients/check-duplicates`);
        if (phone?.trim()) url.searchParams.set('phone', phone.trim());
        if (cnic?.trim()) url.searchParams.set('cnic', cnic.trim());
        if (name?.trim()) url.searchParams.set('name', name.trim());
        if (birthdate?.trim()) url.searchParams.set('birthdate', birthdate.trim());
        if (activeBranchId) url.searchParams.set('branchId', activeBranchId);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success && data.data) {
          setDuplicateCheck(data.data);
          if (!data.data.hasMatch) {
            setIgnoreDuplicateWarning(false);
          }
        }
      } catch {
        // Silently tolerate duplicate check network blips
      } finally {
        setCheckingDuplicates(false);
      }
    },
    [token, apiBaseUrl, activeBranchId]
  );

  const handleFieldChange = (field: keyof CreatePatientDto, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);

    if (field === 'phone' || field === 'cnic' || field === 'name' || field === 'birthdate') {
      if (duplicateCheckTimer.current) clearTimeout(duplicateCheckTimer.current);
      duplicateCheckTimer.current = setTimeout(() => {
        performDuplicateCheck(
          updated.phone,
          updated.cnic,
          updated.name,
          updated.birthdate
        );
      }, 500);
    }
  };

  // Load Encounters for selected patient
  const fetchEncounters = useCallback(
    async (patientId: string) => {
      if (!token) return;
      setLoadingEncounters(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/patients/${patientId}/encounters`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success && data.data) {
          setEncounters(data.data);
        }
      } catch {
        // Ignored
      } finally {
        setLoadingEncounters(false);
      }
    },
    [token, apiBaseUrl]
  );

  // Load Documents for selected patient
  const fetchDocuments = useCallback(
    async (patientId: string) => {
      if (!token) return;
      setLoadingDocuments(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/patients/${patientId}/documents`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data)) {
          setDocuments(data.data);
        }
      } catch {
        // Ignored
      } finally {
        setLoadingDocuments(false);
      }
    },
    [token, apiBaseUrl]
  );

  useEffect(() => {
    if (selectedPatient) {
      setClinicalData({
        allergies: selectedPatient.allergies || '',
        medicalHistory: selectedPatient.medicalHistory || '',
        surgicalHistory: selectedPatient.surgicalHistory || '',
        familyHistory: selectedPatient.familyHistory || '',
        currentMedications: selectedPatient.currentMedications || '',
      });
      if (activeTab === 'encounters') {
        fetchEncounters(selectedPatient.id);
      } else if (activeTab === 'documents') {
        fetchDocuments(selectedPatient.id);
      }
    }
  }, [selectedPatient, activeTab, fetchEncounters, fetchDocuments]);

  const handleSaveClinicalProfile = async () => {
    if (!selectedPatient) return;
    setSavingClinical(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/patients/${selectedPatient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(clinicalData),
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setSelectedPatient(data.data);
        setPatients((prev) =>
          prev.map((p) => (String(p.id) === String(data.data.id) ? data.data : p))
        );
        setEditingClinical(false);
      }
    } catch {
      // Ignored
    } finally {
      setSavingClinical(false);
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !docTitle.trim() || !docUrl.trim()) return;
    setSavingDoc(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/patients/${selectedPatient.id}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: docTitle.trim(),
          documentType: docType,
          fileUrl: docUrl.trim(),
          notes: docNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setDocuments((prev) => [data.data, ...prev]);
        setShowDocForm(false);
        setDocTitle('');
        setDocUrl('');
        setDocNotes('');
      }
    } catch {
      // Ignored
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!selectedPatient || !window.confirm('Delete this clinical document?')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/patients/${selectedPatient.id}/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => String(d.id) !== String(docId)));
      }
    } catch {
      // Ignored
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPatients(searchQuery, 1);
  };

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Patient full name is required.');
      return;
    }
    if (duplicateCheck?.hasMatch && !ignoreDuplicateWarning) {
      setFormError('Potential duplicate patient found. Please review the warning below before proceeding.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload: any = {
        name: formData.name.trim(),
        sex: formData.sex || 'male',
      };
      if (formData.fatherName?.trim()) payload.fatherName = formData.fatherName.trim();
      if (formData.email?.trim()) payload.email = formData.email.trim();
      if (formData.phone?.trim()) payload.phone = formData.phone.trim();
      if (formData.altPhone?.trim()) payload.altPhone = formData.altPhone.trim();
      if (formData.address?.trim()) payload.address = formData.address.trim();
      if (formData.city?.trim()) payload.city = formData.city.trim();
      if (formData.birthdate) payload.birthdate = formData.birthdate;
      if (formData.bloodGroup) payload.bloodGroup = formData.bloodGroup;
      if (formData.cnic?.trim()) payload.cnic = formData.cnic.trim();
      if (formData.guardianRelation?.trim()) payload.guardianRelation = formData.guardianRelation.trim();
      if (formData.guardianMrn?.trim()) payload.guardianMrn = formData.guardianMrn.trim();
      if (formData.mlc !== undefined) payload.mlc = formData.mlc;
      if (formData.emergencyContactName?.trim()) payload.emergencyContactName = formData.emergencyContactName.trim();
      if (formData.emergencyContactPhone?.trim()) payload.emergencyContactPhone = formData.emergencyContactPhone.trim();
      if (formData.emergencyContactRelation?.trim()) payload.emergencyContactRelation = formData.emergencyContactRelation.trim();
      if (formData.allergies?.trim()) payload.allergies = formData.allergies.trim();
      if (formData.medicalHistory?.trim()) payload.medicalHistory = formData.medicalHistory.trim();
      if (formData.surgicalHistory?.trim()) payload.surgicalHistory = formData.surgicalHistory.trim();
      if (formData.familyHistory?.trim()) payload.familyHistory = formData.familyHistory.trim();
      if (formData.currentMedications?.trim()) payload.currentMedications = formData.currentMedications.trim();
      if (activeBranchId) payload.branchId = Number(activeBranchId);

      const res = await fetch(`${apiBaseUrl}/api/v1/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setShowRegisterModal(false);
        setFormData({
          name: '',
          fatherName: '',
          email: '',
          phone: '',
          altPhone: '',
          address: '',
          city: '',
          birthdate: '',
          sex: 'male',
          bloodGroup: 'O+',
          cnic: '',
          guardianRelation: '',
          guardianMrn: '',
          mlc: false,
          emergencyContactName: '',
          emergencyContactPhone: '',
          emergencyContactRelation: '',
          allergies: '',
          medicalHistory: '',
          surgicalHistory: '',
          familyHistory: '',
          currentMedications: '',
        });
        setDuplicateCheck(null);
        setIgnoreDuplicateWarning(false);
        if (data.data) {
          setPatients((prev) => [data.data, ...prev.filter((p) => String(p.id) !== String(data.data.id))]);
          setSelectedPatient(data.data);
          setActiveTab('demographics');
        }
        fetchPatients('', 1);
      } else {
        const msg = data.error?.message || data.message || 'Registration failed.';
        setFormError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setFormError('Network communication error with patient service.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={22} style={{ color: '#0284c7' }} />
            Outpatient Patient Central Registry
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Comprehensive patient demographic management, clinical alerts, and encounter timeline
          </p>
        </div>

        {canRegisterPatient && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowRegisterModal(true);
              setDuplicateCheck(null);
              setIgnoreDuplicateWarning(false);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Plus size={16} /> Register New Patient
          </button>
        )}
      </div>

      {/* Search Toolbar */}
      <div className="card" style={{ padding: 14 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by MRN (e.g. 000001), patient name, CNIC, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 38 }}
            />
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            Search
          </button>
          {searchQuery && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearchQuery('');
                fetchPatients('', 1);
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, background: '#fee2e2', color: '#b91c1c', fontSize: 13 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Patients Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            Total Registered Patients: <strong style={{ color: 'var(--text-main)' }}>{total}</strong>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 16px' }}>MRN</th>
                <th style={{ padding: '10px 16px' }}>Patient Name</th>
                <th style={{ padding: '10px 16px' }}>Age / Sex</th>
                <th style={{ padding: '10px 16px' }}>Phone</th>
                <th style={{ padding: '10px 16px' }}>Allergies / Alerts</th>
                <th style={{ padding: '10px 16px' }}>Emergency Contact</th>
                <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading patient records...
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No patients found matching your search.
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7' }}>
                      #{p.patientId || p.id}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      {p.fatherName && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>s/o {p.fatherName}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ textTransform: 'capitalize' }}>
                        {p.age ? `${p.age} yrs` : '-'} / {p.sex || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{p.phone || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {p.allergies ? (
                        <span className="badge badge-warning" style={{ fontSize: 11, background: '#fef3c7', color: '#b45309' }}>
                          ⚠️ {p.allergies}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#16a34a' }}>NKDA</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {p.emergencyContactName ? (
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 12 }}>{p.emergencyContactName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {p.emergencyContactRelation ? `(${p.emergencyContactRelation}) ` : ''}
                            {p.emergencyContactPhone || ''}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                          onClick={() => {
                            setSelectedPatient(p);
                            setActiveTab('demographics');
                          }}
                          title="View Outpatient Clinical Profile"
                        >
                          <Eye size={14} /> Profile
                        </button>
                        {onBookAppointment && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', fontSize: 12, color: '#0284c7' }}
                            onClick={() => onBookAppointment(p)}
                            title="Book Outpatient Appointment"
                          >
                            <Calendar size={14} /> Book
                          </button>
                        )}
                        {onRaiseInvoice && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', fontSize: 12, color: '#16a34a' }}
                            onClick={() => onRaiseInvoice(p)}
                            title="Raise Patient Invoice"
                          >
                            <CreditCard size={14} /> Bill
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
                const nextP = Math.max(1, page - 1);
                setPage(nextP);
                fetchPatients(searchQuery, nextP);
              }}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => {
                const nextP = Math.min(totalPages, page + 1);
                setPage(nextP);
                fetchPatients(searchQuery, nextP);
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Registration Modal */}
      {showRegisterModal && (
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
          <div className="card" style={{ maxWidth: 760, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 28, position: 'relative' }}>
            <button
              onClick={() => setShowRegisterModal(false)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={20} style={{ color: '#0284c7' }} />
              Register Outpatient Hospital Patient
            </h3>

            {/* Duplicate Detection Alert */}
            {duplicateCheck?.hasMatch && !ignoreDuplicateWarning && (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 8,
                padding: 14,
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  <AlertTriangle size={18} />
                  <span>Potential Duplicate Record Detected ({duplicateCheck.matchCount} match found)</span>
                </div>
                <div style={{ fontSize: 12, color: '#78350f', marginBottom: 10 }}>
                  A patient with matching contact information already exists in this organization/branch:
                </div>
                {duplicateCheck.matches.map(({ patient: m, matchedOn }) => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '8px 12px', borderRadius: 6, marginBottom: 6, border: '1px solid #fef3c7' }}>
                    <div>
                      <strong>{m.name}</strong> (MRN: #{m.patientId || m.id}) • Phone: {m.phone || 'N/A'} • CNIC: {m.cnic || 'N/A'}
                      <div style={{ fontSize: 11, color: '#b45309' }}>Matched on: {matchedOn.join(', ')}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                      onClick={() => {
                        setShowRegisterModal(false);
                        setSelectedPatient(m);
                        setActiveTab('demographics');
                      }}
                    >
                      View Existing
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    type="button"
                    style={{ fontSize: 12, color: '#b45309', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setIgnoreDuplicateWarning(true)}
                  >
                    I have verified this is a different patient (Proceed with registration)
                  </button>
                </div>
              </div>
            )}

            {formError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterPatient}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* SECTION 1: Demographics */}
                <div style={{ gridColumn: 'span 2', fontWeight: 600, fontSize: 13, color: '#0284c7', borderBottom: '1px solid var(--border-color)', paddingBottom: 4, marginTop: 4 }}>
                  1. Patient Demographics
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Amina Yousaf"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Father / Husband Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Muhammad Yousaf"
                    value={formData.fatherName}
                    onChange={(e) => handleFieldChange('fatherName', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sex *</label>
                  <select
                    className="form-select"
                    value={formData.sex}
                    onChange={(e) => handleFieldChange('sex', e.target.value)}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Birth Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.birthdate}
                    onChange={(e) => handleFieldChange('birthdate', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select
                    className="form-select"
                    value={formData.bloodGroup}
                    onChange={(e) => handleFieldChange('bloodGroup', e.target.value)}
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Primary Phone (Mobile)</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="03001234567"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">CNIC / National Identity Card</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="35201-1234567-1"
                    value={formData.cnic}
                    onChange={(e) => handleFieldChange('cnic', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="patient@example.com"
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">City / District</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Islamabad"
                    value={formData.city}
                    onChange={(e) => handleFieldChange('city', e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Residential Address</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Street, Sector, City"
                    value={formData.address}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                  />
                </div>

                {/* SECTION 2: Emergency Contact */}
                <div style={{ gridColumn: 'span 2', fontWeight: 600, fontSize: 13, color: '#0284c7', borderBottom: '1px solid var(--border-color)', paddingBottom: 4, marginTop: 10 }}>
                  2. Emergency Contact
                </div>

                <div className="form-group">
                  <label className="form-label">Emergency Contact Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Zainab Bibi"
                    value={formData.emergencyContactName}
                    onChange={(e) => handleFieldChange('emergencyContactName', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. 03009876543"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => handleFieldChange('emergencyContactPhone', e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Relationship to Patient</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Spouse, Brother, Parent"
                    value={formData.emergencyContactRelation}
                    onChange={(e) => handleFieldChange('emergencyContactRelation', e.target.value)}
                  />
                </div>

                {/* SECTION 3: Clinical Background & Alerts */}
                <div style={{ gridColumn: 'span 2', fontWeight: 600, fontSize: 13, color: '#0284c7', borderBottom: '1px solid var(--border-color)', paddingBottom: 4, marginTop: 10 }}>
                  3. Clinical Background & Alerts
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ color: '#b45309', fontWeight: 600 }}>
                    ⚠️ Known Drug Allergies & Clinical Alerts
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Penicillin, Aspirin, Sulfa drugs (Leave blank if NKDA)"
                    value={formData.allergies}
                    onChange={(e) => handleFieldChange('allergies', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Past Medical History</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Type 2 Diabetes, Hypertension"
                    value={formData.medicalHistory}
                    onChange={(e) => handleFieldChange('medicalHistory', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Surgical History</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Appendectomy (2018)"
                    value={formData.surgicalHistory}
                    onChange={(e) => handleFieldChange('surgicalHistory', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Family Medical History</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. CAD, Diabetes"
                    value={formData.familyHistory}
                    onChange={(e) => handleFieldChange('familyHistory', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Current Medications</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Metformin 500mg BID"
                    value={formData.currentMedications}
                    onChange={(e) => handleFieldChange('currentMedications', e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    id="mlc-check"
                    checked={formData.mlc}
                    onChange={(e) => handleFieldChange('mlc', e.target.checked)}
                  />
                  <label htmlFor="mlc-check" style={{ fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                    Mark as Medico-Legal Case (MLC)
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRegisterModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting || checkingDuplicates}>
                  {submitting ? 'Registering...' : checkingDuplicates ? 'Checking...' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Detail Profile & Clinical Drawer */}
      {selectedPatient && (
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
          <div className="card" style={{ maxWidth: 840, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 28, position: 'relative' }}>
            <button
              onClick={() => setSelectedPatient(null)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8' }}
            >
              <X size={20} />
            </button>

            {/* Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 26, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20 }}>
                {selectedPatient.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{selectedPatient.name}</h3>
                  <span className="badge badge-success">MRN #{selectedPatient.patientId || selectedPatient.id}</span>
                  {selectedPatient.mlc && <span className="badge badge-warning">MLC</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                  <span>{selectedPatient.age ? `${selectedPatient.age} yrs` : 'Age unrecorded'}</span>
                  <span>•</span>
                  <span style={{ textTransform: 'capitalize' }}>{selectedPatient.sex || 'Sex unrecorded'}</span>
                  <span>•</span>
                  <span>Blood Group: <strong>{selectedPatient.bloodGroup || 'Not specified'}</strong></span>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => setActiveTab('demographics')}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: activeTab === 'demographics' ? '2px solid #0284c7' : '2px solid transparent',
                  background: 'none',
                  color: activeTab === 'demographics' ? '#0284c7' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Users size={16} /> Demographics & Emergency
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('clinical')}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: activeTab === 'clinical' ? '2px solid #0284c7' : '2px solid transparent',
                  background: 'none',
                  color: activeTab === 'clinical' ? '#0284c7' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Heart size={16} /> Clinical Alerts & History
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('encounters')}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: activeTab === 'encounters' ? '2px solid #0284c7' : '2px solid transparent',
                  background: 'none',
                  color: activeTab === 'encounters' ? '#0284c7' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Activity size={16} /> Encounter Timeline
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: activeTab === 'documents' ? '2px solid #0284c7' : '2px solid transparent',
                  background: 'none',
                  color: activeTab === 'documents' ? '#0284c7' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <FileText size={16} /> Documents & Records
              </button>
            </div>

            {/* TAB 1: Demographics & Emergency */}
            {activeTab === 'demographics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, background: 'var(--bg-subtle)', padding: 18, borderRadius: 8, fontSize: 13 }}>
                  <div>
                    <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>FATHER / GUARDIAN</strong>
                    {selectedPatient.fatherName || '-'}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>CNIC / IDENTIFICATION</strong>
                    {selectedPatient.cnic || '-'}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>PHONE NUMBER</strong>
                    {selectedPatient.phone || '-'}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>EMAIL ADDRESS</strong>
                    {selectedPatient.email || '-'}
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>RESIDENCE / ADDRESS</strong>
                    {selectedPatient.address || '-'} {selectedPatient.city ? `(${selectedPatient.city})` : ''}
                  </div>
                </div>

                {/* Emergency Contact Card */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                    <Phone size={16} />
                    Emergency Contact Details
                  </div>
                  {selectedPatient.emergencyContactName ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 13 }}>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>CONTACT PERSON</span>
                        <strong>{selectedPatient.emergencyContactName}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>RELATIONSHIP</span>
                        {selectedPatient.emergencyContactRelation || '-'}
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>PHONE NUMBER</span>
                        <a href={`tel:${selectedPatient.emergencyContactPhone}`} style={{ color: '#0284c7', fontWeight: 600 }}>
                          {selectedPatient.emergencyContactPhone}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      No emergency contact recorded for this patient.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Clinical Alerts & History */}
            {activeTab === 'clinical' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Allergies Banner */}
                <div style={{
                  background: selectedPatient.allergies ? '#fef2f2' : '#f0fdf4',
                  border: `1px solid ${selectedPatient.allergies ? '#fecaca' : '#bbf7d0'}`,
                  borderRadius: 8,
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  {selectedPatient.allergies ? (
                    <AlertTriangle size={24} style={{ color: '#dc2626', flexShrink: 0 }} />
                  ) : (
                    <CheckCircle2 size={24} style={{ color: '#16a34a', flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: selectedPatient.allergies ? '#991b1b' : '#166534' }}>
                      {selectedPatient.allergies ? 'Clinical Allergy Alert' : 'No Known Drug Allergies (NKDA)'}
                    </div>
                    <div style={{ fontSize: 12, color: selectedPatient.allergies ? '#b91c1c' : '#15803d', marginTop: 2 }}>
                      {selectedPatient.allergies || 'Patient has no adverse drug reactions on file.'}
                    </div>
                  </div>
                </div>

                {!editingClinical ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div className="card" style={{ padding: 14 }}>
                        <strong style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PAST MEDICAL HISTORY</strong>
                        <div style={{ fontSize: 13 }}>{selectedPatient.medicalHistory || 'None recorded'}</div>
                      </div>
                      <div className="card" style={{ padding: 14 }}>
                        <strong style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>SURGICAL HISTORY</strong>
                        <div style={{ fontSize: 13 }}>{selectedPatient.surgicalHistory || 'None recorded'}</div>
                      </div>
                      <div className="card" style={{ padding: 14 }}>
                        <strong style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>FAMILY HISTORY</strong>
                        <div style={{ fontSize: 13 }}>{selectedPatient.familyHistory || 'None recorded'}</div>
                      </div>
                      <div className="card" style={{ padding: 14 }}>
                        <strong style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>CURRENT MEDICATIONS</strong>
                        <div style={{ fontSize: 13 }}>{selectedPatient.currentMedications || 'None recorded'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => setEditingClinical(true)}
                      >
                        <Edit3 size={14} /> Update Clinical Profile
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ padding: 16 }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>Edit Clinical Profile & Allergies</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label className="form-label" style={{ color: '#dc2626' }}>Allergies & Clinical Alerts</label>
                        <input
                          type="text"
                          className="form-input"
                          value={clinicalData.allergies}
                          onChange={(e) => setClinicalData({ ...clinicalData, allergies: e.target.value })}
                          placeholder="e.g. Penicillin, NSAIDs, Shellfish"
                        />
                      </div>
                      <div>
                        <label className="form-label">Past Medical History</label>
                        <input
                          type="text"
                          className="form-input"
                          value={clinicalData.medicalHistory}
                          onChange={(e) => setClinicalData({ ...clinicalData, medicalHistory: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label">Surgical History</label>
                        <input
                          type="text"
                          className="form-input"
                          value={clinicalData.surgicalHistory}
                          onChange={(e) => setClinicalData({ ...clinicalData, surgicalHistory: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label">Family History</label>
                        <input
                          type="text"
                          className="form-input"
                          value={clinicalData.familyHistory}
                          onChange={(e) => setClinicalData({ ...clinicalData, familyHistory: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label">Current Medications</label>
                        <input
                          type="text"
                          className="form-input"
                          value={clinicalData.currentMedications}
                          onChange={(e) => setClinicalData({ ...clinicalData, currentMedications: e.target.value })}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                      <button className="btn btn-secondary" onClick={() => setEditingClinical(false)} disabled={savingClinical}>
                        Cancel
                      </button>
                      <button className="btn btn-primary" onClick={handleSaveClinicalProfile} disabled={savingClinical}>
                        {savingClinical ? 'Saving...' : 'Save Clinical Profile'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Encounter Timeline */}
            {activeTab === 'encounters' && (
              <div>
                {loadingEncounters ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading encounter timeline...
                  </div>
                ) : encounters ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Summary Counters */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                      <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#0284c7' }}>{encounters.summary.totalAppointments}</div>
                        <div style={{ fontSize: 11, color: '#0369a1' }}>Appointments</div>
                      </div>
                      <div style={{ background: '#fdf4ff', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#a855f7' }}>{encounters.summary.totalConsultations}</div>
                        <div style={{ fontSize: 11, color: '#7e22ce' }}>Consultations</div>
                      </div>
                      <div style={{ background: '#ecfdf5', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{encounters.summary.totalPrescriptions}</div>
                        <div style={{ fontSize: 11, color: '#047857' }}>Prescriptions</div>
                      </div>
                      <div style={{ background: '#fefce8', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#eab308' }}>{encounters.summary.totalLabs}</div>
                        <div style={{ fontSize: 11, color: '#a16207' }}>Lab Orders</div>
                      </div>
                      <div style={{ background: '#f1f5f9', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#334155' }}>
                          Rs. {encounters.summary.totalInvoiced.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Invoiced Total</div>
                      </div>
                    </div>

                    {/* Chronological Encounter Items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {encounters.consultations.map((c) => (
                        <div key={`c-${c.id}`} style={{ borderLeft: '4px solid #a855f7', background: '#faf5ff', padding: 12, borderRadius: '0 8px 8px 0', fontSize: 13 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: '#7e22ce' }}>
                              <Stethoscope size={15} /> Consultation #{c.id} {c.doctorName ? `with ${c.doctorName}` : ''}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.date ? new Date(c.date).toLocaleDateString() : ''}</span>
                          </div>
                          {c.diagnosis && <div style={{ marginTop: 4 }}><strong>Diagnosis:</strong> {c.diagnosis}</div>}
                          {c.symptoms && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chief Complaint: {c.symptoms}</div>}
                          {c.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Plan: {c.notes}</div>}
                        </div>
                      ))}

                      {encounters.prescriptions.map((pr) => (
                        <div key={`p-${pr.id}`} style={{ borderLeft: '4px solid #10b981', background: '#f0fdf4', padding: 12, borderRadius: '0 8px 8px 0', fontSize: 13 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: '#047857' }}>
                              <Pill size={15} /> E-Prescription #{pr.id} {pr.doctorName ? `by ${pr.doctorName}` : ''}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pr.date}</span>
                          </div>
                          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {pr.medicines.map((m, idx) => (
                              <span key={idx} className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: 11 }}>
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}

                      {encounters.appointments.map((a) => (
                        <div key={`a-${a.id}`} style={{ borderLeft: '4px solid #0284c7', background: '#f0f9ff', padding: 12, borderRadius: '0 8px 8px 0', fontSize: 13 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: '#0369a1' }}>
                              <Calendar size={15} /> Appointment #{a.id} {a.doctorName ? `with ${a.doctorName}` : ''}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.date} {a.time ? `at ${a.time}` : ''}</span>
                          </div>
                          <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-muted)' }}>
                            Status: <strong style={{ textTransform: 'capitalize' }}>{a.status}</strong> • Type: {a.type}
                          </div>
                        </div>
                      ))}

                      {encounters.labs.map((l) => (
                        <div key={`l-${l.id}`} style={{ borderLeft: '4px solid #eab308', background: '#fefce8', padding: 12, borderRadius: '0 8px 8px 0', fontSize: 13 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: '#a16207' }}>
                              <Activity size={15} /> Lab Order: {l.testName}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.date}</span>
                          </div>
                          <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-muted)' }}>
                            Status: <strong style={{ textTransform: 'capitalize' }}>{l.status}</strong>
                          </div>
                        </div>
                      ))}

                      {encounters.invoices.map((inv) => (
                        <div key={`inv-${inv.id}`} style={{ borderLeft: '4px solid #64748b', background: '#f8fafc', padding: 12, borderRadius: '0 8px 8px 0', fontSize: 13 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: '#334155' }}>
                              <CreditCard size={15} /> Invoice #{inv.id} — Rs. {inv.amount.toLocaleString()}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.date}</span>
                          </div>
                          <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-muted)' }}>
                            Paid: Rs. {inv.paidAmount.toLocaleString()} • Status: <strong style={{ textTransform: 'capitalize' }}>{inv.status}</strong>
                          </div>
                        </div>
                      ))}

                      {encounters.appointments.length === 0 &&
                        encounters.consultations.length === 0 &&
                        encounters.prescriptions.length === 0 &&
                        encounters.labs.length === 0 &&
                        encounters.invoices.length === 0 && (
                          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            No prior clinical encounters recorded for this patient yet.
                          </div>
                        )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* TAB 4: Documents & Records */}
            {activeTab === 'documents' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Attached Clinical Documents</span>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setShowDocForm(!showDocForm)}
                  >
                    <Plus size={14} /> Attach New Document
                  </button>
                </div>

                {showDocForm && (
                  <form onSubmit={handleAddDocument} className="card" style={{ padding: 16, background: '#f8fafc' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: 13 }}>Attach Medical Document / Report</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Document Title *</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          placeholder="e.g. CBC Baseline Lab Report"
                          value={docTitle}
                          onChange={(e) => setDocTitle(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label">Category / Type</label>
                        <select className="form-select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                          <option value="LAB_REPORT">Lab Report</option>
                          <option value="RADIOLOGY">Radiology / Imaging</option>
                          <option value="DISCHARGE_SUMMARY">Discharge Summary</option>
                          <option value="REFERRAL">Referral Letter</option>
                          <option value="GENERAL">General Document</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">File URL *</label>
                        <input
                          type="url"
                          required
                          className="form-input"
                          placeholder="https://..."
                          value={docUrl}
                          onChange={(e) => setDocUrl(e.target.value)}
                        />
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Notes / Clinical Impressions</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Normal white blood cell count"
                          value={docNotes}
                          onChange={(e) => setDocNotes(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowDocForm(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={savingDoc}>
                        {savingDoc ? 'Attaching...' : 'Attach Document'}
                      </button>
                    </div>
                  </form>
                )}

                {loadingDocuments ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading documents...
                  </div>
                ) : documents.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No clinical documents attached yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {documents.map((d) => (
                      <div key={d.id} className="card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FileText size={16} style={{ color: '#0284c7' }} />
                            {d.title}
                            <span className="badge" style={{ fontSize: 11, background: '#f1f5f9', color: '#475569' }}>
                              {d.documentType}
                            </span>
                          </div>
                          {d.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{d.notes}</div>}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            Uploaded by {d.uploadedByName || 'Staff'} {d.createdAt ? `on ${new Date(d.createdAt).toLocaleDateString()}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <a
                            href={d.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ fontSize: 12, padding: '4px 8px' }}
                          >
                            Open
                          </a>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: 12, padding: '4px 8px', color: '#dc2626' }}
                            onClick={() => handleDeleteDocument(d.id)}
                            title="Delete Document"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Registered on Medora 2.0 Central Registry
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {onBookAppointment && (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => {
                      const p = selectedPatient;
                      setSelectedPatient(null);
                      onBookAppointment(p);
                    }}
                  >
                    <Calendar size={14} /> Book Appointment
                  </button>
                )}
                {onRaiseInvoice && (
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => {
                      const p = selectedPatient;
                      setSelectedPatient(null);
                      onRaiseInvoice(p);
                    }}
                  >
                    <CreditCard size={14} /> Raise Invoice
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
