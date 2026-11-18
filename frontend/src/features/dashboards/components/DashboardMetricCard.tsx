import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type MetricCardVariant =
  | 'primary'
  | 'teal'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'purple'
  | 'slate';

interface DashboardMetricCardProps {
  title: string;
  value: string | number | null | undefined;
  subtext?: string;
  icon: LucideIcon;
  variant?: MetricCardVariant;
  badge?: string;
  onClick?: () => void;
  loading?: boolean;
}

const variantStyles: Record<
  MetricCardVariant,
  { bg: string; color: string; borderAccent?: string }
> = {
  primary: { bg: '#e0f2fe', color: '#0284c7' },
  teal: { bg: '#ccfbf1', color: '#0d9488' },
  emerald: { bg: '#d1fae5', color: '#059669' },
  amber: { bg: '#fef3c7', color: '#d97706' },
  rose: { bg: '#fee2e2', color: '#dc2626' },
  purple: { bg: '#ede9fe', color: '#7c3aed' },
  slate: { bg: '#f1f5f9', color: '#475569' },
};

export const DashboardMetricCard: React.FC<DashboardMetricCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  variant = 'primary',
  badge,
  onClick,
  loading = false,
}) => {
  const currentVariant = variantStyles[variant] || variantStyles.primary;

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        minHeight: 120,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }
      }}
    >
      {/* Top Row: Title, Badge, and Icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--text-muted)',
              display: 'block',
              marginBottom: 4,
            }}
          >
            {title}
          </span>
          {badge && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: currentVariant.color,
                background: currentVariant.bg,
                padding: '1px 6px',
                borderRadius: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {badge}
            </span>
          )}
        </div>

        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: currentVariant.bg,
            color: currentVariant.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={19} />
        </div>
      </div>

      {/* Main Metric Value */}
      <div style={{ marginTop: 10 }}>
        {loading ? (
          <div
            style={{
              height: 28,
              width: '60%',
              background: '#f1f5f9',
              borderRadius: 6,
              animation: 'pulse 1.5s infinite',
            }}
          />
        ) : (
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            {value !== null && value !== undefined ? value : '—'}
          </div>
        )}

        {/* Subtext info */}
        {subtext && (
          <p
            style={{
              margin: '6px 0 0 0',
              fontSize: 12,
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
};
