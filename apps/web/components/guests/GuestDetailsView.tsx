import Link from 'next/link';
import React from 'react';
import type { GuestRecord } from '@/lib/guests';
import { rsvpLabel } from '@/lib/guests';

export type GuestDetailsState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; guest: GuestRecord };
type Props = {
  eventId: string;
  state: GuestDetailsState;
  onRetry: () => void;
  onDelete: () => void;
};

export function GuestDetailsView({ eventId, state, onRetry, onDelete }: Props) {
  const base = `/dashboard/events/${eventId}/guests`;
  if (state.status === 'loading')
    return (
      <main aria-busy="true" className="mx-auto max-w-3xl px-4 py-12">
        <div className="h-96 animate-pulse rounded-2xl border border-line bg-surface" />
      </main>
    );
  if (state.status === 'not-found')
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-headline-md text-ink">Guest not found</h1>
        <p className="mt-3 text-body-md text-muted">
          This guest is unavailable or may have been removed.
        </p>
        <Link
          href={base}
          className="mt-7 inline-flex rounded-xl bg-primary px-5 py-3 text-label-md text-white"
        >
          Back to Guests
        </Link>
      </main>
    );
  if (state.status === 'error')
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-headline-md text-ink">We could not load this guest</h1>
        <p role="alert" className="mt-3 text-body-md text-muted">
          {state.message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-7 rounded-xl border border-line px-5 py-3 text-label-md"
        >
          Try again
        </button>
      </main>
    );
  const { guest } = state;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
      <Link href={base} className="text-label-md text-muted hover:text-ink">
        ← Back to Guests
      </Link>
      <article className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle">
        <header className="border-b border-line p-6 sm:p-9">
          <p className="text-label-sm uppercase tracking-[0.16em] text-accent">
            {rsvpLabel(guest.rsvp?.status ?? null)}
          </p>
          <h1 className="mt-3 break-words font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
            {guest.name}
          </h1>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <Link
              href={`${base}/${guest.id}/edit`}
              className="rounded-xl bg-primary px-5 py-3 text-center text-label-md text-white"
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-xl border border-error/30 px-5 py-3 text-label-md text-error"
            >
              Delete
            </button>
          </div>
        </header>
        <div className="grid gap-8 p-6 sm:grid-cols-2 sm:p-9">
          <section>
            <h2 className="font-display text-headline-sm text-ink">Contact</h2>
            <dl className="mt-5 space-y-4 text-body-md">
              <div>
                <dt className="text-muted">Email</dt>
                <dd className="mt-1 break-words text-ink">{guest.email ?? 'Not provided'}</dd>
              </div>
              <div>
                <dt className="text-muted">Phone</dt>
                <dd className="mt-1 break-words text-ink">{guest.phone ?? 'Not provided'}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h2 className="font-display text-headline-sm text-ink">Confirm Attendance</h2>
            {guest.rsvp ? (
              <dl className="mt-5 space-y-4 text-body-md">
                <div>
                  <dt className="text-muted">Response</dt>
                  <dd className="mt-1 text-ink">{rsvpLabel(guest.rsvp.status)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Attendees</dt>
                  <dd className="mt-1 text-ink">{guest.rsvp.attendeesCount}</dd>
                </div>
                <div>
                  <dt className="text-muted">Message</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-ink">
                    {guest.rsvp.message ?? 'No message'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-5 text-body-md text-muted">Awaiting a response.</p>
            )}
          </section>
        </div>
      </article>
    </main>
  );
}
