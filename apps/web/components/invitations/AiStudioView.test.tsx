import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiStudioView, ModelPicker, type StudioPreview } from './AiStudioView';

const noop = () => undefined;
const base = {
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
  it('shows uploaded previews with remove controls beside the plus upload button', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[]}
        preview={{ status: 'empty' }}
        imageUpload={{
          images: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              fileName: 'couple.jpg',
              previewUrl: 'https://signed.example/couple.jpg',
            },
          ],
          uploading: false,
          progress: null,
          notice: 'Image ready.',
          disabled: false,
          onFiles: noop,
          onRemove: noop,
        }}
      />
    );
    expect(html).toContain('aria-label="Add images"');
    expect(html).toContain('multiple=""');
    expect(html).toContain('aria-label="Selected images"');
    expect(html).toContain('src="https://signed.example/couple.jpg"');
    expect(html).toContain('aria-label="Remove couple.jpg"');
  });

  it('renders an empty composer with no attachment previews while generation is running', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        {...base}
        prompt=""
        messages={[{ role: 'user', text: 'Use this photo for Ahmad and Sara.' }]}
        preview={{ status: 'working' }}
        imageUpload={{
          images: [],
          uploading: false,
          progress: null,
          notice: null,
          disabled: true,
          onFiles: noop,
          onRemove: noop,
        }}
      />
    );
    expect(html).toContain('aria-label="Stop generation"');
    expect(html).toContain('<textarea');
    expect(html).not.toContain('aria-label="Selected images"');
    expect(html).not.toContain('Remove couple.jpg');
  });
  it('keeps design refinement in the AI conversation instead of opening a separate editor', () => {
    const preview = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'A garden dinner' }]}
        preview={artifactPreview}
        detailsHref="/dashboard/invitations/inv-1"
      />
    );
    expect(preview).toContain('aria-label="AI conversation"');
    expect(preview).not.toContain('Edit design');
    expect(preview).not.toContain('Open editor');
  });

  it('uses the existing preview progress state for design refinement', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'Make the background lighter.' }]}
        preview={{ status: 'working', operation: 'refine' }}
      />
    );
    expect(html).toContain('Updating your invitation…');
    expect(html).not.toContain('Creating your invitation…');
  });

  it('keeps the saved preview visible while a refinement is running', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'Make the background lighter.' }]}
        preview={{ status: 'working', operation: 'refine', previous: artifactPreview }}
        detailsHref="/dashboard/invitations/inv-1"
      />
    );
    expect(html).toContain('aria-label="Updating existing preview"');
    expect(html).toContain('src="/api/designs/inv-1/render"');
    expect(html).toContain('Garden Dinner');
  });

  it('introduces the chat and live preview with staged entrance transitions', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'A garden dinner' }]}
        preview={{ status: 'working' }}
      />
    );
    expect(html).toContain('miad-studio-chat-enter');
    expect(html).toContain('miad-studio-preview-enter');
  });

  it('renders the landing state with real recent projects, greeting, and suggestions', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        messages={[]}
        preview={{ status: 'empty' }}
        {...base}
        recentInvitations={[
          { id: 'inv-1', title: 'Garden Dinner' },
          { id: 'inv-2', title: 'Rooftop Birthday' },
          { id: 'inv-3', title: 'Studio Opening' },
          { id: 'inv-4', title: 'Old Project' },
        ]}
      />
    );
    expect(html).toContain('miad-studio-glow');
    expect(html).toContain('Recent projects');
    expect(html).toContain('Garden Dinner');
    expect(html).toContain('Maya, what are we working on today?');
    expect(html).toContain('Tech Founder Dinner');
    expect(html).toContain('aria-label="Account: Maya Haddad"');
    expect(html).toContain('Rooftop Birthday');
    expect(html).toContain('Studio Opening');
    expect(html).not.toContain('Old Project');
    expect(html).not.toContain('invitation preview');
    expect(html).not.toContain('Published');
    expect(html).not.toContain('Open/Edit');
    expect(html).toContain('href="/dashboard/invitations/new?invitationId=inv-1"');
    // The split studio is reserved for an active conversation.
    expect(html).not.toContain('aria-label="AI conversation"');
    expect(html).not.toContain('aria-label="Live invitation preview"');
    expect(html).not.toContain('href="#"');
    expect(html).not.toContain('<script');
  });

  it('shows a responsive loading skeleton and a designed empty state for recent projects', () => {
    const loading = renderToStaticMarkup(
      <AiStudioView {...base} messages={[]} preview={{ status: 'empty' }} recentProjectsLoading />
    );
    expect(loading).toContain('aria-label="Loading recent projects"');
    expect(loading).toContain('animate-pulse');

    const empty = renderToStaticMarkup(
      <AiStudioView {...base} messages={[]} preview={{ status: 'empty' }} />
    );
    expect(empty).toContain('No projects yet');
    expect(empty).not.toContain(
      'Your invitations will appear here once you create your first one.'
    );
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
    expect(html).toContain('miad-studio-split-panels');
    expect(html).toContain('lg:grid-cols-[auto_minmax(0,1fr)]');
    expect(html).not.toContain('miad-studio-glow');
  });

  it('shows a compact Auto pill in the composer toolbar instead of a form field', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[]}
        preview={{ status: 'empty' }}
        modelSelectionOperation="generation"
        modelOptions={[]}
      />
    );
    expect(html).toContain('Choose AI model');
    expect(html).toContain('>Auto</span>');
    expect(html).not.toContain('studio-model');
    expect(html).not.toContain('<select');
  });

  it('shows Auto and only the verified Stitch generation models returned by the API', () => {
    const html = renderToStaticMarkup(
      <ModelPicker
        modelSelectionOperation="generation"
        modelPreference="auto"
        modelSelectionLoading={false}
        onModelPreferenceChange={() => undefined}
        initialOpen
        modelOptions={[
          {
            id: 'GEMINI_3_8_FLASH',
            name: 'Stitch — Gemini 3.8 Flash',
            description: 'Generate with Gemini 3.8 Flash in Stitch',
            operations: ['generation'],
            tier: 'standard',
            available: true,
          },
          {
            id: 'GEMINI_3_5_FLASH_LITE',
            name: 'Stitch — Gemini 3.5 Flash-Lite',
            description: 'Generate with Gemini 3.5 Flash-Lite in Stitch',
            operations: ['generation'],
            tier: 'standard',
            available: true,
          },
          {
            id: 'UNVERIFIED_MODEL',
            name: 'Unverified model',
            description: 'Not a generation option',
            operations: ['refinement'],
            tier: 'standard',
            available: true,
          },
        ]}
      />
    );
    expect(html).toContain('>Auto</span>');
    expect(html).toContain('Stitch — Gemini 3.8 Flash');
    expect(html).toContain('Stitch — Gemini 3.5 Flash-Lite');
    expect(html).not.toContain('Unverified model');
  });

  it('prompts to create a first invitation when the account has none', () => {
    const html = renderToStaticMarkup(
      <AiStudioView messages={[]} preview={{ status: 'empty' }} {...base} />
    );
    expect(html).toContain('Recent projects');
    expect(html).toContain('No projects yet.');
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
    expect(html).toContain('miad-studio-split-panels');
    expect(html).toContain('aria-label="AI conversation"');
    expect(html).toContain('Your invitation preview will appear here');
    expect(html).toContain('Maya Haddad');
    expect(html).toContain('href="/dashboard/invitations/new"');
    expect(html).toContain('href="/dashboard/invitations"');
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
        studioHref="/dashboard/invitations/new?invitationId=inv-1"
        detailsHref="/dashboard/invitations/inv-1"
      />
    );
    expect(html).toContain('A garden birthday');
    expect(html).toContain('Done.');
    expect(html).toContain('Garden Dinner');
    expect(html).not.toContain('href="/dashboard/invitations/inv-1/editor"');
    expect(html).toContain('href="/dashboard/invitations/inv-1"');
    expect(html).toContain('View details');
    expect(html).toContain('>Publish</button>');
    expect(html).not.toContain('Tech Founder Dinner');
  });

  it('marks a regenerated published design as waiting for an explicit publish update', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'A garden dinner' }]}
        preview={artifactPreview}
        detailsHref="/dashboard/invitations/inv-1"
        publishUrl="https://miad.test/invite/garden-dinner"
        publicationPending
        onPublish={noop}
      />
    );
    expect(html).toContain('New design ready to publish');
    expect(html).toContain('Publish update');
    expect(html).toContain('https://miad.test/invite/garden-dinner');
  });

  it('shows the public URL and open action after publishing', () => {
    const html = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'A garden dinner' }]}
        preview={{ status: 'ready', title: 'Garden Dinner', specification }}
        detailsHref="/dashboard/invitations/inv-1"
        publishUrl="https://example.test/invite/garden-dinner"
      />
    );
    expect(html).toContain('https://example.test/invite/garden-dinner');
    expect(html).toContain('Open invitation');
    expect(html).toContain('href="https://example.test/invite/garden-dinner"');
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
        studioHref="/dashboard/invitations/new?invitationId=inv-1"
      />
    );
    expect(failed).toContain('Your invitation was created');
    expect(failed).not.toContain('Retry AI generation');
    expect(failed).toContain('Submit a new prompt in the agent panel');
    expect(failed).toContain('No preview yet');
    expect(failed).toContain('href="/dashboard/invitations"');
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
    expect(html).toContain('Generating your design with Stitch');
    expect(html).toContain('Checking and sanitizing your design');
  });

  it('shows the real refinement steps and exposes a backend failure state', () => {
    const progress = {
      generationId: '11111111-1111-4111-8111-111111111111',
      operation: 'refinement' as const,
      stage: 'REFINEMENT_APPLYING' as const,
      status: 'ACTIVE' as const,
      occurredAt: '2026-09-26T12:00:00.000Z',
    };
    const active = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'Make it more elegant.' }]}
        preview={{ status: 'working', operation: 'refine', previous: artifactPreview }}
        generationProgress={progress}
      />
    );
    expect(active).toContain('Invitation refinement progress');
    expect(active).toContain('Understanding your request');
    expect(active).toContain('Inspecting the current invitation');
    expect(active).toContain('Applying the requested changes');
    expect(active).toContain('Validating the updated design');
    expect(active).toContain('Saving the new invitation version');
    expect(active).toContain('aria-label="Updating existing preview"');

    const failed = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'Make it more elegant.' }]}
        preview={artifactPreview}
        generationProgress={{
          ...progress,
          stage: 'REFINEMENT_APPLYING',
          status: 'FAILED',
          errorMessage: 'The website could not be generated. Please try again.',
        }}
      />
    );
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('The website could not be generated. Please try again.');

    const updated = renderToStaticMarkup(
      <AiStudioView
        {...base}
        messages={[{ role: 'user', text: 'Make it more elegant.' }]}
        preview={artifactPreview}
        generationProgress={{
          ...progress,
          stage: 'REFINEMENT_PREVIEW_UPDATED',
          status: 'COMPLETED',
        }}
      />
    );
    expect(updated).toContain('Updating the preview');
    expect(updated.match(/✓/g)).toHaveLength(6);
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
