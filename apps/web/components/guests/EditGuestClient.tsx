'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { guestToForm } from '@/lib/guest-form';
import { getGuest, GuestInput, GuestRecord, updateGuest } from '@/lib/guests';
import { GuestForm } from './GuestForm';

type State =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; guest: GuestRecord };

export function EditGuestClient({ eventId, guestId }: { eventId: string; guestId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const base = `/dashboard/events/${eventId}/guests`;
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', guest: await getGuest(eventId, guestId) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        router.replace(`/login?next=${encodeURIComponent(`${base}/${guestId}/edit`)}`);
      else if (error instanceof ApiError && error.status === 404) setState({ status: 'not-found' });
      else setState({ status: 'error', message: 'Check your connection and try again.' });
    }
  }, [base, eventId, guestId, router]);
  useEffect(() => {
    void load();
  }, [load]);
  const submit = async (input: GuestInput) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await updateGuest(eventId, guestId, input);
      router.push(`${base}/${guestId}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setState({ status: 'not-found' });
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`${base}/${guestId}/edit`)}`);
        return;
      }
      setSubmitError(error instanceof ApiError ? error.message : 'We could not update this guest.');
      setSubmitting(false);
    }
  };
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
          onClick={() => void load()}
          className="mt-7 rounded-xl border border-line px-5 py-3 text-label-md"
        >
          Try again
        </button>
      </main>
    );
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
      <Link href={`${base}/${guestId}`} className="text-label-md text-muted hover:text-ink">
        ← Back to Guest
      </Link>
      <p className="mt-8 text-label-sm uppercase tracking-[0.16em] text-accent">Guest details</p>
      <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
        Edit guest
      </h1>
      <section className="mt-10 rounded-2xl border border-line bg-surface p-5 shadow-subtle sm:p-8">
        <GuestForm
          initialValues={guestToForm(state.guest)}
          submitLabel="Save changes"
          cancelHref={`${base}/${guestId}`}
          submitting={submitting}
          serverError={submitError}
          onSubmit={(input) => void submit(input)}
        />
      </section>
    </main>
  );
}
