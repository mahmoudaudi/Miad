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
const invitation = {
  id: 'invitation-1',
  eventId: 'event-1',
  slug: 'garden-dinner',
  status: 'PUBLISHED',
  publishedAt: '2026-09-22T00:00:00.000Z',
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-22T00:00:00.000Z',
  hasDesign: true,
  event: { id: 'event-1', title: 'Garden Dinner', eventDate: '2026-10-12' },
};
const noop = () => undefined;

describe('events views', () => {
  it('renders list loading, error, empty, and data states', () => {
    expect(
      renderToStaticMarkup(
        <EventsListView
          state={{ status: 'loading' }}
          projects={{ status: 'loading' }}
          onRetry={noop}
          onRetryProjects={noop}
          onDelete={noop}
        />
      )
    ).toContain('aria-busy="true"');
    expect(
      renderToStaticMarkup(
        <EventsListView
          state={{ status: 'error', message: 'Offline' }}
          projects={{ status: 'ready', invitations: [] }}
          onRetry={noop}
          onRetryProjects={noop}
          onDelete={noop}
        />
      )
    ).toContain('Offline');
    expect(
      renderToStaticMarkup(
        <EventsListView
          state={{ status: 'ready', events: [] }}
          projects={{ status: 'ready', invitations: [] }}
          onRetry={noop}
          onRetryProjects={noop}
          onDelete={noop}
        />
      )
    ).toContain('No invitations yet');
    const data = renderToStaticMarkup(
      <EventsListView
        state={{ status: 'ready', events: [event] }}
        projects={{ status: 'ready', invitations: [invitation] }}
        onRetry={noop}
        onRetryProjects={noop}
        onDelete={noop}
      />
    );
    expect(data).toContain('Garden Dinner');
    expect(data).toContain('Recent Projects');
    expect(data).toContain('/api/designs/invitation-1/render');
    expect(data).toContain('Published');
    expect(data).toContain('/dashboard/invitations/invitation-1/editor');
    expect(data).toContain('/dashboard/events/event-1/edit');
    expect(data).toContain('Delete');
  });

  it('shows recent-project loading, empty, and retryable error states', () => {
    const loading = renderToStaticMarkup(
      <EventsListView
        state={{ status: 'ready', events: [] }}
        projects={{ status: 'loading' }}
        onRetry={noop}
        onRetryProjects={noop}
        onDelete={noop}
      />
    );
    expect(loading).toContain('Loading recent projects');
    const empty = renderToStaticMarkup(
      <EventsListView
        state={{ status: 'ready', events: [] }}
        projects={{ status: 'ready', invitations: [] }}
        onRetry={noop}
        onRetryProjects={noop}
        onDelete={noop}
      />
    );
    expect(empty).toContain('No projects yet');
    const error = renderToStaticMarkup(
      <EventsListView
        state={{ status: 'ready', events: [] }}
        projects={{ status: 'error', message: 'Offline' }}
        onRetry={noop}
        onRetryProjects={noop}
        onDelete={noop}
      />
    );
    expect(error).toContain('We could not load recent projects');
    expect(error).toContain('Try again');
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
