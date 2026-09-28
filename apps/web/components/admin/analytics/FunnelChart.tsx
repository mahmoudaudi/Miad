import React, { useMemo } from 'react';
import { formatCompact, type AdminAnalytics } from '@/lib/admin';

const W = 760;
const H = 180;
const PAD = 8;

/** Created / published / viewed daily lines from live range buckets. */
export function FunnelChart({ data }: { data: AdminAnalytics }) {
  const { daily } = data;
  const chart = useMemo(() => {
    const n = daily.length;
    const max = Math.max(
      1,
      ...daily.map((d) => Math.max(d.created, d.published, d.views))
    );
    const x = (i: number) => (n <= 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1));
    const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2 - 10);
    const line = (pick: (d: (typeof daily)[number]) => number) =>
      daily.map((d, i) => `${x(i).toFixed(1)},${y(pick(d)).toFixed(1)}`).join(' ');
    return { created: line((d) => d.created), published: line((d) => d.published), views: line((d) => d.views), max };
  }, [daily]);

  const ticks = [1, 0.5, 0].map((f) => ({
    value: Math.round(chart.max * f),
    y: PAD + 10 + (1 - f) * (H - PAD * 2 - 10),
  }));

  const stats: Array<{ label: string; value: string; sub: string }> = [
    {
      label: 'Created',
      value: data.funnel.created.toLocaleString('en-US'),
      sub: '100% drafted',
    },
    {
      label: 'Published',
      value: data.funnel.published.toLocaleString('en-US'),
      sub:
        data.funnel.created > 0
          ? `${Math.round((data.funnel.published / data.funnel.created) * 1000) / 10}% conversion`
          : 'no creations',
    },
    {
      label: 'Opened',
      value: formatCompact(data.funnel.opened),
      sub:
        data.funnel.published > 0
          ? `${Math.round((data.funnel.opened / data.funnel.published) * 100) / 10} views/invite`
          : 'no published',
    },
  ];

  return (
    <section className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm lg:col-span-8">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
              Invitations Lifecycle Telemetry
            </h2>
            <span className="rounded bg-[#e8e7f1] px-2 py-0.5 font-mono text-[10px] uppercase text-[#47464b]">
              Full Funnel
            </span>
          </div>
          <p className="text-[12px] text-[#47464b]">
            Creation, publishing velocity, and opened views per day.
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-[#47464b]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#7d1128]" />
            Created ({data.funnel.created.toLocaleString('en-US')})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#4648d4]" />
            Published ({data.funnel.published.toLocaleString('en-US')})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#9ca3af]" />
            Opened ({formatCompact(data.funnel.opened)})
          </span>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-[#f4f2fd] p-2">
            <span className="block text-[11px] uppercase text-[#47464b]">{s.label}</span>
            <span className="text-[18px] font-semibold text-[#1a1b22]">{s.value}</span>
            <span className="block font-mono text-[10px] text-[#47464b]">{s.sub}</span>
          </div>
        ))}
      </div>

      <div className="relative h-56 w-full">
        <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <linearGradient id="analytics-created" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7d1128" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#7d1128" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t.y}>
              <line stroke="#dad9e3" strokeDasharray="3 3" strokeWidth="0.8" x1="0" x2={W} y1={t.y} y2={t.y} />
              <text fill="#77767b" fontFamily="JetBrains Mono" fontSize="10" x="2" y={t.y - 3}>
                {formatCompact(t.value)}
              </text>
            </g>
          ))}
          <polygon fill="url(#analytics-created)" points={`${chart.created} ${W},${H - PAD} ${PAD},${H - PAD}`} />
          <polyline fill="none" points={chart.created} stroke="#7d1128" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          <polyline fill="none" points={chart.published} stroke="#4648d4" strokeLinecap="round" strokeWidth="2" />
          <polyline fill="none" points={chart.views} stroke="#9ca3af" strokeDasharray="3 3" strokeLinecap="round" strokeWidth="2" />
        </svg>
      </div>
      <div className="flex items-center justify-between border-t border-[#e3e1ec]/60 pt-2 font-mono text-[11px] text-[#47464b]">
        <span>{data.daily[0]?.day.slice(0, 10) ?? ''}</span>
        <span>{data.range.label}</span>
        <span>{data.daily[data.daily.length - 1]?.day.slice(0, 10) ?? ''}</span>
      </div>
    </section>
  );
}
