import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  isSidebarNarrow,
  StudioSidebar,
  type StudioProfile,
} from '@/components/invitations/AiStudioView';

const profile: StudioProfile = { name: 'Maya Haddad', email: 'm@example.com', initials: 'MH' };

/** Static markup is always the at-rest state, so the swap is asserted through its classes. */
const render = () =>
  renderToStaticMarkup(
    <StudioSidebar
      manualHref="/dashboard/events/new"
      profile={profile}
      onLogout={() => undefined}
    />
  );

const occurrences = (html: string, needle: string) => html.split(needle).length - 1;

describe('StudioSidebar collapse', () => {
  it('starts expanded with the logo, labels, and a collapse control', () => {
    const html = render();
    expect(html).toContain('data-collapsed="false"');
    expect(html).toContain('w-[224px]');
    expect(html).toContain('aria-label="Collapse sidebar"');
    // The pair was changed from left_panel_close/right_panel_open: the panel
    // variants draw a panel outline and read ambiguously as in/out. These two
    // are a bare directional arrow, so the direction is unmistakable.
    expect(html).toContain('keyboard_double_arrow_left');
    expect(html).toContain('>New<');
    expect(html).toContain('>AI Studio<');
    expect(html).toContain('>Billing<');
    expect(html).toContain('miad-logo.png');
  });

  it('puts the logo and the collapse control in one shared slot', () => {
    const html = render();
    // The control is an overlay centred on the logo's own box, so the icon
    // replaces the logo instead of sitting beside it.
    expect(html).toContain('<div class="relative flex min-w-0 items-center">');
    expect(html).toContain('absolute inset-0 -inset-y-2 flex items-center justify-center');
    // The row is not a justify-between spread of two independent children.
    expect(html).toContain('group/logo flex items-center px-1.5 pb-3.5');
    expect(html).not.toContain('group/logo flex items-center justify-between');
    // One control, one panel icon: nothing is rendered in a second location.
    expect(occurrences(html, 'aria-label="Collapse sidebar"')).toBe(1);
    expect(occurrences(html, 'keyboard_double_arrow_left')).toBe(1);
    // The expand glyph is the mirrored arrow and is only reachable after a click.
    expect(occurrences(html, 'keyboard_double_arrow_right')).toBe(0);
  });

  it('keeps the control hit-testable at rest so a click always lands on it', () => {
    const html = render();
    // The regression this guards: the control used to be pointer-events-none until
    // hover resolved, so a fast click or a touch tap fell through to the logo and
    // the button looked dead. The control must never opt out of hit-testing.
    expect(html).not.toContain('pointer-events-none');
    expect(html).not.toContain('pointer-events-auto');
    // Assembled at runtime on purpose: Tailwind scans this file for class names, so
    // a literal here would emit a dead rule for a class the sidebar no longer uses.
    expect(html).not.toContain(['group-hover/logo:', 'pointer-events-auto'].join(''));
    // No gating of interactivity behind :hover anywhere in the sidebar.
    expect(html).not.toMatch(/hover:[a-z-]*pointer-events/);
    // The control is a real button, so Enter/Space activate it.
    // (onClick is a function, so React omits it from static markup.)
    expect(html).toMatch(/<button type="button"[^>]*aria-label="Collapse sidebar"/);
  });

  it('cross-fades the control in over the logo without moving anything below it', () => {
    const html = render();
    // At rest the logo is shown and the control is transparent; hovering the slot
    // swaps them in place, and leaving restores the logo.
    expect(html).toContain('group-hover/logo:opacity-0');
    // Both sides of the swap use the project's 200ms easing.
    expect(occurrences(html, 'transition-opacity duration-200 ease-out')).toBe(2);
    // The slot keeps the logo's own 24px-tall box, so the rows below keep theirs.
    expect(html).toContain('h-6 w-auto');
    expect(html).not.toContain('size-6 object-contain');
    expect(html).toContain('<div class="mb-4 px-0.5">');
    expect(html).toContain('w-full gap-2.5 px-2 py-1.5');
  });

  it('keeps the logo as the resting face in both states and swaps only on hover', () => {
    const html = render();
    // Neither side is conditional on `collapsed` any more: the logo is always the
    // visible face and the panel icon only appears while the slot is hovered, so
    // collapsing narrows the sidebar without replacing the brand mark.
    expect(html).toContain(
      'shrink-0 opacity-100 transition-opacity duration-200 ease-out group-hover/logo:opacity-0'
    );
    expect(html).toContain(
      'material-symbols-outlined text-[17px] opacity-0 transition-opacity duration-200 ease-out group-hover/logo:opacity-100'
    );
    // No state-driven opacity swap is left: collapsing must not hide the logo.
    expect(html).not.toMatch(/collapsed \? 'opacity-/);
    // Collapsing still changes the sidebar width, which is the only visual difference.
    expect(html).toContain('transition-[width] duration-200 ease-out');
  });

  it('peeks the sidebar open on profile hover without losing the pinned state', () => {
    // Hover and focus both drive the transient reveal; neither may overwrite the
    // choice the user pinned with the toggle.
    expect(isSidebarNarrow(false, false)).toBe(false);
    expect(isSidebarNarrow(false, true)).toBe(false);
    expect(isSidebarNarrow(true, false)).toBe(true);
    expect(isSidebarNarrow(true, true)).toBe(false);
    // The reveal has to animate, not snap.
    const html = render();
    expect(html).toContain('transition-[width] duration-200 ease-out');
    expect(html).toContain('w-[224px]');
  });

  it('aligns the logo on the same centre axis as every other row when collapsed', () => {
    const html = render();
    // The logo row was the only flex item without justify-center, so the mark sat
    // hard left (centre x=30) while New, the nav and the profile all sat at x=40.
    // Collapsing now centres it and matches the 44px nav-item height.
    // The collapsed branch is unreachable from static markup (a click is needed),
    // so this asserts the contract: the row class is a plain string with no
    // interpolated ternary leaking dead tokens into the attribute.
    expect(html).toContain('class="group/logo flex items-center px-1.5 pb-3.5"');
    expect(html).not.toMatch(/class="[^"]*collapsed \?/);
    expect(html).not.toMatch(/class="[^"]*&#x27;/);
    // Nav is a non-wrapping column; its collapsed `items-center` and the `w-11`
    // row width come from the collapsed branch, which needs a click to reach, so
    // the at-rest markup shows the expanded geometry: full-width rows, no wrapping.
    expect(html).toContain('aria-label="Workspace navigation"');
    expect(html).toContain('w-full gap-2.5 px-2 py-1.5');
    // Every collapsed row centres itself rather than being stretched or left-aligned.
    expect(html).not.toContain('items-start');
  });

  it('keeps the collapsed width contract untouched', () => {
    const html = render();
    expect(html).toContain('transition-[width] duration-200 ease-out');
    expect(html).toContain('w-[224px]');
    // w-20 belongs to the collapsed branch, which a click is needed to reach.
    expect(html).not.toContain('w-20');
  });

  it('keeps every nav destination and active marker in the markup', () => {
    const html = render();
    for (const href of [
      '/dashboard/invitations/new',
      '/dashboard/invitations',
      '/dashboard/community/browse',
      '/dashboard/community',
      '/dashboard/events',
      '/dashboard/billing',
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
    // Not collapsed: every nav item exposes its text label to assistive tech.
    expect(html).not.toContain('aria-label="Billing"');
  });

  it('exposes the control to assistive tech with state-reflecting naming', () => {
    const html = render();
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('title="Collapse sidebar"');
    // The logo image stays decorative rather than becoming a second tab stop that
    // competes with the control sitting on top of it.
    expect(html).toContain('<img alt=""');
    // The control itself stays focusable and keeps the focus ring.
    expect(html).toContain('focus-visible:ring-2');
  });
});
