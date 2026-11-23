import React, { useState, useEffect, useCallback } from 'react';
import { Building2, ChevronDown, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UserOrgMembership {
  membershipId: string;
  isDefault: boolean;
  accessRole: string;
  organization: {
    id: string;
    name: string;
    code: string;
    type: string;
    status: string;
  };
}

export const WorkspaceSelector: React.FC = () => {
  const { currentUser, token, apiBaseUrl } = useAuth();
  const [organizations, setOrganizations] = useState<UserOrgMembership[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [activeOrgId, setActiveOrgId] = useState<string>(() => {
    return localStorage.getItem('medora_active_organization') || currentUser?.organizationId || '1';
  });

  const fetchMyOrgs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/organizations/my-organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setOrganizations(data);
        if (data.length > 0 && !localStorage.getItem('medora_active_organization')) {
          const def = data.find((m) => m.isDefault) || data[0];
          setActiveOrgId(def.organization.id);
          localStorage.setItem('medora_active_organization', def.organization.id);
        }
      }
    } catch {
      // Fallback
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    void fetchMyOrgs();
  }, [fetchMyOrgs]);

  const handleSelectOrg = (orgId: string) => {
    setActiveOrgId(orgId);
    localStorage.setItem('medora_active_organization', orgId);
    setOpen(false);
    // Reload or refresh identity to apply new organization scope
    window.location.reload();
  };

  const currentOrg = organizations.find((m) => m.organization.id === activeOrgId);
  const orgName = currentOrg?.organization.name || (currentUser?.isSuperAdmin ? 'Platform Management' : 'Primary Hospital');

  if (organizations.length <= 1 && !currentUser?.isSuperAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: '#f1f5f9', borderRadius: 8, fontSize: 13, color: '#334155', fontWeight: 600 }}>
        <Building2 size={16} style={{ color: '#0284c7' }} />
        <span>{orgName}</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          color: '#0f172a',
          cursor: 'pointer',
        }}
      >
        <Building2 size={16} style={{ color: '#0284c7' }} />
        <span style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {orgName}
        </span>
        <ChevronDown size={14} style={{ color: '#64748b' }} />
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 6,
              width: 260,
              background: '#ffffff',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              padding: 6,
              zIndex: 100,
            }}
          >
            <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Select Healthcare Workspace
            </div>

            {organizations.map((m) => {
              const isSelected = m.organization.id === activeOrgId;
              return (
                <div
                  key={m.organization.id}
                  onClick={() => handleSelectOrg(m.organization.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isSelected ? '#f0f9ff' : 'transparent',
                    color: isSelected ? '#0284c7' : '#1e293b',
                    fontSize: 13,
                    fontWeight: isSelected ? 600 : 500,
                  }}
                >
                  <div>
                    <div>{m.organization.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Role: {m.accessRole}</div>
                  </div>
                  {isSelected && <Check size={16} />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
