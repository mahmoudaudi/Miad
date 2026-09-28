import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/components/ui/ToastProvider', () => ({
  useToast: () => () => undefined,
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, getCurrentUser: () => Promise.resolve(null) };
});

import { AdminLoginForm } from './AdminLoginForm';

describe('AdminLoginForm', () => {
  it('starts in a safe session-checking state with empty credentials', () => {
    // Server render never runs effects, so the form stays in its
    // session-checking state: no inputs, no prefilled values.
    const html = renderToStaticMarkup(<AdminLoginForm />);
    expect(html).toContain('Checking your session');
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('admin@miad.sa');
  });
});
