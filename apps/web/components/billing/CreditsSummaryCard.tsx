import React from 'react';
import { formatNumber } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locales';
import type { CreditSummary } from '@/lib/billing';

/**
 * Credit balance is the primary metric of this page, so it gets the largest
 * type on the card while consumed/granted stay deliberately quieter.
 */
export function CreditsSummaryCard({
  summary,
  locale,
}: {
  summary: CreditSummary;
  locale: Locale;
}) {
  const { balance, used, totalGranted } = summary;
  const hasAllocation = totalGranted > 0;
  const remainingPercent = hasAllocation
    ? Math.max(0, Math.min(100, Math.round((balance / totalGranted) * 100)))
    : 0;

  return (
    <section
      aria-labelledby="credit-balance-heading"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle"
    >
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
        <div className="min-w-0">
          <h2
            id="credit-balance-heading"
            className="text-label-sm uppercase tracking-[0.14em] text-muted"
          >
            Available credits
          </h2>

          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
              {formatNumber(balance, locale)}
            </span>
            <span className="text-body-md text-muted">
              {balance === 1 ? 'credit left' : 'credits left'}
            </span>
          </p>

          {hasAllocation ? (
            <>
              <div
                aria-hidden="true"
                className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${remainingPercent}%` }}
                />
              </div>
              <p className="mt-2.5 text-body-sm text-muted">
                {formatNumber(used, locale)} of {formatNumber(totalGranted, locale)} used
                {remainingPercent === 0 ? ' · you are out of credits' : ''}
              </p>
            </>
          ) : (
            <p className="mt-5 max-w-md text-body-md text-muted">
              You have no credits allocated yet. Generate a design in AI Studio to get started.
            </p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-6 lg:border-s lg:border-t-0 lg:ps-10 lg:pt-0">
          <div>
            <dt className="text-label-sm uppercase tracking-[0.14em] text-muted">Used</dt>
            <dd className="mt-1.5 font-display text-headline-sm text-ink">
              {formatNumber(used, locale)}
            </dd>
          </div>
          <div>
            <dt className="text-label-sm uppercase tracking-[0.14em] text-muted">
              {hasAllocation ? 'Total allocated' : 'Allocated'}
            </dt>
            <dd className="mt-1.5 font-display text-headline-sm text-ink">
              {formatNumber(totalGranted, locale)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
