import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  GitBranch,
  Sliders,
  Palette,
  Users,
  FileText,
  Save,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Hash,
  Layers,
} from 'lucide-react';
import type {
  HospitalSettings,
  HospitalBranch,
  BranchSettings,
  EffectiveSettings,
  UserBranchMembership,
  ConfigurationAuditLog,
} from '../../types/settings';

interface SettingsWorkspaceProps {
  token: string | null;
  activeBranchId: string | null;
  onBranchChange?: (branchId: string) => void;
}

const isDev = import.meta.env.DEV;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isDev ? 'http://localhost:3000' : '');

export const SettingsWorkspace: React.FC<SettingsWorkspaceProps> = ({
  token,
  activeBranchId: initialBranchId,
  onBranchChange,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'hospital' | 'branding' | 'branches' | 'branchSettings' | 'memberships' | 'audit'
  >('overview');

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  // Data states
  const [hospitalSettings, setHospitalSettings] = useState<HospitalSettings | null>(null);
  const [branches, setBranches] = useState<HospitalBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId || '');
  const [effectiveSettings, setEffectiveSettings] = useState<EffectiveSettings | null>(null);
  const [, setBranchSettings] = useState<BranchSettings | null>(null);
  const [memberships, setMemberships] = useState<UserBranchMembership[]>([]);
  const [auditLogs, setAuditLogs] = useState<ConfigurationAuditLog[]>([]);

  // Form states for Hospital Profile
  const [hospitalForm, setHospitalForm] = useState<Partial<HospitalSettings>>({});

  // Form states for Branding
  const [brandingForm, setBrandingForm] = useState({
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '#0284c7',
    secondaryColor: '#0f172a',
  });

  // Form states for Create Branch
  const [newBranch, setNewBranch] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    active: true,
  });

  // Form states for Branch Settings
  const [branchSettingsForm, setBranchSettingsForm] = useState<Partial<BranchSettings>>({});

  // Form states for User Assignment
  const [newAssignment, setNewAssignment] = useState({
    userId: '',
    branchId: '',
    isDefault: false,
    notes: '',
  });

  // Generated document number preview
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);

  const authHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(selectedBranchId ? { 'X-Branch-Id': selectedBranchId } : {}),
    };
  }, [token, selectedBranchId]);

  // Load Hospital Settings
  const fetchHospitalSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/settings/hospital`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setHospitalSettings(data);
        setHospitalForm(data);
        setBrandingForm({
          logoUrl: data.logoUrl || '',
          faviconUrl: data.faviconUrl || '',
          primaryColor: data.primaryColor || '#0284c7',
          secondaryColor: data.secondaryColor || '#0f172a',
        });
      }
    } catch (e) {
      console.error('Failed to load hospital settings:', e);
    }
  }, [authHeaders]);

  // Load Branches
  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/branches?includeInactive=true`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        const data: HospitalBranch[] = json.data || json;
        setBranches(data);
        if (data.length > 0 && !selectedBranchId) {
          const defaultBranch = data.find((b) => b.active) || data[0];
          setSelectedBranchId(defaultBranch.id);
        }
      }
    } catch (e) {
      console.error('Failed to load branches:', e);
    }
  }, [authHeaders, selectedBranchId]);

  // Load Effective Settings for Selected Branch
  const fetchEffectiveSettings = useCallback(
    async (branchId: string) => {
      if (!branchId) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/branches/${branchId}/effective-settings`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          setEffectiveSettings(json.data || json);
        }
      } catch (e) {
        console.error('Failed to load effective settings:', e);
      }
    },
    [authHeaders],
  );

  // Load Raw Branch Settings
  const fetchBranchSettings = useCallback(
    async (branchId: string) => {
      if (!branchId) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/branches/${branchId}/settings`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          setBranchSettings(data);
          setBranchSettingsForm(data);
        }
      } catch (e) {
        console.error('Failed to load branch settings:', e);
      }
    },
    [authHeaders],
  );

  // Load Memberships
  const fetchMemberships = useCallback(
    async (branchId?: string) => {
      try {
        const url = branchId
          ? `${API_BASE_URL}/api/v1/branches/${branchId}/members`
          : `${API_BASE_URL}/api/v1/branches/1/members`;
        const res = await fetch(url, { headers: authHeaders() });
        if (res.ok) {
          const json = await res.json();
          setMemberships(json.data || json);
        }
      } catch (e) {
        console.error('Failed to load memberships:', e);
      }
    },
    [authHeaders],
  );

  // Load Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/settings/audit-logs?limit=50`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setAuditLogs((json.data && json.data.data) || json.data || []);
      }
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchHospitalSettings();
    fetchBranches();
  }, [fetchHospitalSettings, fetchBranches]);

  useEffect(() => {
    if (selectedBranchId) {
      fetchEffectiveSettings(selectedBranchId);
      fetchBranchSettings(selectedBranchId);
      fetchMemberships(selectedBranchId);
    }
  }, [selectedBranchId, fetchEffectiveSettings, fetchBranchSettings, fetchMemberships]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  // Handle Hospital Profile Update
  const handleSaveHospitalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/settings/hospital`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          ...hospitalForm,
          changeReason: 'Updated from Hospital Settings UI',
        }),
      });

      if (res.ok) {
        setFeedback({ type: 'success', message: 'Hospital profile updated successfully!' });
        fetchHospitalSettings();
        if (selectedBranchId) fetchEffectiveSettings(selectedBranchId);
      } else {
        const err = await res.json();
        setFeedback({
          type: 'error',
          message: err.message || 'Failed to update hospital settings',
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error updating settings' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Branding Update
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/settings/branding`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          ...brandingForm,
          changeReason: 'Updated branding assets from UI',
        }),
      });

      if (res.ok) {
        setFeedback({ type: 'success', message: 'Branding assets updated successfully!' });
        fetchHospitalSettings();
        if (selectedBranchId) fetchEffectiveSettings(selectedBranchId);
      } else {
        const err = await res.json();
        setFeedback({ type: 'error', message: err.message || 'Failed to update branding' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error updating branding' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Create Branch
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/branches`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newBranch),
      });

      if (res.ok) {
        setFeedback({ type: 'success', message: `Branch ${newBranch.code} created successfully!` });
        setNewBranch({ name: '', code: '', address: '', phone: '', active: true });
        fetchBranches();
      } else {
        const err = await res.json();
        setFeedback({ type: 'error', message: err.message || 'Failed to create branch' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error creating branch' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Toggle Branch Status
  const handleToggleBranchStatus = async (branch: HospitalBranch) => {
    const nextStatus = !branch.active;
    const confirmMsg = nextStatus
      ? `Reactivate branch "${branch.name}"?`
      : `Deactivate branch "${branch.name}"? Inactive branches will reject new operational access.`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/branches/${branch.id}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          active: nextStatus,
          reason: `Status changed via UI to ${nextStatus ? 'ACTIVE' : 'INACTIVE'}`,
        }),
      });

      if (res.ok) {
        setFeedback({
          type: 'success',
          message: `Branch ${branch.code} ${nextStatus ? 'activated' : 'deactivated'}.`,
        });
        fetchBranches();
      } else {
        const err = await res.json();
        setFeedback({ type: 'error', message: err.message || 'Failed to update branch status' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error updating branch status' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Save Branch Settings
  const handleSaveBranchSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/branches/${selectedBranchId}/settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          ...branchSettingsForm,
          changeReason: 'Updated branch overrides from UI',
        }),
      });

      if (res.ok) {
        setFeedback({
          type: 'success',
          message: 'Branch operational settings saved successfully!',
        });
        fetchBranchSettings(selectedBranchId);
        fetchEffectiveSettings(selectedBranchId);
      } else {
        const err = await res.json();
        setFeedback({ type: 'error', message: err.message || 'Failed to save branch settings' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error saving branch settings' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Assign Member
  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId || !newAssignment.userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/branches/${selectedBranchId}/members`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          userId: newAssignment.userId,
          isDefault: newAssignment.isDefault,
          notes: newAssignment.notes,
        }),
      });

      if (res.ok) {
        setFeedback({ type: 'success', message: 'Staff member assigned to branch.' });
        setNewAssignment({ userId: '', branchId: '', isDefault: false, notes: '' });
        fetchMemberships(selectedBranchId);
      } else {
        const err = await res.json();
        setFeedback({ type: 'error', message: err.message || 'Failed to assign staff member' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error assigning member' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Revoke Member
  const handleRevokeMember = async (userId: string) => {
    if (!window.confirm('Revoke this staff member from this branch?')) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/branches/${selectedBranchId}/members/${userId}`,
        {
          method: 'DELETE',
          headers: authHeaders(),
        },
      );

      if (res.ok) {
        setFeedback({ type: 'success', message: 'Branch membership revoked.' });
        fetchMemberships(selectedBranchId);
      } else {
        const err = await res.json();
        setFeedback({ type: 'error', message: err.message || 'Failed to revoke membership' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error revoking membership' });
    } finally {
      setLoading(false);
    }
  };

  // Generate Document Number Demo
  const handleGenerateDocNumber = async (docType: string) => {
    if (!selectedBranchId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/branches/${selectedBranchId}/generate-number/${docType}`,
        {
          method: 'POST',
          headers: authHeaders(),
        },
      );
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setGeneratedDoc(data.documentNumber);
      }
    } catch (e) {
      console.error('Failed to generate document number:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: 24, margin: '0 auto', maxWidth: 1200 }}>
      {/* Workspace Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Building2 size={28} style={{ color: brandingForm.primaryColor || '#0284c7' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              Hospital Settings & Multi-Branch Management
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Configure institutional identity, branding, branch facilities, and access policies
            </p>
          </div>
        </div>

        {/* Active Branch Context Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Active Context:</span>
          <select
            className="form-select"
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              if (onBranchChange) onBranchChange(e.target.value);
            }}
            style={{ fontWeight: 600, padding: '6px 12px' }}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} [{b.code}] {b.active ? '' : '(INACTIVE)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 6,
            marginBottom: 16,
            backgroundColor:
              feedback.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${feedback.type === 'success' ? '#86efac' : '#fca5a5'}`,
          }}
        >
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span style={{ fontSize: 14 }}>{feedback.message}</span>
        </div>
      )}

      {/* Workspace Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid var(--border)',
          marginBottom: 20,
          overflowX: 'auto',
        }}
      >
        <button
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('overview')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <Layers size={16} /> Overview & Defaults
        </button>
        <button
          className={`btn ${activeTab === 'hospital' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('hospital')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <Building2 size={16} /> Hospital Profile
        </button>
        <button
          className={`btn ${activeTab === 'branding' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('branding')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <Palette size={16} /> Branding & Palette
        </button>
        <button
          className={`btn ${activeTab === 'branches' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('branches')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <GitBranch size={16} /> Branch Directory
        </button>
        <button
          className={`btn ${activeTab === 'branchSettings' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('branchSettings')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <Sliders size={16} /> Branch Settings & Prefixes
        </button>
        <button
          className={`btn ${activeTab === 'memberships' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('memberships')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <Users size={16} /> Staff Assignments
        </button>
        <button
          className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('audit')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <FileText size={16} /> Audit Log
        </button>
      </div>

      {/* TAB 1: OVERVIEW & EFFECTIVE SETTINGS */}
      {activeTab === 'overview' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                INSTITUTION IDENTITY
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {effectiveSettings?.hospitalName || hospitalSettings?.hospitalName || 'Medora'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Reg: {effectiveSettings?.registrationNumber || 'HOSP-2026-9041'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Tax NTN: {effectiveSettings?.taxNumber || 'NTN-4892019-7'}
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 8,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                ACTIVE FACILITY
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {effectiveSettings?.branchName || 'Main Campus'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Facility Code: <span className="badge badge-info">{effectiveSettings?.branchCode}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Timezone: {effectiveSettings?.timezone} | Currency: {effectiveSettings?.currency}
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 8,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                NUMBERING & SEQUENCING
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Invoice: <code>{effectiveSettings?.invoicePrefix}YYYY-XXXXXX</code>
              </div>
              <div style={{ fontSize: 13 }}>
                MRN: <code>{effectiveSettings?.mrnPrefix}YYYY-XXXXXX</code>
              </div>
              <div style={{ fontSize: 13 }}>
                Appointment: <code>{effectiveSettings?.appointmentPrefix}YYYY-XXXXXX</code>
              </div>
            </div>
          </div>

          {/* Document Number Generator Live Demo */}
          <div
            style={{
              padding: 20,
              borderRadius: 8,
              border: '1px dashed var(--border)',
              backgroundColor: 'rgba(2, 132, 199, 0.03)',
            }}
          >
            <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600 }}>
              Live Concurrency-Safe Sequence Allocator Demo
            </h4>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
              Test atomic PostgreSQL sequence generator for active branch ({effectiveSettings?.branchCode})
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleGenerateDocNumber('INVOICE')}
                disabled={loading}
              >
                <Hash size={16} /> Allocate Invoice #
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleGenerateDocNumber('MRN')}
                disabled={loading}
              >
                <Hash size={16} /> Allocate MRN #
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleGenerateDocNumber('APPOINTMENT')}
                disabled={loading}
              >
                <Hash size={16} /> Allocate Appointment #
              </button>
              {generatedDoc && (
                <div
                  style={{
                    marginLeft: 14,
                    padding: '6px 12px',
                    borderRadius: 6,
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    color: '#15803d',
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  Allocated: {generatedDoc}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HOSPITAL PROFILE FORM */}
      {activeTab === 'hospital' && (
        <form onSubmit={handleSaveHospitalSettings}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div className="form-group">
              <label className="form-label">Display Hospital Name *</label>
              <input
                type="text"
                className="form-input"
                required
                value={hospitalForm.hospitalName || ''}
                onChange={(e) =>
                  setHospitalForm({ ...hospitalForm, hospitalName: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Legal Entity Name</label>
              <input
                type="text"
                className="form-input"
                value={hospitalForm.legalName || ''}
                onChange={(e) => setHospitalForm({ ...hospitalForm, legalName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Registration / License #</label>
              <input
                type="text"
                className="form-input"
                value={hospitalForm.registrationNumber || ''}
                onChange={(e) =>
                  setHospitalForm({ ...hospitalForm, registrationNumber: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tax / NTN Number</label>
              <input
                type="text"
                className="form-input"
                value={hospitalForm.taxNumber || ''}
                onChange={(e) => setHospitalForm({ ...hospitalForm, taxNumber: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Official Email</label>
              <input
                type="email"
                className="form-input"
                value={hospitalForm.email || ''}
                onChange={(e) => setHospitalForm({ ...hospitalForm, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Primary Hotline Phone</label>
              <input
                type="text"
                className="form-input"
                value={hospitalForm.phone || ''}
                onChange={(e) => setHospitalForm({ ...hospitalForm, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Official Website</label>
              <input
                type="url"
                className="form-input"
                value={hospitalForm.website || ''}
                onChange={(e) => setHospitalForm({ ...hospitalForm, website: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">System Timezone</label>
              <input
                type="text"
                className="form-input"
                value={hospitalForm.defaultTimezone || 'Asia/Karachi'}
                onChange={(e) =>
                  setHospitalForm({ ...hospitalForm, defaultTimezone: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Default Base Currency</label>
              <input
                type="text"
                className="form-input"
                value={hospitalForm.defaultCurrency || 'PKR'}
                onChange={(e) =>
                  setHospitalForm({ ...hospitalForm, defaultCurrency: e.target.value })
                }
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Headquarters Physical Address</label>
              <input
                type="text"
                className="form-input"
                value={hospitalForm.address || ''}
                onChange={(e) => setHospitalForm({ ...hospitalForm, address: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Default Invoice / Receipt Footer Note</label>
              <textarea
                className="form-input"
                rows={3}
                value={hospitalForm.receiptFooter || ''}
                onChange={(e) =>
                  setHospitalForm({ ...hospitalForm, receiptFooter: e.target.value })
                }
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Save size={16} /> Save Hospital Profile
          </button>
        </form>
      )}

      {/* TAB 3: BRANDING & THEME PALETTE */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSaveBranding}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 20,
              marginBottom: 20,
            }}
          >
            <div>
              <div className="form-group">
                <label className="form-label">Hospital Logo URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://medora.hospital/assets/logo.png"
                  value={brandingForm.logoUrl}
                  onChange={(e) => setBrandingForm({ ...brandingForm, logoUrl: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Favicon URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://medora.hospital/favicon.ico"
                  value={brandingForm.faviconUrl}
                  onChange={(e) => setBrandingForm({ ...brandingForm, faviconUrl: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Primary Brand Color</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={brandingForm.primaryColor}
                      onChange={(e) =>
                        setBrandingForm({ ...brandingForm, primaryColor: e.target.value })
                      }
                      style={{ width: 44, height: 38, padding: 2, cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      value={brandingForm.primaryColor}
                      onChange={(e) =>
                        setBrandingForm({ ...brandingForm, primaryColor: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Secondary Color</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={brandingForm.secondaryColor}
                      onChange={(e) =>
                        setBrandingForm({ ...brandingForm, secondaryColor: e.target.value })
                      }
                      style={{ width: 44, height: 38, padding: 2, cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      value={brandingForm.secondaryColor}
                      onChange={(e) =>
                        setBrandingForm({ ...brandingForm, secondaryColor: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Branding Preview */}
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 20,
                backgroundColor: 'var(--surface)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>
                BRANDING LIVE PREVIEW
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 6,
                  backgroundColor: brandingForm.secondaryColor,
                  color: '#fff',
                }}
              >
                {brandingForm.logoUrl ? (
                  <img
                    src={brandingForm.logoUrl}
                    alt="Logo"
                    style={{ height: 36, objectFit: 'contain' }}
                    onError={(e) => ((e.target as any).style.display = 'none')}
                  />
                ) : (
                  <Building2 size={32} style={{ color: brandingForm.primaryColor }} />
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {hospitalSettings?.hospitalName || 'Medora Hospital'}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Healthcare System</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  style={{
                    backgroundColor: brandingForm.primaryColor,
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                >
                  Primary Action Button
                </button>
              </div>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Save size={16} /> Save Branding & Palette
          </button>
        </form>
      )}

      {/* TAB 4: BRANCH DIRECTORY & CREATION */}
      {activeTab === 'branches' && (
        <div>
          {/* Create Branch Card */}
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              marginBottom: 24,
            }}
          >
            <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600 }}>
              Initialize New Hospital Branch
            </h4>
            <form onSubmit={handleCreateBranch}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <input
                  type="text"
                  className="form-input"
                  placeholder="Branch Name (e.g. City Clinic)"
                  required
                  value={newBranch.name}
                  onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Branch Code (e.g. CITY)"
                  required
                  value={newBranch.code}
                  onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value.toUpperCase() })}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Phone"
                  value={newBranch.phone}
                  onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Physical Address"
                  value={newBranch.address}
                  onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Plus size={16} /> Create Branch
              </button>
            </form>
          </div>

          {/* Branches Table */}
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Branch Facility Name</th>
                <th>Contact Phone</th>
                <th>Address</th>
                <th>Active Staff</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className="badge badge-info">{b.code}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{b.name}</td>
                  <td>{b.phone || '—'}</td>
                  <td>{b.address || '—'}</td>
                  <td>{b._count?.userMemberships ?? 0} members</td>
                  <td>
                    <span
                      className={`badge ${b.active ? 'badge-success' : 'badge-danger'}`}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        backgroundColor: b.active
                          ? 'rgba(34, 197, 94, 0.1)'
                          : 'rgba(239, 68, 68, 0.1)',
                        color: b.active ? '#15803d' : '#b91c1c',
                      }}
                    >
                      {b.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => handleToggleBranchStatus(b)}
                    >
                      {b.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: BRANCH SETTINGS & PREFIXES */}
      {activeTab === 'branchSettings' && (
        <form onSubmit={handleSaveBranchSettings}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Configuring Overrides for: </span>
            <span style={{ fontWeight: 700 }}>
              {branches.find((b) => b.id === selectedBranchId)?.name || 'Selected Branch'}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div className="form-group">
              <label className="form-label">Invoice Prefix Override</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. INV-MAIN-"
                value={branchSettingsForm.invoicePrefix || ''}
                onChange={(e) =>
                  setBranchSettingsForm({ ...branchSettingsForm, invoicePrefix: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">MRN Prefix Override</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. MRN-MAIN-"
                value={branchSettingsForm.mrnPrefix || ''}
                onChange={(e) =>
                  setBranchSettingsForm({ ...branchSettingsForm, mrnPrefix: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Appointment Prefix Override</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. APT-MAIN-"
                value={branchSettingsForm.appointmentPrefix || ''}
                onChange={(e) =>
                  setBranchSettingsForm({
                    ...branchSettingsForm,
                    appointmentPrefix: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Admission Prefix Override</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. ADM-MAIN-"
                value={branchSettingsForm.admissionPrefix || ''}
                onChange={(e) =>
                  setBranchSettingsForm({
                    ...branchSettingsForm,
                    admissionPrefix: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Branch Receipt Header Override</label>
              <input
                type="text"
                className="form-input"
                placeholder="Custom receipt header text for this branch"
                value={branchSettingsForm.receiptHeaderOverride || ''}
                onChange={(e) =>
                  setBranchSettingsForm({
                    ...branchSettingsForm,
                    receiptHeaderOverride: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Branch Primary Color Override</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. #059669"
                value={branchSettingsForm.primaryColorOverride || ''}
                onChange={(e) =>
                  setBranchSettingsForm({
                    ...branchSettingsForm,
                    primaryColorOverride: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Save size={16} /> Save Branch Overrides
          </button>
        </form>
      )}

      {/* TAB 6: STAFF BRANCH MEMBERSHIPS */}
      {activeTab === 'memberships' && (
        <div>
          {/* Assign Member Form */}
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              marginBottom: 20,
            }}
          >
            <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>
              Assign Staff Member to Selected Branch
            </h4>
            <form onSubmit={handleAssignMember} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                type="text"
                className="form-input"
                placeholder="User ID (e.g. 2)"
                required
                style={{ width: 140 }}
                value={newAssignment.userId}
                onChange={(e) => setNewAssignment({ ...newAssignment, userId: e.target.value })}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Assignment Notes (e.g. Roaming consultant)"
                style={{ flex: 1 }}
                value={newAssignment.notes}
                onChange={(e) => setNewAssignment({ ...newAssignment, notes: e.target.value })}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={newAssignment.isDefault}
                  onChange={(e) =>
                    setNewAssignment({ ...newAssignment, isDefault: e.target.checked })
                  }
                />
                Set Default Home Branch
              </label>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Plus size={16} /> Assign
              </button>
            </form>
          </div>

          {/* Memberships Table */}
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role / Group</th>
                <th>Assigned Branch</th>
                <th>Default Branch?</th>
                <th>Assigned Date</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>
                    {m.user?.firstName} {m.user?.lastName} ({m.user?.login})
                  </td>
                  <td>
                    <span className="badge badge-secondary">{m.user?.group}</span>
                  </td>
                  <td>{m.branch?.name}</td>
                  <td>{m.isDefault ? <span className="badge badge-success">DEFAULT</span> : 'No'}</td>
                  <td>{new Date(m.assignedAt).toLocaleDateString()}</td>
                  <td>{m.notes || '—'}</td>
                  <td>
                    {m.isActive ? (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: 12, color: '#dc2626' }}
                        onClick={() => handleRevokeMember(m.userId)}
                      >
                        Revoke
                      </button>
                    ) : (
                      <span className="badge badge-danger">Revoked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 7: CONFIGURATION AUDIT LOG */}
      {activeTab === 'audit' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
              Immutable Configuration Change Audit Log
            </h4>
            <button className="btn btn-secondary" onClick={fetchAuditLogs}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Scope</th>
                <th>Branch</th>
                <th>Key Changed</th>
                <th>Previous Value</th>
                <th>New Value</th>
                <th>Actor</th>
                <th>Change Reason</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge ${log.scope === 'HOSPITAL' ? 'badge-info' : 'badge-secondary'}`}>
                      {log.scope}
                    </span>
                  </td>
                  <td>{log.branch ? `${log.branch.code}` : 'Institution'}</td>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{log.settingKey}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {log.previousValue || '—'}
                  </td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{log.newValue || '—'}</td>
                  <td style={{ fontSize: 12 }}>
                    {log.actorUser ? `${log.actorUser.firstName} (${log.actorUser.login})` : 'System'}
                  </td>
                  <td style={{ fontSize: 12 }}>{log.changeReason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
