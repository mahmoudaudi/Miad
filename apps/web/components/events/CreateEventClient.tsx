'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { emptyEventForm } from '@/lib/event-form';
import { createEvent, deleteEvent, EventInput } from '@/lib/events';
import { createInvitation } from '@/lib/invitations';
import { generateInvitationDesign } from '@/lib/invitation-designs';
import {
  clearPendingInvitationPrompt,
  readPendingInvitationPrompt,
} from '@/lib/pending-invitation-prompt';
import { EventForm } from './EventForm';
import { GenerationFailedNotice } from '@/components/invitations/GenerationFailedNotice';

export function CreateEventClient() {
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

  function invitationSlug(title: string): string {
    const base = title
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '-')
      .slice(0, 64);
    return `${base || 'invitation'}-${crypto.randomUUID().slice(0, 8)}`;
  }

  async function submit(input: EventInput) {
    setSubmitting(true);
    setError(null);
    setFailedInvitation(null);
    let createdEventId: string | null = null;
    try {
      const event = await createEvent(input);
      createdEventId = event.id;
      const invitation = await createInvitation({
        eventId: event.id,
        slug: invitationSlug(input.title),
      });
      // The event + invitation are now persisted. AI generation is a
      // best-effort enhancement: its failure must never roll them back.
      if (savedPrompt?.trim()) {
        setGenerating(true);
        try {
          await generateInvitationDesign(invitation.id, {
            prompt: savedPrompt.trim(),
            mode: 'generate',
          });
        } catch (generationError) {
          if (generationError instanceof ApiError && generationError.status === 401) {
            router.replace('/login?next=%2Fdashboard%2Finvitations');
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
      if (createdEventId) {
        try {
          await deleteEvent(createdEventId);
        } catch {
          // The invitation request may have succeeded before the response was lost.
          // In that case the related record intentionally remains recoverable.
        }
      }
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login?next=%2Fdashboard%2Finvitations%2Fnew');
        return;
      }
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'We could not create this invitation. Please try again.'
      );
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
        router.replace('/login?next=%2Fdashboard%2Finvitations');
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
      <Link
        href="/dashboard/invitations"
        className="rounded-lg text-label-md text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        ← Back to Invitations
      </Link>
      <p className="mt-8 text-label-sm uppercase tracking-[0.16em] text-accent">New celebration</p>
      <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
        Create an invitation
      </h1>
      <p className="mt-3 text-body-lg text-muted">
        Add the core event details. Your prompt will generate the first complete invitation design.
      </p>
      {savedPrompt && (
        <div
          role="status"
          className="mt-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-secondary px-4 py-3 text-body-sm text-ink"
        >
          <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">
            auto_awesome
          </span>
          <span>
            Your saved prompt is ready below. Complete the invitation details to continue.
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
        <EventForm
          key={savedPrompt ? 'saved-prompt-event-form' : 'empty-event-form'}
          initialValues={{ ...emptyEventForm, description: savedPrompt ?? '' }}
          submitLabel={generating ? 'Generating design…' : 'Create Invitation'}
          cancelHref="/dashboard/invitations"
          submitting={submitting || generating || failedInvitation !== null}
          serverError={error}
          onSubmit={(input) => void submit(input)}
        />
      </section>
    </main>
  );
}
