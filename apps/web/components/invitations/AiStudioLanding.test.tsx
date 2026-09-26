import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AttachPanel, AiStudioView } from '@/components/invitations/AiStudioView';

const base = {
  preview: { status: 'empty' } as const,
  prompt: '',
  hint: null,
  sendDisabled: true,
  sendLabel: 'Generate',
  suggestions: ['Tech Founder Dinner', '30th Rooftop Birthday'],
  editorHref: null,
  detailsHref: null,
  failedMessage: null,
  manualHref: '/dashboard/events/new',
  imageBar: null,
  profile: { name: 'Maya Haddad', email: 'm@e.com', initials: 'MH' },
  onPromptChange: () => undefined,
  onSend: () => undefined,
  onStop: () => undefined,
  onSuggestion: () => undefined,
};
const render = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<AiStudioView messages={[]} {...base} {...extra} />);

describe('landing photo attach', () => {
  it('exposes a popover trigger instead of an inline toggle', () => {
    const html = render({ onAttachFile: () => undefined, canAttach: true });
    expect(html).toContain('aria-label="Attach a photo"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('miad-attach');
    expect(html).toContain('miad-attach-icon');
    // The panel is portalled into the Popover and only exists once opened, so the
    // closed state ships no orphan node. It must also not sit in the normal flow:
    // a stacked panel shifted the composer out from under the pointer mid-click.
    expect(html).not.toContain('studio-attach-panel');
    expect(html).not.toContain('Choose a photo');
  });

  it('has no attach control at all when attaching is unavailable', () => {
    const html = render();
    expect(html).not.toContain('aria-label="Attach a photo"');
  });
});

describe('AttachPanel', () => {
  const panel = (props: Partial<React.ComponentProps<typeof AttachPanel>>) =>
    renderToStaticMarkup(
      <AttachPanel id="studio-attach-input" canAttach onAttachFile={() => undefined} {...props} />
    );

  it('mirrors the real backend limits instead of over-promising', () => {
    const html = panel({ onAttachFile: () => undefined });
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(html).toContain('JPEG, PNG or WebP, up to 6 MB.');
    // Documents are rejected by the API, so nothing here may imply they are accepted.
    expect(html).not.toMatch(/pdf|docx/i);
  });

  it('shows a held file and says it waits for the first invitation', () => {
    const html = panel({
      onAttachFile: () => undefined,
      canAttach: false,
      pendingUpload: { name: 'garden.png', size: 2048, type: 'image/png' },
    });
    expect(html).toContain('garden.png');
    expect(html).toContain('2 KB');
    expect(html).toContain('uploads as soon as your first invitation is created');
    // A held file means no second picker.
    expect(html).not.toContain('Choose a photo');
  });

  it('surfaces upload errors to assistive tech', () => {
    const html = panel({ onAttachFile: () => undefined, notice: 'Only JPEG, PNG, and WebP.' });
    expect(html).toContain('role="status"');
    expect(html).toContain('Only JPEG, PNG, and WebP.');
  });
});

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
  it('drops the Miad AI brand row and its icon from the composer', () => {
    const html = render();
    expect(html).not.toContain('Miad AI');
    // auto_awesome still legitimately marks the AI Studio nav item and the first
    // suggestion chip, so scope the check to the composer toolbar itself.
    const toolbar = html.match(
      /class="flex items-center justify-end gap-2 pt-4"[\s\S]*?<\/form>/
    )?.[0];
    expect(toolbar).toBeTruthy();
    expect(toolbar).not.toContain('auto_awesome');
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
