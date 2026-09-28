'use client';

import { SendButton } from '@/components/ui/ActionButtons';
import React, { FormEvent, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import {
  emptyRsvpForm,
  RsvpFormErrors,
  RsvpFormValues,
  RsvpStatus,
  submitPublicRsvp,
  validateRsvpForm,
} from '@/lib/rsvp-form';

type ViewProps = {
  values: RsvpFormValues;
  errors: RsvpFormErrors;
  submitting: boolean;
  submitted: boolean;
  serverError: string | null;
  onChange: (field: keyof RsvpFormValues, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};
const inputClass = 'miad-input mt-2';
const choices: { value: RsvpStatus; label: string; note: string }[] = [
  { value: 'ATTENDING', label: 'Yes', note: 'I’ll be there' },
  { value: 'NOT_ATTENDING', label: 'No', note: 'I can’t make it' },
];

export function PublicRsvpFormView({
  values,
  errors,
  submitting,
  submitted,
  serverError,
  onChange,
  onSubmit,
}: ViewProps) {
  if (submitted)
    return (
      <section
        id="rsvp"
        aria-live="polite"
        className="rounded-xl border border-line bg-white p-6 text-center shadow-subtle sm:p-9"
      >
        <span className="material-symbols-outlined text-3xl text-accent" aria-hidden="true">
          mark_email_read
        </span>
        <h2 className="mt-4 font-display text-headline-md text-ink">Response received</h2>
        <p className="mt-3 text-body-md text-muted">
          Thank you. Your attendance confirmation has been shared with the host.
        </p>
      </section>
    );
  const error = (field: keyof RsvpFormErrors) =>
    errors[field] ? (
      <p id={`rsvp-${field}-error`} className="mt-2 text-body-sm text-error">
        {errors[field]}
      </p>
    ) : null;
  return (
    <section id="rsvp" className="rounded-xl border border-line bg-white p-5 shadow-subtle sm:p-9">
      <div className="text-center">
        <p className="text-label-sm uppercase tracking-[0.16em] text-accent">Kindly respond</p>
        <h2 className="mt-3 font-display text-headline-md text-ink">Will you join us?</h2>
      </div>
      <form noValidate onSubmit={onSubmit} className="mt-8 space-y-6">
        {serverError && (
          <p
            role="alert"
            className="rounded-xl border border-error/20 px-4 py-3 text-body-sm text-error"
          >
            {serverError}
          </p>
        )}
        <fieldset disabled={submitting} className="space-y-6">
          <legend className="sr-only">RSVP details</legend>
          <div>
            <p className="text-label-md text-ink">Attendance *</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {choices.map((choice) => (
                <label
                  key={choice.value}
                  className={`cursor-pointer rounded-xl border p-4 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 text-center transition ${values.status === choice.value ? 'border-primary bg-primary/5' : 'border-line'}`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={choice.value}
                    checked={values.status === choice.value}
                    onChange={() => onChange('status', choice.value)}
                    className="sr-only"
                  />
                  <span className="block text-label-md text-ink">{choice.label}</span>
                  <span className="mt-1 block text-body-sm text-muted">{choice.note}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="rsvp-name" className="text-label-md text-ink">
              Full Name *
            </label>
            <input
              id="rsvp-name"
              value={values.name}
              onChange={(event) => onChange('name', event.target.value)}
              maxLength={255}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'rsvp-name-error' : undefined}
              className={inputClass}
            />
            {error('name')}
          </div>
          <div>
            <label htmlFor="rsvp-count" className="text-label-md text-ink">
              Number of Guests <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="rsvp-count"
              type="number"
              min={0}
              max={20}
              value={values.attendeesCount}
              onChange={(event) => onChange('attendeesCount', event.target.value)}
              disabled={submitting || values.status === 'NOT_ATTENDING'}
              placeholder={values.status === 'ATTENDING' ? '1' : '0'}
              aria-invalid={Boolean(errors.attendeesCount)}
              aria-describedby={errors.attendeesCount ? 'rsvp-attendeesCount-error' : undefined}
              className={inputClass}
            />
            {error('attendeesCount')}
          </div>
          <div>
            <label htmlFor="rsvp-message" className="text-label-md text-ink">
              Message/Note <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="rsvp-message"
              value={values.message}
              onChange={(event) => onChange('message', event.target.value)}
              maxLength={1000}
              rows={4}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? 'rsvp-message-error' : undefined}
              className={inputClass}
            />
            {error('message')}
          </div>
        </fieldset>
        <SendButton
          type="submit"
          className="w-full"
          state={submitting ? 'loading' : serverError ? 'error' : 'idle'}
          label="Confirm Attendance"
          busyLabel="Sending response…"
          errorLabel="Retry response"
        />
      </form>
    </section>
  );
}

export function PublicRsvpForm({ slug }: { slug: string }) {
  const [values, setValues] = useState(emptyRsvpForm);
  const [errors, setErrors] = useState<RsvpFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const change = (field: keyof RsvpFormValues, value: string) => {
    setValues((current) => {
      if (field !== 'status') return { ...current, [field]: value };
      return {
        ...current,
        status: value as RsvpStatus,
        attendeesCount: value === 'NOT_ATTENDING' ? '' : current.attendeesCount,
      };
    });
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setServerError(null);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateRsvpForm(values);
    setErrors(result.errors);
    if (!result.input) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await submitPublicRsvp(slug, result.input);
      setSubmitted(true);
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : 'We could not record your attendance confirmation. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <PublicRsvpFormView
      values={values}
      errors={errors}
      submitting={submitting}
      submitted={submitted}
      serverError={serverError}
      onChange={change}
      onSubmit={(event) => void submit(event)}
    />
  );
}
