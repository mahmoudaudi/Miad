import Link from 'next/link';
import React from 'react';
import type { GuestRecord } from '@/lib/guests';
import { rsvpLabel } from '@/lib/guests';

export type GuestsListState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; guests: GuestRecord[] };

type Props = {
  eventId: string;
  state: GuestsListState;
  successMessage?: string | null;
  onRetry: () => void;
  onDelete: (guest: GuestRecord) => void;
};
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function GuestsListView({ eventId, state, successMessage, onRetry, onDelete }: Props) {
  const base = `/dashboard/events/${eventId}/guests`;
  const responseSummary =
    state.status === 'ready'
      ? {
          attending: state.guests.filter((guest) => guest.rsvp?.status === 'ATTENDING').length,
          declined: state.guests.filter((guest) => guest.rsvp?.status === 'NOT_ATTENDING').length,
          pending: state.guests.filter((guest) => guest.rsvp?.status === 'PENDING').length,
          awaiting: state.guests.filter((guest) => !guest.rsvp).length,
          attendees: state.guests.reduce(
            (total, guest) =>
              total + (guest.rsvp?.status === 'ATTENDING' ? guest.rsvp.attendeesCount : 0),
            0
          ),
        }
      : null;
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <Link
        href="/dashboard/invitations"
        className={`text-label-md text-muted hover:text-ink ${focusRing}`}
      >
        ← Back to Invitations
      </Link>
      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm uppercase tracking-[0.16em] text-accent">Guest management</p>
          <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
            Guests
          </h1>
          <p className="mt-3 text-body-lg text-muted">
            Manage invitations and see real attendance confirmations.
          </p>
        </div>
        <Link
          href={`${base}/new`}
          className={`w-full rounded-xl bg-primary px-5 py-3 text-center text-label-md text-white sm:w-auto ${focusRing}`}
        >
          Add Guest
        </Link>
      </div>
      {successMessage && (
        <p
          role="status"
          className="mt-8 rounded-xl border border-accent/25 bg-surface px-4 py-3 text-body-sm text-ink"
        >
          {successMessage}
        </p>
      )}
      {responseSummary && (
        <section
          aria-label="Attendance responses"
          className="mt-8 grid grid-cols-2 gap-3 min-[390px]:grid-cols-3 xl:grid-cols-5"
        >
          {[
            ['Attending', responseSummary.attending],
            ['Attendees', responseSummary.attendees],
            ['Declined', responseSummary.declined],
            ['Maybe', responseSummary.pending],
            ['Awaiting', responseSummary.awaiting],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line bg-surface p-4">
              <p className="text-label-sm uppercase tracking-[0.12em] text-muted">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
            </div>
          ))}
        </section>
      )}
      {state.status === 'loading' && (
        <div
          aria-busy="true"
          aria-label="Loading guests"
          className="mt-10 h-72 animate-pulse rounded-2xl border border-line bg-surface"
        />
      )}
      {state.status === 'not-found' && (
        <section className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center">
          <h2 className="font-display text-headline-md text-ink">Event not found</h2>
          <p className="mt-3 text-body-md text-muted">
            This event is unavailable or may have been removed.
          </p>
        </section>
      )}
      {state.status === 'error' && (
        <section className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center">
          <h2 className="font-display text-headline-md text-ink">We could not load guests</h2>
          <p role="alert" className="mt-3 text-body-md text-muted">
            {state.message}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className={`mt-6 rounded-xl border border-line px-5 py-3 text-label-md ${focusRing}`}
          >
            Try again
          </button>
        </section>
      )}
      {state.status === 'ready' && state.guests.length === 0 && (
        <section className="mt-10 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-line bg-surface p-8 text-center shadow-subtle">
          <span className="material-symbols-outlined text-3xl text-accent" aria-hidden="true">
            group
          </span>
          <h2 className="mt-4 font-display text-headline-md text-ink">No guests yet</h2>
          <p className="mt-3 max-w-md text-body-md text-muted">
            Add your first guest, or share the published invitation to collect attendance
            confirmations.
          </p>
          <Link
            href={`${base}/new`}
            className={`mt-7 rounded-xl bg-primary px-5 py-3 text-label-md text-white ${focusRing}`}
          >
            Add Guest
          </Link>
        </section>
      )}
      {state.status === 'ready' && state.guests.length > 0 && (
        <ul className="mt-10 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle">
          {state.guests.map((guest) => (
            <li
              key={guest.id}
              className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
            >
              <div className="min-w-0">
                <Link
                  href={`${base}/${guest.id}`}
                  className={`break-words font-display text-headline-sm text-ink hover:text-primary ${focusRing}`}
                >
                  {guest.name}
                </Link>
                <p className="mt-1 break-words text-body-sm text-muted">
                  {guest.email ?? guest.phone ?? 'No contact details'}
                </p>
                <p
                  className={`miad-badge mt-2 ${guest.rsvp?.status === 'ATTENDING' ? '!bg-success/10 !text-success' : guest.rsvp?.status === 'NOT_ATTENDING' ? '!bg-surface-muted !text-muted' : ''}`}
                >
                  {rsvpLabel(guest.rsvp?.status ?? null)}
                  {guest.rsvp?.status === 'ATTENDING'
                    ? ` · ${guest.rsvp.attendeesCount} attending`
                    : ''}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Link
                  href={`${base}/${guest.id}/edit`}
                  className={`rounded-lg border border-line px-4 py-2 text-center text-label-md text-ink ${focusRing}`}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(guest)}
                  className={`rounded-lg px-4 py-2 text-label-md text-error hover:bg-error/5 ${focusRing}`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
