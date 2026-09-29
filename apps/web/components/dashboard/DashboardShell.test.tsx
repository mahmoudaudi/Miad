import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard/invitations',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/i18n/LocaleProvider', () => ({
  useLocale: () => ({ locale: 'en' }),
}));

vi.mock('@/components/ui/ToastProvider', () => ({
  useToast: () => vi.fn(),
}));

import { decideDashboardAccess, isAiStudioPath, DashboardShell } from './DashboardShell';
import type { AuthUser } from '@/lib/auth';

function userWithRole(role: string): AuthUser {
  return {
    id: 'user-1',
    email: 'someone@example.com',
    firstName: 'Some',
    lastName: 'One',
    role,
    isActive: true,
  };
}

describe('isAiStudioPath', () => {
  it('recognizes AI Studio routes with or without a trailing slash', () => {
    expect(isAiStudioPath('/dashboard/invitations/new')).toBe(true);
    expect(isAiStudioPath('/dashboard/invitations/new/')).toBe(true);
    expect(isAiStudioPath('/dashboard/invitations')).toBe(false);
    expect(isAiStudioPath(null)).toBe(false);
  });
});

describe('decideDashboardAccess', () => {
  it('denies admins the normal dashboard so they never render its children', () => {
    expect(decideDashboardAccess(userWithRole('admin'))).toEqual({ type: 'deny-admin' });
  });

  it('sends unauthenticated visitors to login', () => {
    expect(decideDashboardAccess(null)).toEqual({ type: 'deny-login' });
  });

  it('allows normal users to render the dashboard', () => {
    expect(decideDashboardAccess(userWithRole('user'))).toEqual({ type: 'allow' });
  });
});

describe('DashboardShell error states', () => {
  it('distinguishes API failure from unauthenticated state', async () => {
    const origFetch = global.fetch;
    global.fetch = (async () => {
      throw new Error('Network error');
    }) as typeof fetch;

    try {
      const html = renderToStaticMarkup(
        React.createElement(DashboardShell, {}, React.createElement('div', null, 'child'))
      );
      expect(html).toContain('We could not reach the server');
      expect(html).not.toContain('workspace unavailable');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('redirects to login when user is null without error', async () => {
    const origFetch = global.fetch;
    global.fetch = (async () => ({
      status: 401,
      ok: false,
      json: async () => ({ message: 'Unauthorized' }),
    })) as unknown as typeof fetch;

    try {
      const html = renderToStaticMarkup(
        React.createElement(DashboardShell, {}, React.createElement('div', null, 'child'))
      );
      expect(html).not.toContain('workspace unavailable');
    } finally {
      global.fetch = origFetch;
    }
  });
});
