import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InvitationDetailsView } from './InvitationDetailsView';

const invitation = {
  id: 'invitation-existing',
  eventId: 'event-1',
  slug: 'garden-dinner',
  status: 'DRAFT',
  publishedAt: null,
  publishedDesignVersion: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  hasDesign: true,
  event: { id: 'event-1', title: 'Garden Dinner', eventDate: '2026-10-12' },
};

describe('InvitationDetailsView project reopening', () => {
  it('shows a separate community removal action only for an existing listing', () => {
    const html = renderToStaticMarkup(
      <InvitationDetailsView
        state={{ status: 'ready', invitation: { ...invitation, status: 'PUBLISHED', publishedAt: '2026-09-02T00:00:00.000Z' } }}
        publishing={false}
        publicationError={null}
        publicationSuccess={null}
        onRetry={() => undefined}
        onDelete={() => undefined}
        onPublicationChange={() => undefined}
        onRemoveFromCommunity={() => undefined}
        communityDesign={{ id: 'community-1', slug: 'garden-dinner', title: 'Garden Dinner', description: '', category: 'Dinner', specification: {}, creator: { name: 'Maya' }, engagement: { views: 0, likes: 0, saves: 0 }, isPublished: true, createdAt: '2026-09-01T00:00:00.000Z' }}
      />
    );
    expect(html).toContain('Remove from Community');
    expect(html).toContain('Unpublish');
  });

  it('opens the persistent invitation in AI Studio using its project identity', () => {
    const html = renderToStaticMarkup(
      <InvitationDetailsView
        state={{ status: 'ready', invitation }}
        publishing={false}
        publicationError={null}
        publicationSuccess={null}
        publicOrigin="https://miad.test"
        onRetry={() => undefined}
        onDelete={() => undefined}
        onPublicationChange={() => undefined}
      />
    );
    expect(html).toContain('href="/dashboard/invitations/new?invitationId=invitation-existing"');
    expect(html).toContain('Open in AI Studio');
    expect(html).toContain('/dashboard/invitations/invitation-existing/guests');
  });
});
