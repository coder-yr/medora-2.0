import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  AlertCircle,
  X,
  Users,
  CheckCircle2,
  FolderPlus
} from 'lucide-react';
import type { Department, CreateDepartmentDto } from '../../types/department';

interface DepartmentWorkspaceProps {
  token: string;
  apiBaseUrl: string;
}

export const DepartmentWorkspace: React.FC<DepartmentWorkspaceProps> = ({
  token,
  apiBaseUrl,
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [unlisted, setUnlisted] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<CreateDepartmentDto>({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
          {unlisted.length > 0 && (
            <button className="btn btn-secondary" onClick={handleAdopt} disabled={loading}>
              <FolderPlus size={16} /> Adopt {unlisted.length} Unlisted
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> New Department
          </button>
        </div>
      </div>

      {message && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, background: '#dcfce7', color: '#166534', fontSize: 13 }}>
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, background: '#fee2e2', color: '#b91c1c', fontSize: 13 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Department Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {loading ? (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            Loading department catalogue...
          </div>
        ) : departments.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            No departments defined yet. Click "New Department" to get started.
          </div>
        ) : (
          departments.map((dept) => (
            <div key={dept.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{dept.name}</h3>
                  <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <Users size={12} /> {dept.doctorCount} Doctors
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {dept.description || 'General hospital clinical specialty.'}
                </p>
              </div>

              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>ID: #{dept.id}</span>
                <span>Active Specialty</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Unlisted Departments Banner */}
      {unlisted.length > 0 && (
        <div className="card" style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700, color: '#92400e' }}>
                Uncatalogued Specialties In Use
              </h4>
              <p style={{ margin: 0, fontSize: 13, color: '#78350f' }}>
                Doctors currently refer to: <strong>{unlisted.join(', ')}</strong>.
              </p>
            </div>
            <button className="btn btn-primary" onClick={handleAdopt} disabled={loading} style={{ background: '#d97706' }}>
              Adopt into Formal Catalogue
            </button>
          </div>
        </div>
      )}

      {/* Add Modal */}
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
          <div className="card" style={{ maxWidth: 460, width: '100%', padding: 24, position: 'relative' }}>
            <button
              onClick={() => setShowAddModal(false)}
              style={{ position: 'absolute', right: 16, top: 16, color: '#94a3b8' }}
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
                  placeholder="Comprehensive clinical scope..."
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
    </div>
  );
};
