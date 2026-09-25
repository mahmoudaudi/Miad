import Link from 'next/link';
import React from 'react';
import { formatFileSize, MediaRecord } from '@/lib/media';

export type MediaLibraryState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: MediaRecord[]; nextCursor: string | null };

export type MediaUploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string; progress: number }
  | { status: 'finalizing'; fileName: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string; retryable: boolean };

type Props = {
  invitationId: string;
  state: MediaLibraryState;
  upload: MediaUploadState;
  loadingMore: boolean;
  loadMoreError: string | null;
  onRetryLoad: () => void;
  onFileSelected: (file: File | null) => void;
  onRetryUpload: () => void;
  onLoadMore: () => void;
  onDelete: (item: MediaRecord) => void;
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function MediaLibraryView({
  invitationId,
  state,
  upload,
  loadingMore,
  loadMoreError,
  onRetryLoad,
  onFileSelected,
  onRetryUpload,
  onLoadMore,
  onDelete,
}: Props) {
  const uploadBusy = upload.status === 'uploading' || upload.status === 'finalizing';
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <Link
        href={`/dashboard/invitations/${invitationId}`}
        className={`text-label-md text-muted hover:text-ink ${focusRing}`}
      >
        ← Back to Invitation
      </Link>
      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm uppercase tracking-[0.16em] text-accent">Invitation media</p>
          <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
            Media
          </h1>
          <p className="mt-3 text-body-lg text-muted">
            Upload images for this invitation. JPEG, PNG, or WebP · up to 6&nbsp;MB.
          </p>
        </div>
        {state.status === 'ready' && (
          <label
            className={`relative inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-primary px-5 py-3 text-center text-label-md text-white sm:w-auto ${
              uploadBusy ? 'opacity-50' : 'hover:bg-primary/90'
            } focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${focusRing}`}
          >
            {uploadBusy ? 'Uploading…' : 'Choose image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={uploadBusy}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = '';
                onFileSelected(file);
              }}
            />
          </label>
        )}
      </div>

      {upload.status !== 'idle' && (
        <div className="mt-6" aria-live="polite">
          {upload.status === 'uploading' && (
            <div
              role="status"
              className="rounded-xl border border-line bg-surface px-4 py-3 text-body-sm text-ink"
            >
              <p>
                Uploading “{upload.fileName}”… {upload.progress}%
              </p>
              <div
                role="progressbar"
                aria-label="Upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={upload.progress}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
              >
                <div
                  className="h-full rounded-full bg-primary origin-left transition-transform duration-200"
                  style={{ transform: `scaleX(${upload.progress / 100})` }}
                />
              </div>
            </div>
          )}
          {upload.status === 'finalizing' && (
            <p
              role="status"
              className="rounded-xl border border-line bg-surface px-4 py-3 text-body-sm text-ink"
            >
              Saving “{upload.fileName}”…
            </p>
          )}
          {upload.status === 'success' && (
            <p
              role="status"
              className="rounded-xl border border-accent/25 bg-surface px-4 py-3 text-body-sm text-ink"
            >
              {upload.message}
            </p>
          )}
          {upload.status === 'error' && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-error/20 bg-surface px-4 py-3 text-body-sm text-error sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{upload.message}</span>
              {upload.retryable && (
                <button
                  type="button"
                  onClick={onRetryUpload}
                  className={`self-start rounded-lg border border-error/40 px-4 py-2 text-label-md text-error hover:bg-error/5 sm:self-auto ${focusRing}`}
                >
                  Retry upload
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {state.status === 'loading' && (
        <div
          aria-busy="true"
          aria-label="Loading media"
          className="mt-10 h-72 animate-pulse rounded-2xl border border-line bg-surface"
        />
      )}
      {state.status === 'not-found' && (
        <section className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center">
          <h2 className="font-display text-headline-md text-ink">Invitation not found</h2>
          <p className="mt-3 text-body-md text-muted">
            This invitation is unavailable or may have been removed.
          </p>
          <Link
            href="/dashboard/events"
            className={`mt-7 inline-flex rounded-xl bg-primary px-5 py-3 text-label-md text-white ${focusRing}`}
          >
            Back to Events
          </Link>
        </section>
      )}
      {state.status === 'error' && (
        <section className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center">
          <h2 className="font-display text-headline-md text-ink">We could not load media</h2>
          <p role="alert" className="mt-3 text-body-md text-muted">
            {state.message}
          </p>
          <button
            type="button"
            onClick={onRetryLoad}
            className={`mt-6 rounded-xl border border-line px-5 py-3 text-label-md ${focusRing}`}
          >
            Try again
          </button>
        </section>
      )}
      {state.status === 'ready' && state.items.length === 0 && (
        <section className="mt-10 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-line bg-surface p-8 text-center shadow-subtle">
          <span className="material-symbols-outlined text-3xl text-accent" aria-hidden="true">
            image
          </span>
          <h2 className="mt-4 font-display text-headline-md text-ink">No media yet</h2>
          <p className="mt-3 max-w-md text-body-md text-muted">
            Choose a JPEG, PNG, or WebP image up to 6&nbsp;MB to add it to this invitation.
          </p>
        </section>
      )}
      {state.status === 'ready' && state.items.length > 0 && (
        <>
          <ul className="mt-10 grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {state.items.map((item) => (
              <li
                key={item.id}
                className="overflow-hidden rounded-xl border border-line bg-surface shadow-subtle"
              >
                {item.previewUrl ? (
                  // Signed Storage URLs are short-lived and host-specific —
                  // native lazy <img> keeps them out of next/image config.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={item.fileName}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full bg-background object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-background">
                    <span
                      className="material-symbols-outlined text-3xl text-muted"
                      aria-hidden="true"
                    >
                      broken_image
                    </span>
                  </div>
                )}
                <div className="p-3">
                  <p className="truncate text-body-sm text-ink" title={item.fileName}>
                    {item.fileName}
                  </p>
                  <p className="mt-1 text-label-sm uppercase tracking-wider text-muted">
                    {formatFileSize(item.fileSize)} · {item.fileType.replace('image/', '')}
                  </p>
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    className={`mt-3 rounded-lg px-3 py-1.5 text-label-md text-error hover:bg-error/5 ${focusRing}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {loadMoreError && (
            <p role="alert" className="mt-4 text-body-sm text-error">
              {loadMoreError}
            </p>
          )}
          {state.nextCursor && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className={`rounded-xl border border-line px-5 py-3 text-label-md text-ink hover:border-muted disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
