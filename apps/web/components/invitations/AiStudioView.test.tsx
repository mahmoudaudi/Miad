import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiStudioView, type StudioPreview } from './AiStudioView';

const noop = () => undefined;
const base = {
  prompt: '',
  hint: null,
  sendDisabled: true,
  sendLabel: 'Generate',
  suggestions: ['Tech Founder Dinner', '30th Rooftop Birthday'],
  editorHref: null,
  detailsHref: null,
  failedMessage: null,
  retrying: false,
  manualHref: '/dashboard/events/new',
  imageBar: null,
  profile: {
    name: 'Maya Haddad',
    email: 'maya@example.com',
    initials: 'MH',
  },
  onPromptChange: noop,
  onSend: noop,
  onSuggestion: noop,
  onRetry: noop,
};

const specification = {
  schemaVersion: 1,
  theme: 'classic-ivory',
  content: {
    eyebrow: 'You are invited',
    title: 'Garden Dinner',
    dateLine: 'December 12, 2026',
    venueLine: 'The Garden Room',
  },
  colors: { background: '#FFFDF8', surface: '#FFFFFF', text: '#241C18', accent: '#8B7355' },
  typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
  layout: { alignment: 'center', density: 'airy' },
} as never;

const artifactPreview: StudioPreview = {
  status: 'ready',
  title: 'Garden Dinner',
  artifact: {
    format: 'html',
    version: 1,
    title: 'Garden Dinner',
    description: 'An evening together',
    body: '<main><h1>Garden Dinner</h1></main>',
    css: 'body{margin:0}',
  },
  renderUrl: '/api/designs/inv-1/render',
};

describe('AiStudioView', () => {
  it('renders the compact workspace, real navigation, suggestions, and empty canvas', () => {
    const html = renderToStaticMarkup(
      <AiStudioView messages={[]} preview={{ status: 'empty' }} {...base} />
    );
    expect(html).toContain('lg:grid-cols-[224px_430px_minmax(0,1fr)]');
    expect(html).toContain('h-11 grid-cols-[minmax(0,1fr)_auto]');
    expect(html).toContain('w-[224px]');
    expect(html).toContain('lg:w-[430px]');
    expect(html).toContain('aria-label="AI conversation"');
    expect(html).toContain('Tech Founder Dinner');
    expect(html).toContain('Your invitation preview will appear here');
    expect(html).toContain('Maya Haddad');
    expect(html).toContain('maya@example.com');
    expect(html).toContain('href="/dashboard/invitations/new"');
    expect(html).toContain('href="/dashboard/events/new"');
    expect(html).not.toContain('href="#"');
    expect(html).not.toContain('Font Awesome');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('role="status"');
  });

  it('renders the conversation and legacy canvas with editor and details routes', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[
          { role: 'user', text: 'A garden birthday' },
          { role: 'ai', text: 'Done.' },
        ]}
        preview={{ status: 'ready', title: 'Garden Dinner', specification }}
        editorHref="/dashboard/invitations/inv-1/editor"
        detailsHref="/dashboard/invitations/inv-1"
      />
    );
    expect(html).toContain('A garden birthday');
    expect(html).toContain('Done.');
    expect(html).toContain('Garden Dinner');
    expect(html).toContain('href="/dashboard/invitations/inv-1/editor"');
    expect(html).toContain('Open editor');
    expect(html).toContain('href="/dashboard/invitations/inv-1"');
    expect(html).toContain('View details');
    expect(html).not.toContain('Tech Founder Dinner');
  });

  it('renders standalone HTML artifacts in a sandboxed iframe preview', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'A garden dinner' }]}
        preview={artifactPreview}
        detailsHref="/dashboard/invitations/inv-1"
      />
    );
    expect(html).toContain('sandbox=""');
    expect(html).toContain('src="/api/designs/inv-1/render"');
    expect(html).toContain('Garden Dinner');
    expect(html).toContain('View details');
  });

  it('shows image tools only for a legacy specification', () => {
    const imageBar = <aside aria-label="Legacy photo tools">Photo tools</aside>;
    const legacy = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[]}
        imageBar={imageBar}
        preview={{ status: 'ready', title: 'Garden Dinner', specification }}
      />
    );
    const artifact = renderToStaticMarkup(
      <AiStudioView {...base} messages={[]} imageBar={imageBar} preview={artifactPreview} />
    );
    expect(legacy).toContain('Legacy photo tools');
    expect(artifact).not.toContain('Legacy photo tools');
  });

  it('renders working and failed states with retry and manual recovery', () => {
    const working = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'Hi' }]}
        preview={{ status: 'working' }}
      />
    );
    expect(working).toContain('aria-busy="true"');
    expect(working).toContain('Creating your invitation');

    const failed = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'Hi' }]}
        preview={{ status: 'failed' }}
        failedMessage="AI generation is not configured."
        editorHref="/dashboard/invitations/inv-1/editor"
      />
    );
    expect(failed).toContain('Your invitation was created');
    expect(failed).toContain('Retry AI generation');
    expect(failed).toContain('No preview yet');
    expect(failed).toContain('href="/dashboard/events/new"');
  });
});
