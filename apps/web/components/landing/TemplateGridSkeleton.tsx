import React from 'react';
import { Skeleton } from './LandingSkeleton';

/** Honest loading state for the DB-backed template grid. */
export function TemplateGridSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="col-span-full" aria-busy="true" aria-label={loadingLabel}>
      <span className="sr-only">{loadingLabel}</span>
      {/* Shapes match TemplateCard exactly, so real cards drop in with no shift. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="aspect-[4/3] rounded-xl border border-line shadow-sm">
            <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/40 to-black/[0.04]" />
          </Skeleton>
        ))}
      </div>
    </div>
  );
}
