import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminBrandPane } from './AdminBrandPane';

describe('AdminBrandPane', () => {
  it('renders the shared repo logo, white-inverted', () => {
    const html = renderToStaticMarkup(<AdminBrandPane />);
    // next/image optimizes the src, but the repo asset must stay the source.
    expect(html).toContain('miad-logo.png');
    expect(html).toContain('alt="Miad"');
    // No external logo URLs: the portal must use the repo asset.
    expect(html).not.toContain('googleusercontent');
  });
});
