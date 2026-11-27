import React, { useState } from 'react';

export const formatINR = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return '₹0.00';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatIndianNumber = (val: number | null | undefined): string => {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return '0';
  }
  return new Intl.NumberFormat('en-IN').format(val);
};

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

interface TrendLineChartProps {
  title: string;
  subtitle?: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: TrendSeries[];
  valueFormatter?: (val: number) => string;
  emptyMessage?: string;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  title,
  subtitle,
  data,
  xKey,
  series,
  valueFormatter = formatIndianNumber,
  emptyMessage = 'No persisted activity recorded in the selected date range.',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-500">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  let maxVal = 0;
  for (const row of data) {
    for (const s of series) {
      const v = Number(row[s.key] || 0);
      if (v > maxVal) maxVal = v;
    }
  }
  if (maxVal <= 0) maxVal = 1;

  const getX = (idx: number) => {
    if (data.length === 1) return padL + plotW / 2;
    return padL + (idx / (data.length - 1)) * plotW;
  };
  const getY = (val: number) => padT + plotH - (val / maxVal) * plotH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full min-w-[420px]">
          {yTicks.map((t) => {
            const yPos = padT + plotH - t * plotH;
            const tickVal = maxVal * t;
            return (
              <g key={t}>
                <line
                  x1={padL}
                  y1={yPos}
                  x2={width - padR}
                  y2={yPos}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={padL - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px]"
                >
                  {tickVal >= 1000 ? `${(tickVal / 1000).toFixed(1)}k` : Math.round(tickVal)}
                </text>
              </g>
            );
          })}

          {series.map((s) => {
            const points = data
              .map((row, idx) => `${getX(idx)},${getY(Number(row[s.key] || 0))}`)
              .join(' ');
            return (
              <g key={s.key}>
                <polyline
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={points}
                />
                {data.map((row, idx) => (
                  <circle
                    key={`${s.key}-${idx}`}
                    cx={getX(idx)}
                    cy={getY(Number(row[s.key] || 0))}
                    r={hoveredIdx === idx ? 5 : 3}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                ))}
              </g>
            );
          })}

          {data.map((row, idx) => {
            if (idx % labelStep !== 0 && idx !== data.length - 1) return null;
            return (
              <text
                key={`x-${idx}`}
                x={getX(idx)}
                y={height - 10}
                textAnchor="middle"
                className="fill-slate-500 text-[10px]"
              >
                {String(row[xKey])}
              </text>
            );
          })}
        </svg>

        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="mt-2 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <span className="font-semibold text-slate-900">
              {String(data[hoveredIdx][xKey])}
            </span>
            {series.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span>{s.label}:</span>
                <strong className="text-slate-900">
                  {valueFormatter(Number(data[hoveredIdx][s.key] || 0))}
                </strong>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface BarItem {
  label: string;
  value: number;
  secondaryValue?: number;
  color?: string;
}

interface BarComparisonChartProps {
  title: string;
  subtitle?: string;
  items: BarItem[];
  valueFormatter?: (val: number) => string;
  emptyMessage?: string;
  barColor?: string;
}

export const BarComparisonChart: React.FC<BarComparisonChartProps> = ({
  title,
  subtitle,
  items,
  valueFormatter = formatIndianNumber,
  emptyMessage = 'No data available for the selected filters.',
  barColor = '#0284c7',
}) => {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-500">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const maxVal = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const pct = Math.min(100, Math.max(0, (item.value / maxVal) * 100));
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-medium text-slate-700" title={item.label}>
                  {item.label}
                </span>
                <span className="ml-2 font-semibold text-slate-900">
                  {valueFormatter(item.value)}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: item.color || barColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutBreakdownChartProps {
  title: string;
  subtitle?: string;
  segments: DonutSegment[];
  valueFormatter?: (val: number) => string;
  centerLabel?: string;
  emptyMessage?: string;
}

export const DonutBreakdownChart: React.FC<DonutBreakdownChartProps> = ({
  title,
  subtitle,
  segments,
  valueFormatter = formatIndianNumber,
  centerLabel = 'Total',
  emptyMessage = 'No records in selected range.',
}) => {
  const nonZero = segments.filter((s) => s.value > 0);
  const total = nonZero.reduce((sum, s) => sum + s.value, 0);

  if (nonZero.length === 0 || total <= 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-500">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="18"
            />
            {nonZero.map((seg) => {
              const frac = seg.value / total;
              const dash = frac * circumference;
              const offset = -cumulative * circumference;
              cumulative += frac;
              return (
                <circle
                  key={seg.label}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="18"
                  strokeDasharray={`${dash} ${circumference}`}
                  strokeDashoffset={offset}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {centerLabel}
            </span>
            <span className="text-sm font-bold text-slate-900">
              {valueFormatter(total)}
            </span>
          </div>
        </div>

        <div className="w-full space-y-2">
          {nonZero.map((seg) => {
            const pct = ((seg.value / total) * 100).toFixed(1);
            return (
              <div key={seg.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-slate-700">{seg.label}</span>
                </div>
                <span className="font-semibold text-slate-900">
                  {valueFormatter(seg.value)} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
