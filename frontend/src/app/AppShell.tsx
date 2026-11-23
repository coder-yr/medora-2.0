import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Menu,
  Stethoscope,
  LogOut,
  Key,
  Building2,
  Plus,
  Activity,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NAVIGATION_ITEMS } from './NavigationConfig';
import {
  getRoleNavigation,
  getRoleQuickActions,
  getRoleDepartmentMeta,
} from './navigation-utils';
import { NotificationCenter } from '../features/notifications/NotificationCenter';
import { ChangePasswordModal } from '../features/auth/ChangePasswordModal';
import { WorkspaceSelector } from '../components/WorkspaceSelector';

export const AppShell: React.FC = () => {
  const {
    currentUser,
    userRole,
    userPermissions,
    userBranches,
    activeBranchId,
    setActiveBranchId,
    token,
    apiBaseUrl,
    handleLogout,
  } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [quickActionMenuOpen, setQuickActionMenuOpen] = useState(false);

  // Backend Health State
  const [backendStatus, setBackendStatus] = useState<'online' | 'checking' | 'offline'>('checking');
  const [backendLatency, setBackendLatency] = useState<number | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const checkBackendHealth = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/health`);
      if (res.ok) {
        setBackendLatency(Math.round(performance.now() - start));
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void checkBackendHealth();
    const interval = setInterval(() => {
      void checkBackendHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [checkBackendHealth]);

  // Phase 8.2: Role-tailored department branding and navigation hierarchy
  const roleMeta = useMemo(() => {
    return getRoleDepartmentMeta(userRole);
  }, [userRole]);

  const roleSections = useMemo(() => {
    return getRoleNavigation(userRole, userPermissions);
  }, [userRole, userPermissions]);

  const roleQuickActions = useMemo(() => {
    return getRoleQuickActions(userRole, userPermissions);
  }, [userRole, userPermissions]);

  // Determine active title based on role navigation items first, fallback to master NAVIGATION_ITEMS
  const activeTitle = useMemo(() => {
    for (const section of roleSections) {
      const match = section.items.find((item) => item.path === location.pathname);
      if (match) return match.label;
    }
    const currentNavItem = NAVIGATION_ITEMS.find((item) => item.path === location.pathname);
    return currentNavItem ? currentNavItem.label : 'Workspace';
  }, [roleSections, location.pathname]);

  // Active Branch Context
  const activeBranch = useMemo(() => {
    return userBranches.find((b) => String(b.id) === String(activeBranchId)) || {
      id: '1',
      name: 'Main Campus',
      code: 'MAIN',
    };
  }, [userBranches, activeBranchId]);

  // Branch selector capability check (Super Admin, users with branch_view_all, or users assigned to multiple branches)
  const isSuperAdmin = userRole === 'Super Admin';
  const hasBranchViewAll = (userPermissions || []).some(
    (p) => p.toLowerCase() === 'branch_view_all' || p === '*',
  );
  const canSelectBranch = isSuperAdmin || hasBranchViewAll || (userBranches && userBranches.length > 1);

  return (
    <div className="medora-layout">
      {/* Sidebar Navigation */}
      <aside className={`medora-sidebar ${sidebarOpen ? 'open' : 'closed'} no-print`}>
        {/* Sidebar Brand Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand-icon">
            <Stethoscope size={22} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 16, margin: 0, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                MEDORA 2.0
              </h1>
              <span style={{
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                fontSize: 9.5,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                {roleMeta.badge}
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {roleMeta.subtext}
            </p>
          </div>
        </div>

        {/* Dynamic Role-Tailored & RBAC-Filtered Navigation Sections */}
        <div className="sidebar-content">
          {roleSections.map((section) => (
            <div key={section.title}>
              <div className="sidebar-group-title">{section.title}</div>
              <div className="sidebar-group-items">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      className={`sidebar-link ${isActive ? 'active' : ''}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <Icon size={17} />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: 'var(--surface-subtle)',
                          color: 'var(--text-muted)'
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer User Profile */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              flexShrink: 0,
              boxShadow: '0 2px 5px rgba(2, 132, 199, 0.25)'
            }}>
              {(currentUser?.name || userRole || 'A').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {currentUser?.name || 'Authorized Staff'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--primary)',
                  background: 'var(--primary-light)',
                  padding: '1px 6px',
                  borderRadius: 4
                }}>
                  {userRole}
                </span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} title="Online & Authorized" />
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out from Medora"
            className="btn btn-secondary"
            style={{ color: '#dc2626', padding: '6px 8px', borderRadius: 6, borderColor: '#fecdd3', background: '#fff1f2' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main App Content Area */}
      <div className="medora-main">
        {/* Top Header Bar */}
        <header className="medora-topbar no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="btn btn-secondary"
              style={{ padding: '7px 9px', borderRadius: 8, display: 'flex', alignItems: 'center', color: '#475569' }}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <Menu size={18} />
            </button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.01em' }}>
                <span>{activeTitle.toUpperCase()}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 9999 }}>
                  Workspace
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Multi-Organization Workspace Selector */}
            <WorkspaceSelector />

            {/* Live Backend Connection Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '5px 12px',
                borderRadius: 9999,
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
              }}
              onClick={() => setShowStatusModal(true)}
              title="Click to view Backend Status & Diagnostics"
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  backgroundColor:
                    backendStatus === 'online'
                      ? '#22c55e'
                      : backendStatus === 'checking'
                        ? '#eab308'
                        : '#ef4444',
                  boxShadow:
                    backendStatus === 'online'
                      ? '0 0 0 2px rgba(34, 197, 94, 0.2)'
                      : 'none',
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                {backendStatus === 'online'
                  ? `API Live${backendLatency ? ` (${backendLatency}ms)` : ''}`
                  : backendStatus === 'checking'
                    ? 'Connecting...'
                    : 'API Offline'}
              </span>
            </div>

            {/* Active Branch Control: Dropdown selector for multi-branch users, static badge for single-facility staff */}
            {canSelectBranch ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '5px 12px',
                borderRadius: 9999,
                boxShadow: 'var(--shadow-xs)'
              }}>
                <Building2 size={15} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Branch:</span>
                <select
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  value={activeBranchId || '1'}
                  onChange={(e) => setActiveBranchId(e.target.value)}
                  title="Switch Active Operating Branch"
                >
                  {userBranches.length > 0 ? (
                    userBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} [{b.code}]
                      </option>
                    ))
                  ) : (
                    <option value="1">Main Campus [MAIN]</option>
                  )}
                </select>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '5px 12px',
                  borderRadius: 9999,
                  boxShadow: 'var(--shadow-xs)'
                }}
                title="Assigned Hospital Facility Scope"
              >
                <Building2 size={15} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Facility:</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>
                  {activeBranch.name} [{activeBranch.code}]
                </span>
              </div>
            )}

            {/* Notification Center Bell */}
            <NotificationCenter token={token} apiBaseUrl={apiBaseUrl} />

            {/* Persona-Specific "+ Add New" Quick Action Dropdown */}
            {roleQuickActions.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button
                  className="btn btn-primary"
                  style={{
                    padding: '6px 14px',
                    fontSize: 12.5,
                    borderRadius: 9999,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: 'var(--shadow-xs)',
                  }}
                  onClick={() => setQuickActionMenuOpen(!quickActionMenuOpen)}
                >
                  <Plus size={15} /> Add New
                </button>

                {quickActionMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '115%',
                      right: 0,
                      width: 240,
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      padding: '6px 0',
                      zIndex: 60,
                    }}
                    onMouseLeave={() => setQuickActionMenuOpen(false)}
                  >
                    <div style={{
                      padding: '6px 14px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      {userRole} Quick Actions
                    </div>

                    {roleQuickActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.id}
                          style={{
                            width: '100%',
                            padding: '9px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            background: 'transparent',
                            border: 'none',
                            fontSize: 13,
                            color: '#0f172a',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          onClick={() => {
                            setQuickActionMenuOpen(false);
                            navigate(action.path);
                          }}
                        >
                          <Icon size={16} style={{ color: action.color || 'var(--primary)' }} />
                          <span style={{ fontWeight: 500 }}>{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Change Password Button */}
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: 12.5, borderRadius: 8 }}
              onClick={() => setShowChangePassword(true)}
              title="Change Account Password"
            >
              <Key size={14} style={{ color: '#0284c7' }} /> Password
            </button>
          </div>
        </header>

        {/* Workspace Body Route Outlet */}
        <main className="medora-content-area">
          <React.Suspense
            fallback={
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '400px',
                  color: '#64748b',
                  fontSize: 14,
                  fontWeight: 500,
                  gap: 12,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    border: '2px solid #cbd5e1',
                    borderTopColor: '#0284c7',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    display: 'inline-block',
                  }}
                />
                Loading Medora Workspace...
              </div>
            }
          >
            <Outlet />
          </React.Suspense>
        </main>
      </div>

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePasswordModal
          token={token}
          apiBaseUrl={apiBaseUrl}
          onClose={() => setShowChangePassword(false)}
        />
      )}

      {/* Backend Diagnostics Modal */}
      {showStatusModal && (
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
          <div className="card" style={{ maxWidth: 480, width: '100%', padding: 24, position: 'relative' }}>
            <button
              onClick={() => setShowStatusModal(false)}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: backendStatus === 'online' ? '#dcfce7' : '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: backendStatus === 'online' ? '#16a34a' : '#dc2626',
                }}
              >
                <Activity size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                  Backend System Health
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  Medora 2.0 Core Diagnostic Status
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Connection Status</span>
                <span style={{ fontWeight: 700, color: backendStatus === 'online' ? '#16a34a' : '#dc2626' }}>
                  {backendStatus === 'online' ? 'Connected (Operational)' : backendStatus === 'checking' ? 'Testing Connection...' : 'Disconnected'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Latency Round-Trip</span>
                <span style={{ fontWeight: 600 }}>{backendLatency ? `${backendLatency} ms` : 'N/A'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Gateway Endpoint</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{apiBaseUrl}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Active Staff Persona</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{userRole}</span>
              </div>
            </div>

            <button
              onClick={() => {
                void checkBackendHealth();
              }}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '10px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Activity size={15} /> Re-verify Gateway Connectivity
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
