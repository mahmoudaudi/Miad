'use client';

import React, { useRef } from 'react';

import { DeleteButton } from '@/components/ui/ActionButtons';
import { useOverlay } from '@/components/ui/useOverlay';

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteConfirmationDialog({
  title,
  description,
  confirmLabel,
  busyLabel,
  busy,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useOverlay(true, dialogRef, () => {
    if (!busy) onCancel();
  });

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-coal/45 sm:items-center sm:px-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirmation-title"
        aria-describedby="delete-confirmation-description"
        className="animate-modal-pop max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lift sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:p-8"
      >
        <p className="text-label-sm uppercase tracking-[0.14em] text-error">Permanent action</p>
        <h2 id="delete-confirmation-title" className="mt-2 font-display text-headline-md text-ink">
          {title}
        </h2>
        <p id="delete-confirmation-description" className="mt-3 text-body-md text-muted">
          {description}
        </p>
        {error && (
          <p
            role="alert"
            className="miad-feedback-enter mt-4 rounded-xl border border-error/20 p-3 text-body-sm text-error"
          >
            {error}
          </p>
        )}
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-line px-5 py-3 text-label-md text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <DeleteButton
            onClick={onConfirm}
            state={busy ? 'loading' : error ? 'error' : 'idle'}
            label={confirmLabel}
            busyLabel={busyLabel}
            errorLabel={confirmLabel}
          />
        </div>
      </section>
    </div>
  );
}
