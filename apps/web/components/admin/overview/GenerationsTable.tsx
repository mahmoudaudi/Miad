'use client';

import React, { useMemo, useState } from 'react';
import { initialsOf, timeAgo, type AdminGenerationItem } from '@/lib/admin';

function StatusPill({ status }: { status: string }) {
  if (status === 'SUCCEEDED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#6ffbbe]/30 px-2 py-0.5 font-mono text-[11px] font-medium text-[#005236]">
        <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
          check
        </span>
        Successful
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#ffdad6] px-2 py-0.5 font-mono text-[11px] font-medium text-[#93000a]">
        <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
          error
        </span>
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#eeedf7] px-2 py-0.5 font-mono text-[11px] font-medium text-[#47464b]">
      {status}
    </span>
  );
}

function OperationPill({ operation }: { operation: string }) {
  const isGeneration = operation.includes('GENERATE');
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
        isGeneration ? 'bg-[#e1e0ff] text-[#07006c]' : 'bg-[#eeedf7] text-[#47464b]'
      }`}
    >
      {operation
        .split('_')
        .map((w) => w[0] + w.slice(1).toLowerCase())
        .join(' ')}
    </span>
  );
}

/**
 * Recent AI generations. Search filters the loaded page client-side; full
 * server-side filters arrive with the dedicated pages. Preview links open the
 * real public invitation.
 */
export function GenerationsTable({
  items,
  page,
  totalPages,
  total,
  limit,
  onPage,
}: {
  items: AdminGenerationItem[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.userName, item.userEmail, item.invitationName, item.operation]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [items, query]);

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, (page - 1) * limit + items.length);
  const pageNumbers = useMemo(() => {
    const set = new Set([1, totalPages, page - 1, page, page + 1]);
    return [...set].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  }, [page, totalPages]);

  return (
    <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm lg:p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
            Recent AI Generations
          </h2>
          <p className="text-[12px] leading-[16px] text-[#47464b]">
            Direct stream of compiled event sites and validation runs.
          </p>
        </div>
        <div className="relative flex items-center">
          <span
            className="material-symbols-outlined pointer-events-none absolute left-2.5 text-[16px] text-[#47464b]"
            aria-hidden="true"
          >
            search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter this page by user or invitation..."
            type="text"
            className="h-8 w-48 rounded-lg bg-[#f4f2fd] pl-8 pr-3 text-[12px] text-[#1a1b22] placeholder:text-[#47464b]/60 transition-colors focus:bg-[#e8e7f1] focus:outline-none sm:w-56"
          />
        </div>
      </div>

      <div className="-mx-5 overflow-x-auto px-5 lg:-mx-6 lg:px-6">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="bg-[#f4f2fd] font-mono text-[11px] uppercase tracking-wider text-[#47464b]">
              <th className="rounded-l-lg px-3 py-2.5">User</th>
              <th className="px-3 py-2.5">Invitation Name</th>
              <th className="px-3 py-2.5">Type / Operation</th>
              <th className="px-3 py-2.5">Tokens</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Created</th>
              <th className="rounded-r-lg px-3 py-2.5 text-right">Preview</th>
            </tr>
          </thead>
          <tbody className="text-[13px] text-[#1a1b22]">
            {filtered.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-[#f4f2fd]/60">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8e7f1] font-mono text-[11px] font-semibold text-[#1a1b22]"
                    >
                      {initialsOf(item.userName)}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px] font-medium">{item.userName}</span>
                      <span className="truncate font-mono text-[10px] text-[#47464b]">
                        {item.userEmail}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="block max-w-[200px] truncate font-medium">{item.invitationName}</span>
                </td>
                <td className="px-3 py-3">
                  <OperationPill operation={item.operation} />
                </td>
                <td className="px-3 py-3 font-mono text-[11px] text-[#47464b]">
                  {item.tokensUsed === null ? '—' : item.tokensUsed.toLocaleString('en-US')}
                </td>
                <td className="px-3 py-3">
                  <StatusPill status={item.status} />
                </td>
                <td className="px-3 py-3 font-mono text-[11px] text-[#47464b]">
                  {timeAgo(item.createdAt)}
                </td>
                <td className="px-3 py-3 text-right">
                  <a
                    href={`/invite/${encodeURIComponent(item.invitationSlug)}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Preview invitation"
                    className="inline-flex rounded p-1 text-[#4648d4] transition-colors hover:bg-[#eeedf7]"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      open_in_new
                    </span>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="rounded-lg bg-[#f4f2fd] p-4 text-center text-[13px] text-[#47464b]">
            {items.length === 0
              ? 'No AI generations yet. They will stream in here.'
              : 'No matches on this page.'}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col justify-between gap-2 pt-1 text-[12px] sm:flex-row sm:items-center">
        <span className="text-[#47464b]">
          Showing <span className="font-mono font-medium text-[#1a1b22]">{from}</span> to{' '}
          <span className="font-mono font-medium text-[#1a1b22]">{to}</span> of{' '}
          <span className="font-mono font-medium text-[#1a1b22]">
            {total.toLocaleString('en-US')}
          </span>{' '}
          entries
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="rounded-lg bg-[#f4f2fd] px-2.5 py-1 text-[12px] font-medium text-[#1a1b22] transition-colors hover:bg-[#e8e7f1] disabled:opacity-50"
          >
            Previous
          </button>
          {pageNumbers.map((p, i, arr) => (
            <React.Fragment key={p}>
              {i > 0 && p - (arr[i - 1] ?? p) > 1 ? (
                <span className="px-1 font-mono text-[11px] text-[#47464b]">...</span>
              ) : null}
              <button
                type="button"
                onClick={() => onPage(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[12px] transition-colors ${
                  p === page
                    ? 'bg-[#7d1128] text-white'
                    : 'bg-[#f4f2fd] text-[#1a1b22] hover:bg-[#e8e7f1]'
                }`}
              >
                {p}
              </button>
            </React.Fragment>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
            className="rounded-lg bg-[#f4f2fd] px-2.5 py-1 text-[12px] font-medium text-[#1a1b22] transition-colors hover:bg-[#e8e7f1] disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
