'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  deleteCommunityDesign,
  downloadCommunityCsv,
  getCommunitySummary,
  getCommunityTable,
  setCommunityPublication,
  type AdminCommunity,
  type AdminCommunityFilters,
  type AdminCommunityItem,
  type AdminCommunitySummary,
  type AdminCommunityTable,
} from '@/lib/admin';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastProvider';
import { CommunityKpis } from './CommunityKpis';
import { CommunityTable } from './CommunityTable';

function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message || fallback;
  return fallback;
}

/** Community Moderation: live showcase directory with publish controls. */
export function CommunityView() {
  const showToast = useToast();
  const [filters, setFilters] = useState<AdminCommunityFilters>({
    sort: 'newest',
    page: 1,
    limit: 6,
  });
  const [summary, setSummary] = useState<AdminCommunitySummary | null>(null);
  const [table, setTable] = useState<AdminCommunityTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<AdminCommunityItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Summary (KPIs, categories) loads once — never on table page turns.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCommunitySummary()
      .then((res) => {
        if (!cancelled) setSummary(res);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load community designs. Check the API connection and retry.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  // Table page alone (1 scoped query instead of ~6).
  useEffect(() => {
    let cancelled = false;
    getCommunityTable(filters)
      .then((res) => {
        if (!cancelled) setTable(res);
      })
      .catch(() => {
        if (!cancelled) showToast('Could not refresh the table.', 'error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), refreshToken]);

  const patchFilters = useCallback((patch: Partial<AdminCommunityFilters>, resetPage = false) => {
    setFilters((prev) => ({ ...prev, ...patch, ...(resetPage ? { page: 1 } : {}) }));
  }, []);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  const data: AdminCommunity | null =
    summary && table ? { ...summary, table } : null;

  async function togglePublication(item: AdminCommunityItem) {
    setBusyId(item.id);
    try {
      await setCommunityPublication(item.id, !item.isPublished);
      showToast(item.isPublished ? 'Design hidden from showcase.' : 'Design published.', 'success');
      refresh();
    } catch (err) {
      showToast(friendlyError(err, 'Status change failed.'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: AdminCommunityItem) {
    setBusyId(item.id);
    try {
      await deleteCommunityDesign(item.id);
      showToast('Showcase row deleted.', 'success');
      setConfirmDelete(null);
      refresh();
    } catch (err) {
      showToast(friendlyError(err, 'Delete failed.'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 p-5 lg:p-8">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#e8e7f1] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#47464b]">
              Governance Console
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-[#4648d4]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4648d4]" />
              Live Showcase Data
            </span>
          </div>
          <h1 className="text-[24px] font-semibold leading-[32px] tracking-[-0.025em] text-[#1a1b22]">
            Community Moderation
          </h1>
          <p className="text-[13px] text-[#47464b]">
            Curate public invitation designs: review the showcase, hide unsuitable rows, and
            monitor engagement.
          </p>
        </div>
        <div className="self-start lg:self-auto">
          <button
            type="button"
            onClick={() => table && downloadCommunityCsv(table.items)}
            disabled={!table || table.items.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-[#1a1b22] shadow-sm transition-colors hover:bg-[#f4f2fd] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[17px] text-[#47464b]" aria-hidden="true">
              download
            </span>
            Export CSV
          </button>
        </div>
      </div>

      {loading && !summary ? (
        <div aria-busy="true" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading community…</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <CommunityKpis data={data} />
          <CommunityTable
            data={data}
            filters={filters}
            onFiltersChange={patchFilters}
            onTogglePublication={togglePublication}
            onDelete={setConfirmDelete}
            busyId={busyId}
          />
        </>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete showcase row?"
          message={`"${confirmDelete.title}" will be removed from the community showcase. The source invitation is untouched.`}
          confirmLabel="Delete"
          danger
          busy={busyId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete)}
        />
      ) : null}
    </div>
  );
}
