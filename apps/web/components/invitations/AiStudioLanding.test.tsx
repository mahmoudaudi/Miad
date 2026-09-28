import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiStudioView } from '@/components/invitations/AiStudioView';

const base = {
  preview: { status: 'empty' } as const,
  prompt: '',
  hint: null,
  sendDisabled: true,
  sendLabel: 'Generate',
  suggestions: ['Tech Founder Dinner', '30th Rooftop Birthday'],
  studioHref: null,
  detailsHref: null,
  failedMessage: null,
  invitationsHref: '/dashboard/invitations',
  imageBar: null,
  profile: { name: 'Maya Haddad', email: 'm@e.com', initials: 'MH' },
  onPromptChange: () => undefined,
  onSend: () => undefined,
  onStop: () => undefined,
  onSuggestion: () => undefined,
};
const render = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<AiStudioView messages={[]} {...base} {...extra} />);

describe('landing prompt UI', () => {
  it('shows exactly the two given suggestions', () => {
    const html = render();
    expect(html).toContain('Suggested for you');
    expect(html).toContain('Tech Founder Dinner');
    expect(html).toContain('30th Rooftop Birthday');
    expect(html).not.toContain('Series A Celebration');
  });
  it('renders a working reload control only when the pool can change', () => {
    expect(render()).not.toContain('Show different suggestions');
    const on = render({ canReloadSuggestions: true, onReloadSuggestions: () => undefined });
    expect(on).toContain('aria-label="Show different suggestions"');
    expect(on).toContain('refresh');
  });
  it('drops the Miad AI brand row from the composer', () => {
    const html = render();
    expect(html).not.toContain('Miad AI');
    // The toolbar now holds the compact model picker (auto_awesome marks the
    // picker button, not a brand row) alongside voice and send.
    const toolbar = html.match(
      /class="flex items-center justify-end gap-2 pt-4"[\s\S]*?<\/form>/
    )?.[0];
    expect(toolbar).toBeTruthy();
    expect(toolbar).toContain('Choose AI model');
    expect(toolbar).not.toContain('Miad AI');
  });
  it('keeps voice and send together on the right, send with no fill', () => {
    const html = render();
    // right-aligned cluster
    expect(html).toContain('flex items-center justify-end gap-2 pt-4');
    // no crimson fill on submit
    expect(html).not.toContain('bg-[#9f1239]');
    expect(html).toContain('aria-label="Send message"');
    expect(html).toContain('arrow_upward');
  });
});
