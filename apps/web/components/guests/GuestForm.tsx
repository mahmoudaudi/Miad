'use client';

import Link from 'next/link';
import React, { FormEvent, useState } from 'react';
import {
  emptyGuestForm,
  GuestFormErrors,
  GuestFormValues,
  validateGuestForm,
} from '@/lib/guest-form';
import type { GuestInput } from '@/lib/guests';

type Props = {
  initialValues?: GuestFormValues;
  submitLabel: string;
  cancelHref: string;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (input: GuestInput) => void;
  onCancel?: () => void;
};

const inputClass = 'miad-input mt-2';
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function GuestForm({
  initialValues = emptyGuestForm,
  submitLabel,
  cancelHref,
  submitting,
  serverError,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<GuestFormErrors>({});
  const set = (field: 'name' | 'email' | 'phone' | 'notes', value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateGuestForm(values);
    setErrors(result.errors);
    if (result.input) onSubmit(result.input);
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-7">
      {serverError && (
        <p
          role="alert"
          className="rounded-xl border border-error/20 px-4 py-3 text-body-sm text-error"
        >
          {serverError}
        </p>
      )}
      <fieldset disabled={submitting} className="grid gap-6 sm:grid-cols-2">
        <legend className="sr-only">Guest details</legend>
        <div className="sm:col-span-2">
          <label htmlFor="name" className="text-label-md text-ink">
            Name *
          </label>
          <input
            id="name"
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
            maxLength={255}
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'guest-name-error' : undefined}
            className={inputClass}
          />
          {errors.name && (
            <p id="guest-name-error" className="mt-2 text-body-sm text-error">
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="email" className="text-label-md text-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={values.email}
            onChange={(event) => set('email', event.target.value)}
            maxLength={255}
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'guest-email-error' : undefined}
            className={inputClass}
          />
          {errors.email && (
            <p id="guest-email-error" className="mt-2 text-body-sm text-error">
              {errors.email}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="phone" className="text-label-md text-ink">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            value={values.phone}
            onChange={(event) => set('phone', event.target.value)}
            maxLength={50}
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'guest-phone-error' : undefined}
            className={inputClass}
          />
          {errors.phone && (
            <p id="guest-phone-error" className="mt-2 text-body-sm text-error">
              {errors.phone}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="status" className="text-label-md text-ink">
            RSVP status
          </label>
          <select
            id="status"
            value={values.status}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                status: event.target.value as GuestFormValues['status'],
                partySize:
                  event.target.value === 'ATTENDING' && current.partySize < 1
                    ? 1
                    : event.target.value === 'NOT_ATTENDING'
                      ? 0
                      : current.partySize,
              }))
            }
            className={inputClass}
          >
            <option value="PENDING">Pending</option>
            <option value="ATTENDING">Attending</option>
            <option value="NOT_ATTENDING">Declined</option>
          </select>
        </div>
        <div>
          <label htmlFor="partySize" className="text-label-md text-ink">
            Party size
          </label>
          <input
            id="partySize"
            type="number"
            min={values.status === 'ATTENDING' ? 1 : 0}
            max={20}
            value={values.partySize}
            disabled={values.status !== 'ATTENDING'}
            onChange={(event) =>
              setValues((current) => ({ ...current, partySize: Number(event.target.value) }))
            }
            aria-invalid={Boolean(errors.partySize)}
            aria-describedby={errors.partySize ? 'guest-party-size-error' : undefined}
            className={`${inputClass} disabled:opacity-60`}
          />
          {errors.partySize && (
            <p id="guest-party-size-error" className="mt-2 text-body-sm text-error">
              {errors.partySize}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="notes" className="text-label-md text-ink">
            Notes
          </label>
          <textarea
            id="notes"
            value={values.notes}
            onChange={(event) => set('notes', event.target.value)}
            maxLength={1000}
            rows={3}
            className={inputClass}
            placeholder="Dietary notes, requests, or RSVP message"
          />
          {errors.notes && <p className="mt-2 text-body-sm text-error">{errors.notes}</p>}
        </div>
      </fieldset>
      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className={`rounded-xl border border-line px-5 py-3 text-center text-label-md text-ink ${focusRing}`}
          >
            Cancel
          </button>
        ) : (
          <Link
            href={cancelHref}
            className={`rounded-xl border border-line px-5 py-3 text-center text-label-md text-ink ${focusRing}`}
          >
            Cancel
          </Link>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={`rounded-xl bg-primary px-5 py-3 text-label-md text-white disabled:opacity-60 ${focusRing}`}
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
