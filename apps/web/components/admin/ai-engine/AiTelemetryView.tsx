'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  getAdminAiTelemetry,
  getAiFailures,
  type AdminAiFailures,
  type AdminAiTelemetry,
} from '@/lib/admin';
import { AiKpis } from './AiKpis';
import { FailuresTable } from './FailuresTable';
import { OperationsBreakdown } from './OperationsBreakdown';
import { RecentOutputs } from './RecentOutputs';
import { ReliabilityDonut, RunsChart } from './RunsChart';

/** AI Engine Telemetry: live pipeline aggregates, outcomes, and failure feed. */
export function AiTelemetryView() {
  const [data, setData] = useState<AdminAiTelemetry | null>(null);
  const [failures, setFailures] = useState<AdminAiFailures | null>(null);
  const [failPage, setFailPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // Aggregates load once; failures pages fetch alone (2 queries, not ~6).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminAiTelemetry(1, 5)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setFailures(res.failures);
        setUpdatedAt(new Date());
      })
      .catch(() => {
        if (!cancelled) setError('Could not load telemetry. Check the API connection and retry.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const firstFailuresRun = React.useRef(true);
  useEffect(() => {
    // The summary already delivers failures page 1 on mount — skip the duplicate.
    if (firstFailuresRun.current) {
      firstFailuresRun.current = false;
      if (failPage === 1) return;
    }
    let cancelled = false;
    getAiFailures(failPage, 5)
      .then((res) => {
        if (!cancelled) setFailures(res);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [failPage, refreshToken]);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);
  const view: AdminAiTelemetry | null =
    data && failures ? { ...data, failures } : data;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 p-5 lg:p-8">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#e8e7f1] px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-[#47464b]">
              Production
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#47464b]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4648d4]" />
              {updatedAt
                ? `Telemetry synced ${updatedAt.toLocaleTimeString('en-US')} `
                : 'Telemetry syncing…'}
            </span>
          </div>
          <h1 className="text-[28px] font-semibold leading-[36px] tracking-[-0.025em] text-[#1a1b22] sm:text-[36px] sm:leading-[44px]">
            AI Engine &amp; Model Telemetry
          </h1>
          <p className="max-w-3xl text-[13px] text-[#47464b]">
            Real-time performance metrics, operation breakdowns, token consumption, and failure
            diagnostics across production generative pipelines.
          </p>
        </div>
        <div className="self-start lg:self-auto">
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[13px] font-medium text-[#1a1b22] shadow-sm transition-colors hover:bg-[#f4f2fd]"
          >
            <span className="material-symbols-outlined text-[18px] text-[#47464b]" aria-hidden="true">
              refresh
            </span>
            Refresh Telemetry
          </button>
        </div>
      </div>

      {loading && !view ? (
        <div aria-busy="true" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading telemetry…</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-white shadow-sm" />
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

      {view ? (
        <>
          <AiKpis data={view} />
          <OperationsBreakdown data={view} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <RunsChart data={view} />
            <ReliabilityDonut data={view} />
          </div>
          <RecentOutputs data={view} />
          <FailuresTable data={view} onPage={setFailPage} />
        </>
      ) : null}
    </div>
  );
}
