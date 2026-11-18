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
  ExternalLink,
  X,
  Users,
  Calendar,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NAVIGATION_ITEMS, NAVIGATION_CATEGORIES } from './NavigationConfig';
import { filterNavItems, groupNavItemsByCategory } from './navigation-utils';
import { NotificationCenter } from '../features/notifications/NotificationCenter';
import { ChangePasswordModal } from '../features/auth/ChangePasswordModal';

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

  // Compute filtered navigation items based on backend-issued permissions
  const authorizedNavItems = useMemo(() => {
    return filterNavItems(NAVIGATION_ITEMS, userPermissions, userRole);
  }, [userPermissions, userRole]);

  const groupedNav = useMemo(() => {
    return groupNavItemsByCategory(authorizedNavItems);
  }, [authorizedNavItems]);

  // Determine active title
  const currentNavItem = useMemo(() => {
    return NAVIGATION_ITEMS.find((item) => item.path === location.pathname);
  }, [location.pathname]);

  const activeTitle = currentNavItem ? currentNavItem.label : 'Workspace';

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h1 style={{ fontSize: 16, margin: 0, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                MEDORA 2.0
              </h1>
              <span style={{
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Pro
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Hospital Clinical Core
            </p>
          </div>
        </div>

        {/* Dynamic RBAC-Filtered Navigation Categories */}
        <div className="sidebar-content">
          {NAVIGATION_CATEGORIES.map((category) => {
            const items = groupedNav[category];
            if (!items || items.length === 0) return null;

            return (
              <div key={category}>
                <div className="sidebar-group-title">{category}</div>
                <div className="sidebar-group-items">
                  {items.map((item) => {
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
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
                {currentUser?.name || 'Administrator'}
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

            {/* Active Branch Switcher */}
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
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(e.target.value)}
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

            {/* Notification Center Bell */}
            <NotificationCenter token={token} apiBaseUrl={apiBaseUrl} />

            {/* Quick Action "+ Add New" Dropdown */}
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
                    width: 220,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    padding: '6px 0',
                    zIndex: 60,
                  }}
                  onMouseLeave={() => setQuickActionMenuOpen(false)}
                >
                  <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Quick Actions
                  </div>

                  <button
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'transparent',
                      border: 'none',
                      fontSize: 13,
                      color: '#0f172a',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => {
                      setQuickActionMenuOpen(false);
                      navigate('/patients');
                    }}
                  >
                    <Users size={16} style={{ color: '#d97706' }} />
                    <span>Register Patient</span>
                  </button>

                  <button
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'transparent',
                      border: 'none',
                      fontSize: 13,
                      color: '#0f172a',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => {
                      setQuickActionMenuOpen(false);
                      navigate('/appointments');
                    }}
                  >
                    <Calendar size={16} style={{ color: '#7c3aed' }} />
                    <span>Book Appointment</span>
                  </button>

                  <button
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'transparent',
                      border: 'none',
                      fontSize: 13,
                      color: '#0f172a',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => {
                      setQuickActionMenuOpen(false);
                      navigate('/doctors');
                    }}
                  >
                    <Stethoscope size={16} style={{ color: '#0284c7' }} />
                    <span>Register Doctor</span>
                  </button>

                  <button
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'transparent',
                      border: 'none',
                      fontSize: 13,
                      color: '#0f172a',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => {
                      setQuickActionMenuOpen(false);
                      navigate('/billing');
                    }}
                  >
                    <CreditCard size={16} style={{ color: '#dc2626' }} />
                    <span>Raise Invoice</span>
                  </button>

                  <button
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'transparent',
                      border: 'none',
                      fontSize: 13,
                      color: '#0f172a',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => {
                      setQuickActionMenuOpen(false);
                      navigate('/staff');
                    }}
                  >
                    <UserCheck size={16} style={{ color: '#059669' }} />
                    <span>Onboard Staff</span>
                  </button>
                </div>
              )}
            </div>

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
          <Outlet />
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
              style={{ position: 'absolute', right: 16, top: 16, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: backendStatus === 'online' ? '#dcfce7' : '#fee2e2',
                  color: backendStatus === 'online' ? '#16a34a' : '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Activity size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Medora Backend Service</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Real-time Connection Diagnostics</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, background: 'var(--bg-subtle)', padding: 16, borderRadius: 8, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span style={{ fontWeight: 700, color: backendStatus === 'online' ? '#16a34a' : '#dc2626' }}>
                  {backendStatus === 'online' ? '● Operational (200 OK)' : '○ Unreachable'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Endpoint:</span>
                <code style={{ fontSize: 12 }}>{apiBaseUrl || window.location.origin}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Latency (Ping):</span>
                <span style={{ fontWeight: 600 }}>{backendLatency !== null ? `${backendLatency} ms` : '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>API Version:</span>
                <span style={{ fontWeight: 600 }}>v2.0.0 (NestJS 11 + Prisma)</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={checkBackendHealth}
                style={{ fontSize: 12.5 }}
              >
                Re-check
              </button>

              <a
                href={`${apiBaseUrl}/status`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <span>Open Backend Status Page</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

