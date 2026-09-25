import Link from 'next/link';
import React from 'react';

export default function PublicInvitationNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16 text-center">
      <section className="w-full max-w-xl rounded-2xl border border-line bg-surface p-8 shadow-subtle sm:p-12">
        <p className="text-label-sm uppercase tracking-[0.16em] text-accent">Invitation</p>
        <h1 className="mt-3 font-display text-headline-md text-ink">Invitation unavailable</h1>
        <p className="mt-3 text-body-md text-muted">
          This invitation does not exist or is not currently published.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex rounded-xl border border-line px-5 py-3 text-label-md text-ink hover:border-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Visit Miad
        </Link>
      </section>
    </main>
  );
}
