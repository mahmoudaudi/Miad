import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { InvitationDesignRecord } from '@/lib/invitation-designs';
import { InvitationDesignView } from './InvitationDesignView';

const noop = () => undefined;
const design: InvitationDesignRecord = {
  id: 'design-1',
  invitationId: 'invitation-1',
  version: 2,
  designSpecification: {
    schemaVersion: 1,
    theme: 'romantic-blush',
    content: {
      eyebrow: 'You are invited',
      title: 'Garden Dinner',
      dateLine: 'December 12, 2026',
      venueLine: 'The Garden Room',
    },
    colors: {
      background: '#FFF7F8',
      surface: '#FFFFFF',
      text: '#3A2026',
      accent: '#A45C6A',
    },
    typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
    layout: { alignment: 'center', density: 'airy' },
  },
  sourceType: 'MANUAL',
  isActive: true,
  createdAt: '2026-09-20T00:00:00.000Z',
};

const render = (overrides: Partial<React.ComponentProps<typeof InvitationDesignView>> = {}) =>
  renderToStaticMarkup(
    <InvitationDesignView
      invitationId="invitation-1"
      state={{ status: 'ready', design: null }}
      selectedTheme="classic-ivory"
      saving={false}
      saveError={null}
      successMessage={null}
      onSelect={noop}
      onSave={noop}
      onRetry={noop}
      {...overrides}
    />
  );

describe('InvitationDesignView', () => {
  it('renders loading and error states', () => {
    expect(render({ state: { status: 'loading' } })).toContain('aria-busy="true"');
    const error = render({ state: { status: 'error', message: 'Offline' } });
    expect(error).toContain('Offline');
    expect(error).toContain('Try again');
  });

  it('renders all real design options and the empty current state', () => {
    const html = render();
    expect(html).toContain('No design has been saved yet.');
    expect(html).toContain('Classic Ivory');
    expect(html).toContain('Modern Contrast');
    expect(html).toContain('Romantic Blush');
    expect(html).toMatch(/checked="" value="classic-ivory"/);
    expect(html).toContain('Save design');
  });

  it('renders a saved selection and enables a real update choice', () => {
    const saved = render({
      state: { status: 'ready', design },
      selectedTheme: 'romantic-blush',
      successMessage: 'Design saved.',
    });
    expect(saved).toContain('Current design: version 2');
    expect(saved).toContain('Saved: Romantic Blush');
    expect(saved).toContain('/dashboard/invitations/invitation-1/editor');
    expect(saved).toContain('Open editor');
    expect(saved).toContain('Design saved.');
    expect(saved).toContain('Update design');
    expect(saved).toContain('disabled=""');

    const changed = render({
      state: { status: 'ready', design },
      selectedTheme: 'modern-contrast',
    });
    expect(changed).toMatch(/checked="" value="modern-contrast"/);
    expect(changed).not.toContain('disabled=""');
  });

  it('renders save progress, errors, and the not-found state', () => {
    const saving = render({ saving: true, saveError: 'Save failed' });
    expect(saving).toContain('Saving…');
    expect(saving).toContain('Save failed');
    expect(saving).toContain('role="alert"');
    const missing = render({ state: { status: 'not-found' } });
    expect(missing).toContain('Invitation not found');
    expect(missing).toContain('/dashboard/events');
  });
});
