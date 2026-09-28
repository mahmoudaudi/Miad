import { describe, expect, it } from 'vitest';
import { decideDashboardAccess, isAiStudioPath } from './DashboardShell';
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
