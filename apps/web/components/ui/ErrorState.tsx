'use client';
import React from 'react';
import Link from 'next/link';
import { Button } from '../Button';

export function ErrorState({
  title,
  description,
  onRetry,
  backHref,
  backLabel,
}: {
  title: string;
  description: string;
  onRetry: () => void;
  backHref: string;
  backLabel: string;
}) {
  return (
    <main className="miad-page flex min-h-[60dvh] items-center justify-center">
      <section className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 text-center sm:p-10">
        <span className="material-symbols-outlined text-3xl text-accent" aria-hidden="true">
          cloud_off
        </span>
        <h1 className="mt-4 font-display text-headline-md">{title}</h1>
        <p role="alert" className="mt-3 text-body-md text-muted">
          {description}
        </p>
        <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          <Button onClick={onRetry}>Try again</Button>
          <Link href={backHref} className="miad-button miad-button--secondary">
            {backLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
