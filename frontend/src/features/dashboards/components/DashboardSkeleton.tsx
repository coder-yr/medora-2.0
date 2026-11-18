import React from 'react';

export const DashboardSkeletonCards: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
        gap: 16,
      }}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="card"
          style={{
            padding: '18px 20px',
            minHeight: 120,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div
              style={{
                width: 90,
                height: 14,
                borderRadius: 4,
                background: '#f1f5f9',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#f1f5f9',
                animation: 'pulse 1.5s infinite',
              }}
            />
          </div>
          <div>
            <div
              style={{
                width: '50%',
                height: 28,
                borderRadius: 6,
                background: '#f1f5f9',
                animation: 'pulse 1.5s infinite',
                marginBottom: 6,
              }}
            />
            <div
              style={{
                width: '75%',
                height: 12,
                borderRadius: 4,
                background: '#f1f5f9',
                animation: 'pulse 1.5s infinite',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export const DashboardSkeletonTable: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div
        style={{
          width: 140,
          height: 18,
          borderRadius: 4,
          background: '#f1f5f9',
          animation: 'pulse 1.5s infinite',
          marginBottom: 16,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            style={{
              height: 44,
              borderRadius: 6,
              background: '#f8fafc',
              animation: 'pulse 1.5s infinite',
            }}
          />
        ))}
      </div>
    </div>
  );
};

