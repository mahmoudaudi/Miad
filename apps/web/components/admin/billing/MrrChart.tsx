import React from 'react';
import { formatMoney, type AdminBilling } from '@/lib/admin';

const TIER_COLORS = ['#7d1128', '#a32742', '#b88a57', '#4648d4', '#005236', '#77767b'];

/** Six-month MRR bars derived from real subscription windows. */
export function MrrChart({ data }: { data: AdminBilling }) {
  const max = Math.max(1, ...data.monthly.map((m) => m.mrr));
  return (
    <section className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm lg:col-span-8">
      <div className="flex flex-col justify-between gap-2 pb-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
            MRR Trajectory
          </h2>
          <p className="text-[12px] text-[#47464b]">
            Monthly recurring revenue from subscriptions active in each month.
          </p>
        </div>
        <span className="self-start rounded bg-[#eeedf7] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-[#4648d4] md:self-auto">
          Past 6 Months
        </span>
      </div>
      <div className="flex h-56 items-end gap-3 pt-3" role="img" aria-label="Monthly MRR chart">
        {data.monthly.map((m) => {
          const label = new Date(m.month).toLocaleDateString('en-US', { month: 'short' });
          return (
            <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1 self-stretch">
              <div className="flex w-full max-w-10 flex-1 items-end">
                <div
                  title={`${label}: ${formatMoney(m.mrr, data.kpis.currency)} MRR`}
                  className="w-full rounded bg-[#7d1128]"
                  style={{ height: `${Math.max(2, (m.mrr / max) * 100)}%` }}
                />
              </div>
              <span className="font-mono text-[11px] text-[#47464b]">{label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Revenue share by tier from live plan MRR (no payment-method data exists). */
export function RevenueShare({ data }: { data: AdminBilling }) {
  const total = data.tiers.reduce((s, t) => s + t.mrr, 0);
  const circumference = 2 * Math.PI * 15.9155;
  let offset = 0;
  const segments = data.tiers.map((tier, i) => {
    const frac = total > 0 ? tier.mrr / total : 0;
    const seg = { ...tier, dash: frac * 100, offset: -offset, color: TIER_COLORS[i % TIER_COLORS.length] };
    offset += frac * 100;
    return seg;
  });
  return (
    <section className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm lg:col-span-4">
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
          Revenue Share by Tier
        </h2>
        <span className="material-symbols-outlined text-[18px] text-[#47464b]" aria-hidden="true">
          pie_chart
        </span>
      </div>
      {total === 0 ? (
        <p className="rounded-lg bg-[#f4f2fd] p-4 text-center text-[13px] text-[#47464b]">
          No recurring revenue yet — shares appear once subscriptions exist.
        </p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#eeedf7"
                strokeWidth="3.5"
              />
              {segments.map((s) => (
                <path
                  key={s.plan}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={s.color}
                  strokeDasharray={`${s.dash}, 100`}
                  strokeDashoffset={`${s.offset}`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                />
              ))}
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-mono text-[12px] font-bold text-[#1a1b22]">
                {formatMoney(total, data.kpis.currency)}
              </span>
              <span className="text-[9px] uppercase text-[#47464b]">MRR</span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px]">
            {segments.map((s) => (
              <div key={s.plan} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 truncate text-[#1a1b22]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.plan}
                </span>
                <span className="shrink-0 font-mono text-[11px] font-medium text-[#1a1b22]">
                  {total === 0 ? 0 : Math.round((s.mrr / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
