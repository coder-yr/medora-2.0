import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stethoscope,
  Search,
  Plus,
  Calendar,
  AlertCircle,
  X,
  ShieldCheck,
  Eye,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Building2,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import type { Doctor, CreateDoctorDto, UpdateDoctorDto } from '../../types/doctor';
import type { Department } from '../../types/department';

interface DoctorWorkspaceProps {
  token: string;
  apiBaseUrl: string;
  activeBranchId?: string;
  onBookAppointmentWithDoctor?: (doctor: Doctor) => void;
  onNavigateToDepartments?: () => void;
  initialAction?: 'add' | null;
}

export const DoctorWorkspace: React.FC<DoctorWorkspaceProps> = ({
  token,
  apiBaseUrl,
  activeBranchId,
  onBookAppointmentWithDoctor,
  onNavigateToDepartments,
  initialAction,
}) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentSuggestions, setDepartmentSuggestions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<'ALL' | 'ACTIVE' | 'NONE'>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [viewingDoctor, setViewingDoctor] = useState<Doctor | null>(null);
  const [deletingDoctor, setDeletingDoctor] = useState<Doctor | null>(null);

  // Add Form State
  const [addFormData, setAddFormData] = useState<CreateDoctorDto>({
    name: '',
    department: '',
    email: '',
    phone: '',
    address: '',
    profile: '',
    procedureId: '',
    loginUsername: '',
    loginPassword: '',
  });
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Form State
  const [editFormData, setEditFormData] = useState<UpdateDoctorDto>({
    name: '',
    department: '',
    email: '',
    phone: '',
    address: '',
    profile: '',
    procedureId: '',
  });
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Deleting State
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Handle Initial Action trigger
  useEffect(() => {
    if (initialAction === 'add') {
      setShowAddModal(true);
    }
  }, [initialAction]);

  // Fetch Doctors with Pagination and Search
  const fetchDoctors = useCallback(
    async (q = searchQuery, p = page, dept = selectedDeptFilter) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`${apiBaseUrl}/api/v1/doctors`);
        const queryTerm = q.trim() || dept.trim();
        if (queryTerm) url.searchParams.set('q', queryTerm);
        url.searchParams.set('page', String(p));
        url.searchParams.set('limit', '25');
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
    },
    [token, apiBaseUrl, activeBranchId, searchQuery, page, selectedDeptFilter],
  );

  // Fetch Departments Catalogue
  const fetchDepartments = useCallback(async () => {
    if (!token) return;
    try {
      const [deptRes, suggRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/departments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBaseUrl}/api/v1/doctors/departments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const deptData = await deptRes.json();
      if (deptRes.ok && deptData.success && deptData.data?.departments) {
        setDepartments(deptData.data.departments);
      }

      const suggData = await suggRes.json();
      if (suggRes.ok && suggData.success && Array.isArray(suggData.data)) {
        setDepartmentSuggestions(suggData.data);
      }
    } catch {
      // Ignore background department fetch failure
    }
  }, [token, apiBaseUrl]);

  useEffect(() => {
    fetchDoctors();
    fetchDepartments();
  }, [fetchDoctors, fetchDepartments]);

  // Combined Unique Departments for Dropdown Filters & Datalists
  const combinedDepartmentNames = useMemo(() => {
    const set = new Set<string>();
    departments.forEach((d) => d.name && set.add(d.name.trim()));
    departmentSuggestions.forEach((s) => s && set.add(s.trim()));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [departments, departmentSuggestions]);

  // Filtered Doctors list (combines server search + client account filter)
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      if (selectedAccountFilter === 'ACTIVE' && !doc.hasLogin) return false;
      if (selectedAccountFilter === 'NONE' && doc.hasLogin) return false;
      if (selectedDeptFilter && doc.department?.toLowerCase() !== selectedDeptFilter.toLowerCase()) {
        // If not already filtered by query
        return false;
      }
      return true;
    });
  }, [doctors, selectedAccountFilter, selectedDeptFilter]);

  // Quick Metrics
  const metrics = useMemo(() => {
    const totalDocs = total;
    const withLogin = doctors.filter((d) => d.hasLogin).length;
    const totalVisits = doctors.reduce((acc, d) => acc + (d.upcomingAppointments || 0), 0);
    const specialtiesCount = combinedDepartmentNames.length;
    return { totalDocs, withLogin, totalVisits, specialtiesCount };
  }, [total, doctors, combinedDepartmentNames]);

  // Search Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDoctors(searchQuery, 1, selectedDeptFilter);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDeptFilter('');
    setSelectedAccountFilter('ALL');
    setPage(1);
    fetchDoctors('', 1, '');
  };

  // Create Doctor
  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormData.name.trim()) {
      setAddFormError('Doctor name is required.');
      return;
    }
    setSubmittingAdd(true);
    setAddFormError(null);

    try {
      const payload: any = {
        name: addFormData.name.trim(),
      };
      if (addFormData.department?.trim()) payload.department = addFormData.department.trim();
      if (addFormData.email?.trim()) payload.email = addFormData.email.trim();
      if (addFormData.phone?.trim()) payload.phone = addFormData.phone.trim();
      if (addFormData.address?.trim()) payload.address = addFormData.address.trim();
      if (addFormData.profile?.trim()) payload.profile = addFormData.profile.trim();
      if (addFormData.procedureId?.trim()) payload.procedureId = addFormData.procedureId.trim();
      if (addFormData.loginUsername?.trim()) {
        payload.loginUsername = addFormData.loginUsername.trim();
        payload.loginPassword = addFormData.loginPassword || 'DoctorPass123!';
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
        setAddFormData({
          name: '',
          department: '',
          email: '',
          phone: '',
          address: '',
          profile: '',
          procedureId: '',
          loginUsername: '',
          loginPassword: '',
        });
        setSuccessMessage(`Dr. ${data.data.name} successfully registered in roster.`);
        fetchDoctors('', 1, '');
        fetchDepartments();
      } else {
        const msg = data.error?.message || data.message || 'Failed to add doctor.';
        setAddFormError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setAddFormError('Network error registering doctor.');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (doc: Doctor) => {
    setEditingDoctor(doc);
    setEditFormData({
      name: doc.name || '',
      department: doc.department || '',
      email: doc.email || '',
      phone: doc.phone || '',
      address: doc.address || '',
      profile: doc.profile || '',
    });
    setEditFormError(null);
  };

  // Save Edit Doctor
  const handleUpdateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;
    if (!editFormData.name?.trim()) {
      setEditFormError('Doctor name is required.');
      return;
    }
    setSubmittingEdit(true);
    setEditFormError(null);

    try {
      const payload: any = {
        name: editFormData.name.trim(),
        department: editFormData.department?.trim() || null,
        email: editFormData.email?.trim() || null,
        phone: editFormData.phone?.trim() || null,
        address: editFormData.address?.trim() || null,
        profile: editFormData.profile?.trim() || null,
      };

      const res = await fetch(`${apiBaseUrl}/api/v1/doctors/${editingDoctor.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setEditingDoctor(null);
        setSuccessMessage(`Doctor profile for ${data.data.name} updated successfully.`);
        fetchDoctors(searchQuery, page, selectedDeptFilter);
        fetchDepartments();
        if (viewingDoctor && viewingDoctor.id === editingDoctor.id) {
          setViewingDoctor(data.data);
        }
      } else {
        const msg = data.error?.message || data.message || 'Failed to update doctor.';
        setEditFormError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setEditFormError('Network error updating doctor profile.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Delete Doctor
  const handleDeleteDoctor = async () => {
    if (!deletingDoctor) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/doctors/${deletingDoctor.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage(`Dr. ${deletingDoctor.name} removed from active roster.`);
        setDeletingDoctor(null);
        if (viewingDoctor?.id === deletingDoctor.id) {
          setViewingDoctor(null);
        }
        fetchDoctors(searchQuery, page, selectedDeptFilter);
      } else {
        const msg = data.error?.message || data.message || 'Failed to remove doctor.';
        setDeleteError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setDeleteError('Network communication error deleting doctor.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & Quick Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stethoscope size={22} style={{ color: '#0284c7' }} />
            Medical Staff & Doctor Roster
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Dynamic directory of consultant doctors, clinical specialties, OPD appointment load, and portal access
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onNavigateToDepartments && (
            <button
              className="btn btn-secondary"
              onClick={onNavigateToDepartments}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Building2 size={16} /> Manage Departments
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}
          >
            <Plus size={16} /> Register Doctor
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: 8,
          background: '#dcfce7',
          color: '#166534',
          border: '1px solid #bbf7d0',
          fontSize: 13.5
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#166534' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: 8,
          background: '#fee2e2',
          color: '#b91c1c',
          border: '1px solid #fecaca',
          fontSize: 13.5
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} style={{ color: '#dc2626' }} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#b91c1c' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Stethoscope size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Doctors</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{metrics.totalDocs}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Specialties</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{metrics.specialtiesCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Booked Visits</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{metrics.totalVisits}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Portal Accounts</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{metrics.withLogin}</div>
          </div>
        </div>
      </div>

      {/* Dynamic Search & Multi-Filter Card */}
      <div className="card" style={{ padding: 16 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {/* Text Search Input */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by doctor name, phone, email, qualification..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 38 }}
            />
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
          </div>

          {/* Department Filter Dropdown */}
          <div style={{ flex: '1 1 180px', minWidth: 160 }}>
            <select
              className="form-input"
              value={selectedDeptFilter}
              onChange={(e) => {
                setSelectedDeptFilter(e.target.value);
                setPage(1);
                fetchDoctors(searchQuery, 1, e.target.value);
              }}
            >
              <option value="">All Specialties / Departments</option>
              {combinedDepartmentNames.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Portal Account Filter */}
          <div style={{ flex: '0 1 160px', minWidth: 140 }}>
            <select
              className="form-input"
              value={selectedAccountFilter}
              onChange={(e) => setSelectedAccountFilter(e.target.value as any)}
            >
              <option value="ALL">All Accounts</option>
              <option value="ACTIVE">Portal Login Active</option>
              <option value="NONE">No Portal Login</option>
            </select>
          </div>

          {/* Search CTA */}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={15} /> Find
          </button>

          {/* Refresh / Reset */}
          {(searchQuery || selectedDeptFilter || selectedAccountFilter !== 'ALL') && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetFilters}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} /> Reset
            </button>
          )}
        </form>
      </div>

      {/* Dynamic Doctors Roster Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            Showing <strong style={{ color: 'var(--text-main)' }}>{filteredDoctors.length}</strong> of{' '}
            <strong style={{ color: 'var(--text-main)' }}>{total}</strong> Registered Practitioners
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>Page {page} of {totalPages}</span>
            {page > 1 && (
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: 11 }}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  fetchDoctors(searchQuery, page - 1, selectedDeptFilter);
                }}
              >
                Prev
              </button>
            )}
            {page < totalPages && (
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: 11 }}
                onClick={() => {
                  setPage((p) => p + 1);
                  fetchDoctors(searchQuery, page + 1, selectedDeptFilter);
                }}
              >
                Next
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 16px' }}>Doctor Name & Credentials</th>
                <th style={{ padding: '10px 16px' }}>Department</th>
                <th style={{ padding: '10px 16px' }}>Contact Details</th>
                <th style={{ padding: '10px 16px' }}>Appointments</th>
                <th style={{ padding: '10px 16px' }}>Portal Access</th>
                <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <RefreshCw size={18} className="spin" />
                      <span>Loading doctor roster...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDoctors.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No doctors match the active filters.{' '}
                    <button
                      onClick={() => setShowAddModal(true)}
                      style={{ color: '#0284c7', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Add new doctor now
                    </button>
                  </td>
                </tr>
              ) : (
                filteredDoctors.map((doc) => {
                  const initials = doc.name
                    ? doc.name
                        .replace(/^Dr\.?\s+/i, '')
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'DR';

                  return (
                    <tr
                      key={doc.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Name & Avatar */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 9999,
                              background: '#e0f2fe',
                              color: '#0369a1',
                              fontWeight: 700,
                              fontSize: 12,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div
                              style={{ fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
                              onClick={() => setViewingDoctor(doc)}
                            >
                              {doc.name}
                            </div>
                            {doc.profile && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: 'var(--text-muted)',
                                  maxWidth: 240,
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {doc.profile}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          className="badge"
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            if (doc.department) {
                              setSelectedDeptFilter(doc.department);
                              fetchDoctors(searchQuery, 1, doc.department);
                            }
                          }}
                          title="Click to filter by this department"
                        >
                          {doc.department || 'General Practice'}
                        </span>
                      </td>

                      {/* Contact Info */}
                      <td style={{ padding: '12px 16px' }}>
                        {doc.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                            <Phone size={12} style={{ color: '#64748b' }} />
                            <span>{doc.phone}</span>
                          </div>
                        )}
                        {doc.email ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                            <Mail size={11} style={{ color: '#94a3b8' }} />
                            <span>{doc.email}</span>
                          </div>
                        ) : !doc.phone ? (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        ) : null}
                      </td>

                      {/* Upcoming Bookings */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          className="badge"
                          style={{
                            background: doc.upcomingAppointments > 0 ? '#dcfce7' : '#f1f5f9',
                            color: doc.upcomingAppointments > 0 ? '#15803d' : '#64748b',
                            fontWeight: 600,
                            fontSize: 12,
                          }}
                        >
                          {doc.upcomingAppointments || 0} Visits
                        </span>
                      </td>

                      {/* Portal Access */}
                      <td style={{ padding: '12px 16px' }}>
                        {doc.hasLogin ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#16a34a', fontSize: 12, fontWeight: 600 }}>
                            <ShieldCheck size={14} /> Active
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>No Account</span>
                        )}
                      </td>

                      {/* Dynamic Action Buttons */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          {/* View Drawer */}
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', fontSize: 12 }}
                            onClick={() => setViewingDoctor(doc)}
                            title="View Doctor Profile"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Schedule / Book Appointment */}
                          {onBookAppointmentWithDoctor && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '5px 8px', fontSize: 12, color: '#0284c7' }}
                              onClick={() => onBookAppointmentWithDoctor(doc)}
                              title="Book Patient Visit with Doctor"
                            >
                              <Calendar size={14} />
                            </button>
                          )}

                          {/* Edit Doctor */}
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', fontSize: 12, color: '#059669' }}
                            onClick={() => handleOpenEdit(doc)}
                            title="Edit Doctor Profile"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Delete Doctor */}
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', fontSize: 12, color: '#dc2626' }}
                            onClick={() => {
                              setDeleteError(null);
                              setDeletingDoctor(doc);
                            }}
                            title="Remove Doctor"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= ADD DOCTOR MODAL ================= */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
            backdropFilter: 'blur(2px)',
          }}
        >
          <div className="card" style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 28, position: 'relative' }}>
            <button
              onClick={() => setShowAddModal(false)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={20} style={{ color: '#0284c7' }} />
              Register Consultant Doctor
            </h3>

            {addFormError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
                <AlertCircle size={16} />
                <span>{addFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateDoctor}>
              <div className="form-group">
                <label className="form-label">Full Legal / Professional Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Dr. Aisha Khan"
                  value={addFormData.name}
                  onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Department / Medical Specialty</label>
                  {onNavigateToDepartments && (
                    <span
                      onClick={onNavigateToDepartments}
                      style={{ fontSize: 11, color: '#0284c7', cursor: 'pointer', fontWeight: 600 }}
                    >
                      + Add New Department
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  list="dept-options-list"
                  className="form-input"
                  placeholder="Select or type specialty (e.g. Cardiology, Pediatrics)"
                  value={addFormData.department}
                  onChange={(e) => setAddFormData({ ...addFormData, department: e.target.value })}
                />
                <datalist id="dept-options-list">
                  {combinedDepartmentNames.map((d) => (
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
                    value={addFormData.email}
                    onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+92 300 1234567"
                    value={addFormData.phone}
                    onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Clinic / Consultation Suite Address</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Room 204, OPD Block B"
                  value={addFormData.address}
                  onChange={(e) => setAddFormData({ ...addFormData, address: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Qualifications, Clinical Profile & Bio</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="MBBS, FCPS (Cardiology), 10 years clinical experience..."
                  value={addFormData.profile}
                  onChange={(e) => setAddFormData({ ...addFormData, profile: e.target.value })}
                />
              </div>

              {/* Optional Portal Login */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14, marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} style={{ color: '#0284c7' }} />
                  Optional Hospital Portal Account
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                  If provisioned, doctor can log into Medora to review scheduled visits, write electronic prescriptions, and manage clinical notes.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Portal Username</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. aisha.khan"
                      value={addFormData.loginUsername}
                      onChange={(e) => setAddFormData({ ...addFormData, loginUsername: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={addFormData.loginPassword}
                      onChange={(e) => setAddFormData({ ...addFormData, loginPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={submittingAdd}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingAdd}>
                  {submittingAdd ? 'Registering...' : 'Save Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT DOCTOR MODAL ================= */}
      {editingDoctor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
            backdropFilter: 'blur(2px)',
          }}
        >
          <div className="card" style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 28, position: 'relative' }}>
            <button
              onClick={() => setEditingDoctor(null)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Edit2 size={20} style={{ color: '#059669' }} />
              Edit Doctor Profile: {editingDoctor.name}
            </h3>

            {editFormError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
                <AlertCircle size={16} />
                <span>{editFormError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateDoctor}>
              <div className="form-group">
                <label className="form-label">Full Legal / Professional Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department / Medical Specialty</label>
                <input
                  type="text"
                  list="edit-dept-options"
                  className="form-input"
                  value={editFormData.department || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                />
                <datalist id="edit-dept-options">
                  {combinedDepartmentNames.map((d) => (
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
                    value={editFormData.email || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={editFormData.phone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Clinic / OPD Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={editFormData.address || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Qualifications & Profile</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={editFormData.profile || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, profile: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingDoctor(null)}
                  disabled={submittingEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingEdit}>
                  {submittingEdit ? 'Saving...' : 'Update Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= VIEW DOCTOR PROFILE DRAWER ================= */}
      {viewingDoctor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
            backdropFilter: 'blur(2px)',
          }}
        >
          <div className="card" style={{ maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 28, position: 'relative' }}>
            <button
              onClick={() => setViewingDoctor(null)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            {/* Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 9999,
                  background: '#e0f2fe',
                  color: '#0284c7',
                  fontWeight: 800,
                  fontSize: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {viewingDoctor.name
                  ? viewingDoctor.name
                      .replace(/^Dr\.?\s+/i, '')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'DR'}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{viewingDoctor.name}</h3>
                <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', marginTop: 4, display: 'inline-block' }}>
                  {viewingDoctor.department || 'General Practice'}
                </span>
              </div>
            </div>

            {/* Details List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '16px 0', fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Phone size={15} style={{ color: '#64748b' }} />
                <span style={{ color: 'var(--text-muted)', width: 100 }}>Phone:</span>
                <span style={{ fontWeight: 600 }}>{viewingDoctor.phone || 'Not provided'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Mail size={15} style={{ color: '#64748b' }} />
                <span style={{ color: 'var(--text-muted)', width: 100 }}>Email:</span>
                <span style={{ fontWeight: 600 }}>{viewingDoctor.email || 'Not provided'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MapPin size={15} style={{ color: '#64748b' }} />
                <span style={{ color: 'var(--text-muted)', width: 100 }}>OPD Clinic:</span>
                <span style={{ fontWeight: 600 }}>{viewingDoctor.address || 'Standard OPD Suite'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Calendar size={15} style={{ color: '#64748b' }} />
                <span style={{ color: 'var(--text-muted)', width: 100 }}>Appointments:</span>
                <span className="badge badge-success">{viewingDoctor.upcomingAppointments || 0} Scheduled</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={15} style={{ color: '#64748b' }} />
                <span style={{ color: 'var(--text-muted)', width: 100 }}>Portal Status:</span>
                <span style={{ fontWeight: 600, color: viewingDoctor.hasLogin ? '#16a34a' : '#94a3b8' }}>
                  {viewingDoctor.hasLogin ? `Active (User: ${viewingDoctor.loginUsername || 'Linked'})` : 'No Portal Account'}
                </span>
              </div>

              {viewingDoctor.profile && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Profile & Bio:</div>
                  <div style={{ background: 'var(--bg-subtle)', padding: 10, borderRadius: 6, lineHeight: 1.5, fontSize: 12.5 }}>
                    {viewingDoctor.profile}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <button
                className="btn btn-secondary"
                style={{ color: '#dc2626' }}
                onClick={() => {
                  setDeletingDoctor(viewingDoctor);
                  setDeleteError(null);
                }}
              >
                <Trash2 size={14} /> Remove
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    handleOpenEdit(viewingDoctor);
                  }}
                >
                  <Edit2 size={14} /> Edit
                </button>
                {onBookAppointmentWithDoctor && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      onBookAppointmentWithDoctor(viewingDoctor);
                      setViewingDoctor(null);
                    }}
                  >
                    <Calendar size={14} /> Schedule Visit
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE DOCTOR CONFIRMATION ================= */}
      {deletingDoctor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: 16,
            backdropFilter: 'blur(2px)',
          }}
        >
          <div className="card" style={{ maxWidth: 440, width: '100%', padding: 24, position: 'relative' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 17, fontWeight: 700, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trash2 size={18} /> Confirm Remove Doctor
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong>Dr. {deletingDoctor.name}</strong> from the roster?
              Hospital clinical record integrity prevents deletion if the doctor has historical or scheduled patient visits on file.
            </p>

            {deleteError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 12.5, marginBottom: 14 }}>
                <AlertCircle size={16} />
                <span>{deleteError}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingDoctor(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#dc2626' }}
                onClick={handleDeleteDoctor}
                disabled={deleting}
              >
                {deleting ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
