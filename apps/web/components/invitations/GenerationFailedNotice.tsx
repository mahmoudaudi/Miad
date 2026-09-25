import Link from 'next/link';
import React from 'react';

/**
 * Non-fatal creation outcome: the invitation was persisted but AI design
 * generation failed. Offers retry (existing `POST .../design/ai/generate`)
 * and the manual editor path — never a rollback.
 */
export function GenerationFailedNotice({
  message,
  editorHref,
  generating,
  onRetry,
}: {
  message: string;
  editorHref: string;
  generating: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      role="status"
      className="mt-6 rounded-xl border border-primary/20 bg-secondary px-4 py-4 text-body-sm text-ink"
    >
      <p className="flex items-start gap-3">
        <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">
          auto_awesome
        </span>
        <span>
          <span className="block font-medium">
            Your invitation was created, but AI couldn&apos;t generate the design.
          </span>
          <span className="mt-1 block text-muted">{message}</span>
        </span>
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          disabled={generating}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-body-md font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {generating ? 'Generating…' : 'Retry AI generation'}
        </button>
        <Link
          href={editorHref}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 text-body-md font-medium text-ink transition-colors hover:border-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Open editor
        </Link>
      </div>
    </div>
  );
}
