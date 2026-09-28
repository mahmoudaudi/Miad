'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  downloadTransactionsCsv,
  getAdminBilling,
  getBillingTransactions,
  type AdminBilling,
  type AdminTransactions,
} from '@/lib/admin';
import { BillingKpis } from './BillingKpis';
import { MrrChart, RevenueShare } from './MrrChart';
import { TiersGrid } from './TiersGrid';
import { TransactionsTable } from './TransactionsTable';

/** Billing & Subscriptions: live revenue, tiers, and payment settlements. */
export function BillingView() {
  const [data, setData] = useState<AdminBilling | null>(null);
  const [transactions, setTransactions] = useState<AdminTransactions | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  // Aggregates load once; transaction pages fetch alone (3 queries, not 5).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminBilling(1, 6)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setTransactions(res.transactions);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load billing. Check the API connection and retry.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const firstTxRun = React.useRef(true);
  useEffect(() => {
    // The summary already delivers transactions page 1 on mount — skip the duplicate.
    if (firstTxRun.current) {
      firstTxRun.current = false;
      if (txPage === 1) return;
    }
    let cancelled = false;
    getBillingTransactions(txPage, 6)
      .then((res) => {
        if (!cancelled) setTransactions(res);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [txPage, refreshToken]);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);
  const view: AdminBilling | null =
    data && transactions ? { ...data, transactions } : data;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 p-5 lg:p-8">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div className="flex max-w-2xl flex-col gap-1">
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[#47464b]">
            <span>Finance &amp; Operations</span>
            <span>/</span>
            <span className="font-medium text-[#4648d4]">Stored Billing Data</span>
          </div>
          <h1 className="text-[36px] font-semibold leading-[44px] tracking-[-0.035em] text-[#1a1b22]">
            Billing &amp; Subscriptions
          </h1>
          <p className="text-[13px] text-[#47464b]">
            Monitor platform revenue, active subscriptions, tier distribution, and payment
            transactions.
          </p>
        </div>
        <div className="self-start lg:self-auto">
          <button
            type="button"
            onClick={() => view && downloadTransactionsCsv(view.transactions.items)}
            disabled={!view || view.transactions.items.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#7d1128] px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#670e21] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
              download
            </span>
            Download Financial Report
          </button>
        </div>
      </div>

      {loading && !view ? (
        <div aria-busy="true" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading billing…</span>
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

      {view ? (
        <>
          <BillingKpis data={view} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <MrrChart data={view} />
            <RevenueShare data={view} />
          </div>
          <TiersGrid data={view} />
          <TransactionsTable data={view} onPage={setTxPage} />
        </>
      ) : null}
    </div>
  );
}
