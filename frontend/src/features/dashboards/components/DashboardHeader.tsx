import React from 'react';
import { Calendar, Building2, RefreshCw, type LucideIcon } from 'lucide-react';

interface DashboardHeaderProps {
  title: string;
  subtitle: string;
  userName?: string;
  userRole?: string;
  branchName?: string;
  branchCode?: string;
  icon?: LucideIcon;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  subtitle,
  userName,
  userRole,
  branchName = 'Main Campus',
  branchCode = 'MAIN',
  icon: Icon,
  onRefresh,
  isRefreshing = false,
  actions,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 16,
        paddingBottom: 4,
      }}
    >
      <div>
        {/* Personalized Welcome Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            {getGreeting()},{' '}
            <strong style={{ color: 'var(--text-main)' }}>
              {userName || 'Staff Member'}
            </strong>
          </span>
          {userRole && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--primary)',
                background: 'var(--primary-light)',
                padding: '2px 8px',
                borderRadius: 9999,
                letterSpacing: '0.02em',
              }}
            >
              {userRole}
            </span>
          )}
        </div>

        {/* Title and Icon */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            margin: 0,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {Icon && <Icon size={24} style={{ color: 'var(--primary)' }} />}
          <span>{title}</span>
        </h1>

        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      </div>

      {/* Right Side: Context Chips & Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Branch Context Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            padding: '6px 12px',
            borderRadius: 9999,
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--text-main)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <Building2 size={14} style={{ color: 'var(--primary)' }} />
          <span>{branchName}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>[{branchCode}]</span>
        </div>

        {/* Date Context Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            padding: '6px 12px',
            borderRadius: 9999,
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--text-muted)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
          <span>{formattedDate}</span>
        </div>

        {/* Refresh Action */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn btn-secondary"
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12.5,
            }}
            title="Refresh dashboard data"
          >
            <RefreshCw
              size={14}
              style={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
          </button>
        )}

        {/* Custom Actions */}
        {actions}
      </div>
    </div>
  );
};

