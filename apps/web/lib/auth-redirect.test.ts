import { describe, expect, it } from 'vitest';
import {
  getPostAuthRedirectTarget,
  getRoleHomePath,
  USER_HOME_PATH,
} from './auth-redirect';
import { ADMIN_HOME_PATH } from './admin-auth';

describe('getRoleHomePath', () => {
  it('routes admins to the admin portal', () => {
    expect(getRoleHomePath('admin')).toBe(ADMIN_HOME_PATH);
    expect(getRoleHomePath('admin')).toBe('/admin');
  });

  it('routes normal users to AI Studio', () => {
    expect(getRoleHomePath('user')).toBe(USER_HOME_PATH);
    expect(getRoleHomePath('user')).toBe('/dashboard/invitations/new');
    expect(getRoleHomePath(null)).toBe('/dashboard/invitations/new');
    expect(getRoleHomePath(undefined)).toBe('/dashboard/invitations/new');
  });
});

describe('getPostAuthRedirectTarget', () => {
  it('sends admins to /admin even with a dashboard next parameter', () => {
    expect(
      getPostAuthRedirectTarget({
        role: 'admin',
        search: '?next=%2Fdashboard%2Finvitations%2Fnew',
        fallback: '/dashboard/invitations/new',
      })
    ).toBe('/admin');
  });

  it('sends admins to /admin even with a pending-prompt fallback', () => {
    expect(
      getPostAuthRedirectTarget({
        role: 'admin',
        search: '',
        fallback: '/dashboard/invitations/new',
      })
    ).toBe('/admin');
  });

  it('honors a safe next parameter for normal users', () => {
    expect(
      getPostAuthRedirectTarget({
        role: 'user',
        search: '?next=%2Fdashboard%2Fevents%2F123',
        fallback: '/dashboard/invitations/new',
      })
    ).toBe('/dashboard/events/123');
  });

  it('falls back to AI Studio for normal users without a next parameter', () => {
    expect(
      getPostAuthRedirectTarget({ role: 'user', search: '', fallback: '/dashboard/invitations/new' })
    ).toBe('/dashboard/invitations/new');
  });

  it('rejects cross-origin next parameters for normal users', () => {
    expect(
      getPostAuthRedirectTarget({
        role: 'user',
        search: '?next=https%3A%2F%2Fevil.example%2Fsteal',
        fallback: '/dashboard/invitations/new',
      })
    ).toBe('/dashboard/invitations/new');
  });
});
