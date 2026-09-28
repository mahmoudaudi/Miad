import React from 'react';
import type { Locale } from '@/lib/i18n/locales';
import type { BillingPlan, CreditSummary, CreditUsageEntry } from '@/lib/billing';
import { CreditsSummaryCard } from './CreditsSummaryCard';
import { PlansGrid } from './PlansGrid';
import { UsageHistory } from './UsageHistory';
import {
  CreditsSummarySkeleton,
  PlansGridSkeleton,
  UsageHistorySkeleton,
} from './BillingSkeletons';

export type BillingViewState =
  | { status: 'loading' }
  | { status: 'error'; message: string; onRetry: () => void }
  | {
      status: 'ready';
      plans: BillingPlan[];
      currentPlanId: string | null;
      subscriptionStatus: string | null;
      summary: CreditSummary;
      usage: CreditUsageEntry[];
    };

/**
 * A subscription row is the only source of truth for "current plan". With no
 * subscription the account falls back to the free allowance it was granted, so
 * the free plan is treated as current rather than leaving the page ambiguous.
 */
export function currentPlanIdFor(
  plans: BillingPlan[],
  subscribedPlanId: string | null
): string | null {
  if (subscribedPlanId && plans.some((plan) => plan.id === subscribedPlanId)) {
    return subscribedPlanId;
  }
  const free = plans.find((plan) => Number(plan.price) === 0);
  return free?.id ?? null;
}

function SectionHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div className="mt-12">
      <h2 id={id} className="font-display text-headline-sm text-ink">
        {title}
      </h2>
      <p className="mt-1.5 max-w-2xl text-body-md text-muted">{description}</p>
    </div>
  );
}

/** Presentational page body. Kept free of hooks so it can be rendered in tests. */
export function BillingView({ state, locale }: { state: BillingViewState; locale: Locale }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <header>
        <p className="text-label-sm uppercase tracking-[0.16em] text-accent">Billing</p>
        <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
          Credits and plans
        </h1>
        <p className="mt-3 max-w-2xl text-body-lg text-muted">
          AI designs use credits. Check your balance, see what each plan includes, and upgrade when
          payments are available.
        </p>
      </header>

      {state.status === 'error' && (
        <section
          role="alert"
          className="miad-feedback-enter mt-8 rounded-2xl border border-error/20 bg-surface p-6 sm:p-8"
        >
          <span className="material-symbols-outlined text-3xl text-error" aria-hidden="true">
            cloud_off
          </span>
          <h2 className="mt-4 font-display text-headline-sm text-ink">
            We could not load your billing details
          </h2>
          <p className="mt-2 text-body-md text-muted">{state.message}</p>
          <button
            type="button"
            onClick={state.onRetry}
            className="miad-button miad-button--primary mt-6"
          >
            Try again
          </button>
        </section>
      )}

      {state.status === 'loading' && (
        <div className="mt-8 space-y-12">
          <CreditsSummarySkeleton />
          <div className="mt-12">
            <div className="h-5 w-32 animate-pulse rounded bg-secondary" />
            <div className="mt-3 h-3 w-72 max-w-full animate-pulse rounded bg-secondary" />
            <div className="mt-6">
              <PlansGridSkeleton />
            </div>
          </div>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <div className="mt-8">
            <CreditsSummaryCard summary={state.summary} locale={locale} />
          </div>

          <SectionHeading
            id="plans-heading"
            title="Plans"
            description="Every plan includes a monthly credit allowance. Upgrades open once payments are available."
          />
          <div className="mt-6">
            {state.plans.length > 0 ? (
              <PlansGrid
                plans={state.plans}
                currentPlanId={state.currentPlanId}
                locale={locale}
              />
            ) : (
              <p className="rounded-2xl border border-line bg-surface p-6 text-center text-body-md text-muted">
                No plans are configured yet. Please check back later.
              </p>
            )}
          </div>

          <SectionHeading
            id="activity-heading"
            title="Recent activity"
            description="Your most recent AI generations and edits. Failed or cancelled requests are refunded."
          />
          <div className="mt-6">
            <UsageHistory entries={state.usage} locale={locale} />
          </div>
        </>
      )}
    </main>
  );
}
