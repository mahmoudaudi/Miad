import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { hasUsableAccessToken, middleware } from '../middleware';

function tokenWithExpiry(exp: number): string {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `header.${payload}.signature`;
}

describe('authentication middleware', () => {
  it('recognizes current and expired access-token timestamps', () => {
    const now = Date.UTC(2026, 8, 20);
    expect(hasUsableAccessToken(tokenWithExpiry(now / 1000 + 60), now)).toBe(true);
    expect(hasUsableAccessToken(tokenWithExpiry(now / 1000 - 1), now)).toBe(false);
    expect(hasUsableAccessToken('malformed', now)).toBe(false);
  });

  it('redirects an unauthenticated protected request to login with its destination', () => {
    const response = middleware(new NextRequest('http://localhost:3000/dashboard?tab=events'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?next=%2Fdashboard%3Ftab%3Devents'
    );
  });

  it('does not redirect a protected request with an unexpired access cookie', () => {
    const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 60);
    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: { cookie: `access_token=${token}` },
    });
    expect(middleware(request).status).toBe(200);
  });

  it('redirects an authenticated home-page request directly to AI Studio', () => {
    const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 60);
    const request = new NextRequest('http://localhost:3000/', {
      headers: { cookie: `access_token=${token}` },
    });
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard/invitations/new');
  });

  it('restores dashboard routes when only a current refresh cookie remains', () => {
    const expiredAccess = tokenWithExpiry(Math.floor(Date.now() / 1000) - 1);
    const refresh = tokenWithExpiry(Math.floor(Date.now() / 1000) + 60);
    const cookie = `access_token=${expiredAccess}; refresh_token=${refresh}`;

    const homeResponse = middleware(
      new NextRequest('http://localhost:3000/', { headers: { cookie } })
    );
    expect(homeResponse.headers.get('location')).toBe(
      'http://localhost:3000/dashboard/invitations/new'
    );

    const dashboardResponse = middleware(
      new NextRequest('http://localhost:3000/dashboard', { headers: { cookie } })
    );
    expect(dashboardResponse.status).toBe(200);
  });

  it('keeps the landing page available to signed-out visitors', () => {
    expect(middleware(new NextRequest('http://localhost:3000/')).status).toBe(200);
  });

  it('allows login when the access cookie is expired', () => {
    const token = tokenWithExpiry(Math.floor(Date.now() / 1000) - 1);
    const request = new NextRequest('http://localhost:3000/login', {
      headers: { cookie: `access_token=${token}` },
    });
    expect(middleware(request).status).toBe(200);
  });

  it('redirects authenticated login and registration routes to AI Studio', () => {
    const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 60);
    for (const path of ['/login', '/register']) {
      const request = new NextRequest(`http://localhost:3000${path}`, {
        headers: { cookie: `access_token=${token}` },
      });
      const response = middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/dashboard/invitations/new'
      );
    }
  });
});
