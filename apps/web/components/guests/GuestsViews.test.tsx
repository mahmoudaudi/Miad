import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyGuestForm } from '@/lib/guest-form';
import { GuestDetailsView } from './GuestDetailsView';
import { GuestForm } from './GuestForm';
import { GuestsListView } from './GuestsListView';

const noop = () => undefined;
const guest = {
  id: 'guest-1',
  name: 'Nadia',
  email: 'nadia@example.com',
  phone: null,
  createdAt: '',
  updatedAt: '',
  rsvp: { status: 'ATTENDING' as const, attendeesCount: 2, message: 'See you!', respondedAt: '' },
};

describe('guest views', () => {
  it('renders list loading, error, empty, and RSVP data states', () => {
    expect(
      renderToStaticMarkup(
        <GuestsListView
          eventId="event-1"
          state={{ status: 'loading' }}
          onRetry={noop}
          onDelete={noop}
        />
      )
    ).toContain('aria-busy="true"');
    expect(
      renderToStaticMarkup(
        <GuestsListView
          eventId="event-1"
          state={{ status: 'error', message: 'Offline' }}
          onRetry={noop}
          onDelete={noop}
        />
      )
    ).toContain('Offline');
    expect(
      renderToStaticMarkup(
        <GuestsListView
          eventId="event-1"
          state={{ status: 'ready', guests: [] }}
          onRetry={noop}
          onDelete={noop}
        />
      )
    ).toContain('No guests yet');
    const data = renderToStaticMarkup(
      <GuestsListView
        eventId="event-1"
        state={{ status: 'ready', guests: [guest] }}
        onRetry={noop}
        onDelete={noop}
      />
    );
    expect(data).toContain('Nadia');
    expect(data).toContain('2 attending');
    expect(data).toContain('/dashboard/events/event-1/guests/guest-1/edit');
  });

  it('renders persisted guest details and RSVP', () => {
    const html = renderToStaticMarkup(
      <GuestDetailsView
        eventId="event-1"
        state={{ status: 'ready', guest }}
        onRetry={noop}
        onDelete={noop}
      />
    );
    expect(html).toContain('nadia@example.com');
    expect(html).toContain('See you!');
    expect(html).toContain('Attending');
  });

  it('renders a functional add/edit form with loading and error states', () => {
    const html = renderToStaticMarkup(
      <GuestForm
        initialValues={emptyGuestForm}
        submitLabel="Add Guest"
        cancelHref="/dashboard/events/event-1/guests"
        submitting={true}
        serverError="Could not save"
        onSubmit={noop}
      />
    );
    expect(html).toContain('Name');
    expect(html).toContain('Saving…');
    expect(html).toContain('Could not save');
  });
});
