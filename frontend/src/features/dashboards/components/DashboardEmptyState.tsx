import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface DashboardEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  compact?: boolean;
}

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  compact = false,
}) => {
  return (
    <div
      style={{
        padding: compact ? '32px 16px' : '48px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: compact ? 42 : 52,
          height: compact ? 42 : 52,
          borderRadius: 12,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          marginBottom: 12,
        }}
      >
        <Icon size={compact ? 20 : 26} />
      </div>

      <h4 style={{ margin: '0 0 6px 0', fontSize: compact ? 14 : 16, fontWeight: 700, color: 'var(--text-main)' }}>
        {title}
      </h4>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.5 }}>
        {description}
      </p>

      {actionText && onAction && (
        <button
          onClick={onAction}
          className="btn btn-secondary"
          style={{ marginTop: 16, fontSize: 12.5 }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
