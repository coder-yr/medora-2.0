import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Key,
  Layers,
  Activity,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  Sliders,
  Clock,
  FileText,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface OrganizationItem {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'INACTIVE';
  edition: 'CLINIC' | 'PROFESSIONAL' | 'HOSPITAL' | 'ENTERPRISE';
  subscriptionTier: string;
  maxBranches: number;
  maxUsers: number;
  branchCount: number;
  userCount: number;
  enabledModules: string[];
  createdAt: string;
}

interface PlatformAnalytics {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  totalBranches: number;
  totalUsers: number;
  activeSupportGrants: number;
}

interface PlatformAuditLogItem {
  id: string;
  action: string;
  actorEmail?: string;
  actorRole?: string;
  targetType: string;
  targetId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

interface RegistrationItem {
  id: string;
  reference: string;
  organizationName: string;
  organizationType: string;
  requestedEdition: 'CLINIC' | 'PROFESSIONAL' | 'HOSPITAL' | 'ENTERPRISE';
  specialization?: string;
  healthcareSpecialization?: string;
  registrationNumber?: string;
  licenseNumber?: string;
  organizationEmail: string;
  contactPhone: string;
  country: string;
  state?: string;
  city: string;
  address?: string;
  website?: string;
  adminFullName: string;
  adminEmail: string;
  adminPhone?: string;
  adminDesignation?: string;
  status: 'DRAFT' | 'PENDING_EMAIL_VERIFICATION' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED';
  isEmailVerified: boolean;
  emailVerifiedAt?: string;
  rejectionReason?: string;
  approvedAt?: string;
  approvedBy?: { id: string; name: string; email: string };
  rejectedAt?: string;
  rejectedBy?: { id: string; name: string; email: string };
  organization?: { id: string; name: string; code: string; status: string };
  createdAt: string;
}

export const PlatformAdminWorkspace: React.FC = () => {
  const { token, apiBaseUrl } = useAuth();

  const [activeTab, setActiveTab] = useState<'organizations' | 'registrations' | 'audit' | 'analytics'>('organizations');
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Registration Filter & Modals
  const [selectedReg, setSelectedReg] = useState<RegistrationItem | null>(null);
  const [showRegReviewModal, setShowRegReviewModal] = useState<boolean>(false);
  const [showRegRejectModal, setShowRegRejectModal] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [approvedEditionChoice, setApprovedEditionChoice] = useState<'CLINIC' | 'PROFESSIONAL' | 'HOSPITAL' | 'ENTERPRISE'>('HOSPITAL');
  const [regStatusFilter, setRegStatusFilter] = useState<string>('ALL');
  const [regSearchTerm, setRegSearchTerm] = useState<string>('');
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);
  const [provisionedNotice, setProvisionedNotice] = useState<{
    orgId: string;
    orgName: string;
    reference: string;
    invitationToken: string;
  } | null>(null);

  // Modals
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationItem | null>(null);

  // Provision Form
  const [provName, setProvName] = useState('');
  const [provCode, setProvCode] = useState('');
  const [provEdition, setProvEdition] = useState<'CLINIC' | 'PROFESSIONAL' | 'HOSPITAL' | 'ENTERPRISE'>('HOSPITAL');
  const [provAdminName, setProvAdminName] = useState('');
  const [provAdminEmail, setProvAdminEmail] = useState('');
  const [provAdminPassword, setProvAdminPassword] = useState('');
  const [provisioning, setProvisioning] = useState(false);

  // Break-Glass Form
  const [bgOrgId, setBgOrgId] = useState('');
  const [bgReason, setBgReason] = useState('');
  const [bgHours, setBgHours] = useState(4);
  const [bgSubmitting, setBgSubmitting] = useState(false);
  const [bgSuccessMsg, setBgSuccessMsg] = useState<string | null>(null);

  // Status/Entitlement update state
  const [statusUpdating, setStatusUpdating] = useState(false);

  const ALL_MODULES = [
    { key: 'patients', label: 'Patients Directory' },
    { key: 'appointments', label: 'Outpatient Appointments' },
    { key: 'consultations', label: 'Clinical Consultations' },
    { key: 'prescriptions', label: 'e-Prescriptions' },
    { key: 'inpatient', label: 'IPD Admissions & Bed Management' },
    { key: 'laboratory', label: 'LIS & Laboratory Pathology' },
    { key: 'radiology', label: 'RIS / PACS & Imaging Worklist' },
    { key: 'pharmacy', label: 'Dispensary & Inventory FEFO' },
    { key: 'billing', label: 'Hospital POS Billing & Invoicing' },
    { key: 'staff', label: 'Staff Directory & Access Roster' },
    { key: 'departments', label: 'Clinical Departments' },
    { key: 'accounting', label: 'General Ledger & Financials' },
    { key: 'telemedicine', label: 'Telemedicine Consultations' },
    { key: 'multi_branch', label: 'Multi-Branch Federated Campus' },
  ];

  const fetchPlatformData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [orgsRes, analyticsRes, auditRes, regsRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/platform/organizations`, { headers }).then((r) => r.json()),
        fetch(`${apiBaseUrl}/api/v1/platform/analytics`, { headers }).then((r) => r.json()),
        fetch(`${apiBaseUrl}/api/v1/platform/audit-logs?limit=50`, { headers }).then((r) => r.json()),
        fetch(`${apiBaseUrl}/api/v1/platform/registrations`, { headers }).then((r) => r.json()),
      ]);

      const orgList = Array.isArray(orgsRes) ? orgsRes : orgsRes?.data || [];
      if (Array.isArray(orgList)) {
        setOrganizations(orgList);
      }

      const regList = Array.isArray(regsRes) ? regsRes : regsRes?.data || [];
      if (Array.isArray(regList)) {
        setRegistrations(regList);
      }

      const analyticsData = analyticsRes?.data || analyticsRes;
      if (analyticsData && !analyticsData.error) {
        setAnalytics(analyticsData);
      }

      const auditData = auditRes?.data || auditRes;
      if (auditData?.logs) {
        setAuditLogs(auditData.logs);
      }
    } catch {
      setError('Failed to retrieve platform governance datasets.');
    } finally {
      setLoading(false);
    }
  }, [token, apiBaseUrl]);

  // Handle Registration Approval
  const handleApproveRegistration = async (reg: RegistrationItem) => {
    setActionSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/platform/registrations/${reg.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvedEdition: approvedEditionChoice,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Approval failed.');
      }

      const payload = data.data || data;
      setShowRegReviewModal(false);
      setProvisionedNotice({
        orgId: payload.organizationId,
        orgName: payload.organizationName,
        reference: payload.reference,
        invitationToken: payload.invitationToken,
      });

      void fetchPlatformData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve registration.');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Handle Registration Rejection
  const handleRejectRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReg || !rejectReason.trim()) {
      alert('Please provide a mandatory explanation for rejection.');
      return;
    }

    setActionSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/platform/registrations/${selectedReg.id}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rejectionReason: rejectReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Rejection failed.');
      }

      setShowRegRejectModal(false);
      setRejectReason('');
      setSelectedReg(null);
      void fetchPlatformData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject registration.');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Handle Retry Provisioning
  const handleRetryProvisioning = async (regId: string) => {
    setActionSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/platform/registrations/${regId}/retry-provisioning`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Retry provisioning failed.');
      }

      alert('Provisioning operation resumed successfully.');
      void fetchPlatformData();
    } catch (err: any) {
      alert(err.message || 'Failed to retry provisioning.');
    } finally {
      setActionSubmitting(false);
    }
  };

  useEffect(() => {
    void fetchPlatformData();
  }, [fetchPlatformData]);

  // Handle Provision Organization
  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provName || !provCode || !provAdminName || !provAdminEmail || !provAdminPassword) {
      alert('Please fill out all mandatory provisioning fields.');
      return;
    }

    setProvisioning(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/platform/organizations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: provName.trim(),
          code: provCode.trim().toUpperCase(),
          edition: provEdition,
          adminName: provAdminName.trim(),
          adminEmail: provAdminEmail.trim().toLowerCase(),
          adminPassword: provAdminPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Provisioning failed.');
      }

      setShowProvisionModal(false);
      setProvName('');
      setProvCode('');
      setProvAdminName('');
      setProvAdminEmail('');
      setProvAdminPassword('');
      await fetchPlatformData();
      alert(`Organization successfully provisioned! Initial admin ${data.adminEmail} has been assigned.`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProvisioning(false);
    }
  };

  // Toggle Organization Status (Active / Suspended)
  const handleToggleOrgStatus = async (org: OrganizationItem) => {
    const nextStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmPrompt = window.confirm(
      `Are you sure you want to ${nextStatus === 'SUSPENDED' ? 'SUSPEND' : 'REACTIVATE'} organization "${org.name}"?`,
    );
    if (!confirmPrompt) return;

    setStatusUpdating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/platform/organizations/${org.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: nextStatus,
          reason: `Super Admin manually changed status to ${nextStatus}`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to update organization status.');
      }

      await fetchPlatformData();
      if (selectedOrg && selectedOrg.id === org.id) {
        setSelectedOrg({ ...selectedOrg, status: nextStatus });
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  // Update Entitlements
  const handleToggleModule = async (moduleKey: string) => {
    if (!selectedOrg) return;

    const currentModules = selectedOrg.enabledModules || [];
    const nextModules = currentModules.includes(moduleKey)
      ? currentModules.filter((m) => m !== moduleKey)
      : [...currentModules, moduleKey];

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/platform/organizations/${selectedOrg.id}/entitlements`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabledModules: nextModules,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to update module entitlements.');
      }

      setSelectedOrg({ ...selectedOrg, enabledModules: nextModules });
      setOrganizations((prev) =>
        prev.map((o) => (o.id === selectedOrg.id ? { ...o, enabledModules: nextModules } : o)),
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit Break-Glass Support Request
  const handleBreakGlassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bgOrgId || !bgReason.trim()) {
      alert('Organization selection and justification reason are required.');
      return;
    }

    setBgSubmitting(true);
    setBgSuccessMsg(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/platform/break-glass`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: bgOrgId,
          requestedReason: bgReason.trim(),
          durationHours: Number(bgHours),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to establish break-glass support session.');
      }

      setBgSuccessMsg(data.message);
      await fetchPlatformData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBgSubmitting(false);
    }
  };

  const filteredOrgs = organizations.filter(
    (o) =>
      o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.code.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px', fontFamily: 'inherit' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ padding: '6px 10px', background: '#e0e7ff', color: '#4338ca', borderRadius: 8, fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Shield size={16} /> Exclusive Platform Control
            </span>
            <span style={{ color: '#64748b', fontSize: 13 }}>Platform Owner: Super Administrator</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>
            Medora Platform Governance Cockpit
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
            Multi-organization administration, edition tiering, module entitlements, and security audit logging.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => void fetchPlatformData()}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 14px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => setShowBreakGlassModal(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 14px', background: '#fff1f2', borderColor: '#fecdd3', color: '#be123c' }}
          >
            <Key size={14} /> Break-Glass Support
          </button>
          <button
            onClick={() => setShowProvisionModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px', background: '#4f46e5', borderColor: '#4338ca' }}
          >
            <Plus size={16} /> Provision Organization
          </button>
        </div>
      </div>

      {/* Global Analytics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Organizations</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
            {analytics?.totalOrganizations ?? organizations.length}
          </div>
          <div style={{ fontSize: 12, color: '#10b981', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={13} /> {analytics?.activeOrganizations ?? organizations.filter((o) => o.status === 'ACTIVE').length} Active
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Suspended Tenancies</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#e11d48', marginTop: 4 }}>
            {analytics?.suspendedOrganizations ?? organizations.filter((o) => o.status === 'SUSPENDED').length}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Enforced compliance holds</div>
        </div>

        <div className="card" style={{ padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Hospital Campuses</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#2563eb', marginTop: 4 }}>
            {analytics?.totalBranches ?? 2}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Multi-branch locations</div>
        </div>

        <div className="card" style={{ padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Provisioned Staff</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#7c3aed', marginTop: 4 }}>
            {analytics?.totalUsers ?? 5}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Platform-wide directory</div>
        </div>

        <div className="card" style={{ padding: 18, borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Active Break-Glass</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: analytics?.activeSupportGrants ? '#f59e0b' : '#059669', marginTop: 4 }}>
            {analytics?.activeSupportGrants ?? 0}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Time-limited clinical grants</div>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('organizations')}
          style={{
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'organizations' ? '3px solid #4f46e5' : '3px solid transparent',
            color: activeTab === 'organizations' ? '#4f46e5' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Building2 size={16} /> Organizations Directory ({organizations.length})
        </button>

        <button
          onClick={() => setActiveTab('registrations')}
          style={{
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'registrations' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'registrations' ? '#0284c7' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Layers size={16} /> Registrations & Approvals ({registrations.length})
          {registrations.filter((r) => r.status === 'PENDING_APPROVAL').length > 0 && (
            <span style={{ background: '#f59e0b', color: '#ffffff', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>
              {registrations.filter((r) => r.status === 'PENDING_APPROVAL').length} Pending
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '3px solid #4f46e5' : '3px solid transparent',
            color: activeTab === 'audit' ? '#4f46e5' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <FileText size={16} /> Platform Security Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* Tab 1: Organizations Directory */}
      {activeTab === 'organizations' && (
        <div className="card" style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff', overflow: 'hidden' }}>
          {/* Table Toolbar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: 280 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search organizations by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 34, fontSize: 13 }}
              />
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Showing {filteredOrgs.length} of {organizations.length} organizations
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '12px 16px' }}>Organization</th>
                  <th style={{ padding: '12px 16px' }}>Code</th>
                  <th style={{ padding: '12px 16px' }}>Edition</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Campuses</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Staff</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                      No organizations matching search filter.
                    </td>
                  </tr>
                ) : (
                  filteredOrgs.map((org) => (
                    <tr key={org.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{org.name}</div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Created {new Date(org.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 11.5 }}>{org.code}</code>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                            background:
                              org.edition === 'ENTERPRISE'
                                ? '#f3e8ff'
                                : org.edition === 'HOSPITAL'
                                ? '#dbeafe'
                                : '#e0f2fe',
                            color:
                              org.edition === 'ENTERPRISE'
                                ? '#7e22ce'
                                : org.edition === 'HOSPITAL'
                                ? '#1d4ed8'
                                : '#0284c7',
                          }}
                        >
                          {org.edition}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                            background: org.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                            color: org.status === 'ACTIVE' ? '#15803d' : '#b91c1c',
                          }}
                        >
                          {org.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {org.branchCount} / {org.maxBranches}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {org.userCount} / {org.maxUsers}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            onClick={() => {
                              setSelectedOrg(org);
                              setShowDetailModal(true);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Sliders size={13} /> Entitlements
                          </button>
                          <button
                            onClick={() => void handleToggleOrgStatus(org)}
                            disabled={statusUpdating}
                            className="btn btn-secondary"
                            style={{
                              padding: '4px 8px',
                              fontSize: 12,
                              color: org.status === 'ACTIVE' ? '#b91c1c' : '#15803d',
                              borderColor: org.status === 'ACTIVE' ? '#fecdd3' : '#bbf7d0',
                              background: org.status === 'ACTIVE' ? '#fff1f2' : '#f0fdf4',
                            }}
                          >
                            {org.status === 'ACTIVE' ? <Lock size={13} /> : <Unlock size={13} />}
                            {org.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Registrations & Approvals */}
      {activeTab === 'registrations' && (
        <div className="card" style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff', overflow: 'hidden' }}>
          {/* Table Toolbar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 280 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search by reference, facility name, email..."
                  value={regSearchTerm}
                  onChange={(e) => setRegSearchTerm(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: 36, fontSize: 13 }}
                />
              </div>

              <select
                value={regStatusFilter}
                onChange={(e) => setRegStatusFilter(e.target.value)}
                className="form-select"
                style={{ width: 'auto', fontSize: 13 }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_APPROVAL">Pending Super Admin Review</option>
                <option value="PENDING_EMAIL_VERIFICATION">Awaiting Email Verification</option>
                <option value="ACTIVE">Active & Provisioned</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <button
              onClick={() => void fetchPlatformData()}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* Registrations Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px' }}>Reference</th>
                  <th style={{ padding: '10px 14px' }}>Healthcare Facility</th>
                  <th style={{ padding: '10px 14px' }}>Edition</th>
                  <th style={{ padding: '10px 14px' }}>Location & Contact</th>
                  <th style={{ padding: '10px 14px' }}>Initial Admin</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations
                  .filter((r) => {
                    if (regStatusFilter !== 'ALL' && r.status !== regStatusFilter) return false;
                    if (regSearchTerm.trim()) {
                      const s = regSearchTerm.toLowerCase();
                      return (
                        r.reference.toLowerCase().includes(s) ||
                        r.organizationName.toLowerCase().includes(s) ||
                        r.organizationEmail.toLowerCase().includes(s) ||
                        r.adminEmail.toLowerCase().includes(s) ||
                        r.adminFullName.toLowerCase().includes(s)
                      );
                    }
                    return true;
                  })
                  .map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                        {r.reference}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.organizationName}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Type: {r.organizationType}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: 4 }}>
                          {r.requestedEdition}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div>{r.city}, {r.country}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{r.organizationEmail}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600 }}>{r.adminFullName}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{r.adminEmail}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 10,
                              width: 'fit-content',
                              background:
                                r.status === 'ACTIVE'
                                  ? '#ecfdf5'
                                  : r.status === 'PENDING_APPROVAL'
                                    ? '#fef3c7'
                                    : r.status === 'REJECTED'
                                      ? '#fef2f2'
                                      : '#f8fafc',
                              color:
                                r.status === 'ACTIVE'
                                  ? '#047857'
                                  : r.status === 'PENDING_APPROVAL'
                                    ? '#b45309'
                                    : r.status === 'REJECTED'
                                      ? '#b91c1c'
                                      : '#64748b',
                            }}
                          >
                            {r.status}
                          </span>
                          <span style={{ fontSize: 10, color: r.isEmailVerified ? '#166534' : '#c2410c' }}>
                            {r.isEmailVerified ? '✓ Email Verified' : 'Email Unverified'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {r.status === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedReg(r);
                                  setApprovedEditionChoice(r.requestedEdition);
                                  setShowRegReviewModal(true);
                                }}
                                className="btn btn-primary"
                                style={{ padding: '5px 10px', fontSize: 12, background: '#0284c7', borderColor: '#0284c7' }}
                              >
                                Review & Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedReg(r);
                                  setShowRegRejectModal(true);
                                }}
                                className="btn btn-secondary"
                                style={{ padding: '5px 10px', fontSize: 12, color: '#b91c1c', borderColor: '#fecaca', background: '#fff1f2' }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === 'ACTIVE' && r.organization && (
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>
                              Org #{r.organization.id} Live
                            </span>
                          )}
                          {r.status === 'REJECTED' && (
                            <button
                              onClick={() => {
                                alert(`Rejection Reason: ${r.rejectionReason || 'No details provided.'}`);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: 11 }}
                            >
                              View Reason
                            </button>
                          )}
                          {(r.status === 'APPROVED' || r.status === 'PROVISIONING') && (
                            <button
                              onClick={() => void handleRetryProvisioning(r.id)}
                              disabled={actionSubmitting}
                              className="btn btn-secondary"
                              style={{ padding: '5px 10px', fontSize: 12, color: '#d97706', borderColor: '#fde68a' }}
                            >
                              Retry Provisioning
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                {registrations.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                      No organization registrations found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="card" style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              Platform-Wide Security Audit Stream
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: '#64748b' }}>
              Immutable record of administrative operations, break-glass elevations, and organization status adjustments.
            </p>
          </div>
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px 14px' }}>Timestamp</th>
                  <th style={{ padding: '10px 14px' }}>Action</th>
                  <th style={{ padding: '10px 14px' }}>Actor</th>
                  <th style={{ padding: '10px 14px' }}>Target</th>
                  <th style={{ padding: '10px 14px' }}>Details</th>
                  <th style={{ padding: '10px 14px' }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                      No platform audit logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <code style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 5px', borderRadius: 4, fontWeight: 600 }}>
                          {log.action}
                        </code>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div>{log.actorEmail || 'System'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{log.actorRole}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {log.targetType} #{log.targetId}
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: 280, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {JSON.stringify(log.details)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>{log.ipAddress || 'internal'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Provision Organization */}
      {showProvisionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              maxWidth: 580,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={20} color="#4f46e5" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Provision Organization</h3>
              </div>
              <button
                onClick={() => setShowProvisionModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleProvisionSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Organization Legal / Operational Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Al-Khidmat Specialized Hospital"
                    value={provName}
                    onChange={(e) => setProvName(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Organization Unique Code *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. AKH-01"
                    value={provCode}
                    onChange={(e) => setProvCode(e.target.value.toUpperCase())}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Product Edition *
                  </label>
                  <select
                    className="form-select"
                    value={provEdition}
                    onChange={(e) => setProvEdition(e.target.value as any)}
                  >
                    <option value="CLINIC">CLINIC (OPD Only)</option>
                    <option value="PROFESSIONAL">PROFESSIONAL (Clinic + Pharmacy)</option>
                    <option value="HOSPITAL">HOSPITAL (Full IPD/LIS/RIS)</option>
                    <option value="ENTERPRISE">ENTERPRISE (Multi-Branch/GL)</option>
                  </select>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={15} /> Initial Organization Administrator Credentials
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Administrator Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Dr. Haris Mahmood"
                    value={provAdminName}
                    onChange={(e) => setProvAdminName(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      className="form-control"
                      placeholder="admin@alkhidmat.org"
                      value={provAdminEmail}
                      onChange={(e) => setProvAdminEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Initial Password *
                    </label>
                    <input
                      type="password"
                      required
                      className="form-control"
                      placeholder="••••••••"
                      value={provAdminPassword}
                      onChange={(e) => setProvAdminPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisioning}
                  className="btn btn-primary"
                  style={{ fontSize: 13, background: '#4f46e5', borderColor: '#4338ca' }}
                >
                  {provisioning ? 'Provisioning...' : 'Provision Organization & Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Manage Entitlements & Detail */}
      {showDetailModal && selectedOrg && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              maxWidth: 620,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {selectedOrg.name} — Module Entitlements
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Code: <code>{selectedOrg.code}</code> | Edition: <strong>{selectedOrg.edition}</strong>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
              Enable or disable granular operational modules for this organization. Modules outside the subscribed edition will be blocked by the server-side EntitlementGuard.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {ALL_MODULES.map((mod) => {
                const isEnabled = (selectedOrg.enabledModules || []).includes(mod.key);
                return (
                  <div
                    key={mod.key}
                    onClick={() => void handleToggleModule(mod.key)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: isEnabled ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
                      background: isEnabled ? '#eef2ff' : '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => {}} // Handled by parent div
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12.5, fontWeight: isEnabled ? 600 : 400, color: isEnabled ? '#3730a3' : '#475569' }}>
                      {mod.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="btn btn-primary"
                style={{ fontSize: 13, background: '#4f46e5', borderColor: '#4338ca' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Break-Glass Support Access */}
      {showBreakGlassModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              maxWidth: 540,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Key size={20} color="#be123c" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#9f1239' }}>
                  Break-Glass Emergency Clinical Access
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowBreakGlassModal(false);
                  setBgSuccessMsg(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12.5, color: '#9f1239', lineHeight: 1.5 }}>
              <AlertTriangle size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
              <strong>Strict Security Protocol (Phase 10.2):</strong> By default, Super Administrators have zero access to clinical and patient medical records. Initiating emergency access creates an immutable, time-limited cryptographic grant and triggers alert notifications.
            </div>

            {bgSuccessMsg ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14, color: '#166534', fontSize: 13, marginBottom: 16 }}>
                <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                {bgSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleBreakGlassSubmit}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Target Organization *
                  </label>
                  <select
                    required
                    className="form-select"
                    value={bgOrgId}
                    onChange={(e) => setBgOrgId(e.target.value)}
                  >
                    <option value="">Select target organization...</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Access Duration (Hours) *
                  </label>
                  <select
                    className="form-select"
                    value={bgHours}
                    onChange={(e) => setBgHours(Number(e.target.value))}
                  >
                    <option value={1}>1 Hour (Standard investigation)</option>
                    <option value={4}>4 Hours (Database maintenance)</option>
                    <option value={8}>8 Hours (Full shift triage)</option>
                    <option value={24}>24 Hours (Maximum allowable grant)</option>
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Operational Reason / Support Ticket *
                  </label>
                  <textarea
                    required
                    rows={3}
                    className="form-control"
                    placeholder="e.g. Critical support ticket #SUP-9912: Resolving corrupted prescription record linkage"
                    value={bgReason}
                    onChange={(e) => setBgReason(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowBreakGlassModal(false)}
                    className="btn btn-secondary"
                    style={{ fontSize: 13 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bgSubmitting}
                    className="btn btn-primary"
                    style={{ fontSize: 13, background: '#be123c', borderColor: '#9f1239' }}
                  >
                    {bgSubmitting ? 'Activating Grant...' : 'Activate Emergency Grant'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Review & Approve Registration */}
      {showRegReviewModal && selectedReg && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              maxWidth: 620,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  Review Organization Registration
                </h3>
                <span style={{ fontSize: 12, color: '#0284c7', fontFamily: 'monospace' }}>Ref: {selectedReg.reference}</span>
              </div>
              <button
                onClick={() => setShowRegReviewModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16, fontSize: 13 }}>
              <div>
                <span style={{ color: '#64748b' }}>Organization: </span>
                <strong>{selectedReg.organizationName}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Type: </span>
                <strong>{selectedReg.organizationType}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Specialization: </span>
                <span>{selectedReg.healthcareSpecialization || selectedReg.specialization || 'General'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>License: </span>
                <span>{selectedReg.licenseNumber || selectedReg.registrationNumber || 'None specified'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Facility Email: </span>
                <span>{selectedReg.organizationEmail}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Phone: </span>
                <span>{selectedReg.contactPhone}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b' }}>Administrator: </span>
                <strong>{selectedReg.adminFullName}</strong> ({selectedReg.adminEmail})
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Approved Product Edition *
              </label>
              <select
                className="form-select"
                value={approvedEditionChoice}
                onChange={(e) => setApprovedEditionChoice(e.target.value as any)}
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                <option value="CLINIC">CLINIC (Outpatient Consultation & Billing)</option>
                <option value="PROFESSIONAL">PROFESSIONAL (Clinic + Pharmacy Dispensary)</option>
                <option value="HOSPITAL">HOSPITAL (Inpatient Wards, Beds, LIS, RIS)</option>
                <option value="ENTERPRISE">ENTERPRISE (Multi-Branch, Accounting, Telemedicine)</option>
              </select>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b' }}>
                Requested by applicant: <strong>{selectedReg.requestedEdition}</strong>. Super Admin holds authority to adjust edition tier before automated tenant provisioning.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowRegReviewModal(false)}
                className="btn btn-secondary"
                style={{ fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionSubmitting}
                onClick={() => void handleApproveRegistration(selectedReg)}
                className="btn btn-primary"
                style={{ fontSize: 13, background: '#0284c7', borderColor: '#0284c7' }}
              >
                {actionSubmitting ? 'Provisioning...' : 'Approve & Provision Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reject Registration */}
      {showRegRejectModal && selectedReg && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              maxWidth: 480,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#991b1b' }}>
                Reject Organization Registration
              </h3>
              <button
                onClick={() => setShowRegRejectModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
              Provide a mandatory explanation for rejecting <strong>{selectedReg.organizationName}</strong>. This explanation will be displayed to the applicant upon tracking status.
            </p>

            <form onSubmit={handleRejectRegistration}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Rejection Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  className="form-control"
                  placeholder="e.g. Incomplete healthcare license credentials. Please resubmit with verified provincial health authority registration."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowRegRejectModal(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting || !rejectReason.trim()}
                  className="btn btn-primary"
                  style={{ fontSize: 13, background: '#b91c1c', borderColor: '#b91c1c' }}
                >
                  {actionSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notice: Provisioned Result */}
      {provisionedNotice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              maxWidth: 540,
              width: '100%',
              padding: 28,
              boxShadow: '0 25px 30px -5px rgba(0, 0, 0, 0.2)',
              textAlign: 'center',
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle2 size={32} />
            </div>

            <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
              Organization Provisioned Successfully!
            </h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              Tenant <strong>{provisionedNotice.orgName}</strong> (ID #{provisionedNotice.orgId}) has been created with primary branch, default settings, and onboarding checklist.
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, textAlign: 'left', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                Initial Administrator Invitation Token
              </div>
              <input
                readOnly
                value={provisionedNotice.invitationToken}
                style={{ width: '100%', fontSize: 12, fontFamily: 'monospace', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
              />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b' }}>
                This token allows the initial Org Admin to set their password at <code>/accept-invitation?token={provisionedNotice.invitationToken}</code>
              </p>
            </div>

            <button
              onClick={() => setProvisionedNotice(null)}
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: 14, fontWeight: 600, background: '#0284c7', borderColor: '#0284c7' }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
