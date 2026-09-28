'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { InvitationRecord, listInvitations } from '@/lib/invitations';

export function InvitationIndexClient() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<InvitationRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listInvitations()
      .then((records) => {
        if (active) setInvitations(records);
      })
      .catch((caught) => {
        if (!active) return;
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace('/login?next=%2Fdashboard%2Finvitations');
          return;
        }
        setError(caught instanceof ApiError ? caught.message : 'We could not load your invitations.');
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm uppercase tracking-[0.16em] text-accent">Your workspace</p>
          <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
            Invitations
          </h1>
          <p className="mt-3 max-w-2xl text-body-lg text-muted">
            Create invitations with AI, then manage previews, publishing, guests, and responses here.
          </p>
        </div>
        <Link
          href="/dashboard/invitations/new"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-3 text-label-md text-white transition-colors hover:bg-primary-hover"
        >
          Create with AI
        </Link>
      </header>

      {error && (
        <p role="alert" className="mt-8 rounded-xl border border-error/20 bg-surface p-4 text-body-sm text-error">
          {error}
        </p>
      )}

      {invitations === null && !error && (
        <ul aria-label="Loading invitations" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <li key={item} className="h-28 animate-pulse rounded-2xl border border-line bg-surface" />
          ))}
        </ul>
      )}

      {invitations?.length === 0 && !error && (
        <section className="mt-8 rounded-2xl border border-dashed border-line bg-surface p-8 text-center sm:p-12">
          <span className="material-symbols-outlined text-3xl text-accent" aria-hidden="true">
            mail
          </span>
          <h2 className="mt-4 font-display text-headline-sm text-ink">No invitations yet</h2>
          <p className="mt-2 text-body-md text-muted">
            Describe the occasion, style, and details you have in mind. AI Studio will create your first invitation.
          </p>
          <Link
            href="/dashboard/invitations/new"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-3 text-label-md text-white transition-colors hover:bg-primary-hover"
          >
            Start in AI Studio
          </Link>
        </section>
      )}

      {invitations && invitations.length > 0 && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {invitations.map((invitation) => (
            <li key={invitation.id}>
              <Link
                href={`/dashboard/invitations/${invitation.id}`}
                className="group flex min-h-28 flex-col justify-between rounded-2xl border border-line bg-surface p-5 shadow-subtle transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate font-display text-headline-sm text-ink">
                    {invitation.event.title}
                  </span>
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-primary">
                    {invitation.status === 'PUBLISHED' && invitation.publishedAt ? 'Published' : 'Draft'}
                  </span>
                </span>
                <span className="mt-3 flex items-center justify-between gap-3 text-body-sm text-muted">
                  <span className="min-w-0 truncate">/{invitation.slug}</span>
                  <span className="shrink-0 font-medium text-primary group-hover:underline">
                    Open invitation
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
