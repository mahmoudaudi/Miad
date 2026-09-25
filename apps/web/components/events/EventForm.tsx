'use client';

import Link from 'next/link';
import React, { FormEvent, useState } from 'react';
import {
  emptyEventForm,
  EventFormErrors,
  EventFormValues,
  validateEventForm,
} from '@/lib/event-form';
import type { EventInput } from '@/lib/events';

type Props = {
  initialValues?: EventFormValues;
  submitLabel: string;
  cancelHref: string;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (input: EventInput) => void;
};

const inputClass = 'miad-input mt-2';
const labelClass = 'text-label-md text-ink';
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function EventForm({
  initialValues = emptyEventForm,
  submitLabel,
  cancelHref,
  submitting,
  serverError,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<EventFormValues>(initialValues);
  const [errors, setErrors] = useState<EventFormErrors>({});

  const set = (field: keyof EventFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateEventForm(values);
    setErrors(result.errors);
    if (result.input) onSubmit(result.input);
  }

  const fieldError = (field: keyof EventFormValues) =>
    errors[field] ? (
      <p id={`${field}-error`} className="mt-2 text-body-sm text-error">
        {errors[field]}
      </p>
    ) : null;
  const describedBy = (field: keyof EventFormValues) =>
    errors[field] ? `${field}-error` : undefined;

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-8">
      {serverError && (
        <div
          role="alert"
          className="rounded-xl border border-error/20 bg-surface px-4 py-3 text-body-sm text-error"
        >
          {serverError}
        </div>
      )}

      <fieldset disabled={submitting} className="space-y-8">
        <legend className="sr-only">Invitation details</legend>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="title" className={labelClass}>
              Invitation title <span aria-hidden="true">*</span>
            </label>
            <input
              id="title"
              name="title"
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={255}
              required
              aria-invalid={Boolean(errors.title)}
              aria-describedby={describedBy('title')}
              className={inputClass}
              autoComplete="off"
            />
            {fieldError('title')}
          </div>
          <div>
            <label htmlFor="eventType" className={labelClass}>
              Occasion type <span aria-hidden="true">*</span>
            </label>
            <input
              id="eventType"
              name="eventType"
              value={values.eventType}
              onChange={(e) => set('eventType', e.target.value)}
              maxLength={100}
              required
              aria-invalid={Boolean(errors.eventType)}
              aria-describedby={describedBy('eventType')}
              className={inputClass}
              placeholder="Wedding, ceremony, birthday, dinner…"
              autoComplete="off"
            />
            {fieldError('eventType')}
          </div>
          <div>
            <label htmlFor="eventDate" className={labelClass}>
              Occasion date <span aria-hidden="true">*</span>
            </label>
            <input
              id="eventDate"
              name="eventDate"
              type="date"
              value={values.eventDate}
              onChange={(e) => set('eventDate', e.target.value)}
              required
              aria-invalid={Boolean(errors.eventDate)}
              aria-describedby={describedBy('eventDate')}
              className={inputClass}
            />
            {fieldError('eventDate')}
          </div>
          <div>
            <label htmlFor="startTime" className={labelClass}>
              Start time
            </label>
            <input
              id="startTime"
              name="startTime"
              type="time"
              value={values.startTime}
              onChange={(e) => set('startTime', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="endTime" className={labelClass}>
              End time
            </label>
            <input
              id="endTime"
              name="endTime"
              type="time"
              value={values.endTime}
              onChange={(e) => set('endTime', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="border-t border-line pt-8">
          <h2 className="font-display text-headline-sm text-ink">Place</h2>
          <p className="mt-1 text-body-sm text-muted">Optional venue and location details.</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="venueName" className={labelClass}>
                Venue name
              </label>
              <input
                id="venueName"
                name="venueName"
                value={values.venueName}
                onChange={(e) => set('venueName', e.target.value)}
                maxLength={255}
                aria-invalid={Boolean(errors.venueName)}
                aria-describedby={describedBy('venueName')}
                className={inputClass}
                autoComplete="organization"
              />
              {fieldError('venueName')}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="venueAddress" className={labelClass}>
                Venue address
              </label>
              <textarea
                id="venueAddress"
                name="venueAddress"
                value={values.venueAddress}
                onChange={(e) => set('venueAddress', e.target.value)}
                rows={3}
                className={inputClass}
                autoComplete="street-address"
              />
            </div>
            <div>
              <label htmlFor="latitude" className={labelClass}>
                Latitude
              </label>
              <input
                id="latitude"
                name="latitude"
                inputMode="decimal"
                value={values.latitude}
                onChange={(e) => set('latitude', e.target.value)}
                aria-invalid={Boolean(errors.latitude)}
                aria-describedby={describedBy('latitude')}
                className={inputClass}
                placeholder="33.8938000"
              />
              {fieldError('latitude')}
            </div>
            <div>
              <label htmlFor="longitude" className={labelClass}>
                Longitude
              </label>
              <input
                id="longitude"
                name="longitude"
                inputMode="decimal"
                value={values.longitude}
                onChange={(e) => set('longitude', e.target.value)}
                aria-invalid={Boolean(errors.longitude)}
                aria-describedby={describedBy('longitude')}
                className={inputClass}
                placeholder="35.5018000"
              />
              {fieldError('longitude')}
            </div>
          </div>
        </div>

        <div className="border-t border-line pt-8">
          <label htmlFor="description" className={labelClass}>
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            rows={5}
            className={inputClass}
            placeholder="Add the details you want to remember."
          />
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
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
