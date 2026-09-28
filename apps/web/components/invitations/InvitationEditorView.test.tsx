import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  applyInvitationTheme,
  designSpecificationsMatch,
  InvitationDesignRecord,
  InvitationDesignSpecification,
} from '@/lib/invitation-designs';
import { InvitationEditorView, InvitationPreview } from './InvitationEditorView';

const specification: InvitationDesignSpecification = {
  schemaVersion: 1,
  theme: 'classic-ivory',
  content: {
    eyebrow: 'You are invited',
    title: 'Garden Dinner',
    dateLine: 'December 12, 2026',
    venueLine: 'The Garden Room',
  },
  colors: {
    background: '#FFFDF8',
    surface: '#FFFFFF',
    text: '#241C18',
    accent: '#8B7355',
  },
  typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
  layout: { alignment: 'center', density: 'airy' },
};
const design: InvitationDesignRecord = {
  id: 'design-1',
  invitationId: 'invitation-1',
  version: 2,
  designSpecification: specification,
  sourceType: 'MANUAL',
  isActive: true,
  createdAt: '2026-09-21T00:00:00.000Z',
};
const noop = () => undefined;

const render = (overrides: Partial<React.ComponentProps<typeof InvitationEditorView>> = {}) =>
  renderToStaticMarkup(
    <InvitationEditorView
      invitationId="invitation-1"
      state={{ status: 'ready', design }}
      draft={specification}
      dirty={false}
      saving={false}
      saveError={null}
      successMessage={null}
      onChange={noop}
      onSave={noop}
      onRetry={noop}
      {...overrides}
    />
  );

describe('InvitationEditorView', () => {
  it('renders loading, load error, and missing-design recovery states', () => {
    expect(render({ state: { status: 'loading' }, draft: null })).toContain('aria-busy="true"');
    expect(render({ state: { status: 'error', message: 'Offline' }, draft: null })).toContain(
      'Try again'
    );
    const missing = render({ state: { status: 'missing-design' }, draft: null });
    expect(missing).toContain('Choose a design first');
    expect(missing).toContain('/dashboard/invitations/new?invitationId=invitation-1');
  });

  it('loads saved text, style controls, and the matching live preview', () => {
    const html = render();
    expect(html).toContain('value="Garden Dinner"');
    expect(html).toContain('value="The Garden Room"');
    expect(html).toContain('Playfair Display');
    expect(html).toContain('Live preview');
    expect(html).toContain('Garden Dinner');
    expect(html).toContain('All changes saved');
    expect(html).toContain('disabled=""');
  });

  it('reflects edited values immediately and marks the editor unsaved', () => {
    const edited: InvitationDesignSpecification = {
      ...specification,
      content: { ...specification.content, title: 'An Evening Together' },
      colors: { ...specification.colors, accent: '#345678' },
      layout: { alignment: 'left', density: 'compact' },
    };
    expect(designSpecificationsMatch(specification, edited)).toBe(false);
    const html = render({ draft: edited, dirty: true });
    expect(html).toContain('value="An Evening Together"');
    expect(html).toContain('An Evening Together');
    expect(html).toContain('Unsaved changes');
    expect(html).toContain('Save changes</button>');
    expect(html).toContain('background-color:#FFFDF8');
    expect(html).toContain('color:#345678');
  });

  it('applies a real theme locally while preserving edited invitation text', () => {
    const themed = applyInvitationTheme(specification, 'modern-contrast');
    expect(themed).toMatchObject({
      theme: 'modern-contrast',
      content: { title: 'Garden Dinner' },
      colors: { accent: '#7A263A' },
      typography: { headingFamily: 'Inter' },
      layout: { alignment: 'left' },
    });
    const preview = renderToStaticMarkup(<InvitationPreview specification={themed} />);
    expect(preview).toContain('Garden Dinner');
    expect(preview).toContain('text-align:left');
  });

  it('renders saving, successful save, and save-error feedback', () => {
    const saving = render({ dirty: true, saving: true });
    expect(saving).toContain('Saving…');
    expect(saving).toContain('disabled=""');
    const failed = render({ dirty: true, saveError: 'Save failed' });
    expect(failed).toContain('Save failed');
    expect(failed).toContain('role="alert"');
    expect(render({ successMessage: 'Changes saved.' })).toContain('Changes saved.');
  });
});
