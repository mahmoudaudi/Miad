'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { useAdminSession } from '../AdminShell';
import {
  downloadGenerationsCsv,
  getAdminOverview,
  getOverviewGenerations,
  isAbortError,
  type AdminGenerations,
  type AdminOverview,
  type AdminOverviewSummary,
} from '@/lib/admin';
import { ActivityChart } from './ActivityChart';
import { RecentActivity, SystemHealth } from './ActivityAndHealth';
import { GenerationsTable } from './GenerationsTable';
import { AiStrip, KpiCards } from './StatsCards';
import { WelcomeBar } from './WelcomeBar';

function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading overview…</span>
      <div className="h-16 animate-pulse rounded-xl bg-white shadow-sm" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-white shadow-sm" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl bg-white shadow-sm" />
    </div>
  );
}

/**
 * Admin overview. Single API call for summary + first page of generations.
 * Subsequent page turns use the dedicated generations endpoint.
 */
export function OverviewView() {
  const session = useAdminSession();
  const showToast = useToast();
  const [summary, setSummary] = useState<AdminOverviewSummary | null>(null);
  const [generations, setGenerations] = useState<AdminGenerations | null>(null);
  const [page, setPage] = useState(1);
  const [retryToken, setRetryToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  // Load summary + first page of generations in a single request
  useEffect(() => {
    let cancelled = false;
    setError(null);
    const started = performance.now();
    // Fetch full overview with first page of generations (limit=6)
    getAdminOverview(1, 6)
      .then((data: AdminOverview) => {
        if (cancelled) return;
        const { generations: firstPage, ...rest } = data;
        setSummary(rest);
        setGenerations(firstPage);
        setLatencyMs(performance.now() - started);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the overview. Check the API connection and retry.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  // Page turns after the first use the dedicated generations endpoint.
  // Page 1 is already embedded in the summary response above — refetching
  // it here would duplicate that request on every overview load.
  useEffect(() => {
    if (page === 1) {
      setLoadingTable(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoadingTable(true);
    getOverviewGenerations(page, 6, controller.signal)
      .then((data) => {
        if (!cancelled) setGenerations(data);
      })
      .catch((error: unknown) => {
        if (!cancelled && !isAbortError(error)) showToast('Could not refresh the table.', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoadingTable(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, retryToken, showToast]);

  const onExport = useCallback(() => {
    const items = generations?.items ?? [];
    if (items.length > 0) downloadGenerationsCsv(items);
  }, [generations]);

  const overview: AdminOverview | null =
    summary && generations ? { ...summary, generations } : null;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-5 lg:p-8">
      <WelcomeBar
        firstName={session.firstName || 'Admin'}
        canExport={(generations?.items.length ?? 0) > 0}
        onExport={onExport}
      />
      {loading && !summary ? <OverviewSkeleton /> : null}
      {error ? (
        <div role="alert" className="rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="text-[14px] font-medium text-[#93000a]">{error}</p>
          <button
            type="button"
            onClick={() => setRetryToken((t) => t + 1)}
            className="mt-3 rounded-lg bg-[#7d1128] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#670e21]"
          >
            Retry
          </button>
        </div>
      ) : null}
      {overview ? (
        <>
          <div className="space-y-3">
            <KpiCards overview={overview} />
            <AiStrip overview={overview} />
          </div>
          <ActivityChart overview={overview} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <RecentActivity items={overview.activity} />
            <SystemHealth overview={overview} latencyMs={latencyMs} />
          </div>
          <div aria-busy={loadingTable} className={loadingTable ? 'opacity-70' : undefined}>
            <GenerationsTable
              items={overview.generations.items}
              page={overview.generations.page}
              totalPages={overview.generations.totalPages}
              total={overview.generations.total}
              limit={overview.generations.limit}
              onPage={setPage}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}