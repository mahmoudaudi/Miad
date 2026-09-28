import React from 'react';
import { AdminIcon } from '../AdminIcon';
import type { AdminAnalytics } from '@/lib/admin';

/** AI summary for the range with a real link into AI Engine Telemetry. */
export function AnalyticsAiPanel({ data }: { data: AdminAnalytics }) {
  const stats = [
    { label: 'Generations', value: data.ai.generations.toLocaleString('en-US'), sub: 'Net production runs' },
    { label: 'Refinements', value: data.ai.refinements.toLocaleString('en-US'), sub: 'Edit operations' },
    { label: 'Success Rate', value: `${data.ai.successRate}%`, sub: `${data.ai.successful.toLocaleString('en-US')} resolved` },
    { label: 'Failed', value: data.ai.failed.toLocaleString('en-US'), sub: 'Recorded failures' },
  ];
  return (
    <section className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm lg:col-span-7">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
            AI Performance in Range
          </h2>
          <p className="text-[12px] text-[#47464b]">Generations, refinements, and outcomes.</p>
        </div>
        <AdminIcon icon="neurology" tone="indigo" label="AI performance" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col justify-between rounded-xl border border-[#e3e1ec] bg-[#f4f2fd]/60 p-2.5">
            <span className="text-[11px] uppercase text-[#47464b]">{s.label}</span>
            <span className="my-1 text-[18px] font-semibold text-[#1a1b22]">{s.value}</span>
            <span className="font-mono text-[11px] text-[#47464b]">{s.sub}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f4f2fd] p-3">
        <span className="text-[13px] text-[#1a1b22]">
          Full pipeline telemetry lives on the AI Engine page.
        </span>
        <a
          href="/admin/ai-engine"
          className="font-mono text-[11px] font-medium text-[#4648d4] hover:underline"
        >
          Open AI Engine →
        </a>
      </div>
    </section>
  );
}

/** Device shares from stored deviceType rows plus top invitations by views. */
export function AnalyticsDevicesPanel({ data }: { data: AdminAnalytics }) {
  const total = data.devices.reduce((s, d) => s + d.views, 0);
  const icons: Record<string, string> = { mobile: 'smartphone', desktop: 'laptop_mac', tablet: 'tablet_mac' };
  return (
    <section className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm lg:col-span-5">
      <div>
        <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
          Devices &amp; Top Invitations
        </h2>
        <p className="text-[12px] text-[#47464b]">Recorded viewports and most-viewed invitations.</p>
      </div>
      {total === 0 ? (
        <p className="my-3 rounded-lg bg-[#f4f2fd] p-3 text-[13px] text-[#47464b]">
          No device telemetry recorded in this range.
        </p>
      ) : (
        <div className="my-3 flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-[#eeedf7] p-0.5">
          {data.devices.map((d, i) => (
            <div
              key={d.device}
              title={`${d.device}: ${d.views.toLocaleString('en-US')} views`}
              className="h-full rounded-full"
              style={{
                width: `${(d.views / total) * 100}%`,
                backgroundColor: ['#7d1128', '#1b1b1e', '#c8c5cb', '#4648d4'][i % 4],
              }}
            />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {data.devices.map((d) => (
          <div key={d.device} className="flex items-center justify-between rounded-lg bg-[#f4f2fd]/60 p-2 transition-colors hover:bg-[#f4f2fd]">
            <span className="flex items-center gap-2 text-[13px] font-medium text-[#1a1b22]">
              <span className="material-symbols-outlined text-[18px] text-[#47464b]" aria-hidden="true">
                {icons[d.device] ?? 'devices'}
              </span>
              {d.device}
            </span>
            <span className="font-mono text-[12px] font-semibold">
              {d.views.toLocaleString('en-US')}{' '}
              <span className="font-normal text-[#47464b]">
                ({total === 0 ? 0 : Math.round((d.views / total) * 100)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-1.5 border-t border-[#e3e1ec]/60 pt-3">
        {data.top.length === 0 ? (
          <p className="text-[12px] text-[#47464b]">No viewed invitations in this range.</p>
        ) : (
          data.top.map((t, i) => (
            <div key={t.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 font-mono text-[11px] font-bold text-[#47464b]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="truncate font-medium">{t.title}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-[#47464b]">
                {t.views.toLocaleString('en-US')} views
                <a
                  href={`/invite/${encodeURIComponent(t.slug)}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Preview invitation"
                  className="rounded p-0.5 text-[#4648d4] hover:bg-[#eeedf7]"
                >
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                    open_in_new
                  </span>
                </a>
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
