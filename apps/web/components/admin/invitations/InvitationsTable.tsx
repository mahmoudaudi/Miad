'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AdminIcon } from '../AdminIcon';
import {
  downloadInvitationsCsv,
  initialsOf,
  type AdminInvitationAnalytics,
  type AdminInvitationItem,
  type AdminInvitationsFilters,
  type AdminInvitationsResponse,
} from '@/lib/admin';

function eventIcon(eventType: string): string {
  const t = eventType.toLowerCase();
  if (t.includes('wedding')) return 'favorite';
  if (t.includes('birthday')) return 'cake';
  if (t.includes('corporate') || t.includes('business') || t.includes('summit')) return 'business';
  if (t.includes('baby') || t.includes('shower')) return 'child_care';
  if (t.includes('graduation') || t.includes('school') || t.includes('class')) return 'school';
  if (t.includes('anniversary')) return 'loyalty';
  if (t.includes('dinner')) return 'dinner_dining';
  return 'celebration';
}

function StatusPill({ status }: { status: 'PUBLISHED' | 'DRAFT' }) {
  return status === 'PUBLISHED' ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f2fd] px-2 py-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-[#005236]" />
      <span className="font-mono text-[11px] font-medium text-[#1a1b22]">Published</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eeedf7] px-2 py-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-[#c8c5cb]" />
      <span className="font-mono text-[11px] font-medium text-[#47464b]">Draft</span>
    </span>
  );
}

function ActionButton({
  title,
  icon,
  onClick,
  disabled,
  danger,
}: {
  title: string;
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? 'text-[#47464b] hover:bg-[#ffdad6]/40 hover:text-[#ba1a1a]'
          : 'text-[#47464b] hover:bg-[#eeedf7] hover:text-[#1a1b22]'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}

function AnalyticsDetail({
  data,
  loading,
}: {
  data: AdminInvitationAnalytics | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex gap-2 py-1" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading analytics…</span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 w-28 animate-pulse rounded-lg bg-[#eeedf7]" />
        ))}
      </div>
    );
  }
  if (!data) {
    return <p className="py-1 text-[12px] text-[#ba1a1a]">Could not load analytics.</p>;
  }
  const cells: Array<[string, string]> = [
    ['Views', data.views.toLocaleString('en-US')],
    ['Unique visitors', data.uniqueVisitors.toLocaleString('en-US')],
    ['RSVP responses', data.rsvps.toLocaleString('en-US')],
    ['Attending', data.attending.toLocaleString('en-US')],
    ['Not attending', data.notAttending.toLocaleString('en-US')],
    ['Pending', data.pending.toLocaleString('en-US')],
    ['Attending guests', data.attendingGuests.toLocaleString('en-US')],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4 lg:grid-cols-7">
      {cells.map(([label, value]) => (
        <div key={label}>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-[#47464b]">{label}</dt>
          <dd className="font-mono text-[13px] font-semibold text-[#1a1b22]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Invitations directory table. Status tabs, search, category, and date
 * filters are server-side. Preview, analytics, owner lookup, publish
 * toggle, delete, and bulk actions are all real.
 */
export function InvitationsTable({
  data,
  filters,
  onFiltersChange,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onClearSelection,
  onBulkPublish,
  onBulkUnpublish,
  onExportSelected,
  onTogglePublish,
  onDelete,
  analyticsFor,
  analyticsData,
  analyticsLoading,
  onToggleAnalytics,
  busyId,
}: {
  data: AdminInvitationsResponse;
  filters: AdminInvitationsFilters;
  onFiltersChange: (patch: Partial<AdminInvitationsFilters>, resetPage?: boolean) => void;
  selected: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onBulkPublish: () => void;
  onBulkUnpublish: () => void;
  onExportSelected: () => void;
  onTogglePublish: (item: AdminInvitationItem) => void;
  onDelete: (item: AdminInvitationItem) => void;
  analyticsFor: string | null;
  analyticsData: AdminInvitationAnalytics | null;
  analyticsLoading: boolean;
  onToggleAnalytics: (item: AdminInvitationItem) => void;
  busyId: string | null;
}) {
  const [draft, setDraft] = useState(filters.search ?? '');
  const selectAllRef = useRef<HTMLInputElement>(null);
  const { table, kpis, eventTypes } = data;
  const pageIds = table.items.map((i) => i.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== (filters.search ?? '')) onFiltersChange({ search: draft }, true);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // External presets (header search, deep links) sync into the input.
  useEffect(() => {
    setDraft(filters.search ?? '');
  }, [filters.search]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selected.length > 0 && !allPageSelected && pageIds.some((id) => selected.includes(id));
    }
  });

  const selectCls =
    'h-8 rounded-lg bg-[#f4f2fd] pl-3 pr-8 text-[13px] font-medium text-[#1a1b22] focus:outline-none appearance-none cursor-pointer';
  const tabs: Array<{ key: 'all' | 'PUBLISHED' | 'DRAFT'; label: string; count: number }> = [
    { key: 'all', label: 'All Invitations', count: kpis.total },
    { key: 'PUBLISHED', label: 'Published', count: kpis.published },
    { key: 'DRAFT', label: 'Draft', count: kpis.draft },
  ];
  const activeTab = filters.status ?? 'all';
  const selectedItems = table.items.filter((i) => selected.includes(i.id));
  const from = table.total === 0 ? 0 : (table.page - 1) * table.limit + 1;
  const to = Math.min(table.total, (table.page - 1) * table.limit + table.items.length);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() =>
                onFiltersChange({ status: tab.key === 'all' ? undefined : tab.key }, true)
              }
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-[#7d1128] text-white shadow-sm'
                  : 'text-[#47464b] hover:bg-[#f4f2fd] hover:text-[#1a1b22]'
              }`}
            >
              {tab.label}{' '}
              <span className={`ml-1 font-mono text-[11px] ${active ? 'text-white/80' : 'text-[#47464b]'}`}>
                {tab.count.toLocaleString('en-US')}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col justify-between gap-2 rounded-xl bg-white p-3 shadow-sm lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] max-w-md flex-1">
            <span
              className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#47464b]"
              aria-hidden="true"
            >
              search
            </span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search by event title, host name, slug..."
              type="text"
              className="h-8 w-full rounded-lg bg-[#f4f2fd] pl-9 pr-3 text-[13px] text-[#1a1b22] placeholder:text-[#47464b]/60 focus:bg-white focus:outline-none"
            />
          </div>
          <div className="relative">
            <select
              value={filters.eventType ?? ''}
              onChange={(e) => onFiltersChange({ eventType: e.target.value || undefined }, true)}
              className={selectCls}
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              {eventTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-[#47464b]" aria-hidden="true">
              expand_more
            </span>
          </div>
          <div className="relative">
            <select
              value={filters.created ?? ''}
              onChange={(e) =>
                onFiltersChange(
                  { created: (e.target.value || undefined) as AdminInvitationsFilters['created'] },
                  true
                )
              }
              className={selectCls}
              aria-label="Filter by creation date"
            >
              <option value="">Any time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-[#47464b]" aria-hidden="true">
              expand_more
            </span>
          </div>
          <div className="relative">
            <select
              value={filters.sort ?? 'newest'}
              onChange={(e) =>
                onFiltersChange({ sort: e.target.value as AdminInvitationsFilters['sort'] }, true)
              }
              className={selectCls}
              aria-label="Sort invitations"
            >
              <option value="newest">Newest first</option>
              <option value="mostViewed">Most viewed</option>
              <option value="mostRsvps">Most RSVPs</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-[#47464b]" aria-hidden="true">
              expand_more
            </span>
          </div>
          <button
            type="button"
            title="Clear filters"
            onClick={() => {
              setDraft('');
              onFiltersChange(
                { search: undefined, status: undefined, eventType: undefined, created: undefined, sort: 'newest' },
                true
              );
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4f2fd] text-[#1a1b22] transition-colors hover:bg-[#eeedf7]"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              filter_alt_off
            </span>
          </button>
        </div>
        <div className="flex items-center gap-1.5 self-end lg:self-auto">
          <button
            type="button"
            title="Export current rows as CSV"
            onClick={() => downloadInvitationsCsv(table.items)}
            disabled={table.items.length === 0}
            className="rounded-lg bg-[#f4f2fd] p-1.5 text-[#47464b] transition-colors hover:bg-[#eeedf7] hover:text-[#1a1b22] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              download
            </span>
          </button>
          <span className="font-mono text-[11px] text-[#47464b]">
            Showing {from}-{to} of {table.total.toLocaleString('en-US')}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="select-none bg-[#f4f2fd] font-mono text-[11px] uppercase tracking-wider text-[#47464b]">
                <th className="w-8 px-4 py-2.5">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={onToggleSelectAll}
                    aria-label="Select all rows on this page"
                    className="cursor-pointer rounded"
                  />
                </th>
                <th className="px-4 py-2.5 font-medium">Invitation Title</th>
                <th className="px-4 py-2.5 font-medium">Owner</th>
                <th className="px-4 py-2.5 font-medium">Event Type</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Created &amp; Updated</th>
                <th className="px-4 py-2.5 text-right font-medium">Views</th>
                <th className="px-4 py-2.5 text-right font-medium">RSVPs</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-[#1a1b22]">
              {table.items.map((item) => {
                const busy = busyId === item.id;
                const checked = selected.includes(item.id);
                return (
                  <React.Fragment key={item.id}>
                    <tr className="transition-colors hover:bg-[#f4f2fd]/60">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleSelect(item.id)}
                          aria-label={`Select ${item.title}`}
                          className="cursor-pointer rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-[240px] items-center gap-2">
                          <AdminIcon icon={eventIcon(item.eventType)} tone="slate" size={20} />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-[13px] font-semibold">{item.title}</span>
                            <a
                              href={`/invite/${encodeURIComponent(item.slug)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 truncate font-mono text-[11px] text-[#47464b] hover:text-[#1a1b22]"
                            >
                              /invite/{item.slug}
                              <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                                open_in_new
                              </span>
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-[150px] items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e8e7f1] text-[9px] font-semibold text-[#1a1b22]"
                          >
                            {initialsOf(item.owner.name)}
                          </span>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate">{item.owner.name}</span>
                            <span className="truncate font-mono text-[10px] text-[#47464b]">
                              {item.owner.email} • {item.owner.plan}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-[#eeedf7] px-2 py-0.5 text-[11px] font-medium text-[#1a1b22]">
                          {item.eventType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={item.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex flex-col font-mono text-[11px] text-[#47464b]">
                          <span>
                            {new Date(item.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="text-[10px] text-[#47464b]/70">
                            Updated{' '}
                            {new Date(item.updatedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[13px] text-[#47464b]">
                        {item.views.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[13px] font-semibold">
                        {item.rsvps.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`/invite/${encodeURIComponent(item.slug)}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Preview invitation"
                            className="rounded p-1 text-[#47464b] transition-colors hover:bg-[#eeedf7] hover:text-[#1a1b22]"
                          >
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                              visibility
                            </span>
                          </a>
                          <ActionButton
                            title={analyticsFor === item.id ? 'Hide analytics' : 'View analytics'}
                            icon="insights"
                            onClick={() => onToggleAnalytics(item)}
                          />
                          <a
                            href={`/admin/users?search=${encodeURIComponent(item.owner.email)}`}
                            title="View owner"
                            className="rounded p-1 text-[#47464b] transition-colors hover:bg-[#eeedf7] hover:text-[#1a1b22]"
                          >
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                              person
                            </span>
                          </a>
                          {item.status === 'PUBLISHED' ? (
                            <ActionButton
                              title="Unpublish"
                              icon="archive"
                              danger
                              disabled={busy}
                              onClick={() => onTogglePublish(item)}
                            />
                          ) : (
                            <ActionButton
                              title="Publish"
                              icon="publish"
                              disabled={busy}
                              onClick={() => onTogglePublish(item)}
                            />
                          )}
                          <ActionButton
                            title="Delete"
                            icon="delete"
                            danger
                            disabled={busy}
                            onClick={() => onDelete(item)}
                          />
                        </div>
                      </td>
                    </tr>
                    {analyticsFor === item.id ? (
                      <tr className="bg-[#f4f2fd]/50">
                        <td colSpan={9} className="px-4 py-3">
                          <AnalyticsDetail data={analyticsData} loading={analyticsLoading} />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {table.items.length === 0 ? (
            <p className="m-3 rounded-lg bg-[#f4f2fd] p-4 text-center text-[13px] text-[#47464b]">
              No invitations match these filters.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-center justify-between gap-2 bg-[#f4f2fd] px-4 py-2.5 sm:flex-row">
          <span className="font-mono text-[11px] text-[#47464b]">
            {from}–{to} of {table.total.toLocaleString('en-US')} items
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={table.page <= 1}
              onClick={() => onFiltersChange({ page: table.page - 1 })}
              aria-label="Previous page"
              className="flex h-7 w-7 items-center justify-center rounded text-[#47464b] transition-colors hover:bg-white hover:text-[#1a1b22] disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                chevron_left
              </span>
            </button>
            <span className="px-1 font-mono text-[11px] text-[#47464b]">
              {table.page} / {table.totalPages}
            </span>
            <button
              type="button"
              disabled={table.page >= table.totalPages}
              onClick={() => onFiltersChange({ page: table.page + 1 })}
              aria-label="Next page"
              className="flex h-7 w-7 items-center justify-center rounded text-[#47464b] transition-colors hover:bg-white hover:text-[#1a1b22] disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </div>

      {selected.length > 0 ? (
        <BatchBar
          count={selected.length}
          onPublish={onBulkPublish}
          onUnpublish={onBulkUnpublish}
          onExport={onExportSelected}
          onClear={onClearSelection}
        />
      ) : null}
    </div>
  );
}

/** Floating bulk-action bar for the current selection. Tags don't exist in the SaaS. */
function BatchBar({
  count,
  onPublish,
  onUnpublish,
  onExport,
  onClear,
}: {
  count: number;
  onPublish: () => void;
  onUnpublish: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  const btn =
    'inline-flex items-center gap-1.5 rounded bg-white/15 px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-white/25';
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-[#7d1128] px-4 py-2.5 text-white shadow-xl">
      <span className="font-mono text-[12px] font-medium">
        {count} invitation{count === 1 ? '' : 's'} selected
      </span>
      <div className="h-4 w-px bg-white/25" />
      <button type="button" onClick={onPublish} className={btn}>
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
          public
        </span>
        Bulk Publish
      </button>
      <button type="button" onClick={onExport} className={btn}>
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
          file_download
        </span>
        Export Data
      </button>
      <button type="button" onClick={onUnpublish} className={btn}>
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
          archive
        </span>
        Unpublish
      </button>
      <button
        type="button"
        onClick={onClear}
        title="Clear selection"
        className="p-1 text-white/60 transition-colors hover:text-white"
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          close
        </span>
      </button>
    </div>
  );
}
