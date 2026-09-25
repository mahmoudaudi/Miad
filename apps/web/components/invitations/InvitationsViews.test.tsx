import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DeleteInvitationDialog } from './DeleteInvitationDialog';
import { InvitationDetailsView } from './InvitationDetailsView';
import { InvitationForm } from './InvitationForm';
import { InvitationsListView } from './InvitationsListView';

const invitation = {
  id: 'invitation-1',
  eventId: 'event-1',
  slug: 'garden-dinner',
  status: 'DRAFT',
  publishedAt: null,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
  event: { id: 'event-1', title: 'Garden Dinner', eventDate: '2026-11-14' },
};
const noop = () => undefined;

describe('invitation views', () => {
  it('renders loading, error, empty, and data list states', () => {
    expect(
      renderToStaticMarkup(
        <InvitationsListView
          eventId="event-1"
          state={{ status: 'loading' }}
          successMessage={null}
          onRetry={noop}
          onDelete={noop}
        />
      )
    ).toContain('aria-busy="true"');
    expect(
      renderToStaticMarkup(
        <InvitationsListView
          eventId="event-1"
          state={{ status: 'error', message: 'Offline' }}
          successMessage={null}
          onRetry={noop}
          onDelete={noop}
        />
      )
    ).toContain('Offline');
    expect(
      renderToStaticMarkup(
        <InvitationsListView
          eventId="event-1"
          state={{ status: 'ready', invitations: [] }}
          successMessage={null}
          onRetry={noop}
          onDelete={noop}
        />
      )
    ).toContain('No invitation yet');
    const data = renderToStaticMarkup(
      <InvitationsListView
        eventId="event-1"
        state={{ status: 'ready', invitations: [invitation] }}
        successMessage={null}
        onRetry={noop}
        onDelete={noop}
      />
    );
    expect(data).toContain('garden-dinner');
    expect(data).toContain('/dashboard/invitations/invitation-1/edit');
  });

  it('renders create and populated edit forms', () => {
    const create = renderToStaticMarkup(
      <InvitationForm
        submitLabel="Create Invitation"
        cancelHref="/dashboard/events/event-1/invitations"
        submitting={false}
        serverError={null}
        onSubmit={noop}
      />
    );
    expect(create).toContain('Create Invitation');
    expect(create).toContain('name="slug"');
    const edit = renderToStaticMarkup(
      <InvitationForm
        initialSlug="garden-dinner"
        submitLabel="Save changes"
        cancelHref="/dashboard/invitations/invitation-1"
        submitting={false}
        serverError={null}
        onSubmit={noop}
      />
    );
    expect(edit).toContain('value="garden-dinner"');
  });

  it('renders details without future actions', () => {
    const html = renderToStaticMarkup(
      <InvitationDetailsView
        state={{ status: 'ready', invitation }}
        publishing={false}
        publicationError={null}
        publicationSuccess={null}
        onRetry={noop}
        onDelete={noop}
        onPublicationChange={noop}
      />
    );
    expect(html).toContain('Garden Dinner');
    expect(html).toContain('Not published');
    expect(html).toContain('/dashboard/invitations/invitation-1/design');
    expect(html).toContain('Design');
    expect(html).toContain('/dashboard/invitations/invitation-1/media');
    expect(html).toContain('Media');
    expect(html).toContain('Edit');
    expect(html).toContain('Delete');
    expect(html).toContain('Publish');
    expect(html).not.toContain('/invite/garden-dinner');
    expect(html).not.toMatch(/Customize|Share|RSVP|AI Generate/);
  });

  it('renders real published state, public URL, loading, success, and error feedback', () => {
    const published = {
      ...invitation,
      status: 'PUBLISHED',
      publishedAt: '2026-09-21T00:00:00.000Z',
    };
    const html = renderToStaticMarkup(
      <InvitationDetailsView
        state={{ status: 'ready', invitation: published }}
        publishing
        publicationError="Publication failed"
        publicationSuccess="Invitation published."
        onRetry={noop}
        onDelete={noop}
        onPublicationChange={noop}
      />
    );
    expect(html).toContain('Unpublishing…');
    expect(html).toContain('/invite/garden-dinner');
    expect(html).toContain('Publication failed');
    expect(html).toContain('Invitation published.');
    expect(html).toContain('role="alert"');
  });

  it('renders an accessible delete confirmation and feedback', () => {
    const html = renderToStaticMarkup(
      <DeleteInvitationDialog
        slug="garden-dinner"
        deleting
        error="Delete failed"
        onCancel={noop}
        onConfirm={noop}
      />
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Deleting…');
    expect(html).toContain('role="alert"');
  });
});
