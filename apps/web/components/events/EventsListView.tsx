import Link from 'next/link';
import React from 'react';
import type { EventRecord } from '@/lib/events';
import { formatEventDate, formatEventTime } from '@/lib/events';

export type EventsListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; events: EventRecord[] };

type Props = {
  state: EventsListState;
  successMessage?: string | null;
  onRetry: () => void;
  onDelete: (event: EventRecord) => void;
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function EventsListView({ state, successMessage, onRetry, onDelete }: Props) {
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm uppercase tracking-[0.16em] text-accent">Your creations</p>
          <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
            Invitations
          </h1>
          <p className="mt-3 max-w-xl text-body-lg text-muted">
            Every invitation can be for any occasion, from a wedding to a private ceremony.
          </p>
        </div>
        <Link
          href="/dashboard/invitations/new"
          className={`inline-flex w-full justify-center rounded-xl bg-primary px-5 py-3 text-label-md text-white hover:bg-primary/90 sm:w-auto ${focusRing}`}
        >
          Create Invitation
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

      {state.status === 'loading' && (
        <section
          aria-busy="true"
          aria-label="Loading invitations"
          className="mt-10 grid gap-5 md:grid-cols-2"
        >
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-2xl border border-line bg-surface"
            />
          ))}
        </section>
      )}

      {state.status === 'error' && (
        <section className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center shadow-subtle sm:p-12">
          <h2 className="font-display text-headline-md text-ink">
            We could not load your invitations
          </h2>
          <p role="alert" className="mt-3 text-body-md text-muted">
            {state.message}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className={`mt-6 rounded-xl border border-line px-5 py-3 text-label-md text-ink hover:border-muted ${focusRing}`}
          >
            Try again
          </button>
        </section>
      )}

      {state.status === 'ready' && state.events.length === 0 && (
        <section className="mt-10 flex min-h-80 flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-14 text-center shadow-subtle">
          <span className="material-symbols-outlined text-3xl text-accent" aria-hidden="true">
            event_available
          </span>
          <h2 className="mt-5 font-display text-headline-md text-ink">No invitations yet</h2>
          <p className="mt-3 max-w-md text-body-md text-muted">
            Create your first invitation and its details will appear here.
          </p>
          <Link
            href="/dashboard/invitations/new"
            className={`mt-7 rounded-xl bg-primary px-5 py-3 text-label-md text-white ${focusRing}`}
          >
            Create Invitation
          </Link>
        </section>
      )}

      {state.status === 'ready' && state.events.length > 0 && (
        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {state.events.map((event) => {
            const time = formatEventTime(event.startTime, event.endTime);
            return (
              <li
                key={event.id}
                className="flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-subtle sm:p-7"
              >
                <p className="text-label-sm uppercase tracking-[0.14em] text-accent">
                  {event.eventType}
                </p>
                <h2 className="mt-2 break-words font-display text-headline-md text-ink">
                  {event.title}
                </h2>
                <div className="mt-5 space-y-2 text-body-md text-muted">
                  <p className="flex items-start gap-2">
                    <span
                      className="material-symbols-outlined mt-0.5 text-[18px]"
                      aria-hidden="true"
                    >
                      calendar_today
                    </span>
                    <span>{formatEventDate(event.eventDate)}</span>
                  </p>
                  {time && (
                    <p className="flex items-start gap-2">
                      <span
                        className="material-symbols-outlined mt-0.5 text-[18px]"
                        aria-hidden="true"
                      >
                        schedule
                      </span>
                      <span>{time}</span>
                    </p>
                  )}
                  {event.venueName && (
                    <p className="flex items-start gap-2">
                      <span
                        className="material-symbols-outlined mt-0.5 text-[18px]"
                        aria-hidden="true"
                      >
                        location_on
                      </span>
                      <span>{event.venueName}</span>
                    </p>
                  )}
                </div>
                <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-6 sm:flex sm:flex-wrap">
                  <Link
                    href={
                      event.invitationId
                        ? `/dashboard/invitations/${event.invitationId}`
                        : `/dashboard/events/${event.id}`
                    }
                    className={`rounded-lg border border-line px-3 py-2 text-center text-label-md text-ink hover:border-muted sm:px-4 ${focusRing}`}
                  >
                    View
                  </Link>
                  <Link
                    href={`/dashboard/events/${event.id}/edit`}
                    className={`rounded-lg border border-line px-3 py-2 text-center text-label-md text-ink hover:border-muted sm:px-4 ${focusRing}`}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDelete(event)}
                    className={`rounded-lg px-3 py-2 text-label-md text-error hover:bg-error/5 sm:px-4 ${focusRing}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
