'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  downloadAnalyticsCsv,
  getAdminAnalytics,
  type AdminAnalytics,
  type AdminAnalyticsParams,
} from '@/lib/admin';
import { AnalyticsKpis } from './AnalyticsKpis';
import { AnalyticsAiPanel, AnalyticsDevicesPanel } from './AnalyticsPanels';
import { FunnelChart } from './FunnelChart';
import { RsvpDonut } from './RsvpDonut';

type Preset = '7d' | '30d' | '90d' | 'custom';

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Platform Analytics: range-aware engagement, funnel, RSVP, AI, and devices. */
export function AnalyticsView() {
  const [preset, setPreset] = useState<Preset>('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const params: AdminAnalyticsParams =
    preset === 'custom' && from && to
      ? { from: new Date(`${from}T00:00:00Z`).toISOString(), to: new Date(`${to}T00:00:00Z`).toISOString() }
      : { range: preset === 'custom' ? '30d' : preset };

  useEffect(() => {
    if (preset === 'custom' && (!from || !to)) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminAnalytics(params)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setUpdatedAt(new Date());
      })
      .catch(() => {
        if (!cancelled) setError('Could not load analytics. Check the API connection and retry.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params), refreshToken]);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);
  const presets: Array<{ key: Preset; label: string }> = [
    { key: '7d', label: 'Last 7 Days' },
    { key: '30d', label: 'Last 30 Days' },
    { key: '90d', label: 'Last 90 Days' },
    { key: 'custom', label: 'Custom Range' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 p-5 lg:p-8">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div className="flex max-w-2xl flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#eeedf7] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#4648d4]">
              Metrics Engine
            </span>
            <span className="font-mono text-[11px] text-[#47464b]">
              {updatedAt ? `Synced ${updatedAt.toLocaleTimeString('en-US')}` : 'Syncing…'}
            </span>
          </div>
          <h1 className="text-[36px] font-semibold leading-[44px] tracking-[-0.035em] text-[#1a1b22]">
            Platform Analytics
          </h1>
          <p className="text-[13px] text-[#47464b]">
            User engagement, invitation generation velocity, RSVP conversions, and traffic trends —
            all from stored platform data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl bg-white p-1 shadow-sm">
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                aria-pressed={preset === p.key}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  preset === p.key
                    ? 'bg-[#7d1128] text-white shadow-sm'
                    : 'text-[#47464b] hover:text-[#1a1b22]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => data && downloadAnalyticsCsv(data)}
            disabled={!data || data.daily.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#7d1128] px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#670e21] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              file_download
            </span>
            Export Dataset
          </button>
        </div>
      </div>

      {preset === 'custom' ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-sm">
          <label className="flex items-center gap-1.5 text-[13px] text-[#47464b]">
            From
            <input
              type="date"
              value={from}
              max={toInputDate(new Date())}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 rounded-lg border border-[#c8c5cb] bg-white px-2 text-[13px] text-[#1a1b22] focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[13px] text-[#47464b]">
            To
            <input
              type="date"
              value={to}
              max={toInputDate(new Date())}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 rounded-lg border border-[#c8c5cb] bg-white px-2 text-[13px] text-[#1a1b22] focus:outline-none"
            />
          </label>
          {from && to && from >= to ? (
            <span className="text-[12px] font-medium text-[#93000a]">
              Pick an end date after the start date.
            </span>
          ) : null}
        </div>
      ) : null}

      {loading && !data ? (
        <div aria-busy="true" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading analytics…</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-white shadow-sm" />
            ))}
          </div>
          <div className="h-96 animate-pulse rounded-xl bg-white shadow-sm" />
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="text-[14px] font-medium text-[#93000a]">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-3 rounded-lg bg-[#7d1128] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#670e21]"
          >
            Retry
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <AnalyticsKpis data={data} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <FunnelChart data={data} />
            <RsvpDonut data={data} />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <AnalyticsAiPanel data={data} />
            <AnalyticsDevicesPanel data={data} />
          </div>
        </>
      ) : null}
    </div>
  );
}
