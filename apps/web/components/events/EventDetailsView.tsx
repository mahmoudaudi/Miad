import Link from 'next/link';
import React from 'react';
import type { EventRecord } from '@/lib/events';
import { formatEventDate, formatEventTime } from '@/lib/events';

export type EventDetailsState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; event: EventRecord };

type Props = { state: EventDetailsState; onRetry: () => void; onDelete: () => void };
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

function StateMessage({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <section className="rounded-2xl border border-line bg-surface p-8 shadow-subtle sm:p-12">
        <h1 className="font-display text-headline-md text-ink">{title}</h1>
        <p role={onRetry ? 'alert' : undefined} className="mt-3 text-body-md text-muted">
          {message}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={`rounded-xl border border-line px-5 py-3 text-label-md text-ink ${focusRing}`}
            >
              Try again
            </button>
          )}
          <Link
            href="/dashboard/events"
            className={`rounded-xl bg-primary px-5 py-3 text-label-md text-white ${focusRing}`}
          >
            Back to Invitations
          </Link>
        </div>
      </section>
    </main>
  );
}

export function EventDetailsView({ state, onRetry, onDelete }: Props) {
  if (state.status === 'loading')
    return (
      <main
        aria-busy="true"
        aria-label="Loading invitation"
        className="mx-auto max-w-[1000px] px-4 py-12 sm:px-6"
      >
        <div className="h-96 animate-pulse rounded-2xl border border-line bg-surface" />
      </main>
    );
  if (state.status === 'not-found')
    return (
      <StateMessage
        title="Invitation not found"
        message="This invitation is unavailable or may have been removed."
      />
    );
  if (state.status === 'error')
    return (
      <StateMessage
        title="We could not load this invitation"
        message={state.message}
        onRetry={onRetry}
      />
    );

  const event = state.event;
  const time = formatEventTime(event.startTime, event.endTime);
  const coordinates =
    event.latitude !== null && event.longitude !== null
      ? `${event.latitude}, ${event.longitude}`
      : event.latitude !== null
        ? `${event.latitude}`
        : event.longitude !== null
          ? `${event.longitude}`
          : null;
  return (
    <main className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <Link
        href="/dashboard/events"
        className={`rounded-lg text-label-md text-muted hover:text-ink ${focusRing}`}
      >
        ← Back to Invitations
      </Link>
      <article className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle">
        <header className="border-b border-line px-5 py-8 sm:px-9 sm:py-10">
          <p className="text-label-sm uppercase tracking-[0.16em] text-accent">{event.eventType}</p>
          <h1 className="mt-3 break-words font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
            {event.title}
          </h1>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <Link
              href={`/dashboard/events/${event.id}/guests`}
              className={`rounded-xl border border-line px-4 py-3 text-center text-label-md text-ink hover:border-muted sm:px-5 ${focusRing}`}
            >
              Guests
            </Link>
            <Link
              href={`/dashboard/events/${event.id}/invitations`}
              className={`rounded-xl border border-line px-4 py-3 text-center text-label-md text-ink hover:border-muted sm:px-5 ${focusRing}`}
            >
              Design
            </Link>
            <Link
              href={`/dashboard/events/${event.id}/edit`}
              className={`rounded-xl bg-primary px-4 py-3 text-center text-label-md text-white sm:px-5 ${focusRing}`}
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={onDelete}
              className={`rounded-xl border border-error/30 px-4 py-3 text-label-md text-error hover:bg-error/5 sm:px-5 ${focusRing}`}
            >
              Delete
            </button>
          </div>
        </header>
        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-labelledby="event-details-heading" className="p-5 sm:p-9">
            <h2 id="event-details-heading" className="font-display text-headline-sm text-ink">
              Invitation details
            </h2>
            <dl className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <dt className="text-label-sm uppercase tracking-wider text-muted">Date</dt>
                <dd className="mt-2 text-body-md text-ink">{formatEventDate(event.eventDate)}</dd>
              </div>
              <div>
                <dt className="text-label-sm uppercase tracking-wider text-muted">Time</dt>
                <dd className="mt-2 text-body-md text-ink">{time ?? 'Not specified'}</dd>
              </div>
              <div>
                <dt className="text-label-sm uppercase tracking-wider text-muted">Venue</dt>
                <dd className="mt-2 break-words text-body-md text-ink">
                  {event.venueName ?? 'Not specified'}
                </dd>
              </div>
              <div>
                <dt className="text-label-sm uppercase tracking-wider text-muted">Coordinates</dt>
                <dd className="mt-2 break-words text-body-md text-ink">
                  {coordinates ?? 'Not specified'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-label-sm uppercase tracking-wider text-muted">Address</dt>
                <dd className="mt-2 whitespace-pre-wrap break-words text-body-md text-ink">
                  {event.venueAddress ?? 'Not specified'}
                </dd>
              </div>
            </dl>
          </section>
          <aside className="border-t border-line bg-background/60 p-5 sm:p-9 md:border-l md:border-t-0">
            <h2 className="font-display text-headline-sm text-ink">Description</h2>
            <p className="mt-4 whitespace-pre-wrap break-words text-body-md text-muted">
              {event.description ?? 'No description added.'}
            </p>
          </aside>
        </div>
      </article>
    </main>
  );
}
