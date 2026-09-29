import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccountMenu } from '@/components/ui/AccountMenu';

const render = (profile: { name: string; email: string; initials: string }) =>
  renderToStaticMarkup(
    <AccountMenu profile={profile} items="account" side="top" onLogout={() => undefined} />
  );

describe('AccountMenu avatar', () => {
  it('shows a single letter, not two initials', () => {
    const html = render({ name: 'Maya Haddad', email: 'm@e.com', initials: 'MH' });
    const avatar = html.match(/rounded-full[^>]*>([^<]*)</)?.[1];
    expect(avatar).toBe('M');
    expect(html).not.toContain('>MH<');
  });
  it('prefers the real first name over the display name', () => {
    const html = render({ name: 'Dr. Mahmoud Ali', email: 'm@e.com', initials: 'MA' });
    expect(html.match(/rounded-full[^>]*>([^<]*)</)?.[1]).toBe('D');
  });
  it('falls back to a letter for a placeholder name', () => {
    const html = render({ name: 'Your account', email: '', initials: 'M' });
    expect(html.match(/rounded-full[^>]*>([^<]*)</)?.[1]).toBe('Y');
  });
});

describe('AccountMenu chevron', () => {
  const menu = () =>
    renderToStaticMarkup(
      <AccountMenu
        profile={{ name: 'Maya Haddad', email: 'm@e.com', initials: 'MH' }}
        onLogout={() => undefined}
      />
    );

  it('rests pointing up and rotates down while the menu is open', () => {
    const html = menu();
    // expand_less is the up chevron, so the resting face points up and the
    // 180deg flip on [data-open=true] is what turns it down when the menu opens.
    expect(html).toContain('expand_less');
    expect(html).not.toContain('expand_more');
    expect(html).toContain('miad-chevron');
    // Popover owns the open state and publishes it as data-open on its root, so the
    // rotation stays declarative and the chevron never needs its own state.
    expect(html).toContain('data-open="false"');
    expect(html).toContain('aria-expanded="false"');
    // The chevron keeps its place in the trigger; nothing else moved.
    expect(html).toContain('material-symbols-outlined shrink-0 text-[14px] text-muted');
  });

  it('hides the chevron entirely in compact mode, with no leftover node', () => {
    const html = renderToStaticMarkup(
      <AccountMenu
        profile={{ name: 'Maya Haddad', email: 'm@e.com', initials: 'MH' }}
        compact
        onLogout={() => undefined}
      />
    );
    expect(html).not.toContain('miad-chevron');
    expect(html).not.toContain('expand_less');
  });
});
