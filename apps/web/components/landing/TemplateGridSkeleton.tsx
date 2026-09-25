import React from 'react';

/** Honest loading state for the DB-backed template grid. */
export function TemplateGridSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="col-span-full" aria-busy="true" aria-label={loadingLabel}>
      <span className="sr-only">{loadingLabel}</span>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="aspect-[4/3] animate-pulse rounded-xl border border-[#e8e4de] bg-[#eeeeec] shadow-sm">
            <div className="h-full rounded-xl bg-gradient-to-br from-white/70 via-transparent to-black/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
