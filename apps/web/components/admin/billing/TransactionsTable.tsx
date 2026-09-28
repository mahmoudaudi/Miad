'use client';

import React, { useMemo, useState } from 'react';
import {
  downloadTransactionsCsv,
  formatMoney,
  type AdminBilling,
} from '@/lib/admin';

function StatusPill({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (['SUCCEEDED', 'COMPLETED', 'PAID'].includes(s)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#4edea3]/20 px-2 py-0.5 font-mono text-[11px] font-medium text-[#005236]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#005236]" />
        Paid
      </span>
    );
  }
  if (['PENDING', 'PROCESSING'].includes(s)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#e8e7f1] px-2 py-0.5 font-mono text-[11px] font-medium text-[#1a1b22]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#77767b]" />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#ffdad6] px-2 py-0.5 font-mono text-[11px] font-medium text-[#93000a]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#ba1a1a]" />
      {status}
    </span>
  );
}

/**
 * Settled + pending payment rows. The SaaS stores no payment methods,
 * invoices, or refunds, so those columns don't exist here.
 */
export function TransactionsTable({
  data,
  onPage,
}: {
  data: AdminBilling;
  onPage: (page: number) => void;
}) {
  const [query, setQuery] = useState('');
  const { transactions, kpis } = data;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions.items;
    return transactions.items.filter((t) =>
      [t.reference, t.customerName, t.customerEmail, t.plan, t.status]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [transactions.items, query]);

  const from = transactions.total === 0 ? 0 : (transactions.page - 1) * transactions.limit + 1;
  const to = Math.min(
    transactions.total,
    (transactions.page - 1) * transactions.limit + transactions.items.length
  );

  return (
    <section className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-2 border-b border-[#e8e7f1]/60 p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
              Recent Transactions
            </h2>
            <span className="rounded bg-[#e8e7f1] px-2 py-0.5 font-mono text-[10px] text-[#47464b]">
              Live Payment Feed
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[#47464b]">
            Stored payment settlements with customer, plan, and status.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative flex items-center">
            <span
              className="material-symbols-outlined pointer-events-none absolute left-2.5 text-[16px] text-[#47464b]"
              aria-hidden="true"
            >
              filter_list
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter invoices..."
              type="text"
              className="h-8 w-48 rounded-lg bg-[#f4f2fd] pl-8 pr-3 text-[13px] text-[#1a1b22] placeholder:text-[#47464b]/60 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => downloadTransactionsCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex h-8 items-center gap-1 rounded-lg bg-[#f4f2fd] px-2.5 text-[13px] font-medium text-[#1a1b22] transition-colors hover:bg-[#eeedf7] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              file_download
            </span>
            Export CSV
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-9 border-b border-[#e8e7f1] bg-[#f4f2fd]/70 font-mono text-[11px] uppercase tracking-wider text-[#47464b]">
              <th className="px-5 py-2 font-medium">Reference</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Tier Plan</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Cycle</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Processed Date</th>
            </tr>
          </thead>
          <tbody className="text-[13px] text-[#1a1b22]">
            {filtered.map((t) => (
              <tr key={t.id} className="transition-colors hover:bg-[#f4f2fd]/40">
                <td className="px-5 py-3 font-mono text-[12px] font-medium text-[#47464b]">
                  {t.reference}
                </td>
                <td className="px-3 py-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-medium">{t.customerName}</span>
                    <span className="truncate text-[11px] text-[#47464b]">{t.customerEmail}</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center rounded bg-[#eeedf7] px-2 py-0.5 font-mono text-[11px] font-medium text-[#4648d4]">
                    {t.plan}
                  </span>
                </td>
                <td className="px-3 py-3 font-mono font-semibold">
                  {formatMoney(t.amount, t.currency)}
                </td>
                <td className="px-3 py-3 text-[12px] text-[#47464b]">{t.cycle.toLowerCase()}</td>
                <td className="px-3 py-3">
                  <StatusPill status={t.status} />
                </td>
                <td className="px-3 py-3 font-mono text-[11px] text-[#47464b]">
                  {new Date(t.processedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="m-3 rounded-lg bg-[#f4f2fd] p-4 text-center text-[13px] text-[#47464b]">
            {transactions.total === 0
              ? 'No payments recorded yet. Transactions appear here once billing goes live.'
              : 'No matches on this page.'}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-center justify-between gap-2 border-t border-[#e8e7f1]/60 bg-[#f4f2fd]/40 p-4 sm:flex-row">
        <div className="flex items-center gap-2 text-[13px] text-[#47464b]">
          <span>
            Showing {from}–{to} of {transactions.total.toLocaleString('en-US')}
          </span>
          <span className="text-[#c8c5cb]">•</span>
          <span className="font-mono text-[11px] font-medium text-[#1a1b22]">
            Gross: {formatMoney(transactions.gross, kpis.currency)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={transactions.page <= 1}
            onClick={() => onPage(transactions.page - 1)}
            aria-label="Previous page"
            className="rounded bg-white px-2.5 py-1 text-[#47464b] shadow-sm hover:text-[#1a1b22] disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px] align-middle" aria-hidden="true">
              chevron_left
            </span>
          </button>
          <span className="rounded bg-[#7d1128] px-3 py-1 font-mono text-[11px] font-semibold text-white">
            Page {transactions.page} of {transactions.totalPages}
          </span>
          <button
            type="button"
            disabled={transactions.page >= transactions.totalPages}
            onClick={() => onPage(transactions.page + 1)}
            aria-label="Next page"
            className="rounded bg-white px-2.5 py-1 text-[#47464b] shadow-sm hover:text-[#1a1b22] disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px] align-middle" aria-hidden="true">
              chevron_right
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
