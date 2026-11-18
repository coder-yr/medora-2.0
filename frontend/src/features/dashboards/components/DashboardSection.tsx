import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: string | number;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  subtitle,
  icon: Icon,
  badge,
  action,
  children,
  noPadding = false,
}) => {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Section Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          background: 'var(--bg-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {Icon && (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={17} />
            </div>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                {title}
              </h3>
              {badge !== undefined && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: '#f1f5f9',
                    color: '#475569',
                    padding: '2px 8px',
                    borderRadius: 9999,
                  }}
                >
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {action && <div>{action}</div>}
      </div>

      {/* Section Body */}
      <div style={{ padding: noPadding ? 0 : '18px 20px' }}>{children}</div>
    </div>
  );
};
