import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BillingView, type BillingViewState } from './billing-view';
import type { BillingPlan, CreditUsageEntry } from '@/lib/billing';
import { defaultLocale } from '@/lib/i18n/locales';

const plan = (overrides: Partial<BillingPlan> = {}): BillingPlan => ({
  id: 'free',
  name: 'Free',
  description: 'A small monthly allowance.',
  price: 0,
  billingInterval: 'MONTHLY',
  creditsPerCycle: 10,
  planFeatures: [],
  ...overrides,
});

const usage = (overrides: Partial<CreditUsageEntry> = {}): CreditUsageEntry => ({
  id: 'u-1',
  operationType: 'GENERATE_DESIGN',
  status: 'SUCCEEDED',
  creditsConsumed: 1,
  creditsReserved: 1,
  creditsRefunded: 0,
  invitationId: 'inv-1',
  invitationTitle: 'Nadia’s birthday',
  createdAt: '2026-02-01T10:00:00.000Z',
  completedAt: '2026-02-01T10:00:05.000Z',
  ...overrides,
});

const render = (state: BillingViewState) =>
  renderToStaticMarkup(<BillingView state={state} locale={defaultLocale} />);

const ready = (overrides: Partial<Extract<BillingViewState, { status: 'ready' }>> = {}) => ({
  status: 'ready' as const,
  plans: [plan()],
  currentPlanId: 'free',
  subscriptionStatus: null,
  summary: { balance: 7, totalGranted: 10, used: 3 },
  usage: [usage()],
  ...overrides,
});

describe('BillingView loading state', () => {
  const html = render({ status: 'loading' });

  it('shows labelled skeletons and no content yet', () => {
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Loading credit balance');
    expect(html).toContain('Loading plans');
    // The title and skeletons are present, but no real figures or plans are.
    expect(html).toContain('Credits and plans');
    expect(html).not.toContain('Available credits');
    expect(html).not.toContain('Current plan');
    expect(html).not.toContain('Recent activity');
  });

  it('never renders a placeholder number as if it were real', () => {
    expect(html).not.toMatch(/credits left/);
  });
});

describe('BillingView error state', () => {
  const html = render({ status: 'error', message: 'Network unreachable', onRetry: () => undefined });

  it('announces the failure assertively', () => {
    expect(html).toContain('role="alert"');
    expect(html).toContain('Network unreachable');
  });

  it('offers a retry action', () => {
    expect(html).toContain('Try again');
    expect(html).toContain('<button');
  });

  it('does not render plans or activity while broken', () => {
    expect(html).not.toContain('Current plan');
    expect(html).not.toContain('Recent activity');
  });
});

describe('BillingView ready state', () => {
  const html = render(ready());

  it('leads with the credit balance as the primary metric', () => {
    expect(html).toContain('Available credits');
    expect(html).toContain('7');
    expect(html).toContain('credits left');
    expect(html).toContain('3 of 10 used');
  });

  it('types the balance larger than the secondary stats', () => {
    // The balance is the headline number; used/allocated must stay quieter.
    const balance = html.match(/text-headline-lg[^"]*">7</)?.[0] ?? '';
    const usedStat = html.match(/text-headline-sm[^"]*">3</)?.[0] ?? '';
    expect(balance).toContain('text-headline-lg');
    expect(usedStat).toContain('text-headline-sm');
    expect(balance).not.toBe(usedStat);
  });

  it('sizes the credit meter to the remaining balance', () => {
    // 7 of 10 remaining, so the bar fills 70% and the label matches.
    expect(html).toContain('style="width:70%"');
  });

  it('renders every plan from the API payload', () => {
    expect(html).toContain('Free');
    expect(html).toContain('10 credits included per month');
  });

  it('marks the current plan instead of offering an upgrade for it', () => {
    expect(html).toContain('Current plan');
    expect(html).toContain('aria-current="true"');
  });

  it('marks paid plans as coming soon with a stated reason', () => {
    const withPro = render(
      ready({ plans: [plan(), plan({ id: 'pro', name: 'Pro', price: 29.99, creditsPerCycle: 500 })], currentPlanId: 'free' })
    );
    expect(withPro).toContain('Coming soon');
    expect(withPro).toContain('Payments are not available yet.');
    expect(withPro).not.toContain('>Current plan</p><span');
  });

  it('lists recent activity with operation, subject, and credits', () => {
    expect(html).toContain('Recent activity');
    expect(html).toContain('Generation');
    expect(html).toContain('Nadia’s birthday');
    expect(html).toContain('Completed');
  });

  it('does not label a refunded request as completed', () => {
    const refunded = render(ready({ usage: [usage({ status: 'FAILED', creditsConsumed: 0 })] }));
    expect(refunded).toContain('Refunded');
    expect(refunded).not.toContain('Completed');
  });
});

describe('BillingView empty states', () => {
  it('invites the user to generate when no credits were ever allocated', () => {
    const html = render(ready({ summary: { balance: 0, totalGranted: 0, used: 0 } }));
    expect(html).toContain('no credits allocated yet');
    expect(html).toContain('Generate a design in AI Studio');
    // No progress meter, and no misleading "out of credits" warning.
    expect(html).not.toContain('of 0 used');
    expect(html).not.toContain('you are out of credits');
    expect(html).not.toContain('Total allocated');
  });

  it('explains an empty activity history instead of showing a blank list', () => {
    const html = render(ready({ usage: [] }));
    expect(html).toContain('No AI activity yet');
    expect(html).not.toContain('Nadia’s birthday');
  });

  it('handles an account with no plans configured', () => {
    const html = render(ready({ plans: [], currentPlanId: null }));
    expect(html).toContain('No plans are configured yet');
  });
});

describe('BillingView accessibility', () => {
  const html = render(ready());

  it('labels each landmarked section', () => {
    expect(html).toContain('aria-labelledby="credit-balance-heading"');
    expect(html).toContain('id="plans-heading"');
    expect(html).toContain('id="activity-heading"');
  });

  it('emits machine-readable timestamps', () => {
    expect(html).toMatch(/dateTime="2026-02-01T10:00:00\.000Z"/);
  });

  it('hides decorative icons from assistive technology', () => {
    expect(html).toContain('aria-hidden="true"');
  });

  it('never leaves an enabled action that claims to start a payment', () => {
    expect(html).not.toMatch(/<button(?![^>]*disabled)[^>]*>\s*(Upgrade|Subscribe|Checkout)/i);
  });
});
