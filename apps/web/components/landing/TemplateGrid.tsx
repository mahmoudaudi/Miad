'use client';

import React, { useState } from 'react';
import Link from 'next/link';

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
        className="flex flex-wrap items-center gap-2 lg:justify-end"
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
                  ? 'bg-[#191919] text-white shadow-sm'
                  : 'border border-[#dedbd6] bg-white text-[#6f6b65] hover:border-[#bab4ac] hover:text-[#191919]'
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
          className="col-span-full rounded-xl border border-[#e6e1dc] bg-white p-8 text-center text-sm text-[#6f6b65]"
        >
          {emptyMessage}
        </p>
      ) : (
        <div className="col-span-full grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((item) => (
            <React.Fragment key={item.key}>{item.card}</React.Fragment>
          ))}
        </div>
      )}
      {browseLabel ? (
        <div className="col-span-full flex justify-center pt-1">
          <Link
            href="/register"
            className="min-h-11 w-full rounded-full bg-primary px-5 py-2.5 text-center text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 sm:w-auto"
          >
            {browseLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
