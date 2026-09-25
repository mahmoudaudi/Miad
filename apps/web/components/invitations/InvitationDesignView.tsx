import Link from 'next/link';
import React from 'react';
import {
  invitationDesignOptions,
  InvitationDesignRecord,
  InvitationThemeId,
} from '@/lib/invitation-designs';

export type InvitationDesignState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; design: InvitationDesignRecord | null };

type Props = {
  invitationId: string;
  state: InvitationDesignState;
  selectedTheme: InvitationThemeId;
  saving: boolean;
  saveError: string | null;
  successMessage: string | null;
  onSelect: (theme: InvitationThemeId) => void;
  onSave: () => void;
  onRetry: () => void;
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function InvitationDesignView({
  invitationId,
  state,
  selectedTheme,
  saving,
  saveError,
  successMessage,
  onSelect,
  onSave,
  onRetry,
}: Props) {
  if (state.status === 'loading') {
    return (
      <main
        aria-busy="true"
        aria-label="Loading invitation design"
        className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8"
      >
        <div className="h-96 animate-pulse rounded-2xl border border-line bg-surface" />
      </main>
    );
  }
  if (state.status === 'not-found') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-headline-md text-ink">Invitation not found</h1>
        <p className="mt-3 text-body-md text-muted">
          This invitation is unavailable or may have been removed.
        </p>
        <Link
          href="/dashboard/events"
          className={`mt-7 inline-flex rounded-xl bg-primary px-5 py-3 text-label-md text-white ${focusRing}`}
        >
          Back to Events
        </Link>
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-headline-md text-ink">Design unavailable</h1>
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
  }

  const currentTheme = state.design?.designSpecification.theme;
  const hasChanges = currentTheme !== selectedTheme;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <Link
        href={`/dashboard/invitations/${invitationId}`}
        className={`rounded-lg text-label-md text-muted hover:text-ink ${focusRing}`}
      >
        ← Back to Invitation
      </Link>
      <header className="mt-8 max-w-2xl">
        <p className="text-label-sm uppercase tracking-[0.16em] text-accent">Invitation design</p>
        <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
          Choose a visual direction
        </h1>
        <p className="mt-4 text-body-md text-muted">
          Select a complete theme for this invitation. Colors, typography, and layout are saved
          together.
        </p>
      </header>

      <section aria-labelledby="design-options-heading" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="design-options-heading" className="font-display text-headline-sm text-ink">
              Design options
            </h2>
            <p className="mt-2 text-body-sm text-muted">
              {state.design
                ? `Current design: version ${state.design.version}`
                : 'No design has been saved yet.'}
            </p>
          </div>
          {currentTheme && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-label-sm text-muted">
                Saved: {invitationDesignOptions.find((option) => option.id === currentTheme)?.name}
              </span>
              <Link
                href={`/dashboard/invitations/${invitationId}/editor`}
                className={`rounded-xl bg-primary px-4 py-2.5 text-label-md text-white ${focusRing}`}
              >
                Open editor
              </Link>
            </div>
          )}
        </div>

        <fieldset className="mt-6 grid gap-5 md:grid-cols-3">
          <legend className="sr-only">Choose an invitation design</legend>
          {invitationDesignOptions.map((option) => {
            const selected = selectedTheme === option.id;
            const specification = option.specification;
            return (
              <label
                key={option.id}
                className={`cursor-pointer overflow-hidden rounded-2xl border bg-surface shadow-subtle transition-colors ${
                  selected ? 'border-primary' : 'border-line hover:border-muted'
                } ${focusRing}`}
              >
                <input
                  type="radio"
                  name="invitation-theme"
                  value={option.id}
                  checked={selected}
                  onChange={() => onSelect(option.id)}
                  className="sr-only"
                />
                <div
                  aria-hidden="true"
                  className="m-3 min-h-44 rounded-xl border p-5"
                  style={{
                    backgroundColor: specification.colors.background,
                    borderColor: specification.colors.accent,
                    color: specification.colors.text,
                    textAlign: specification.layout.alignment,
                  }}
                >
                  <p
                    className="text-xs uppercase tracking-[0.18em]"
                    style={{ color: specification.colors.accent }}
                  >
                    You are invited
                  </p>
                  <p
                    className="mt-7 text-2xl"
                    style={{ fontFamily: specification.typography.headingFamily }}
                  >
                    A Beautiful Occasion
                  </p>
                  <div
                    className={`mt-5 h-px w-12 ${
                      specification.layout.alignment === 'center' ? 'mx-auto' : ''
                    }`}
                    style={{ backgroundColor: specification.colors.accent }}
                  />
                  <p className="mt-4 text-xs">Saturday · Six in the evening</p>
                </div>
                <div className="px-5 pb-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-label-md text-ink">{option.name}</span>
                    <span
                      aria-hidden="true"
                      className={`flex size-5 items-center justify-center rounded-full border ${
                        selected ? 'border-primary bg-primary' : 'border-line'
                      }`}
                    >
                      {selected && <span className="size-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="mt-2 text-body-sm text-muted">{option.description}</p>
                </div>
              </label>
            );
          })}
        </fieldset>
      </section>

      <section className="mt-8 flex flex-col items-stretch gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite">
          {saveError && (
            <p role="alert" className="text-body-sm text-error">
              {saveError}
            </p>
          )}
          {successMessage && <p className="text-body-sm text-success">{successMessage}</p>}
          {!saveError && !successMessage && (
            <p className="text-body-sm text-muted">Your selection is private until saved.</p>
          )}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !hasChanges}
          className={`w-full rounded-xl bg-primary px-5 py-3 text-label-md text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${focusRing}`}
        >
          {saving ? 'Saving…' : state.design ? 'Update design' : 'Save design'}
        </button>
      </section>
    </main>
  );
}
