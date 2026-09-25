'use client';

import Link from 'next/link';
import React, { FormEvent, useState } from 'react';
import { normalizeInvitationSlug, validateInvitationSlug } from '@/lib/invitation-form';

type Props = {
  initialSlug?: string;
  submitLabel: string;
  cancelHref: string;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (slug: string) => void;
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function InvitationForm({
  initialSlug = '',
  submitLabel,
  cancelHref,
  submitting,
  serverError,
  onSubmit,
}: Props) {
  const [slug, setSlug] = useState(initialSlug);
  const [slugError, setSlugError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateInvitationSlug(slug);
    setSlugError(error);
    if (!error) onSubmit(normalizeInvitationSlug(slug));
  }

  return (
    <form noValidate onSubmit={submit}>
      {serverError && (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-error/20 px-4 py-3 text-body-sm text-error"
        >
          {serverError}
        </p>
      )}
      <label htmlFor="invitation-slug" className="text-label-md text-ink">
        Invitation slug <span aria-hidden="true">*</span>
      </label>
      <input
        id="invitation-slug"
        name="slug"
        value={slug}
        onChange={(event) => {
          setSlug(event.target.value);
          setSlugError(null);
        }}
        required
        minLength={3}
        maxLength={255}
        autoComplete="off"
        spellCheck={false}
        disabled={submitting}
        aria-invalid={Boolean(slugError)}
        aria-describedby={
          slugError ? 'invitation-slug-error invitation-slug-help' : 'invitation-slug-help'
        }
        className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-body-md text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
        placeholder="maya-and-sami"
      />
      <p id="invitation-slug-help" className="mt-2 text-body-sm text-muted">
        Lowercase letters, numbers, and hyphens. This reserves the invitation identifier; public
        invitations are not enabled yet.
      </p>
      {slugError && (
        <p id="invitation-slug-error" className="mt-2 text-body-sm text-error">
          {slugError}
        </p>
      )}
      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
        <Link
          href={cancelHref}
          className={`rounded-xl border border-line px-5 py-3 text-center text-label-md text-ink hover:border-muted ${focusRing}`}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className={`rounded-xl bg-primary px-5 py-3 text-label-md text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
