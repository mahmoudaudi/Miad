import React from 'react';
/** Loading placeholders. Reserve the final layout so nothing shifts on load. */
export function CreditsSummarySkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading credit balance"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle"
    >
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
        <div>
          <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
          <div className="mt-4 h-10 w-28 animate-pulse rounded bg-secondary sm:h-12" />
          <div className="mt-5 h-1.5 w-full animate-pulse rounded-full bg-secondary" />
          <div className="mt-3 h-3 w-40 animate-pulse rounded bg-secondary" />
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-6 lg:border-s lg:border-t-0 lg:ps-10 lg:pt-0">
          {[0, 1].map((item) => (
            <div key={item}>
              <div className="h-3 w-16 animate-pulse rounded bg-secondary" />
              <div className="mt-2 h-6 w-12 animate-pulse rounded bg-secondary" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PlansGridSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading plans"
      className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4"
    >
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-72 animate-pulse rounded-2xl border border-line bg-surface shadow-subtle"
        />
      ))}
    </div>
  );
}

export function UsageHistorySkeleton() {
  return (
    <ul
      aria-busy="true"
      aria-label="Loading recent activity"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle"
    >
      {[0, 1, 2, 3].map((item) => (
        <li
          key={item}
          className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 sm:px-6"
        >
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-secondary" />
          <div className="min-w-0 flex-1">
            <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
            <div className="mt-2 h-3 w-48 animate-pulse rounded bg-secondary" />
          </div>
          <div className="hidden h-3 w-24 animate-pulse rounded bg-secondary sm:block" />
        </li>
      ))}
    </ul>
  );
}
