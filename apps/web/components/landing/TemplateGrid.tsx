'use client';

import React, { useState } from 'react';
import { AuthModalTrigger } from './AuthModalTrigger';

export type TemplateFilter = { value: string; label: string };
export type TemplateGridItem = { key: string; category: string; card: React.ReactNode };

/**
 * Filterable template grid — the only client island in the showcase.
 * Receives server-rendered cards and shows/hides them locally; no refetch.
 */
export function TemplateGrid({
  filters,
  filterLabel,
  items,
  emptyMessage,
  browseLabel,
}: {
  filters: TemplateFilter[];
  filterLabel: string;
  items: TemplateGridItem[];
  emptyMessage: string;
  browseLabel?: string;
}) {
  const [active, setActive] = useState('all');
  const visible = active === 'all' ? items : items.filter((item) => item.category === active);

  return (
    <div className="contents">
      <div
        className="-mx-4 flex flex-nowrap gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 lg:justify-end"
        role="group"
        aria-label={filterLabel}
      >
        {filters.map((filter) => {
          const selected = filter.value === active;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActive(filter.value)}
              aria-pressed={selected}
              className={`min-h-11 rounded-xl px-3 py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                selected
                  ? 'bg-ink text-background shadow-sm'
                  : 'border border-line bg-surface text-muted hover:border-primary/30 hover:text-ink'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>
      {visible.length === 0 ? (
        <p
          role="status"
          className="col-span-full rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted"
        >
          {emptyMessage}
        </p>
      ) : (
        <div className="col-span-full flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:pb-0 lg:grid-cols-4">
          {visible.map((item) => (
            <div
              key={item.key}
              className="w-[min(82vw,20rem)] shrink-0 snap-start sm:w-auto sm:shrink"
            >
              {item.card}
            </div>
          ))}
        </div>
      )}
      {browseLabel ? (
        <div className="col-span-full flex justify-center pt-1">
          <AuthModalTrigger
            mode="register"
            className="min-h-11 w-full rounded-full bg-primary px-5 py-2.5 text-center text-sm font-medium text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 sm:w-auto"
          >
            {browseLabel}
          </AuthModalTrigger>
        </div>
      ) : null}
    </div>
  );
}
