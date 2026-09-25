import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Lightweight route protection. Expiry is checked here for correct redirects;
 * signature, user liveness, and token version remain authoritative in the API.
 * - / redirects authenticated users straight to AI Studio
 * - /dashboard/* requires a session → else /login
 * - /login & /register with a resumable session → AI Studio
 */
export function hasUsableAccessToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return false;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === 'number' && payload.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const accessToken = req.cookies.get('access_token')?.value;
  const refreshToken = req.cookies.get('refresh_token')?.value;
  const { pathname } = req.nextUrl;
  // A valid refresh cookie still represents a resumable signed-in session.
  // Let the dashboard restore its short-lived access token through /auth/refresh.
  const hasSession =
    hasUsableAccessToken(accessToken) || hasUsableAccessToken(refreshToken);

  const isDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  if (pathname === '/' && hasSession) {
    return NextResponse.redirect(new URL('/dashboard/invitations/new', req.url));
  }
  if (isDashboard && !hasSession) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
  if ((pathname === '/login' || pathname === '/register') && hasSession) {
    return NextResponse.redirect(new URL('/dashboard/invitations/new', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/login', '/register'],
};
