import React, { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope,
  Search,
  Plus,
  Calendar,
  AlertCircle,
  X,
  ShieldCheck,
} from 'lucide-react';
import type { Doctor, CreateDoctorDto } from '../../types/doctor';

interface DoctorWorkspaceProps {
  token: string;
  apiBaseUrl: string;
  activeBranchId?: string;
  onBookAppointmentWithDoctor?: (doctor: Doctor) => void;
}

export const DoctorWorkspace: React.FC<DoctorWorkspaceProps> = ({
  token,
  apiBaseUrl,
  activeBranchId,
  onBookAppointmentWithDoctor,
}) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departmentSuggestions, setDepartmentSuggestions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<CreateDoctorDto>({
    name: '',
    department: '',
    email: '',
    phone: '',
    address: '',
    profile: '',
    loginUsername: '',
    loginPassword: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchDoctors = useCallback(async (q = searchQuery, p = page) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${apiBaseUrl}/api/v1/doctors`);
      if (q.trim()) url.searchParams.set('q', q.trim());
      url.searchParams.set('page', String(p));
      url.searchParams.set('limit', '15');
      if (activeBranchId) url.searchParams.set('branchId', activeBranchId);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setDoctors(data.data.data || []);
        setTotal(data.data.total || 0);
        setTotalPages(data.data.totalPages || 1);
      } else {
        setError(data.error?.message || data.message || 'Failed to load doctors.');
      }
    } catch {
      setError('Network error contacting doctor directory service.');
    } finally {
      setLoading(false);
    }
  }, [token, apiBaseUrl, activeBranchId, searchQuery, page]);

  const fetchDepartments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/doctors/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        setDepartmentSuggestions(data.data);
      }
    } catch {
      // Ignore background suggestion error
    }
  }, [token, apiBaseUrl]);

  useEffect(() => {
    fetchDoctors();
    fetchDepartments();
  }, [fetchDoctors, fetchDepartments]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDoctors(searchQuery, 1);
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Doctor name is required.');
      return;
    }
    setSubmitting(true);
    setFormError(null);

    try {
      const payload: any = {
        name: formData.name.trim(),
      };
      if (formData.department?.trim()) payload.department = formData.department.trim();
      if (formData.email?.trim()) payload.email = formData.email.trim();
      if (formData.phone?.trim()) payload.phone = formData.phone.trim();
      if (formData.address?.trim()) payload.address = formData.address.trim();
      if (formData.profile?.trim()) payload.profile = formData.profile.trim();
      if (formData.loginUsername?.trim()) {
        payload.loginUsername = formData.loginUsername.trim();
        payload.loginPassword = formData.loginPassword || 'DoctorPass123!';
      }

      const res = await fetch(`${apiBaseUrl}/api/v1/doctors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setShowAddModal(false);
        setFormData({
          name: '',
          department: '',
          email: '',
          phone: '',
          address: '',
          profile: '',
          loginUsername: '',
          loginPassword: '',
        });
        fetchDoctors('', 1);
      } else {
        const msg = data.error?.message || data.message || 'Failed to add doctor.';
        setFormError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setFormError('Network error registering doctor.');
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
            <Stethoscope size={22} style={{ color: '#0284c7' }} />
            Medical Staff & Doctor Roster
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Manage consultant doctors, specialties, OPD load, and scheduling accounts
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Plus size={16} /> Add Consultant Doctor
        </button>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: 14 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search doctors by name, department / specialty, email or phone..."
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
                fetchDoctors('', 1);
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, background: '#fee2e2', color: '#b91c1c', fontSize: 13 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Doctors Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            Active Doctors: <strong style={{ color: 'var(--text-main)' }}>{total}</strong>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 16px' }}>Doctor Name</th>
                <th style={{ padding: '10px 16px' }}>Specialty / Dept</th>
                <th style={{ padding: '10px 16px' }}>Contact Details</th>
                <th style={{ padding: '10px 16px' }}>Upcoming Visits</th>
                <th style={{ padding: '10px 16px' }}>Portal Access</th>
                <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading doctor directory...
                  </td>
                </tr>
              ) : doctors.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No doctors found matching criteria.
                  </td>
                </tr>
              ) : (
                doctors.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{doc.name}</span>
                      </div>
                      {doc.profile && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 260, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {doc.profile}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                        {doc.department || 'General Practice'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div>{doc.phone || '-'}</div>
                      {doc.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.email}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-success" style={{ fontSize: 12 }}>
                        {doc.upcomingAppointments || 0} Booked
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {doc.hasLogin ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a', fontSize: 12, fontWeight: 500 }}>
                          <ShieldCheck size={14} /> Active Account
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>No Portal Login</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {onBookAppointmentWithDoctor && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: 12, color: '#0284c7' }}
                          onClick={() => onBookAppointmentWithDoctor(doc)}
                        >
                          <Calendar size={14} /> Schedule
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Doctor Modal */}
      {showAddModal && (
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
          <div className="card" style={{ maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 28, position: 'relative' }}>
            <button
              onClick={() => setShowAddModal(false)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={20} style={{ color: '#0284c7' }} />
              Add Hospital Consultant Doctor
            </h3>

            {formError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateDoctor}>
              <div className="form-group">
                <label className="form-label">Full Legal / Professional Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Dr Sana Riaz"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department / Medical Specialty</label>
                <input
                  type="text"
                  list="departments-list"
                  className="form-input"
                  placeholder="e.g. Cardiology"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
                <datalist id="departments-list">
                  {departmentSuggestions.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Work Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="doctor@medora.hospital"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+92 300 1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Doctor Qualifications & Profile</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="MBBS, FCPS, 10 years clinical experience..."
                  value={formData.profile}
                  onChange={(e) => setFormData({ ...formData, profile: e.target.value })}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14, marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-main)' }}>
                  Optional Hospital Portal Account
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="sana.riaz"
                      value={formData.loginUsername}
                      onChange={(e) => setFormData({ ...formData, loginUsername: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={formData.loginPassword}
                      onChange={(e) => setFormData({ ...formData, loginPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Save Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
