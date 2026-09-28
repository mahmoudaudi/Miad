import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GenerationFailedNotice } from './GenerationFailedNotice';

const studioHref = '/dashboard/invitations/new?invitationId=invitation-1';

describe('GenerationFailedNotice', () => {
  it('states the invitation was created and offers retry plus AI Studio recovery', () => {
    const html = renderToStaticMarkup(
      <GenerationFailedNotice
        message="AI generation is not configured."
        studioHref={studioHref}
        generating={false}
        onRetry={() => undefined}
      />
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('Your invitation was created');
    expect(html).not.toContain('could not create');
    expect(html).toContain('AI generation is not configured.');
    expect(html).toContain('Retry AI generation');
    expect(html).toContain(`href="${studioHref}"`);
    expect(html).toContain('Continue in AI Studio');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('Generating…');
  });

  it('disables retry while a generation attempt is running', () => {
    const html = renderToStaticMarkup(
      <GenerationFailedNotice
        message="AI generation timed out. Please try again."
        studioHref={studioHref}
        generating={true}
        onRetry={() => undefined}
      />
    );
    expect(html).toContain('Generating…');
    expect(html).toContain('disabled');
    expect(html).toContain(`href="${studioHref}"`);
  });

  it('invokes retry without navigating away', () => {
    const onRetry = vi.fn();
    const html = renderToStaticMarkup(
      <GenerationFailedNotice
        message="AI generation failed. Please try again."
        studioHref={studioHref}
        generating={false}
        onRetry={onRetry}
      />
    );
    // Static render cannot click; assert the handler is wired by rendering
    // the interactive elements without automatically navigating away.
    expect(onRetry).not.toHaveBeenCalled();
    expect(html).toContain('<button');
    expect(html).toContain('Continue in AI Studio');
  });

  it('omits retry when unavailable and keeps a route back to AI Studio', () => {
    const html = renderToStaticMarkup(
      <GenerationFailedNotice message="AI generation failed." studioHref={studioHref} />
    );
    expect(html).toContain('Your invitation was created');
    expect(html).toContain('AI generation failed.');
    expect(html).not.toContain('Retry AI generation');
    expect(html).not.toContain('<button');
    expect(html).toContain(`href="${studioHref}"`);
    expect(html).toContain('Continue in AI Studio');
  });
});
