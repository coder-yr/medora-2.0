import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface DashboardErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}

export const DashboardErrorState: React.FC<DashboardErrorStateProps> = ({
  title = 'Failed to load dashboard metrics',
  message,
  onRetry,
  compact = false,
}) => {
  return (
    <div
      style={{
        padding: compact ? '20px 16px' : '36px 20px',
        textAlign: 'center',
        background: '#fef2f2',
        border: '1px solid #fecdd3',
        borderRadius: 12,
        margin: compact ? 0 : '12px 0',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: '#fee2e2',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
        }}
      >
        <AlertCircle size={22} />
      </div>

      <h4 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 700, color: '#991b1b' }}>
        {title}
      </h4>
      <p style={{ margin: '0 auto', fontSize: 13, color: '#b91c1c', maxWidth: 420, lineHeight: 1.4 }}>
        {message}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="btn btn-secondary"
          style={{
            marginTop: 14,
            fontSize: 12.5,
            borderColor: '#fca5a5',
            color: '#991b1b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <RotateCcw size={14} /> Try Again
        </button>
      )}
    </div>
  );
};

