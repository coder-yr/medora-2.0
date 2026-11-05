import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Calendar,
  CreditCard,
  Eye,
  AlertCircle,
  X,
} from 'lucide-react';
import type { Patient, CreatePatientDto } from '../../types/patient';

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
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        setPatients(data.data.data || []);
        setTotal(data.data.total || 0);
        setTotalPages(data.data.totalPages || 1);
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
        });
        fetchPatients('', 1);
        setSelectedPatient(data.data);
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
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={22} style={{ color: '#0284c7' }} />
            Patient Central Registry
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Search, register and manage hospital patient demographics and medical records
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowRegisterModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Plus size={16} /> Register New Patient
        </button>
      </div>

      {/* Search & Filter Toolbar */}
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

      {/* Error Notice */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, background: '#fee2e2', color: '#b91c1c', fontSize: 13 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Patients Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            Total Patients: <strong style={{ color: 'var(--text-main)' }}>{total}</strong>
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
                <th style={{ padding: '10px 16px' }}>CNIC / City</th>
                <th style={{ padding: '10px 16px' }}>Type</th>
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
                      <div>{p.cnic || '-'}</div>
                      {p.city && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.city}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {p.mlc ? (
                        <span className="badge badge-warning" style={{ fontSize: 11 }}>MLC</span>
                      ) : (
                        <span className="badge" style={{ fontSize: 11, background: '#f1f5f9', color: '#475569' }}>Regular</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                          onClick={() => setSelectedPatient(p)}
                          title="View Patient Demographics & Profile"
                        >
                          <Eye size={14} /> View
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

        {/* Pagination Bar */}
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

      {/* Register Patient Modal */}
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
          <div className="card" style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 28, position: 'relative' }}>
            <button
              onClick={() => setShowRegisterModal(false)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={20} style={{ color: '#0284c7' }} />
              Register New Hospital Patient
            </h3>

            {formError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterPatient}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Full Patient Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Amina Yousaf"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Father / Husband Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Muhammad Yousaf"
                    value={formData.fatherName}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sex *</label>
                  <select
                    className="form-select"
                    value={formData.sex}
                    onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select
                    className="form-select"
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
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
                  <label className="form-label">Primary Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="03001234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">CNIC / Identity Card</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="35201-1234567-1"
                    value={formData.cnic}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="patient@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Islamabad"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Street, Sector, City"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    id="mlc-check"
                    checked={formData.mlc}
                    onChange={(e) => setFormData({ ...formData, mlc: e.target.checked })}
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
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Registering...' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Detail Drawer / Modal */}
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
          <div className="card" style={{ maxWidth: 540, width: '100%', padding: 28, position: 'relative' }}>
            <button
              onClick={() => setSelectedPatient(null)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>
                {selectedPatient.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selectedPatient.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span className="badge badge-success">MRN #{selectedPatient.patientId || selectedPatient.id}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {selectedPatient.age ? `${selectedPatient.age} yrs` : ''} {selectedPatient.sex || ''}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--bg-subtle)', padding: 16, borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
              <div>
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>FATHER / GUARDIAN</strong>
                {selectedPatient.fatherName || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>BLOOD GROUP</strong>
                {selectedPatient.bloodGroup || 'Not specified'}
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>PHONE NUMBER</strong>
                {selectedPatient.phone || '-'}
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>CNIC / IDENTITY</strong>
                {selectedPatient.cnic || '-'}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>ADDRESS / RESIDENCE</strong>
                {selectedPatient.address || '-'} {selectedPatient.city ? `(${selectedPatient.city})` : ''}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Registered on Medora 2.0
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {onBookAppointment && (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 13 }}
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
                    style={{ fontSize: 13 }}
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
