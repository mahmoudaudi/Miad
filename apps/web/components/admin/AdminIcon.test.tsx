import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminIcon } from './AdminIcon';

describe('AdminIcon', () => {
  it('renders a gradient tile with a filled glyph', () => {
    const html = renderToStaticMarkup(<AdminIcon icon="group" tone="burgundy" label="Users" />);
    expect(html).toContain('group');
    expect(html).toContain('bg-gradient-to-br');
    expect(html).toContain('rounded-xl');
    expect(html).toContain('aria-label="Users"');
  });

  it('renders decorative glyphs without labels', () => {
    const html = renderToStaticMarkup(<AdminIcon icon="search" tone="slate" size={16} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('aria-label');
  });
});
