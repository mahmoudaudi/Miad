import React from 'react';
import { formatCurrency, formatNumber } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locales';
import { getBillingCurrency } from '@/lib/env';
import { isUpgradePlan, type BillingPlan } from '@/lib/billing';

const intervalLabel = (billingInterval: string): string =>
  /year|annual/i.test(billingInterval) ? 'per year' : 'per month';

function planAmount(plan: BillingPlan): number {
  const amount = Number(plan.price);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Upgrade actions are intentionally inert until a payment provider exists. The
 * button stays focusable-but-disabled with a reason, rather than being hidden,
 * so the layout does not shift when checkout is added.
 */
function PlanAction({ plan, isCurrent }: { plan: BillingPlan; isCurrent: boolean }) {
  if (isCurrent) {
    return (
      <p className="miad-badge" role="status">
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
          check_circle
        </span>
        Current plan
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled
        aria-describedby={`plan-${plan.id}-note`}
        className="miad-button miad-button--secondary w-full cursor-not-allowed opacity-70"
      >
        {isUpgradePlan(plan) ? 'Coming soon' : 'Included'}
      </button>
      <p id={`plan-${plan.id}-note`} className="mt-2 text-center text-xs text-muted">
        Payments are not available yet.
      </p>
    </div>
  );
}

export function PlanCard({
  plan,
  isCurrent,
  locale,
}: {
  plan: BillingPlan;
  isCurrent: boolean;
  locale: Locale;
}) {
  const amount = planAmount(plan);
  const monthlyCredits = plan.creditsPerCycle;
  const otherFeatures = plan.planFeatures.filter(
    (item) => item.feature.name !== 'AI_CREDITS_PER_CYCLE'
  );

  return (
    <article
      aria-current={isCurrent ? 'true' : undefined}
      className={`flex flex-col rounded-2xl border bg-surface p-6 shadow-subtle ${
        isCurrent ? 'border-accent' : 'border-line'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-label-sm uppercase tracking-[0.14em] text-muted">{plan.name}</h3>
        {isCurrent && (
          <span className="sr-only">This is the plan you are on now.</span>
        )}
      </div>

      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-headline-md text-ink">
          {amount === 0 ? 'Free' : formatCurrency(amount, locale, getBillingCurrency())}
        </span>
        {amount > 0 && (
          <span className="text-body-sm text-muted">{intervalLabel(plan.billingInterval)}</span>
        )}
      </p>

      {plan.description && <p className="mt-3 text-body-sm text-muted">{plan.description}</p>}

      {monthlyCredits !== null && (
        <p className="mt-5 flex items-center gap-2 text-body-md text-ink">
          <span className="material-symbols-outlined text-[16px] text-accent" aria-hidden="true">
            bolt
          </span>
          <span>
            {formatNumber(monthlyCredits, locale)}{' '}
            {monthlyCredits === 1 ? 'credit' : 'credits'} included per month
          </span>
        </p>
      )}

      {otherFeatures.length > 0 && (
        <ul className="mt-4 space-y-2">
          {otherFeatures.map((item) => (
            <li key={item.feature.name} className="flex items-center gap-2 text-body-sm">
              <span
                className={`material-symbols-outlined text-[16px] ${
                  item.enabled ? 'text-success' : 'text-muted'
                }`}
                aria-hidden="true"
              >
                {item.enabled ? 'check' : 'remove'}
              </span>
              <span className={item.enabled ? 'text-ink' : 'text-muted'}>
                {item.feature.name}
              </span>
              <span className="sr-only">{item.enabled ? 'included' : 'not included'}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-7">
        <PlanAction plan={plan} isCurrent={isCurrent} />
      </div>
    </article>
  );
}

export function PlansGrid({
  plans,
  currentPlanId,
  locale,
}: {
  plans: BillingPlan[];
  currentPlanId: string | null;
  locale: Locale;
}) {
  return (
    <div className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          isCurrent={plan.id === currentPlanId}
          locale={locale}
        />
      ))}
    </div>
  );
}
