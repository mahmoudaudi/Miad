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
