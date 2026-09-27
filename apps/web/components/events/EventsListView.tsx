import Link from 'next/link';
import React from 'react';
import { HtmlInvitationFrame } from '@/components/invitations/HtmlInvitationFrame';
import type { EventRecord } from '@/lib/events';
import { formatEventDate, formatEventTime } from '@/lib/events';
import type { InvitationRecord } from '@/lib/invitations';

export type EventsListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; events: EventRecord[] };

type Props = {
  state: EventsListState;
  projects: RecentProjectsState;
  successMessage?: string | null;
  onRetry: () => void;
  onRetryProjects: () => void;
  onDelete: (event: EventRecord) => void;
};

export type RecentProjectsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; invitations: InvitationRecord[] };

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

function RecentProjectCards({ invitations }: { invitations: InvitationRecord[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {invitations.map((invitation) => (
        <li key={invitation.id}>
          <Link
            href={`/dashboard/invitations/${invitation.id}/editor`}
            aria-label={`Open invitation editor: ${invitation.event.title}`}
            className={`group block min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-subtle transition duration-200 hover:-translate-y-0.5 hover:shadow-lift ${focusRing}`}
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-[#f3f4f6]">
              {invitation.hasDesign ? (
                <HtmlInvitationFrame
                  src={`/api/designs/${encodeURIComponent(invitation.id)}/render`}
                  title={`${invitation.event.title} invitation preview`}
                  className="pointer-events-none h-full w-full"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
                  <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                    mail
                  </span>
                  <span className="text-xs">Design preview coming soon</span>
                </div>
              )}
              <span
                className={`absolute start-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-sm ${invitation.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-800' : 'bg-white/95 text-[#52525b]'}`}
              >
                {invitation.status === 'PUBLISHED' ? 'Published' : 'Draft'}
              </span>
            </div>
            <div className="flex min-h-[92px] items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-medium text-ink">{invitation.event.title}</h2>
                <p className="mt-1 truncate text-xs text-muted">
                  {formatEventDate(invitation.event.eventDate)}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  Updated{' '}
                  {new Intl.DateTimeFormat('en', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }).format(new Date(invitation.updatedAt))}
                </p>
              </div>
              <span
                className="material-symbols-outlined mt-0.5 shrink-0 text-lg text-primary transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              >
                arrow_outward
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function EventsListView({
  state,
  projects,
  successMessage,
  onRetry,
  onRetryProjects,
  onDelete,
}: Props) {
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
          className="miad-feedback-enter mt-8 rounded-xl border border-accent/25 bg-surface px-4 py-3 text-body-sm text-ink"
        >
          {successMessage}
        </p>
      )}

      <section className="mt-10" aria-labelledby="recent-projects-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-label-sm uppercase tracking-[0.14em] text-accent">Your designs</p>
            <h2
              id="recent-projects-heading"
              className="mt-1 font-display text-headline-md text-ink"
            >
              Recent Projects
            </h2>
          </div>
          {projects.status === 'ready' && projects.invitations.length > 0 && (
            <span className="text-body-sm text-muted">{projects.invitations.length} projects</span>
          )}
        </div>
        {projects.status === 'loading' && (
          <div
            aria-busy="true"
            aria-label="Loading recent projects"
            className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="animate-pulse overflow-hidden rounded-xl border border-line bg-surface shadow-subtle"
              >
                <div className="aspect-[4/3] bg-[#e5e7eb]" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-2/3 rounded bg-[#e5e7eb]" />
                  <div className="h-3 w-1/2 rounded bg-[#e5e7eb]" />
                </div>
              </div>
            ))}
          </div>
        )}
        {projects.status === 'error' && (
          <div className="miad-feedback-enter rounded-xl border border-line bg-surface p-6 text-center shadow-subtle">
            <p role="alert" className="text-body-sm text-muted">
              We could not load recent projects. {projects.message}
            </p>
            <button
              type="button"
              onClick={onRetryProjects}
              className={`mt-4 rounded-lg border border-line px-4 py-2 text-label-md text-ink transition-colors hover:border-muted ${focusRing}`}
            >
              Try again
            </button>
          </div>
        )}
        {projects.status === 'ready' && projects.invitations.length === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-surface/70 px-6 py-10 text-center">
            <span className="material-symbols-outlined text-3xl text-accent" aria-hidden="true">
              auto_awesome
            </span>
            <h3 className="mt-3 font-display text-headline-sm text-ink">No projects yet</h3>
            <p className="mt-2 text-body-sm text-muted">
              Your invitations will appear here after you create one.
            </p>
            <Link
              href="/dashboard/invitations/new"
              className={`mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-label-md text-white transition-colors hover:bg-primary/90 ${focusRing}`}
            >
              Create an invitation
            </Link>
          </div>
        )}
        {projects.status === 'ready' && projects.invitations.length > 0 && (
          <RecentProjectCards invitations={projects.invitations} />
        )}
      </section>

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
        <section className="miad-feedback-enter mt-10 rounded-2xl border border-line bg-surface p-8 text-center shadow-subtle sm:p-12">
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
