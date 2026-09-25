import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyEventForm } from '@/lib/event-form';
import { DeleteEventDialog } from './DeleteEventDialog';
import { EventDetailsView } from './EventDetailsView';
import { EventForm } from './EventForm';
import { EventsListView } from './EventsListView';

const event = {
  id: 'event-1',
  invitationId: 'invitation-1',
  title: 'Garden Dinner',
  eventType: 'Dinner',
  description: 'Outside together.',
  eventDate: '2026-10-12',
  startTime: '18:30',
  endTime: '21:00',
  venueName: 'The Garden',
  venueAddress: 'Main Street',
  latitude: 33.8,
  longitude: 35.5,
  createdAt: '',
  updatedAt: '',
};
const noop = () => undefined;

describe('events views', () => {
  it('renders list loading, error, empty, and data states', () => {
    expect(
      renderToStaticMarkup(
        <EventsListView state={{ status: 'loading' }} onRetry={noop} onDelete={noop} />
      )
    ).toContain('aria-busy="true"');
    expect(
      renderToStaticMarkup(
        <EventsListView
          state={{ status: 'error', message: 'Offline' }}
          onRetry={noop}
          onDelete={noop}
        />
      )
    ).toContain('Offline');
    expect(
      renderToStaticMarkup(
        <EventsListView state={{ status: 'ready', events: [] }} onRetry={noop} onDelete={noop} />
      )
    ).toContain('No invitations yet');
    const data = renderToStaticMarkup(
      <EventsListView state={{ status: 'ready', events: [event] }} onRetry={noop} onDelete={noop} />
    );
    expect(data).toContain('Garden Dinner');
    expect(data).toContain('/dashboard/events/event-1/edit');
    expect(data).toContain('Delete');
  });

  it('renders details, not-found, and error states with only valid actions', () => {
    const details = renderToStaticMarkup(
      <EventDetailsView state={{ status: 'ready', event }} onRetry={noop} onDelete={noop} />
    );
    expect(details).toContain('Outside together.');
    expect(details).toContain('Edit');
    expect(details).toContain('Delete');
    expect(details).toContain('/dashboard/events/event-1/invitations');
    expect(details).toContain('/dashboard/events/event-1/guests');
    expect(details).not.toMatch(/Publish|Analytics/);
    expect(
      renderToStaticMarkup(
        <EventDetailsView state={{ status: 'not-found' }} onRetry={noop} onDelete={noop} />
      )
    ).toContain('Invitation not found');
    expect(
      renderToStaticMarkup(
        <EventDetailsView
          state={{ status: 'error', message: 'Offline' }}
          onRetry={noop}
          onDelete={noop}
        />
      )
    ).toContain('Try again');
  });

  it('renders accessible create/edit form fields and populated values', () => {
    const create = renderToStaticMarkup(
      <EventForm
        initialValues={emptyEventForm}
        submitLabel="Create Event"
        cancelHref="/dashboard/events"
        submitting={false}
        serverError={null}
        onSubmit={noop}
      />
    );
    expect(create).toContain('Invitation title');
    expect(create).toContain('name="latitude"');
    expect(create).toContain('Create Event');
    const edit = renderToStaticMarkup(
      <EventForm
        initialValues={{ ...emptyEventForm, title: 'Garden Dinner', eventDate: '2026-10-12' }}
        submitLabel="Save changes"
        cancelHref="/dashboard/events/event-1"
        submitting={false}
        serverError={null}
        onSubmit={noop}
      />
    );
    expect(edit).toContain('value="Garden Dinner"');
    expect(edit).toContain('Save changes');
  });

  it('renders a labelled delete confirmation with loading and error feedback', () => {
    const html = renderToStaticMarkup(
      <DeleteEventDialog
        eventTitle="Garden Dinner"
        deleting={true}
        error="Delete failed"
        onCancel={noop}
        onConfirm={noop}
      />
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Deleting…');
    expect(html).toContain('role="alert"');
  });
});
