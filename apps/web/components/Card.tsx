import React from 'react';

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="w-full rounded-2xl border border-line bg-surface p-5 sm:p-7">
    <h2 className="font-display text-headline-sm text-ink">{title}</h2>
    <div className="mt-3">{children}</div>
  </section>;
}
