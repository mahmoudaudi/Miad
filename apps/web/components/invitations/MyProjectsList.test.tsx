import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  isStudioProjectActive,
  MyProjectsList,
  studioProjectHref,
  type MyProjectsState,
} from './AiStudioView';

const render = (state: MyProjectsState, activeInvitationId: string | null = null) =>
  renderToStaticMarkup(
    <MyProjectsList
      state={state}
      pathname="/dashboard/invitations/new"
      activeInvitationId={activeInvitationId}
      collapsed={false}
      onRetry={() => undefined}
    />
  );

describe('My Projects sidebar list', () => {
  it('shows a loading state while owned invitations are loading', () => {
    const html = render({ status: 'loading' });
    expect(html).toContain('MY PROJECTS');
    expect(html).toContain('aria-label="Loading projects"');
    expect(html).toContain('animate-pulse');
  });

  it('opens each saved invitation directly in AI Studio', () => {
    const id = 'invite 1';
    const html = render({ status: 'ready', projects: [{ id, title: 'Garden Dinner' }] });
    expect(studioProjectHref(id)).toBe(
      '/dashboard/invitations/new?invitationId=invite%201'
    );
    expect(html).toContain('href="/dashboard/invitations/new?invitationId=invite%201"');
    expect(html).toContain('Garden Dinner');
  });

  it('highlights only the currently opened project', () => {
    const html = render(
      {
        status: 'ready',
        projects: [
          { id: 'inv-1', title: 'Garden Dinner' },
          { id: 'inv-2', title: 'Studio Opening' },
        ],
      },
      'inv-2'
    );
    expect(isStudioProjectActive('/dashboard/invitations/new', 'inv-2', 'inv-2')).toBe(true);
    expect(isStudioProjectActive('/dashboard/invitations', 'inv-2', 'inv-2')).toBe(false);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('href="/dashboard/invitations/new?invitationId=inv-2"');
    expect(html).toContain('aria-current="page"');
  });

  it('handles an empty project list and preserves long names for assistive labels', () => {
    expect(render({ status: 'ready', projects: [] })).toContain('No projects yet.');
    const title = 'A very long saved invitation name that should truncate in the sidebar';
    const html = render({ status: 'ready', projects: [{ id: 'inv-1', title }] });
    expect(html).toContain(`title="${title}"`);
    expect(html).toContain('class="min-w-0 truncate"');
  });

  it('shows a retry action when projects fail to load', () => {
    const onRetry = vi.fn();
    const html = renderToStaticMarkup(
      <MyProjectsList
        state={{ status: 'error', message: 'Projects could not be loaded.' }}
        pathname={null}
        activeInvitationId={null}
        collapsed={false}
        onRetry={onRetry}
      />
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Projects could not be loaded.');
    expect(html).toContain('aria-label="Retry loading projects"');
  });
});
