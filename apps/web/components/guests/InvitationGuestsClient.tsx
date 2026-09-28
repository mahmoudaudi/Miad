'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeleteConfirmationDialog } from '@/components/dashboard/DeleteConfirmationDialog';
import { ApiError } from '@/lib/api-client';
import {
  createInvitationGuest,
  deleteInvitationGuest,
  GuestInput,
  GuestRecord,
  rsvpLabel,
  updateInvitationGuest,
} from '@/lib/guests';
import { listInvitationGuests } from '@/lib/guests';
import { GuestForm } from './GuestForm';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; guests: GuestRecord[] };

export type GuestStatusFilter = 'ALL' | 'PENDING' | 'ATTENDING' | 'NOT_ATTENDING';
export type GuestSort = 'newest' | 'oldest' | 'name';

export function filterInvitationGuests(
  guests: GuestRecord[],
  query: string,
  status: GuestStatusFilter,
  sort: GuestSort
): GuestRecord[] {
  const needle = query.trim().toLocaleLowerCase();
  return guests
    .filter((guest) => {
      const guestStatus = guest.rsvp?.status ?? 'PENDING';
      const matchesStatus = status === 'ALL' || guestStatus === status;
      const matchesQuery =
        !needle ||
        [guest.name, guest.email ?? '', guest.phone ?? ''].some((value) =>
          value.toLocaleLowerCase().includes(needle)
        );
      return matchesStatus && matchesQuery;
    })
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'oldest'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt)
    );
}

export function summarizeInvitationGuests(guests: GuestRecord[]) {
  return {
    total: guests.length,
    pending: guests.filter((guest) => !guest.rsvp || guest.rsvp.status === 'PENDING').length,
    attending: guests.filter((guest) => guest.rsvp?.status === 'ATTENDING').length,
    declined: guests.filter((guest) => guest.rsvp?.status === 'NOT_ATTENDING').length,
    expected: guests.reduce(
      (sum, guest) => sum + (guest.rsvp?.status === 'ATTENDING' ? guest.rsvp.attendeesCount : 0),
      0
    ),
  };
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';
const emptyGuestRecords: GuestRecord[] = [];
const statusClass = (status: string) =>
  status === 'ATTENDING'
    ? 'border-success/20 bg-success/10 text-success'
    : status === 'NOT_ATTENDING'
      ? 'border-line bg-surface-muted text-muted'
      : 'border-amber-200 bg-amber-50 text-amber-800';

function responseDate(value: string | null | undefined): string {
  if (!value) return 'No response yet';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function InvitationGuestsClient({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const path = `/dashboard/invitations/${invitationId}/guests`;
  const [state, setState] = useState<State>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<GuestStatusFilter>('ALL');
  const [sort, setSort] = useState<GuestSort>('newest');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GuestRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<GuestRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', guests: await listInvitationGuests(invitationId) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(path)}`);
        return;
      }
      setState({ status: 'error', message: 'Check your connection and try again.' });
    }
  }, [invitationId, path, router]);
  useEffect(() => void load(), [load]);

  const guests = state.status === 'ready' ? state.guests : emptyGuestRecords;
  const visibleGuests = useMemo(
    () => filterInvitationGuests(guests, query, statusFilter, sort),
    [guests, query, statusFilter, sort]
  );
  const totals = useMemo(() => summarizeInvitationGuests(guests), [guests]);

  async function save(input: GuestInput) {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) await updateInvitationGuest(invitationId, editing.id, input);
      else await createInvitationGuest(invitationId, input);
      setNotice(editing ? 'Guest details updated.' : 'Guest added to this invitation.');
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(path)}`);
        return;
      }
      setFormError(error instanceof ApiError ? error.message : 'We could not save this guest.');
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    if (!selected || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteInvitationGuest(invitationId, selected.id);
      setNotice(`${selected.name} was removed.`);
      setSelected(null);
      await load();
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'We could not remove this guest.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <Link
        href={`/dashboard/invitations/${invitationId}`}
        className={`text-sm text-muted hover:text-ink ${focusRing}`}
      >
        ← Back to project
      </Link>
      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm uppercase tracking-[0.16em] text-accent">
            Invitation project
          </p>
          <h1 className="mt-2 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
            Guests
          </h1>
          <p className="mt-2 text-body-md text-muted">
            Track responses and expected attendance in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormError(null);
            setFormOpen(true);
          }}
          className={`rounded-xl bg-primary px-5 py-3 text-label-md text-white ${focusRing}`}
        >
          Add guest
        </button>
      </div>
      {notice && (
        <p
          role="status"
          className="miad-feedback-enter mt-5 rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-body-sm text-success"
        >
          {notice}
        </p>
      )}
      {state.status === 'ready' && (
        <section
          aria-label="Guest statistics"
          className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
        >
          {(
            [
              ['Total guests', totals.total],
              ['Pending', totals.pending],
              ['Attending', totals.attending],
              ['Declined', totals.declined],
              ['Expected attendees', totals.expected],
            ] as const
          ).map(([label, value]) => (
            <article
              key={label}
              className="rounded-2xl border border-line bg-surface p-4 shadow-subtle sm:p-5"
            >
              <p className="text-label-sm uppercase tracking-wide text-muted">{label}</p>
              <p className="mt-2 font-display text-3xl text-ink">{value}</p>
            </article>
          ))}
        </section>
      )}
      {formOpen && (
        <section className="miad-feedback-enter mt-7 rounded-2xl border border-line bg-surface p-5 shadow-subtle sm:p-7">
          <h2 className="font-display text-headline-sm text-ink">
            {editing ? 'Edit guest' : 'Add a guest'}
          </h2>
          <GuestForm
            key={editing?.id ?? 'new'}
            initialValues={
              editing
                ? {
                    name: editing.name,
                    email: editing.email ?? '',
                    phone: editing.phone ?? '',
                    status: editing.rsvp?.status ?? 'PENDING',
                    partySize: editing.rsvp?.attendeesCount ?? 0,
                    notes: editing.rsvp?.message ?? '',
                  }
                : undefined
            }
            submitLabel={editing ? 'Save changes' : 'Add guest'}
            cancelHref={path}
            submitting={submitting}
            serverError={formError}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
              setFormError(null);
            }}
            onSubmit={(input) => void save(input)}
          />
        </section>
      )}
      {state.status === 'loading' && (
        <div
          aria-busy="true"
          aria-label="Loading guests"
          className="mt-8 h-56 animate-pulse rounded-2xl border border-line bg-surface"
        />
      )}
      {state.status === 'error' && (
        <section className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
          <h2 className="font-display text-headline-md text-ink">We could not load guests</h2>
          <p role="alert" className="mt-3 text-body-md text-muted">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className={`mt-5 rounded-xl border border-line px-5 py-3 ${focusRing}`}
          >
            Try again
          </button>
        </section>
      )}
      {state.status === 'ready' && guests.length > 0 && (
        <section className="mt-7">
          <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_190px_170px] sm:p-5">
            <label className="text-label-sm text-muted">
              Search guests
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, email, or phone"
                className="miad-input mt-2"
              />
            </label>
            <label className="text-label-sm text-muted">
              RSVP status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as GuestStatusFilter)}
                className="miad-input mt-2"
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ATTENDING">Attending</option>
                <option value="NOT_ATTENDING">Declined</option>
              </select>
            </label>
            <label className="text-label-sm text-muted">
              Sort by
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as GuestSort)}
                className="miad-input mt-2"
              >
                <option value="newest">Recently added</option>
                <option value="oldest">Oldest added</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
          </div>
          {visibleGuests.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-line p-8 text-center text-body-md text-muted">
              No guests match these search and filter settings.
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle">
              <ul className="divide-y divide-line">
                {visibleGuests.map((guest) => {
                  const guestStatus = guest.rsvp?.status ?? 'PENDING';
                  return (
                    <li
                      key={guest.id}
                      className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="break-words font-display text-headline-sm text-ink">
                            {guest.name}
                          </h2>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(guestStatus)}`}
                          >
                            {rsvpLabel(guestStatus)}
                          </span>
                        </div>
                        <p className="mt-1 break-words text-sm text-muted">
                          {[guest.email, guest.phone].filter(Boolean).join(' · ') ||
                            'No contact details'}
                        </p>
                        <p className="mt-2 text-sm text-ink">
                          {guestStatus === 'ATTENDING'
                            ? `${guest.rsvp?.attendeesCount ?? 0} expected attendee${guest.rsvp?.attendeesCount === 1 ? '' : 's'}`
                            : guestStatus === 'NOT_ATTENDING'
                              ? 'Not attending'
                              : 'Awaiting response'}
                          <span className="mx-2 text-line">•</span>
                          {responseDate(guest.rsvp?.respondedAt)}
                        </p>
                        {guest.rsvp?.message && (
                          <p className="mt-2 line-clamp-2 text-sm text-muted">
                            Note: {guest.rsvp.message}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 sm:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(guest);
                            setFormError(null);
                            setFormOpen(true);
                          }}
                          className={`rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-surface-muted ${focusRing}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(guest);
                            setDeleteError(null);
                          }}
                          className={`rounded-lg px-4 py-2 text-sm text-error hover:bg-error/5 ${focusRing}`}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}
      {state.status === 'ready' && guests.length === 0 && !formOpen && (
        <section className="mt-8 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
          <span aria-hidden="true" className="material-symbols-outlined text-3xl text-accent">
            groups
          </span>
          <h2 className="mt-4 font-display text-headline-md text-ink">
            Your guest list starts here
          </h2>
          <p className="mt-2 max-w-md text-body-md text-muted">
            Add guests or share your published invitation to collect responses automatically.
          </p>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className={`mt-6 rounded-xl bg-primary px-5 py-3 text-label-md text-white ${focusRing}`}
          >
            Add your first guest
          </button>
        </section>
      )}
      {selected && (
        <DeleteConfirmationDialog
          title="Remove this guest?"
          description={`“${selected.name}” and their RSVP will be permanently removed.`}
          confirmLabel="Remove guest"
          busyLabel="Removing…"
          busy={deleting}
          error={deleteError}
          onCancel={() => {
            if (!deleting) setSelected(null);
          }}
          onConfirm={() => void remove()}
        />
      )}
    </main>
  );
}
