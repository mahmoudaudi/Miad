'use client';

import React, { useEffect, useState } from 'react';
import { AdminIcon } from '../AdminIcon';
import {
  downloadCommunityCsv,
  initialsOf,
  type AdminCommunity,
  type AdminCommunityFilters,
  type AdminCommunityItem,
} from '@/lib/admin';

function StatusPill({ isPublished }: { isPublished: boolean }) {
  return isPublished ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4edea3]/20 px-2 py-0.5 font-mono text-[11px] font-medium text-[#005236]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#005236]" />
      Published
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8e7f1] px-2 py-0.5 font-mono text-[11px] font-medium text-[#47464b]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#77767b]" />
      Hidden
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
      <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}

/**
 * Community designs directory. Hiding (unpublishing) is the takedown
 * equivalent; deletion removes the showcase row permanently.
 */
export function CommunityTable({
  data,
  filters,
  onFiltersChange,
  onTogglePublication,
  onDelete,
  busyId,
}: {
  data: AdminCommunity;
  filters: AdminCommunityFilters;
  onFiltersChange: (patch: Partial<AdminCommunityFilters>, resetPage?: boolean) => void;
  onTogglePublication: (item: AdminCommunityItem) => void;
  onDelete: (item: AdminCommunityItem) => void;
  busyId: string | null;
}) {
  const [draft, setDraft] = useState(filters.search ?? '');
  const { table, categories } = data;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== (filters.search ?? '')) onFiltersChange({ search: draft }, true);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const selectCls =
    'h-8 rounded-lg bg-[#f4f2fd] pl-2.5 pr-7 text-[12px] text-[#1a1b22] appearance-none focus:outline-none cursor-pointer';
  const from = table.total === 0 ? 0 : (table.page - 1) * table.limit + 1;
  const to = Math.min(table.total, (table.page - 1) * table.limit + table.items.length);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="flex flex-col items-stretch justify-between gap-2 p-3 lg:flex-row lg:items-center">
        <div className="relative max-w-lg flex-1">
          <span
            className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#47464b]"
            aria-hidden="true"
          >
            search
          </span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by title, slug, or creator..."
            type="text"
            className="h-8 w-full rounded-lg bg-[#f4f2fd] pl-8 pr-3 text-[12px] text-[#1a1b22] placeholder:text-[#47464b]/60 shadow-sm focus:bg-white focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <select
              value={filters.category ?? ''}
              onChange={(e) => onFiltersChange({ category: e.target.value || undefined }, true)}
              className={selectCls}
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-[#47464b]" aria-hidden="true">
              expand_more
            </span>
          </div>
          <div className="relative">
            <select
              value={filters.status ?? ''}
              onChange={(e) =>
                onFiltersChange(
                  { status: (e.target.value || undefined) as AdminCommunityFilters['status'] },
                  true
                )
              }
              className={selectCls}
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="published">Published</option>
              <option value="hidden">Hidden</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-[#47464b]" aria-hidden="true">
              expand_more
            </span>
          </div>
          <div className="relative">
            <select
              value={filters.sort ?? 'newest'}
              onChange={(e) =>
                onFiltersChange({ sort: e.target.value as AdminCommunityFilters['sort'] }, true)
              }
              className={selectCls}
              aria-label="Sort designs"
            >
              <option value="newest">Newest first</option>
              <option value="mostViewed">Most viewed</option>
              <option value="mostLiked">Most liked</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-[#47464b]" aria-hidden="true">
              expand_more
            </span>
          </div>
          <button
            type="button"
            title="Clear filters"
            onClick={() => {
              setDraft('');
              onFiltersChange({ search: undefined, category: undefined, status: undefined, sort: 'newest' }, true);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4f2fd] text-[#1a1b22] transition-colors hover:bg-[#eeedf7]"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              filter_alt_off
            </span>
          </button>
          <button
            type="button"
            title="Export current rows as CSV"
            onClick={() => downloadCommunityCsv(table.items)}
            disabled={table.items.length === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4f2fd] text-[#47464b] transition-colors hover:bg-[#eeedf7] hover:text-[#1a1b22] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              download
            </span>
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="select-none bg-[#f4f2fd]/70 font-mono text-[11px] uppercase tracking-wider text-[#47464b]">
              <th className="px-4 py-2.5 font-medium">Design</th>
              <th className="px-4 py-2.5 font-medium">Creator</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Views</th>
              <th className="px-4 py-2.5 text-right font-medium">Likes</th>
              <th className="px-4 py-2.5 text-right font-medium">Saves</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="text-[13px] text-[#1a1b22]">
            {table.items.map((item) => {
              const busy = busyId === item.id;
              return (
                <tr key={item.id} className="transition-colors hover:bg-[#f4f2fd]/60">
                  <td className="px-4 py-3">
                    <div className="flex min-w-[220px] items-center gap-2">
                      <AdminIcon icon="gallery_thumbnail" tone="slate" size={20} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[13px] font-semibold">{item.title}</span>
                        <span className="truncate font-mono text-[11px] text-[#47464b]">
                          /{item.slug}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[150px] items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e8e7f1] text-[9px] font-semibold"
                      >
                        {initialsOf(item.creator.name)}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{item.creator.name}</span>
                        <span className="truncate font-mono text-[10px] text-[#47464b]">
                          {item.creator.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-[#eeedf7] px-2 py-0.5 text-[11px] font-medium">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill isPublished={item.isPublished} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] text-[#47464b]">
                    {item.views.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] text-[#47464b]">
                    {item.likes.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] text-[#47464b]">
                    {item.saves.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <a
                        href={`/invite/${encodeURIComponent(item.invitationSlug)}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Preview source invitation"
                        className="rounded p-1 text-[#47464b] transition-colors hover:bg-[#eeedf7] hover:text-[#1a1b22]"
                      >
                        <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                          visibility
                        </span>
                      </a>
                      {item.isPublished ? (
                        <ActionButton
                          title="Hide from showcase"
                          icon="visibility_off"
                          danger
                          disabled={busy}
                          onClick={() => onTogglePublication(item)}
                        />
                      ) : (
                        <ActionButton
                          title="Publish to showcase"
                          icon="publish"
                          disabled={busy}
                          onClick={() => onTogglePublication(item)}
                        />
                      )}
                      <ActionButton
                        title="Delete showcase row"
                        icon="delete"
                        danger
                        disabled={busy}
                        onClick={() => onDelete(item)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {table.items.length === 0 ? (
          <p className="m-3 rounded-lg bg-[#f4f2fd] p-4 text-center text-[13px] text-[#47464b]">
            No community designs match these filters.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-center justify-between gap-2 bg-[#f4f2fd]/40 px-4 py-2.5 sm:flex-row">
        <span className="font-mono text-[11px] text-[#47464b]">
          {from}–{to} of {table.total.toLocaleString('en-US')} designs
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
  );
}
