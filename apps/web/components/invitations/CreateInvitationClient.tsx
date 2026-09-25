'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { createInvitation } from '@/lib/invitations';
import {
  clearPendingInvitationPrompt,
  readPendingInvitationPrompt,
} from '@/lib/pending-invitation-prompt';
import { generateInvitationDesign } from '@/lib/invitation-designs';
import { GenerationFailedNotice } from './GenerationFailedNotice';
import { InvitationForm } from './InvitationForm';

export function CreateInvitationClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPrompt, setSavedPrompt] = useState<string | null>(null);
  const [failedInvitation, setFailedInvitation] = useState<{
    invitationId: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    setSavedPrompt(readPendingInvitationPrompt());
  }, []);

  async function submit(slug: string) {
    setSubmitting(true);
    setError(null);
    setFailedInvitation(null);
    try {
      const invitation = await createInvitation({ eventId, slug });
      // The invitation is now persisted. AI generation is a best-effort
      // enhancement: its failure must never discard the invitation.
      if (savedPrompt?.trim()) {
        setGenerating(true);
        try {
          await generateInvitationDesign(invitation.id, {
            prompt: savedPrompt.trim(),
            mode: 'generate',
          });
        } catch (generationError) {
          if (generationError instanceof ApiError && generationError.status === 401) {
            router.replace(
              `/login?next=${encodeURIComponent(`/dashboard/events/${eventId}/invitations/new`)}`
            );
            return;
          }
          setFailedInvitation({
            invitationId: invitation.id,
            message:
              generationError instanceof ApiError
                ? generationError.message
                : 'AI generation is unavailable right now.',
          });
          return;
        } finally {
          setGenerating(false);
        }
      }
      clearPendingInvitationPrompt();
      router.push(`/dashboard/invitations/${invitation.id}/editor`);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(`/dashboard/events/${eventId}/invitations/new`)}`
        );
        return;
      }
      if (caught instanceof ApiError && caught.status === 404) {
        setError('This event is unavailable or may have been removed.');
      } else {
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'We could not create this invitation. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function retryGeneration() {
    if (!failedInvitation || !savedPrompt?.trim() || generating) return;
    setGenerating(true);
    setError(null);
    try {
      await generateInvitationDesign(failedInvitation.invitationId, {
        prompt: savedPrompt.trim(),
        mode: 'generate',
      });
      const editorHref = `/dashboard/invitations/${failedInvitation.invitationId}/editor`;
      clearPendingInvitationPrompt();
      setFailedInvitation(null);
      router.push(editorHref);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(`/dashboard/events/${eventId}/invitations/new`)}`
        );
        return;
      }
      setFailedInvitation({
        invitationId: failedInvitation.invitationId,
        message:
          caught instanceof ApiError ? caught.message : 'AI generation is unavailable right now.',
      });
    } finally {
      setGenerating(false);
    }
  }

  const backHref = `/dashboard/events/${eventId}/invitations`;
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
      <Link
        href={backHref}
        className="rounded-lg text-label-md text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        ← Back to Invitation
      </Link>
      <p className="mt-8 text-label-sm uppercase tracking-[0.16em] text-accent">New invitation</p>
      <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
        Create an invitation
      </h1>
      <p className="mt-3 text-body-lg text-muted">
        Choose your invitation link. Your saved prompt will guide the first design.
      </p>
      {savedPrompt && (
        <div
          role="status"
          className="mt-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-secondary px-4 py-3 text-body-sm text-ink"
        >
          <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">
            auto_awesome
          </span>
          <span className="min-w-0">
            <span className="block font-medium">Your prompt is saved for this invitation.</span>
            <span className="mt-1 block line-clamp-2 text-muted">{savedPrompt}</span>
          </span>
        </div>
      )}
      {failedInvitation && (
        <GenerationFailedNotice
          message={failedInvitation.message}
          editorHref={`/dashboard/invitations/${failedInvitation.invitationId}/editor`}
          generating={generating}
          onRetry={() => void retryGeneration()}
        />
      )}
      <section className="mt-10 rounded-2xl border border-line bg-surface p-5 shadow-subtle sm:p-8">
        <InvitationForm
          submitLabel={generating ? 'Generating design…' : 'Create Invitation'}
          cancelHref={backHref}
          submitting={submitting || generating || failedInvitation !== null}
          serverError={error}
          onSubmit={(slug) => void submit(slug)}
        />
      </section>
    </main>
  );
}
