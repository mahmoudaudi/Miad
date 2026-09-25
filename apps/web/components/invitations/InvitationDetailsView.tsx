import { PublishButton } from '@/components/ui/ActionButtons';
import { ShareButton } from '@/components/ui/ShareButton';
import Link from 'next/link';
import React from 'react';
import { formatEventDate } from '@/lib/events';
import type { InvitationRecord } from '@/lib/invitations';

export type InvitationDetailsState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; invitation: InvitationRecord };

type Props = {
  state: InvitationDetailsState;
  publishing: boolean;
  publicationError: string | null;
  publicationSuccess: string | null;
  publicOrigin?: string;
  onRetry: () => void;
  onDelete: () => void;
  onPublicationChange: (published: boolean) => void;
  onCopyPublicUrl?: (url: string) => void;
  onSharePublicUrl?: (url: string) => void;
};
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function InvitationDetailsView({
  state,
  publishing,
  publicationError,
  publicationSuccess,
  publicOrigin = '',
  onRetry,
  onDelete,
  onPublicationChange,
}: Props) {
  if (state.status === 'loading')
    return (
      <main
        aria-busy="true"
        aria-label="Loading invitation"
        className="mx-auto max-w-4xl px-4 py-12 sm:px-6"
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
          className={`mt-7 inline-flex rounded-xl bg-primary px-5 py-3 text-label-md text-white ${focusRing}`}
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
          onClick={onRetry}
          className={`mt-7 rounded-xl border border-line px-5 py-3 text-label-md text-ink ${focusRing}`}
        >
          Try again
        </button>
      </main>
    );

  const invitation = state.invitation;
  const isPublished = invitation.status === 'PUBLISHED' && Boolean(invitation.publishedAt);
  const publicPath = `/invite/${invitation.slug}`;
  const publicUrl = `${publicOrigin}${publicPath}`;
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <Link
        href="/dashboard/invitations"
        className={`rounded-lg text-label-md text-muted hover:text-ink ${focusRing}`}
      >
        ← Back to Invitations
      </Link>
      <article className="mt-8 rounded-2xl border border-line bg-surface shadow-subtle">
        <header className="border-b border-line p-6 sm:p-9">
          <p className="text-label-sm uppercase tracking-[0.16em] text-accent">
            {invitation.status}
          </p>
          <h1 className="mt-3 break-words font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
            {invitation.event.title}
          </h1>
          <p className="mt-3 break-all text-body-md text-muted">
            Your invitation · {invitation.slug}
          </p>
          <div className="mt-7 grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:flex sm:flex-wrap">
            <PublishButton
              onClick={() => onPublicationChange(!isPublished)}
              state={
                publishing
                  ? 'loading'
                  : publicationError
                    ? 'error'
                    : isPublished && publicationSuccess
                      ? 'success'
                      : 'idle'
              }
              label={isPublished ? 'Unpublish' : 'Publish'}
              busyLabel={isPublished ? 'Unpublishing…' : 'Publishing…'}
              successLabel="Published"
              errorLabel={isPublished ? 'Retry unpublish' : 'Retry publish'}
              variant={isPublished ? 'secondary' : 'primary'}
            />
            <Link
              href={`/dashboard/invitations/${invitation.id}/design`}
              className={`rounded-xl border border-line px-4 py-3 text-center text-label-md text-ink hover:border-muted sm:px-5 ${focusRing}`}
            >
              Design
            </Link>
            <Link
              href={`/dashboard/invitations/${invitation.id}/media`}
              className={`rounded-xl border border-line px-4 py-3 text-center text-label-md text-ink hover:border-muted sm:px-5 ${focusRing}`}
            >
              Media
            </Link>
            <Link
              href={`/dashboard/invitations/${invitation.id}/analytics`}
              className={`rounded-xl border border-line px-4 py-3 text-center text-label-md text-ink hover:border-muted sm:px-5 ${focusRing}`}
            >
              Analytics
            </Link>
            <Link
              href={`/dashboard/invitations/${invitation.id}/community`}
              className={`rounded-xl border border-line px-4 py-3 text-center text-label-md text-ink hover:border-muted sm:px-5 ${focusRing}`}
            >
              Community
            </Link>
            <Link
              href={`/dashboard/invitations/${invitation.id}/edit`}
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
          {(publicationError || publicationSuccess) && (
            <div className="mt-5" aria-live="polite">
              {publicationError && (
                <p role="alert" className="text-body-sm text-error">
                  {publicationError}
                </p>
              )}
              {publicationSuccess && (
                <p className="text-body-sm text-success">{publicationSuccess}</p>
              )}
            </div>
          )}
        </header>
        <dl className="grid gap-6 p-6 sm:grid-cols-2 sm:p-9">
          <div>
            <dt className="text-label-sm uppercase tracking-wider text-muted">Occasion date</dt>
            <dd className="mt-2 text-body-md text-ink">
              {formatEventDate(invitation.event.eventDate)}
            </dd>
          </div>
          {isPublished && (
            <div className="sm:col-span-2">
              <dt className="text-label-sm uppercase tracking-wider text-muted">Public URL</dt>
              <dd className="mt-2 space-y-4">
                <Link
                  href={publicPath}
                  target="_blank"
                  rel="noreferrer"
                  className={`break-all text-body-md text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary ${focusRing}`}
                >
                  {publicUrl}
                </Link>
                <div className="flex flex-wrap gap-2">
                  <ShareButton url={publicUrl} title={invitation.event.title} />
                  <Link
                    href={`/dashboard/invitations/${invitation.id}/editor`}
                    className={`rounded-lg border border-line px-4 py-2 text-label-md text-ink ${focusRing}`}
                  >
                    Edit published design
                  </Link>
                </div>
                <div className="inline-flex rounded-xl border border-line bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(publicUrl)}`}
                    width={160}
                    height={160}
                    alt="QR code for the public invitation"
                  />
                </div>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-label-sm uppercase tracking-wider text-muted">Status</dt>
            <dd className="mt-2 text-body-md text-ink">{invitation.status}</dd>
          </div>
          <div>
            <dt className="text-label-sm uppercase tracking-wider text-muted">Published</dt>
            <dd className="mt-2 text-body-md text-ink">
              {invitation.publishedAt
                ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                    new Date(invitation.publishedAt)
                  )
                : 'Not published'}
            </dd>
          </div>
          <div>
            <dt className="text-label-sm uppercase tracking-wider text-muted">Created</dt>
            <dd className="mt-2 text-body-md text-ink">
              {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                new Date(invitation.createdAt)
              )}
            </dd>
          </div>
        </dl>
      </article>
    </main>
  );
}
