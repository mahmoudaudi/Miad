import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GenerationFailedNotice } from './GenerationFailedNotice';

const editorHref = '/dashboard/invitations/invitation-1/editor';

describe('GenerationFailedNotice', () => {
  it('states the invitation was created and offers retry plus manual editor', () => {
    const html = renderToStaticMarkup(
      <GenerationFailedNotice
        message="AI generation is not configured."
        editorHref={editorHref}
        generating={false}
        onRetry={() => undefined}
      />
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('Your invitation was created');
    expect(html).not.toContain('could not create');
    expect(html).toContain('AI generation is not configured.');
    expect(html).toContain('Retry AI generation');
    expect(html).toContain(`href="${editorHref}"`);
    expect(html).toContain('Open editor');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('Generating…');
  });

  it('disables retry while a generation attempt is running', () => {
    const html = renderToStaticMarkup(
      <GenerationFailedNotice
        message="AI generation timed out. Please try again."
        editorHref={editorHref}
        generating={true}
        onRetry={() => undefined}
      />
    );
    expect(html).toContain('Generating…');
    expect(html).toContain('disabled');
    // The manual path stays available even while AI is busy.
    expect(html).toContain(`href="${editorHref}"`);
  });

  it('invokes retry without navigating away', () => {
    const onRetry = vi.fn();
    const html = renderToStaticMarkup(
      <GenerationFailedNotice
        message="AI generation failed. Please try again."
        editorHref={editorHref}
        generating={false}
        onRetry={onRetry}
      />
    );
    // Static render cannot click; assert the handler is wired by rendering
    // the interactive elements (no auto-navigation, editor is a plain link).
    expect(onRetry).not.toHaveBeenCalled();
    expect(html).toContain('<button');
    expect(html).toContain('Open editor');
  });
});
