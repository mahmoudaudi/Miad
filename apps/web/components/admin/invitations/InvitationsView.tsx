'use client';

import { useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  bulkAdminInvitationStatus,
  deleteAdminInvitation,
  downloadInvitationsCsv,
  getAdminInvitationAnalytics,
  getInvitationsSummary,
  getInvitationsTable,
  isAbortError,
  getAdminTopViewed,
  setAdminInvitationStatus,
  type AdminInvitationAnalytics,
  type AdminInvitationItem,
  type AdminInvitationsFilters,
  type AdminInvitationsResponse,
  type AdminInvitationsSummary,
  type AdminInvitationsTable,
  type AdminTopViewedItem,
} from '@/lib/admin';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastProvider';
import { InvitationsKpis } from './InvitationsKpis';
import { InvitationsTable } from './InvitationsTable';
import { LiveInspectorModal } from './LiveInspectorModal';

function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message || fallback;
  return fallback;
}

/** Invitations Directory: live fleet, filters, moderation, and bulk actions. */
export function InvitationsView() {
  const showToast = useToast();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<AdminInvitationsFilters>({
    sort: 'newest',
    page: 1,
    limit: 6,
  });

  // Header search drives the table filter through the URL.
  const appliedSearchRef = React.useRef<string | null>(null);
  const urlSearch = searchParams.get('search')?.trim() ?? '';
  useEffect(() => {
    if (appliedSearchRef.current === urlSearch) return;
    appliedSearchRef.current = urlSearch;
    setFilters((prev) => ({ ...prev, search: urlSearch || undefined, page: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);
  const [summary, setSummary] = useState<AdminInvitationsSummary | null>(null);
  const [table, setTable] = useState<AdminInvitationsTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<AdminInvitationItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [analyticsFor, setAnalyticsFor] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AdminInvitationAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorItems, setInspectorItems] = useState<AdminTopViewedItem[]>([]);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  // Summary (KPIs, event types) loads once — never on table page turns.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getInvitationsSummary()
      .then((res) => {
        if (!cancelled) setSummary(res);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load invitations. Check the API connection and retry.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  // Table page alone (scoped scans instead of full-table ones).
  // The AbortController cancels the in-flight request when filters change
  // mid-flight, so fast typing doesn't pile up pool checkouts server-side.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    getInvitationsTable(filters, controller.signal)
      .then((res) => {
        if (cancelled) return;
        setTable(res);
        // Selection never survives a refetch: ids may have left the page.
        setSelected((prev) => prev.filter((id) => res.items.some((item) => item.id === id)));
      })
      .catch((error: unknown) => {
        if (!cancelled && !isAbortError(error)) showToast('Could not refresh the table.', 'error');
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), refreshToken]);

  const patchFilters = useCallback((patch: Partial<AdminInvitationsFilters>, resetPage = false) => {
    setFilters((prev) => ({ ...prev, ...patch, ...(resetPage ? { page: 1 } : {}) }));
  }, []);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  async function togglePublish(item: AdminInvitationItem) {
    const next = item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setBusyId(item.id);
    try {
      await setAdminInvitationStatus(item.id, next);
      showToast(next === 'PUBLISHED' ? 'Invitation published.' : 'Invitation unpublished.', 'success');
      refresh();
    } catch (err) {
      showToast(friendlyError(err, 'Status change failed.'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: AdminInvitationItem) {
    setBusyId(item.id);
    try {
      await deleteAdminInvitation(item.id);
      showToast('Invitation deleted.', 'success');
      setConfirmDelete(null);
      refresh();
    } catch (err) {
      showToast(friendlyError(err, 'Delete failed.'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function bulkStatus(status: 'PUBLISHED' | 'DRAFT') {
    if (selected.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await bulkAdminInvitationStatus(selected, status);
      showToast(
        res.updated === res.total
          ? `${res.updated} invitations ${status === 'PUBLISHED' ? 'published' : 'unpublished'}.`
          : `${res.updated} of ${res.total} updated (designless drafts skip publishing).`,
        res.updated === res.total ? 'success' : 'error'
      );
      setSelected([]);
      refresh();
    } catch {
      showToast('Bulk update failed.', 'error');
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleAnalytics(item: AdminInvitationItem) {
    if (analyticsFor === item.id) {
      setAnalyticsFor(null);
      setAnalyticsData(null);
      return;
    }
    setAnalyticsFor(item.id);
    setAnalyticsData(null);
    setAnalyticsLoading(true);
    getAdminInvitationAnalytics(item.id)
      .then(setAnalyticsData)
      .catch(() => setAnalyticsData(null))
      .finally(() => setAnalyticsLoading(false));
  }

  function openInspector() {
    setInspectorOpen(true);
    setInspectorLoading(true);
    getAdminTopViewed()
      .then(setInspectorItems)
      .catch(() => setInspectorItems([]))
      .finally(() => setInspectorLoading(false));
  }

  const data: AdminInvitationsResponse | null =
    summary && table ? { ...summary, table } : null;
  const publishedRate = summary?.kpis.publishedRate ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 p-5 lg:p-8">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[#47464b]">
            <span>Directory Index</span>
            <span>•</span>
            <span className="font-semibold text-[#7d1128]">Active Fleet {publishedRate}%</span>
          </div>
          <h1 className="text-[24px] font-semibold leading-[32px] tracking-[-0.025em] text-[#1a1b22]">
            Invitations Directory
          </h1>
          <p className="max-w-2xl text-[13px] text-[#47464b]">
            Manage event websites generated by platform users, review deployment status and RSVP
            traffic.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={openInspector}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#7d1128] px-3 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#670e21]"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              visibility
            </span>
            Live Event Inspector
          </button>
        </div>
      </div>

      {loading && !summary ? (
        <div aria-busy="true" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading invitations…</span>
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
          <InvitationsKpis data={data} />
          <InvitationsTable
            data={data}
            filters={filters}
            onFiltersChange={patchFilters}
            selected={selected}
            onToggleSelect={(id) =>
              setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
            }
            onToggleSelectAll={() => {
              const pageIds = data.table.items.map((i) => i.id);
              setSelected((prev) =>
                pageIds.every((id) => prev.includes(id))
                  ? prev.filter((id) => !pageIds.includes(id))
                  : [...new Set([...prev, ...pageIds])]
              );
            }}
            onClearSelection={() => setSelected([])}
            onBulkPublish={() => bulkStatus('PUBLISHED')}
            onBulkUnpublish={() => bulkStatus('DRAFT')}
            onExportSelected={() =>
              downloadInvitationsCsv(data.table.items.filter((i) => selected.includes(i.id)))
            }
            onTogglePublish={togglePublish}
            onDelete={setConfirmDelete}
            analyticsFor={analyticsFor}
            analyticsData={analyticsData}
            analyticsLoading={analyticsLoading}
            onToggleAnalytics={toggleAnalytics}
            busyId={busyId || (bulkBusy ? '__bulk__' : null)}
          />
        </>
      ) : null}

      {inspectorOpen ? (
        <LiveInspectorModal
          items={inspectorItems}
          loading={inspectorLoading}
          onClose={() => setInspectorOpen(false)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete invitation?"
          message={`"${confirmDelete.title}" and its designs, guests, RSVPs, views, and AI history will be permanently deleted.`}
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
