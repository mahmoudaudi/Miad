import React, { useMemo } from 'react';
import { formatCompact, type AdminOverview } from '@/lib/admin';

const W = 1000;
const H = 240;
const X0 = 40;
const X1 = 980;
const Y0 = 20;
const Y1 = 200;

type Pt = { x: number; y: number };

function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  const first = pts[0];
  if (!first || pts.length === 1) return first ? `M ${first.x} ${first.y}` : '';
  let d = `M ${first.x} ${first.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)] ?? pts[i] ?? first;
    const p1 = pts[i] ?? first;
    const p2 = pts[i + 1] ?? first;
    const p3 = pts[Math.min(pts.length - 1, i + 2)] ?? first;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function hourLabel(iso: string): string {
  return `${new Date(iso).getUTCHours().toString().padStart(2, '0')}:00`;
}

/**
 * Platform activity chart. The series is the last 24h of ai_usage rows
 * bucketed by hour — successful vs failed runs. Metric tabs other than AI
 * Usage unlock with the Analytics page.
 */
export function ActivityChart({ overview }: { overview: AdminOverview }) {
  const { series } = overview;

  const chart = useMemo(() => {
    const n = series.length;
    const max = Math.max(1, ...series.map((p) => p.successful));
    const x = (i: number) => (n <= 1 ? (X0 + X1) / 2 : X0 + (i * (X1 - X0)) / (n - 1));
    const y = (v: number) => Y1 - (v / max) * (Y1 - Y0);
    const successPts = series.map((p, i) => ({ x: x(i), y: y(p.successful) }));
    const failMax = Math.max(1, ...series.map((p) => p.failed));
    const failPts = series.map((p, i) => ({
      x: x(i),
      y: Y1 - (p.failed / failMax) * (Y1 - Y0) * 0.25,
    }));
    const peak = series.reduce(
      (best, p, i) => (p.successful > (series[best]?.successful ?? -1) ? i : best),
      0
    );
    return { max, successPts, failPts, peak, successLine: smoothPath(successPts), failLine: smoothPath(failPts) };
  }, [series]);

  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => ({
    value: Math.round(chart.max * f),
    y: Y1 - f * (Y1 - Y0),
  }));

  const runs24h = series.reduce((s, p) => s + p.successful + p.failed, 0);
  const success24h = series.reduce((s, p) => s + p.successful, 0);
  const rate24h = runs24h === 0 ? 0 : Math.round((success24h / runs24h) * 1000) / 10;
  const peakPoint = series[chart.peak];
  const peakX = chart.successPts[chart.peak]?.x ?? X0;

  const subRow: Array<{ label: string; value: string; accent?: boolean }> = [
    { label: 'New Users (24h)', value: overview.users.newLast24h.toLocaleString('en-US') },
    { label: 'AI Runs (24h)', value: runs24h.toLocaleString('en-US') },
    { label: 'AI Success (24h)', value: `${rate24h}%`, accent: true },
    {
      label: 'Total RSVPs',
      value: formatCompact(overview.rsvps.total),
    },
  ];

  return (
    <section className="space-y-5 rounded-xl bg-white p-5 shadow-sm lg:p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
              Platform Activity &amp; Velocity
            </h2>
            <span className="rounded bg-[#eeedf7] px-2 py-0.5 font-mono text-[11px] text-[#47464b]">
              Real-time Telemetry
            </span>
          </div>
          <p className="text-[12px] leading-[16px] text-[#47464b]">
            Successful vs failed AI runs per hour, last 24 hours.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-white px-2.5 py-1 text-[12px] font-medium text-[#1a1b22] shadow-sm">
            AI Usage
          </span>
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#f4f2fd] px-2.5 py-1 font-mono text-[11px] text-[#1a1b22]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7d1128]" />
            Live stream
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#f4f2fd] p-3 sm:grid-cols-4">
        {subRow.map((cell) => (
          <div key={cell.label}>
            <span className="block text-[11px] font-medium uppercase tracking-wider text-[#47464b]">
              {cell.label}
            </span>
            <span
              className={`font-mono text-[16px] font-semibold ${cell.accent ? 'text-[#005236]' : 'text-[#1a1b22]'}`}
            >
              {cell.value}
            </span>
          </div>
        ))}
      </div>

      <div className="relative h-64 w-full select-none lg:h-72">
        <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <linearGradient id="admin-gradient-success" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7d1128" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#7d1128" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="admin-gradient-fail" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ba1a1a" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ba1a1a" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <line
              key={t.y}
              stroke="#dad9e3"
              strokeDasharray={t.value === 0 ? undefined : '3 3'}
              strokeWidth="0.8"
              x1={X0}
              x2={X1}
              y1={t.y}
              y2={t.y}
            />
          ))}
          {ticks.map((t) => (
            <text key={`t-${t.y}`} fill="#77767b" fontFamily="JetBrains Mono" fontSize="10" x="10" y={t.y + 4}>
              {formatCompact(t.value)}
            </text>
          ))}
          <path d={`${chart.failLine} L ${X1} ${Y1} L ${X0} ${Y1} Z`} fill="url(#admin-gradient-fail)" />
          <path d={chart.failLine} fill="none" stroke="#ba1a1a" strokeLinecap="round" strokeWidth="1.8" />
          <path d={`${chart.successLine} L ${X1} ${Y1} L ${X0} ${Y1} Z`} fill="url(#admin-gradient-success)" />
          <path d={chart.successLine} fill="none" stroke="#7d1128" strokeLinecap="round" strokeWidth="2.5" />
          {series.map((p, i) =>
            i % 4 === 0 || i === series.length - 1 ? (
              <text
                key={p.hour}
                fill="#77767b"
                fontFamily="JetBrains Mono"
                fontSize="10"
                x={X0 + (i * (X1 - X0)) / Math.max(1, series.length - 1)}
                y={H - 18}
              >
                {i === series.length - 1 ? 'Now' : hourLabel(p.hour)}
              </text>
            ) : null
          )}
          {peakPoint && (peakPoint.successful > 0 || peakPoint.failed > 0) ? (
            <g>
              <line stroke="#7d1128" strokeDasharray="2 2" strokeWidth="1.2" x1={peakX} x2={peakX} y1={Y0} y2={Y1} />
              <circle cx={peakX} cy={chart.successPts[chart.peak]?.y ?? Y1} fill="#7d1128" r="5" stroke="#ffffff" strokeWidth="2" />
            </g>
          ) : null}
        </svg>
        {peakPoint && (peakPoint.successful > 0 || peakPoint.failed > 0) ? (
          <div
            className="pointer-events-none absolute top-2 rounded-lg bg-white p-2.5 shadow-md"
            style={{ left: `min(${((peakX / W) * 100).toFixed(1)}%, 62%)` }}
          >
            <div className="mb-1 flex items-center justify-between gap-3 font-mono text-[11px]">
              <span className="font-semibold text-[#1a1b22]">{hourLabel(peakPoint.hour)} Peak</span>
              <span className="text-[#47464b]">Today</span>
            </div>
            <div className="flex items-center gap-3 text-[13px] font-medium">
              <span className="flex items-center gap-1 text-[#7d1128]">
                <span className="h-2 w-2 rounded-full bg-[#7d1128]" />
                {peakPoint.successful} Successful
              </span>
              <span className="flex items-center gap-1 text-[#ba1a1a]">
                <span className="h-2 w-2 rounded-full bg-[#ba1a1a]" />
                {peakPoint.failed} Failed
              </span>
            </div>
          </div>
        ) : (
          <p className="pointer-events-none absolute inset-x-0 top-2 text-center text-[12px] text-[#47464b]">
            No AI runs in the last 24 hours.
          </p>
        )}
      </div>
    </section>
  );
}
