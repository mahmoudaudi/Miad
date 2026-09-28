import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminAccessDeniedError, isAdminRole, signInAsAdmin } from './admin-auth';
import { AuthApiError } from './auth';

const adminUser = {
  id: 'a-1',
  email: 'admin@miad.sa',
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin',
  isActive: true,
};

const plainUser = { ...adminUser, id: 'u-1', email: 'host@example.com', role: 'user' };

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isAdminRole', () => {
  it('accepts only the admin role', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('user')).toBe(false);
    expect(isAdminRole('')).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe('signInAsAdmin', () => {
  it('resolves the user when the role is admin', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(adminUser, 200));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      signInAsAdmin({ email: 'admin@miad.sa', password: 'secret' })
    ).resolves.toEqual(adminUser);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/auth/login');
  });

  it('logs out and denies a signed-in non-admin session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(plainUser, 200))
      .mockResolvedValueOnce(jsonResponse({ status: 'ok' }, 200));
    vi.stubGlobal('fetch', fetchMock);

    await expect(signInAsAdmin({ email: 'host@example.com', password: 'secret' })).rejects.toBeInstanceOf(
      AdminAccessDeniedError
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/auth/logout');
  });

  it('still denies when logout itself fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(plainUser, 200))
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(signInAsAdmin({ email: 'host@example.com', password: 'secret' })).rejects.toBeInstanceOf(
      AdminAccessDeniedError
    );
  });

  it('propagates API errors without logging out', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'Invalid credentials' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(signInAsAdmin({ email: 'admin@miad.sa', password: 'wrong' })).rejects.toBeInstanceOf(
      AuthApiError
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
