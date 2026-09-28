import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdminBilling } from '@/lib/admin';
import { BillingKpis } from './BillingKpis';
import { TiersGrid } from './TiersGrid';
import { TransactionsTable } from './TransactionsTable';

const data: AdminBilling = {
  kpis: {
    totalRevenue: 58,
    currency: 'USD',
    mrr: 257,
    activeSubscriptions: 3,
    newSubs30d: 1,
    endedSubs: 0,
    churnRate: 0,
  },
  monthly: [
    { month: '2026-04-01T00:00:00.000Z', mrr: 0 },
    { month: '2026-05-01T00:00:00.000Z', mrr: 0 },
    { month: '2026-06-01T00:00:00.000Z', mrr: 0 },
    { month: '2026-07-01T00:00:00.000Z', mrr: 0 },
    { month: '2026-08-01T00:00:00.000Z', mrr: 58 },
    { month: '2026-09-01T00:00:00.000Z', mrr: 257 },
  ],
  tiers: [
    { plan: 'Studio Pro', price: 29, interval: 'MONTHLY', subscribers: 2, mrr: 58 },
    { plan: 'Enterprise', price: 2388, interval: 'ANNUAL', subscribers: 1, mrr: 199 },
  ],
  transactions: {
    items: [
      {
        id: 'p-1',
        reference: 'pi_123',
        customerName: 'Ahmad K',
        customerEmail: 'ahmad@k.me',
        plan: 'Studio Pro',
        amount: 29,
        currency: 'USD',
        cycle: 'MONTHLY',
        status: 'SUCCEEDED',
        processedAt: '2026-09-20T10:00:00Z',
      },
    ],
    page: 1,
    limit: 6,
    total: 1,
    totalPages: 1,
    gross: 29,
  },
};

const noop = () => undefined;

describe('BillingKpis', () => {
  it('renders live revenue figures', () => {
    const html = renderToStaticMarkup(<BillingKpis data={data} />);
    expect(html).toContain('$58');
    expect(html).toContain('$257');
    expect(html).not.toMatch(/\$24,820|MRR: \$18,400|Apple Pay/);
  });
});

describe('TiersGrid', () => {
  it('renders stored plans with real counts', () => {
    const html = renderToStaticMarkup(<TiersGrid data={data} />);
    expect(html).toContain('Studio Pro');
    expect(html).toContain('Enterprise');
    expect(html).toContain('Most Popular');
    expect(html).not.toContain('AI Gen Allowance');
    expect(html).not.toContain('Conversion');
  });

  it('explains missing plans instead of faking tiers', () => {
    const html = renderToStaticMarkup(<TiersGrid data={{ ...data, tiers: [] }} />);
    expect(html).toContain('No billing plans are configured yet');
  });
});

describe('TransactionsTable', () => {
  it('renders stored payments without invented columns', () => {
    const html = renderToStaticMarkup(<TransactionsTable data={data} onPage={noop} />);
    expect(html).toContain('pi_123');
    expect(html).toContain('ahmad@k.me');
    expect(html).toContain('Paid');
    expect(html).not.toContain('Payment Method');
    expect(html).not.toContain('Receipt');
    expect(html).not.toContain('picture_as_pdf');
  });

  it('explains an empty ledger', () => {
    const empty: AdminBilling = {
      ...data,
      transactions: { items: [], page: 1, limit: 6, total: 0, totalPages: 1, gross: 0 },
    };
    const html = renderToStaticMarkup(<TransactionsTable data={empty} onPage={noop} />);
    expect(html).toContain('No payments recorded yet');
  });
});
