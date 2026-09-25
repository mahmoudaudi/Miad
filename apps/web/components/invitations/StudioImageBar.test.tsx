import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudioImageBar } from './StudioImageBar';

const noop = () => undefined;

describe('StudioImageBar', () => {
  it('offers upload plus internet link with a contextual hint', () => {
    const html = renderToStaticMarkup(
      <StudioImageBar
        disabled={false}
        uploading={false}
        progress={null}
        imageUrl=""
        notice={null}
        hint="Weddings shine with your own photos."
        onFile={noop}
        onUrlChange={noop}
        onUrlAdd={noop}
      />
    );
    expect(html).toContain('aria-label="Invitation photos"');
    expect(html).toContain('Upload photo');
    expect(html).toContain('Paste an internet image link');
    expect(html).toContain('Weddings shine with your own photos.');
    expect(html).toContain('https://… image link');
  });

  it('shows upload progress and status notices', () => {
    const html = renderToStaticMarkup(
      <StudioImageBar
        disabled={false}
        uploading={true}
        progress={42}
        imageUrl="https://example.com/a.jpg"
        notice="Photo added to your design."
        hint="Upload your own photo, or paste an internet image link."
        onFile={noop}
        onUrlChange={noop}
        onUrlAdd={noop}
      />
    );
    expect(html).toContain('Uploading…');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('Photo added to your design.');
  });
});
