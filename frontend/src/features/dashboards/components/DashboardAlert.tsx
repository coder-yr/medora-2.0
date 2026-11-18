import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';

interface DashboardAlertProps {
  type?: 'warning' | 'danger' | 'info' | 'success';
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

const stylesMap = {
  warning: { bg: '#fffbeb', border: '#fef3c7', text: '#92400e', icon: AlertTriangle, iconColor: '#d97706' },
  danger: { bg: '#fef2f2', border: '#fee2e2', text: '#991b1b', icon: AlertCircle, iconColor: '#dc2626' },
  info: { bg: '#f0f9ff', border: '#e0f2fe', text: '#0369a1', icon: Info, iconColor: '#0284c7' },
  success: { bg: '#ecfdf5', border: '#d1fae5', text: '#065f46', icon: CheckCircle2, iconColor: '#059669' },
};

export const DashboardAlert: React.FC<DashboardAlertProps> = ({
  type = 'warning',
  title,
  message,
  actionText,
  onAction,
  onDismiss,
}) => {
  const current = stylesMap[type] || stylesMap.warning;
  const Icon = current.icon;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 10,
        background: current.bg,
        border: `1px solid ${current.border}`,
        color: current.text,
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <Icon size={18} style={{ color: current.iconColor, flexShrink: 0 }} />
        <div>
          <strong style={{ fontWeight: 700, marginRight: 6 }}>{title}</strong>
          <span>{message}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {actionText && onAction && (
          <button
            onClick={onAction}
            style={{
              background: 'transparent',
              border: `1px solid ${current.iconColor}`,
              color: current.text,
              fontSize: 11.5,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {actionText}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: current.text,
              cursor: 'pointer',
              padding: 2,
            }}
            title="Dismiss alert"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

