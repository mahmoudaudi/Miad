import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/admin',
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, getCurrentUser: () => Promise.resolve(null) };
});

import { AdminShell } from './AdminShell';

describe('AdminShell', () => {
  it('renders a loading frame before the session resolves', () => {
    // Server render never runs effects, so the guard stays pending: no
    // sidebar, no content, no user data leaks into the markup.
    const html = renderToStaticMarkup(<AdminShell section="overview">secret</AdminShell>);
    expect(html).toContain('Loading admin portal');
    expect(html).not.toContain('secret');
  });

  it('never renders a stale cached identity as authoritative', () => {
    // A previous account's cached session must not appear, even when present.
    const values = new Map<string, string>([
      [
        'miad_admin_session_cache',
        JSON.stringify({
          user: {
            id: 'account-a',
            email: 'a@example.com',
            firstName: 'Account',
            lastName: 'A',
            role: 'admin',
            isActive: true,
          },
          timestamp: Date.now(),
        }),
      ],
    ]);
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          values.set(key, value);
        },
        removeItem: (key: string) => {
          values.delete(key);
        },
      },
    });
    const html = renderToStaticMarkup(<AdminShell section="overview">secret</AdminShell>);
    expect(html).toContain('Loading admin portal');
    expect(html).not.toContain('Account A');
    expect(html).not.toContain('a@example.com');
    vi.unstubAllGlobals();
  });
});
