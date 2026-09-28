import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PublicInvitationNotFound from '../../app/invite/[slug]/not-found';
import type { InvitationDesignSpecification } from '@/lib/invitation-designs';
import { PublicInvitationView } from './PublicInvitationView';

const specification: InvitationDesignSpecification = {
  schemaVersion: 1,
  theme: 'modern-contrast',
  content: {
    eyebrow: 'Join us for',
    title: 'An Evening Together',
    dateLine: 'Saturday, May 22',
    venueLine: 'The Garden Room',
  },
  colors: {
    background: '#F1F2F3',
    surface: '#FFFFFF',
    text: '#202122',
    accent: '#345678',
  },
  typography: { headingFamily: 'Inter', bodyFamily: 'Playfair Display' },
  layout: { alignment: 'left', density: 'compact' },
};

describe('PublicInvitationView', () => {
  it('renders the saved content and complete saved design without editor controls', () => {
    const html = renderToStaticMarkup(
      <PublicInvitationView specification={specification} slug="an-evening" />
    );
    expect(html).toContain('<h1');
    expect(html).toContain('An Evening Together');
    expect(html).toContain('The Garden Room');
    expect(html).toContain('background-color:#F1F2F3');
    expect(html).toContain('background-color:#FFFFFF');
    expect(html).toContain('color:#202122');
    expect(html).toContain('border-color:#345678');
    expect(html).toContain('text-align:left');
    expect(html).toContain('font-family:Playfair Display');
    expect(html).toContain('Confirm Attendance');
    expect(html).toContain('min-h-[100svh] w-full overflow-x-clip');
    expect(html).toContain('min-h-[100svh] w-full overflow-visible');
    expect(html).toContain('max-w-2xl');
    expect(html).not.toMatch(/Save changes|Editor controls|Publish/);
  });

  it('lets a long public invitation grow vertically while keeping the full-viewport canvas', () => {
    const long = {
      ...specification,
      elements: Array.from({ length: 8 }, (_, index) => ({
        id: `copy-${index}`,
        type: 'text' as const,
        label: `Section ${index + 1}`,
        text: `A long invitation detail for guests to read comfortably. ${'A useful detail. '.repeat(8)}`,
        x: 8,
        y: index * 10,
        width: 84,
        height: 10,
        fontSize: 16,
        color: '#202122',
      })),
    };
    const html = renderToStaticMarkup(<PublicInvitationView specification={long} slug="long-invitation" />);
    expect(html).toContain('A long invitation detail for guests to read comfortably.');
    expect(html).toContain('min-h-[100svh] w-full overflow-visible');
    expect(html).toContain('Confirm Attendance');
  });

  it('renders HTML artifacts only through a sandboxed render route', () => {
    const html = renderToStaticMarkup(
      <PublicInvitationView
        slug="an-evening"
        artifact={{
          format: 'html',
          version: 1,
          title: 'An Evening Together',
          description: 'An evening together',
        }}
      />
    );
    expect(html).toContain('src="/api/public/invitations/an-evening/render"');
    expect(html).toContain('sandbox="allow-same-origin"');
    expect(html).toContain('h-[100svh] min-h-[100svh] w-full');
    expect(html).toContain('id="rsvp"');
    expect(html).toContain('Confirm Attendance');
    expect(html.indexOf('</iframe>')).toBeLessThan(html.indexOf('id="rsvp"'));
    expect(html).not.toContain('dangerouslySetInnerHTML');
  });

  it('renders the public not-found state without exposing resource details', () => {
    const html = renderToStaticMarkup(<PublicInvitationNotFound />);
    expect(html).toContain('Invitation unavailable');
    expect(html).toContain('does not exist or is not currently published');
    expect(html).not.toMatch(/database|userId|invitationId|token/i);
  });
});
