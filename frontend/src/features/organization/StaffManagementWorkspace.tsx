import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Building2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  X,
  Edit2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface StaffMember {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  accessRole: string;
  group: string;
  isActive: boolean;
  branchId?: string | null;
  branchName?: string | null;
  assignedAt: string;
}

interface ActivityLogItem {
  id: string;
  action: string;
  actorEmail?: string;
  actorRole?: string;
  details: Record<string, any>;
  createdAt: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export const StaffManagementWorkspace: React.FC = () => {
  const { token, apiBaseUrl, currentUser, userBranches, activeBranchId } = useAuth();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [activeTab, setActiveTab] = useState<'staff' | 'invitations'>('staff');
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);

  // Invite Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('Doctor');
  const [inviteBranchId, setInviteBranchId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Role Edit Form
  const [newRole, setNewRole] = useState('Doctor');
  const [updatingRole, setUpdatingRole] = useState(false);

  const orgId = currentUser?.organizationId || '1';

  const ALLOWED_STAFF_ROLES = [
    'Doctor',
    'Nurse',
    'Receptionist',
    'Pharmacist',
    'Laboratorist',
    'Radiologist',
    'Cashier',
    'Accountant',
    'HR',
    'ClinicAdmin',
    'Admin',
  ];

  const fetchStaffData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [staffRes, activityRes, invRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/organizations/${orgId}/staff`, { headers })
          .then((r) => r.json())
          .catch(() => ({ data: [] })),
        fetch(`${apiBaseUrl}/api/v1/organizations/${orgId}/staff/activity`, { headers })
          .then((r) => r.json())
          .catch(() => ({ data: { logs: [] } })),
        fetch(`${apiBaseUrl}/api/v1/organizations/${orgId}/staff/invitations`, { headers })
          .then((r) => r.json())
          .catch(() => ({ data: [] })),
      ]);

      const staffList = staffRes.data?.data || staffRes.data || staffRes;
      if (Array.isArray(staffList)) {
        setStaff(staffList);
      }

      const invList = invRes.data?.data || invRes.data || invRes;
      if (Array.isArray(invList)) {
        setPendingInvitations(invList);
      }

      const activityData = activityRes.data?.data || activityRes.data || activityRes;
      if (activityData?.logs) {
        setActivityLogs(activityData.logs);
      }
    } catch {
      setError('Unable to load organization staff records.');
    } finally {
      setLoading(false);
    }
  }, [token, apiBaseUrl, orgId]);

  useEffect(() => {
    void fetchStaffData();
  }, [fetchStaffData]);

  // Handle Invite
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) {
      alert('Email and Name are required.');
      return;
    }

    setInviting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/organizations/${orgId}/staff/invite`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          name: inviteName.trim(),
          role: inviteRole,
          branchId: inviteBranchId || activeBranchId || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || 'Invitation failed.');
      }

      const payload = json.data?.data || json.data || json;
      const inviteToken = payload.invitationToken || payload.token;
      if (!inviteToken) {
        throw new Error('Server did not return a valid invitation token.');
      }

      const inviteUrl = `${window.location.origin}/accept-invitation?token=${encodeURIComponent(inviteToken)}`;
      setGeneratedInviteLink(inviteUrl);
      await fetchStaffData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInviting(false);
    }
  };

  // Revoke Pending Invitation
  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    const confirmPrompt = window.confirm(`Are you sure you want to revoke the pending invitation for "${email}"?`);
    if (!confirmPrompt) return;

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${orgId}/staff/invitations/${invitationId}/revoke`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || json.message || 'Failed to revoke invitation.');
      }

      await fetchStaffData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Toggle Active/Inactive
  const handleToggleStatus = async (member: StaffMember) => {
    const nextStatus = !member.isActive;
    const confirmPrompt = window.confirm(
      `Are you sure you want to ${nextStatus ? 'ACTIVATE' : 'DEACTIVATE'} staff member "${member.name}"?`,
    );
    if (!confirmPrompt) return;

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${orgId}/staff/${member.membershipId}/status`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isActive: nextStatus,
            notes: `Status changed to ${nextStatus ? 'active' : 'inactive'} by Organization Admin`,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to update membership status.');
      }

      setStaff((prev) =>
        prev.map((s) => (s.membershipId === member.membershipId ? { ...s, isActive: nextStatus } : s)),
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle Role Update
  const handleUpdateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    setUpdatingRole(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${orgId}/staff/${selectedMember.membershipId}/role`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: newRole,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to update role.');
      }

      setShowRoleModal(false);
      await fetchStaffData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingRole(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedInviteLink) return;
    navigator.clipboard.writeText(generatedInviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filteredStaff = staff.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || s.accessRole === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '4px 8px', background: '#ecfdf5', color: '#047857', borderRadius: 6, fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Building2 size={14} /> Organization Admin
            </span>
            <span style={{ color: '#64748b', fontSize: 13 }}>Tenant ID: #{orgId}</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>
            Staff & Operational Directory
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#64748b' }}>
            Invite clinicians and front-desk personnel, manage branch assignments, and enforce organizational role limits.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => void fetchStaffData()}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 14px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => {
              setGeneratedInviteLink(null);
              setInviteEmail('');
              setInviteName('');
              setShowInviteModal(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px', background: '#0284c7', borderColor: '#0369a1' }}
          >
            <UserPlus size={16} /> Invite Staff Member
          </button>
        </div>
      </div>

      {/* Staff Table Card */}
      <div className="card" style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff', overflow: 'hidden' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 20px', gap: 8 }}>
          <button
            onClick={() => setActiveTab('staff')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'staff' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'staff' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'staff' ? 700 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            Active Directory ({staff.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'invitations' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'invitations' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'invitations' ? 700 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            Pending Invitations ({pendingInvitations.filter((i) => i.status === 'PENDING').length})
          </button>
        </div>

        {activeTab === 'staff' ? (
          <>
            {/* Toolbar */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
                <div style={{ position: 'relative', minWidth: 260 }}>
                  <Search size={15} style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search staff by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: 34, fontSize: 13 }}
                  />
                </div>
                <select
                  className="form-select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  style={{ width: 'auto', fontSize: 13 }}
                >
                  <option value="ALL">All Roles</option>
                  {ALLOWED_STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: 13, color: '#64748b' }}>
                {filteredStaff.length} members shown
              </div>
            </div>

            {/* Table */}
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '12px 16px' }}>Staff Member</th>
                    <th style={{ padding: '12px 16px' }}>Role</th>
                    <th style={{ padding: '12px 16px' }}>Branch</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px' }}>Joined</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                        No staff members match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((member) => (
                      <tr key={member.membershipId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{member.name}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{member.email}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 11.5,
                              fontWeight: 600,
                              background: member.accessRole === 'Admin' ? '#e0e7ff' : '#f1f5f9',
                              color: member.accessRole === 'Admin' ? '#4338ca' : '#334155',
                            }}
                          >
                            {member.accessRole}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="badge badge-neutral" style={{ fontSize: 11.5 }}>
                            {member.branchName || 'Main Campus'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 11.5,
                              fontWeight: 600,
                              background: member.isActive ? '#dcfce7' : '#fee2e2',
                              color: member.isActive ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {member.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                          {new Date(member.assignedAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              onClick={() => {
                                setSelectedMember(member);
                                setNewRole(member.accessRole);
                                setShowRoleModal(true);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <Edit2 size={12} /> Edit Role
                            </button>
                            <button
                              onClick={() => void handleToggleStatus(member)}
                              className="btn btn-secondary"
                              style={{
                                padding: '4px 8px',
                                fontSize: 12,
                                color: member.isActive ? '#b91c1c' : '#15803d',
                                borderColor: member.isActive ? '#fecdd3' : '#bbf7d0',
                                background: member.isActive ? '#fff1f2' : '#f0fdf4',
                              }}
                            >
                              {member.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '12px 16px' }}>Invited Recipient</th>
                  <th style={{ padding: '12px 16px' }}>Role</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Issued Date</th>
                  <th style={{ padding: '12px 16px' }}>Expires</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvitations.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                      No invitations recorded. Click "Invite Staff Member" to issue single-use activation links.
                    </td>
                  </tr>
                ) : (
                  pendingInvitations.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{inv.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{inv.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge badge-primary" style={{ fontSize: 11.5 }}>
                          {inv.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                            background:
                              inv.status === 'PENDING'
                                ? '#fef3c7'
                                : inv.status === 'ACCEPTED'
                                  ? '#dcfce7'
                                  : '#fee2e2',
                            color:
                              inv.status === 'PENDING'
                                ? '#b45309'
                                : inv.status === 'ACCEPTED'
                                  ? '#15803d'
                                  : '#b91c1c',
                          }}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {inv.status === 'PENDING' && (
                          <button
                            onClick={() => void handleRevokeInvitation(inv.id, inv.email)}
                            className="btn btn-secondary"
                            style={{
                              padding: '4px 8px',
                              fontSize: 12,
                              color: '#b91c1c',
                              borderColor: '#fecdd3',
                              background: '#fff1f2',
                            }}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Invite Staff */}
      {showInviteModal && (
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
              maxWidth: 520,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={20} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Invite Staff Member</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {generatedInviteLink ? (
              <div>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                    <CheckCircle2 size={16} /> Invitation Token Generated!
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#166534' }}>
                    Share this single-use secure link with <strong>{inviteName}</strong> ({inviteEmail}). The link expires in 7 days.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <input
                    type="text"
                    readOnly
                    className="form-control"
                    value={generatedInviteLink}
                    style={{ fontSize: 12, background: '#f8fafc', fontFamily: 'monospace' }}
                  />
                  <button
                    onClick={copyToClipboard}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                  >
                    {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="btn btn-primary"
                    style={{ fontSize: 13, background: '#0284c7', borderColor: '#0369a1' }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Dr. Ayesha Khan"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    placeholder="ayesha.khan@hospital.org"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Role *
                    </label>
                    <select
                      className="form-select"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                    >
                      {ALLOWED_STAFF_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Primary Campus
                    </label>
                    <select
                      className="form-select"
                      value={inviteBranchId}
                      onChange={(e) => setInviteBranchId(e.target.value)}
                    >
                      {userBranches && userBranches.length > 0 ? (
                        userBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))
                      ) : (
                        <option value="1">Main Campus</option>
                      )}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="btn btn-secondary"
                    style={{ fontSize: 13 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="btn btn-primary"
                    style={{ fontSize: 13, background: '#0284c7', borderColor: '#0369a1' }}
                  >
                    {inviting ? 'Generating...' : 'Issue Invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: Edit Role */}
      {showRoleModal && selectedMember && (
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
              maxWidth: 440,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                Update Role for {selectedMember.name}
              </h3>
              <button
                onClick={() => setShowRoleModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateRoleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Assigned Operational Role *
                </label>
                <select
                  className="form-select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  {ALLOWED_STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 6 }}>
                  Privilege escalation to Super Admin is strictly prevented.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingRole}
                  className="btn btn-primary"
                  style={{ fontSize: 13, background: '#0284c7', borderColor: '#0369a1' }}
                >
                  {updatingRole ? 'Updating...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
