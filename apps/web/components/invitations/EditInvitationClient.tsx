'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { getInvitation, InvitationRecord, updateInvitation } from '@/lib/invitations';
import { InvitationForm } from './InvitationForm';

type State =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; invitation: InvitationRecord };

export function EditInvitationClient({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', invitation: await getInvitation(invitationId) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(`/dashboard/invitations/${invitationId}/edit`)}`
        );
      } else if (error instanceof ApiError && error.status === 404) {
        setState({ status: 'not-found' });
      } else {
        setState({ status: 'error', message: 'Check your connection and try again.' });
      }
    }
  }, [invitationId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(slug: string) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const invitation = await updateInvitation(invitationId, { slug });
      router.push(`/dashboard/invitations/${invitation.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(`/dashboard/invitations/${invitationId}/edit`)}`
        );
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        setState({ status: 'not-found' });
        return;
      }
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : 'We could not update this invitation. Please try again.'
      );
      setSubmitting(false);
    }
  }

  if (state.status === 'loading')
    return (
      <main
        aria-busy="true"
        aria-label="Loading invitation form"
        className="mx-auto max-w-2xl px-4 py-12 sm:px-6"
      >
        <div className="h-80 animate-pulse rounded-2xl border border-line bg-surface" />
      </main>
    );
  if (state.status === 'not-found')
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-headline-md text-ink">Invitation not found</h1>
        <p className="mt-3 text-body-md text-muted">
          This invitation is unavailable or may have been removed.
        </p>
        <Link
          href="/dashboard/invitations"
          className="mt-7 inline-flex rounded-xl bg-primary px-5 py-3 text-label-md text-white"
        >
          Back to Invitations
        </Link>
      </main>
    );
  if (state.status === 'error')
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-headline-md text-ink">Invitation unavailable</h1>
        <p role="alert" className="mt-3 text-body-md text-muted">
          {state.message}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-7 rounded-xl border border-line px-5 py-3 text-label-md text-ink"
        >
          Try again
        </button>
      </main>
    );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
      <Link
        href={`/dashboard/invitations/${invitationId}`}
        className="rounded-lg text-label-md text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        ← Back to Invitation
      </Link>
      <p className="mt-8 text-label-sm uppercase tracking-[0.16em] text-accent">
        Invitation record
      </p>
      <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
        Edit invitation
      </h1>
      <p className="mt-3 text-body-lg text-muted">
        Update the reserved slug for {state.invitation.event.title}.
      </p>
      <section className="mt-10 rounded-2xl border border-line bg-surface p-5 shadow-subtle sm:p-8">
        <InvitationForm
          initialSlug={state.invitation.slug}
          submitLabel="Save changes"
          cancelHref={`/dashboard/invitations/${invitationId}`}
          submitting={submitting}
          serverError={submitError}
          onSubmit={(slug) => void submit(slug)}
        />
      </section>
    </main>
  );
}
