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
  manualHref: '/dashboard/events/new',
  imageBar: null,
  profile: {
    name: 'Maya Haddad',
    email: 'maya@example.com',
    initials: 'MH',
  },
  onPromptChange: noop,
  onSend: noop,
  onStop: noop,
  onSuggestion: noop,
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
  it('renders the landing state with real recent projects, greeting, and suggestions', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        messages={[]}
        preview={{ status: 'empty' }}
        {...base}
        recentInvitations={[
          {
            id: 'inv-1',
            title: 'Garden Dinner',
            eventDate: 'December 12, 2026',
            createdAt: new Date().toISOString(),
          },
        ]}
      />
    );
    expect(html).toContain('miad-studio-glow');
    expect(html).toContain('Recent projects');
    expect(html).toContain('Garden Dinner');
    expect(html).toContain('Maya, what are we working on today?');
    expect(html).toContain('Tech Founder Dinner');
    expect(html).toContain('aria-label="Account: Maya Haddad"');
    expect(html).toContain('href="/dashboard/invitations/inv-1"');
    // The split studio is reserved for an active conversation.
    expect(html).not.toContain('aria-label="AI conversation"');
    expect(html).not.toContain('aria-label="Live invitation preview"');
    expect(html).not.toContain('href="#"');
    expect(html).not.toContain('<script');
  });

  it('promotes to the split studio once the client sends a prompt', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        messages={[{ role: 'user', text: 'A rooftop birthday' }]}
        preview={{ status: 'empty' }}
        {...base}
      />
    );
    expect(html).toContain('aria-label="AI conversation"');
    expect(html).toContain('aria-label="Live invitation preview"');
    expect(html).toContain('lg:w-[430px]');
    expect(html).not.toContain('miad-studio-glow');
  });

  it('prompts to create a first invitation when the account has none', () => {
    const html = renderToStaticMarkup(
      <AiStudioView messages={[]} preview={{ status: 'empty' }} {...base} />
    );
    expect(html).toContain('Recent projects');
    expect(html).toContain('once you create your first one');
  });

  it('renders the compact workspace, real navigation, and empty canvas', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        messages={[{ role: 'user', text: 'A garden birthday' }]}
        preview={{ status: 'empty' }}
        {...base}
      />
    );
    expect(html).toContain('lg:grid-cols-[224px_430px_minmax(0,1fr)]');
    expect(html).toContain('h-12 grid-cols-[minmax(0,1fr)_auto]');
    expect(html).toContain('w-[224px]');
    expect(html).toContain('lg:w-[430px]');
    expect(html).toContain('aria-label="AI conversation"');
    expect(html).toContain('Your invitation preview will appear here');
    expect(html).toContain('Maya Haddad');
    expect(html).toContain('href="/dashboard/invitations/new"');
    expect(html).toContain('href="/dashboard/events/new"');
    expect(html).not.toContain('href="#"');
    expect(html).not.toContain('Font Awesome');
    expect(html).not.toContain('<script');
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
    const messages = [{ role: 'user' as const, text: 'A garden dinner' }];
    const legacy = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={messages}
        imageBar={imageBar}
        preview={{ status: 'ready', title: 'Garden Dinner', specification }}
      />
    );
    const artifact = renderToStaticMarkup(
      <AiStudioView {...base} messages={messages} imageBar={imageBar} preview={artifactPreview} />
    );
    expect(legacy).toContain('Legacy photo tools');
    expect(artifact).not.toContain('Legacy photo tools');
  });

  it('renders working and failed states without retry, plus manual recovery', () => {
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
    expect(failed).not.toContain('Retry AI generation');
    expect(failed).toContain('Submit a new prompt in the agent panel');
    expect(failed).toContain('No preview yet');
    expect(failed).toContain('href="/dashboard/events/new"');
  });

  it('swaps the submit button for a real stop button while generating', () => {
    const idle = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'Hi' }]}
        preview={{ status: 'empty' }}
        sendDisabled={false}
        sendLabel="Generate"
      />
    );
    expect(idle).toContain('type="submit"');
    expect(idle).toContain('arrow_upward');
    expect(idle).not.toContain('aria-label="Stop generation"');

    const working = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'Hi' }]}
        preview={{ status: 'working' }}
        sendDisabled
        sendLabel="Creating…"
      />
    );
    expect(working).toContain('type="button"');
    expect(working).toContain('aria-label="Stop generation"');
    // Material stop glyph renders the square in the composer…
    expect(working).toContain('>stop<');
    const composer = working.match(/<form[\s\S]*?<\/form>/)?.[0];
    expect(composer).toBeTruthy();
    // …replacing the old fake spinner and the send arrow, with no timer text.
    expect(composer).not.toContain('progress_activity');
    expect(composer).not.toContain('arrow_upward');
    // The stop action stays clickable while generating.
    expect(working).not.toContain('disabled=""');
  });

  it('renders backend-provided progress without a percentage or simulated time', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'A garden dinner' }]}
        preview={{ status: 'working' }}
        generationProgress={{
          generationId: '11111111-1111-4111-8111-111111111111',
          stage: 'GENERATING_WEBSITE',
          status: 'ACTIVE',
          occurredAt: '2026-09-26T12:00:00.000Z',
        }}
      />
    );
    expect(html).toContain('Website generation progress');
    expect(html).toContain('Generating your website');
    expect(html).toContain('Checking the generated website');
  });

  it('shows one smart question and hides generation progress while asking', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'Tech Founder Dinner' }]}
        preview={{ status: 'empty' }}
        questionPhase="WAITING_FOR_ANSWER"
        question={{
          id: 'atmosphere',
          text: 'What kind of atmosphere would you like for the dinner?',
          type: 'single_select',
          options: [
            { label: 'Modern', value: 'Modern' },
            { label: 'Luxury', value: 'Luxury' },
          ],
          allowOther: true,
        }}
        generationProgress={{
          generationId: '11111111-1111-4111-8111-111111111111',
          stage: 'GENERATING_WEBSITE',
          status: 'ACTIVE',
          occurredAt: '2026-09-26T12:00:00.000Z',
        }}
      />
    );
    expect(html).toContain('aria-label="Smart question"');
    expect(html).toContain('What kind of atmosphere would you like for the dinner?');
    expect(html.match(/aria-label="Smart question"/g)).toHaveLength(1);
    // No generation stages or preview while the assistant is still asking.
    expect(html).not.toContain('Website generation progress');
    expect(html).not.toContain('Generating your website');
    expect(html).not.toContain('Reading the website response');
    expect(html).not.toContain('Saving your invitation');
  });

  it('shows a real analyzing state with no fake timer or generation stages', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'Tech Founder Dinner' }]}
        preview={{ status: 'empty' }}
        questionPhase="ANALYZING_PROMPT"
      />
    );
    expect(html).toContain('Thinking about your invitation');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('aria-label="Smart question"');
    expect(html).not.toContain('Generating your website');
    expect(html.replace(/<[^>]*>/g, ' ')).not.toMatch(/%|remaining/i);
  });
});
