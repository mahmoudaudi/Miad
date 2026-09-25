import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError, getCurrentUser, logout, me } from './auth';

const user = {
  id: 'u-1',
  email: 'host@example.com',
  firstName: 'Host',
  lastName: 'User',
  role: 'user',
  isActive: true,
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth client', () => {
  it('restores the user once when the access token is expired', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse(user, 200));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCurrentUser()).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/auth/me');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/auth/refresh');
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('refreshes an expired access token before retrying logout', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse(user, 200))
      .mockResolvedValueOnce(jsonResponse({ status: 'ok' }, 200));
    vi.stubGlobal('fetch', fetchMock);

    await expect(logout()).resolves.toEqual({ status: 'ok' });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      expect.stringContaining('/auth/logout'),
      expect.stringContaining('/auth/refresh'),
      expect.stringContaining('/auth/logout'),
    ]);
  });

  it('surfaces server failures while treating only 401 as anonymous', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ message: 'Unavailable' }, 503))
    );
    await expect(me()).rejects.toBeInstanceOf(AuthApiError);
  });

  it('omits Content-Type on bodyless requests so simple GETs skip CORS preflight', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(user, 200));
    vi.stubGlobal('fetch', fetchMock);

    await me();
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit)?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('keeps Content-Type on requests with a JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(user, 200));
    vi.stubGlobal('fetch', fetchMock);

    const { login } = await import('./auth');
    await login({ email: 'host@example.com', password: 'long-enough-pw' });
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit)?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

});
