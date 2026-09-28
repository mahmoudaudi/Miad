import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminHeader } from './AdminHeader';

describe('AdminHeader', () => {
  it('renders only the section breadcrumb', () => {
    const html = renderToStaticMarkup(<AdminHeader section="users" />);
    expect(html).toContain('Platform');
    expect(html).toContain('Users Management');
    // Removed: global search, live pill, navbar profile.
    expect(html).not.toContain('role="search"');
    expect(html).not.toContain('API Connected');
    expect(html).not.toContain('notifications');
  });

  it('falls back to the raw section name', () => {
    const html = renderToStaticMarkup(<AdminHeader section="mystery" />);
    expect(html).toContain('mystery');
  });
});
