import React from 'react';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { resolveUserRole } from '../../../app/role-resolution';

export const UnconfiguredRoleView: React.FC = () => {
  const { currentUser, userRole, handleLogout, refreshIdentity } = useAuth();

  const handleCheckPermissions = () => {
    // Revalidates identity and permissions against the server
    void refreshIdentity();
  };

  return (
    <div
      style={{
        maxWidth: 580,
        margin: '60px auto',
        padding: 36,
        borderRadius: 16,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08)',
        textAlign: 'center',
      }}
      className="card"
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: '#fff1f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e11d48',
          margin: '0 auto 18px',
        }}
      >
        <ShieldAlert size={32} />
      </div>

      <h2 style={{ margin: '0 0 10px 0', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
        Account Role Not Configured
      </h2>

      <p style={{ margin: '0 0 18px 0', fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
        Signed in as <strong>{currentUser?.name || 'Hospital User'}</strong> ({currentUser?.email}).
        <br />
        Your account currently does not have an active operational persona assigned in the hospital directory.
      </p>

      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 12.5,
          color: '#64748b',
          marginBottom: 24,
          textAlign: 'left',
          lineHeight: 1.5,
        }}
      >
        <div><strong>Assigned System Role:</strong> <code>{userRole || 'None'}</code></div>
        <div><strong>Assigned Group:</strong> <code>{currentUser?.group || 'None'}</code></div>
        <div style={{ marginTop: 6, fontSize: 11.5, color: '#94a3b8' }}>
          To access clinical, diagnostic, or administrative workspaces, a Hospital Administrator must assign your role and department.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button
          onClick={handleCheckPermissions}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontSize: 13 }}
        >
          <RefreshCw size={15} /> Check Permissions
        </button>
        <button
          onClick={handleLogout}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontSize: 13 }}
        >
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </div>
  );
};
