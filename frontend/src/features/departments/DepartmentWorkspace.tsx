import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  Plus,
  AlertCircle,
  X,
  Users,
  CheckCircle2,
  FolderPlus,
  Search,
  Edit2,
  Trash2,
  Stethoscope,
  RefreshCw,
} from 'lucide-react';
import type { Department, CreateDepartmentDto, UpdateDepartmentDto } from '../../types/department';

interface DepartmentWorkspaceProps {
  token: string;
  apiBaseUrl: string;
  onViewDepartmentDoctors?: (departmentName: string) => void;
  onNavigateToDoctors?: () => void;
}

export const DepartmentWorkspace: React.FC<DepartmentWorkspaceProps> = ({
  token,
  apiBaseUrl,
  onViewDepartmentDoctors,
  onNavigateToDoctors,
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [unlisted, setUnlisted] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<CreateDepartmentDto>({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Modal
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateDepartmentDto>({ name: '', description: '' });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Delete Modal
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchDepartments = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setDepartments(data.data.departments || []);
        setUnlisted(data.data.unlisted || []);
      } else {
        setError(data.error?.message || data.message || 'Failed to load department catalogue.');
      }
    } catch {
      setError('Network communication error with department catalogue.');
    } finally {
      setLoading(false);
    }
  }, [token, apiBaseUrl]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Filtered Departments
  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return departments;
    const q = searchQuery.toLowerCase().trim();
    return departments.filter(
      (d) => d.name.toLowerCase().includes(q) || (d.description && d.description.toLowerCase().includes(q)),
    );
  }, [departments, searchQuery]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalDepts = departments.length;
    const totalAssignedDocs = departments.reduce((acc, d) => acc + (d.doctorCount || 0), 0);
    const unlistedCount = unlisted.length;
    return { totalDepts, totalAssignedDocs, unlistedCount };
  }, [departments, unlisted]);

  // Create Department
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Department name is required.');
      return;
    }
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/departments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowAddModal(false);
        setFormData({ name: '', description: '' });
        setMessage(`Department "${data.data.name}" registered successfully.`);
        fetchDepartments();
      } else {
        const msg = data.error?.message || data.message || 'Failed to create department.';
        setFormError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setFormError('Network communication error.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setEditFormData({
      name: dept.name,
      description: dept.description || '',
    });
    setEditFormError(null);
  };

  // Update Department (Cascades rename to doctors)
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    if (!editFormData.name?.trim()) {
      setEditFormError('Department name is required.');
      return;
    }
    setSubmittingEdit(true);
    setEditFormError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/departments/${editingDept.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editFormData.name.trim(),
          description: editFormData.description?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingDept(null);
        const docsUpdated = data.data?.doctorsUpdatedCount || 0;
        setMessage(
          `Department updated successfully.${docsUpdated > 0 ? ` Cascaded rename to ${docsUpdated} doctor record(s).` : ''}`,
        );
        fetchDepartments();
      } else {
        const msg = data.error?.message || data.message || 'Failed to update department.';
        setEditFormError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setEditFormError('Network communication error updating department.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Delete Department
  const handleDelete = async () => {
    if (!deletingDept) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/departments/${deletingDept.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeletingDept(null);
        setMessage(`Department "${deletingDept.name}" removed successfully.`);
        fetchDepartments();
      } else {
        const msg = data.error?.message || data.message || 'Failed to delete department.';
        setDeleteError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setDeleteError('Network communication error deleting department.');
    } finally {
      setDeleting(false);
    }
  };

  // Adopt Unlisted Specialties
  const handleAdopt = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/departments/adopt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(data.data?.message || 'Unlisted specialties successfully adopted.');
        fetchDepartments();
      } else {
        setError(data.error?.message || 'Failed to adopt specialties.');
      }
    } catch {
      setError('Network communication error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={22} style={{ color: '#0284c7' }} />
            Hospital Departments & Clinical Specialties
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Organize hospital clinical services, medical specialties, and staff assignments
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {onNavigateToDoctors && (
            <button className="btn btn-secondary" onClick={onNavigateToDoctors} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Stethoscope size={16} /> Doctor Roster
            </button>
          )}
          {unlisted.length > 0 && (
            <button className="btn btn-secondary" onClick={handleAdopt} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <FolderPlus size={16} /> Adopt {unlisted.length} Unlisted
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <Plus size={16} /> New Department
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {message && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', fontSize: 13.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#166534' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: 13.5 }}>
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
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Departments</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{metrics.totalDepts}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Stethoscope size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned Doctors</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{metrics.totalAssignedDocs}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FolderPlus size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Uncatalogued</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{metrics.unlistedCount}</div>
          </div>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search departments by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 38 }}
            />
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
          </div>
          {searchQuery && (
            <button className="btn btn-secondary" onClick={() => setSearchQuery('')}>
              Clear
            </button>
          )}
          <button className="btn btn-secondary" onClick={fetchDepartments} disabled={loading} title="Refresh">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Grid of Department Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {loading ? (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <RefreshCw size={18} className="spin" />
              <span>Loading department catalogue...</span>
            </div>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            No departments found. Click "New Department" to get started.
          </div>
        ) : (
          filteredDepartments.map((dept) => (
            <div
              key={dept.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'box-shadow 0.2s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>{dept.name}</h3>
                  <span
                    className="badge"
                    style={{
                      background: dept.doctorCount > 0 ? '#e0f2fe' : '#f1f5f9',
                      color: dept.doctorCount > 0 ? '#0369a1' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <Users size={12} /> {dept.doctorCount} Doctors
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45, minHeight: 38 }}>
                  {dept.description || 'General hospital clinical specialty.'}
                </p>
              </div>

              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  ID: #{dept.id}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {onViewDepartmentDoctors && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: 11, color: '#0284c7' }}
                      onClick={() => onViewDepartmentDoctors(dept.name)}
                      title="View Doctors in this department"
                    >
                      <Stethoscope size={13} /> View Doctors
                    </button>
                  )}
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 11, color: '#059669' }}
                    onClick={() => handleOpenEdit(dept)}
                    title="Edit Department"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 11, color: '#dc2626' }}
                    onClick={() => {
                      setDeleteError(null);
                      setDeletingDept(dept);
                    }}
                    title="Delete Department"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Unlisted Departments Banner */}
      {unlisted.length > 0 && (
        <div className="card" style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700, color: '#92400e' }}>
                Uncatalogued Specialties In Use
              </h4>
              <p style={{ margin: 0, fontSize: 13, color: '#78350f' }}>
                Practitioners currently specify: <strong>{unlisted.join(', ')}</strong>.
              </p>
            </div>
            <button className="btn btn-primary" onClick={handleAdopt} disabled={loading} style={{ background: '#d97706' }}>
              Adopt into Formal Catalogue
            </button>
          </div>
        </div>
      )}

      {/* ================= ADD DEPARTMENT MODAL ================= */}
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
          <div className="card" style={{ maxWidth: 460, width: '100%', padding: 24, position: 'relative' }}>
            <button
              onClick={() => setShowAddModal(false)}
              style={{ position: 'absolute', right: 16, top: 16, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={20} style={{ color: '#0284c7' }} />
              Add Hospital Department
            </h3>

            {formError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 13, marginBottom: 14 }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Department / Specialty Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Neurology, Pediatrics"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Scope & Clinical Description</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Comprehensive clinical scope and specialty description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
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
                  {submitting ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT DEPARTMENT MODAL ================= */}
      {editingDept && (
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
          <div className="card" style={{ maxWidth: 460, width: '100%', padding: 24, position: 'relative' }}>
            <button
              onClick={() => setEditingDept(null)}
              style={{ position: 'absolute', right: 16, top: 16, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Edit2 size={20} style={{ color: '#059669' }} />
              Edit Department: {editingDept.name}
            </h3>

            {editFormError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 13, marginBottom: 14 }}>
                <AlertCircle size={16} />
                <span>{editFormError}</span>
              </div>
            )}

            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label className="form-label">Department / Specialty Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Renaming automatically updates the department on all {editingDept.doctorCount} assigned doctor record(s).
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Scope & Clinical Description</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingDept(null)}
                  disabled={submittingEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingEdit}>
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DELETE DEPARTMENT MODAL ================= */}
      {deletingDept && (
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
              <Trash2 size={18} /> Confirm Delete Department
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Are you sure you want to delete the department <strong>"{deletingDept.name}"</strong>?
              {deletingDept.doctorCount > 0 && (
                <span style={{ display: 'block', color: '#b91c1c', fontWeight: 600, marginTop: 6 }}>
                  Warning: {deletingDept.doctorCount} doctor(s) are assigned to this department. The system will prevent deletion while doctors remain assigned.
                </span>
              )}
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
                onClick={() => setDeletingDept(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#dc2626' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
