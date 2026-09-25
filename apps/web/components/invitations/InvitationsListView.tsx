import Link from 'next/link';
import React from 'react';
import type { InvitationRecord } from '@/lib/invitations';

export type InvitationsListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; invitations: InvitationRecord[] };

type Props = {
  eventId: string;
  state: InvitationsListState;
  successMessage: string | null;
  onRetry: () => void;
  onDelete: (invitation: InvitationRecord) => void;
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function InvitationsListView({ eventId, state, successMessage, onRetry, onDelete }: Props) {
  const invitation = state.status === 'ready' ? state.invitations[0] : undefined;
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <Link
        href={`/dashboard/events/${eventId}`}
        className={`rounded-lg text-label-md text-muted hover:text-ink ${focusRing}`}
      >
        ← Back to Invitation
      </Link>
      <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm uppercase tracking-[0.16em] text-accent">Invitation design</p>
          <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
            Invitation
          </h1>
          <p className="mt-3 max-w-xl text-body-lg text-muted">
            Manage the design, publishing, and guest experience for this invitation.
          </p>
        </div>
        {state.status === 'ready' && state.invitations.length === 0 && (
          <Link
            href={`/dashboard/events/${eventId}/invitations/new`}
            className={`w-full rounded-xl bg-primary px-5 py-3 text-center text-label-md text-white sm:w-auto ${focusRing}`}
          >
            Create Invitation
          </Link>
        )}
      </div>

      {successMessage && (
        <p
          role="status"
          className="mt-8 rounded-xl border border-accent/25 bg-surface px-4 py-3 text-body-sm text-ink"
        >
          {successMessage}
        </p>
      )}

      {state.status === 'loading' && (
        <section
          aria-busy="true"
          aria-label="Loading invitation"
          className="mt-10 h-64 animate-pulse rounded-2xl border border-line bg-surface"
        />
      )}
      {state.status === 'error' && (
        <section className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center shadow-subtle">
          <h2 className="font-display text-headline-md text-ink">Invitation unavailable</h2>
          <p role="alert" className="mt-3 text-body-md text-muted">
            {state.message}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className={`mt-6 rounded-xl border border-line px-5 py-3 text-label-md text-ink ${focusRing}`}
          >
            Try again
          </button>
        </section>
      )}
      {state.status === 'ready' && state.invitations.length === 0 && (
        <section className="mt-10 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-line bg-surface p-8 text-center shadow-subtle">
          <span className="material-symbols-outlined text-3xl text-accent" aria-hidden="true">
            mail
          </span>
          <h2 className="mt-5 font-display text-headline-md text-ink">No invitation yet</h2>
          <p className="mt-3 max-w-md text-body-md text-muted">
            Start designing this invitation when you are ready.
          </p>
          <Link
            href={`/dashboard/events/${eventId}/invitations/new`}
            className={`mt-7 rounded-xl bg-primary px-5 py-3 text-label-md text-white ${focusRing}`}
          >
            Create Invitation
          </Link>
        </section>
      )}
      {invitation && (
        <article className="mt-10 rounded-2xl border border-line bg-surface p-6 shadow-subtle sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-label-sm uppercase tracking-[0.14em] text-accent">
                {invitation.status}
              </p>
              <h2 className="mt-2 break-words font-display text-headline-md text-ink">
                {invitation.event.title}
              </h2>
              <p className="mt-3 break-all text-body-md text-muted">Slug: {invitation.slug}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              <Link
                href={`/dashboard/invitations/${invitation.id}`}
                className={`rounded-lg border border-line px-3 py-2 text-center text-label-md text-ink sm:px-4 ${focusRing}`}
              >
                View
              </Link>
              <Link
                href={`/dashboard/invitations/${invitation.id}/edit`}
                className={`rounded-lg border border-line px-3 py-2 text-center text-label-md text-ink sm:px-4 ${focusRing}`}
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => onDelete(invitation)}
                className={`rounded-lg px-3 py-2 text-label-md text-error hover:bg-error/5 sm:px-4 ${focusRing}`}
              >
                Delete
              </button>
            </div>
          </div>
        </article>
      )}
    </main>
  );
}
