import React from 'react';
import type { AdminAiTelemetry } from '@/lib/admin';

/** 30-day stacked bars of successful vs failed runs (real daily buckets). */
export function RunsChart({ data }: { data: AdminAiTelemetry }) {
  const max = Math.max(1, ...data.daily.map((d) => d.successful + d.failed));
  return (
    <section className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm lg:col-span-7">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
            Runs &amp; Outcomes
          </h2>
          <p className="text-[12px] text-[#47464b]">Daily successful vs failed runs, last 30 days.</p>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-[#47464b]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#7d1128]" />
            Successful
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#ba1a1a]" />
            Failed
          </span>
        </div>
      </div>
      <div className="flex h-56 items-end gap-1 pt-4" role="img" aria-label="Daily AI runs chart">
        {data.daily.map((d) => {
          const successPct = ((d.successful / max) * 100).toFixed(1);
          const failedPct = ((d.failed / max) * 100).toFixed(1);
          const label = new Date(d.day).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
          return (
            <div
              key={d.day}
              title={`${label}: ${d.successful} successful, ${d.failed} failed`}
              className="flex min-w-0 flex-1 flex-col justify-end self-stretch"
            >
              <div className="flex w-full flex-1 flex-col justify-end gap-px">
                <div className="w-full rounded-sm bg-[#ba1a1a]/70" style={{ height: `${failedPct}%` }} />
                <div className="w-full rounded-sm bg-[#7d1128]" style={{ height: `${successPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-2 font-mono text-[10px] text-[#47464b]">
        <span>30 days ago</span>
        <span>Today</span>
      </div>
    </section>
  );
}

/** Outcome donut: resolved vs failed runs (the SaaS tracks no retry stages). */
export function ReliabilityDonut({ data }: { data: AdminAiTelemetry }) {
  const { kpis } = data;
  const total = Math.max(1, kpis.successful + kpis.failed);
  const circumference = 2 * Math.PI * 40;
  const resolvedLen = (kpis.successful / total) * circumference;
  return (
    <section className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm lg:col-span-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
            Reliability
          </h2>
          <p className="text-[12px] text-[#47464b]">Compilation outcome distribution.</p>
        </div>
        <span className="rounded bg-[#eeedf7] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#1a1b22]">
          Realtime
        </span>
      </div>
      <div className="flex items-center justify-center gap-6 py-2">
        <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" fill="none" r="40" stroke="#f4f2fd" strokeWidth="12" />
            <circle
              cx="50"
              cy="50"
              fill="none"
              r="40"
              stroke="#7d1128"
              strokeDasharray={`${resolvedLen.toFixed(1)} ${circumference.toFixed(1)}`}
              strokeWidth="12"
            />
            <circle
              cx="50"
              cy="50"
              fill="none"
              r="40"
              stroke="#ba1a1a"
              strokeDasharray={`${(circumference - resolvedLen).toFixed(1)} ${circumference.toFixed(1)}`}
              strokeDashoffset={(-resolvedLen).toFixed(1)}
              strokeWidth="12"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[18px] font-semibold leading-none text-[#1a1b22]">
              {kpis.successRate}%
            </span>
            <span className="mt-0.5 font-mono text-[10px] text-[#47464b]">Resolved</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="flex items-center gap-1.5 font-medium text-[#1a1b22]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#7d1128]" />
                Resolved Runs
              </span>
              <span className="font-semibold text-[#1a1b22]">
                {kpis.successful.toLocaleString('en-US')}
              </span>
            </div>
            <p className="pl-3.5 text-[10px] text-[#47464b]">Recorded SUCCEEDED outcomes</p>
          </div>
          <div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="flex items-center gap-1.5 font-medium text-[#1a1b22]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#ba1a1a]" />
                Failed Runs
              </span>
              <span className="font-semibold text-[#ba1a1a]">
                {kpis.failed.toLocaleString('en-US')}
              </span>
            </div>
            <p className="pl-3.5 text-[10px] text-[#47464b]">Recorded FAILED outcomes</p>
          </div>
        </div>
      </div>
    </section>
  );
}
