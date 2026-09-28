import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Lightweight route protection. Expiry is checked here for correct redirects;
 * signature, user liveness, and token version remain authoritative in the API.
 * - / redirects authenticated users straight to AI Studio
 * - /dashboard/* and /community/* require a session → else the in-app login modal
 * - /admin/* (except /admin/login) requires a session → else /admin/login
 * - /login & /register open the in-app modal instead of standalone pages
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

/**
 * Best-effort role hint from the token payload. The signature is NOT
 * verified here, so this must never authorize anything — it only steers
 * obvious misroutes early. DashboardShell, AdminShell, and the API remain
 * authoritative. Returns null when the claim is absent or unreadable, in
 * which case callers fall back to the existing behavior.
 */
export function readTokenRoleClaim(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload.role === 'string' && payload.role ? payload.role : null;
  } catch {
    return null;
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
  const isCommunity = pathname === '/community' || pathname.startsWith('/community/');
  const isAdminLogin = pathname === '/admin/login';
  const isAdminRoute =
    !isAdminLogin && (pathname === '/admin' || pathname.startsWith('/admin/'));

  // Best-effort admin/user separation from the unverified role claim.
  // Authoritative enforcement lives in DashboardShell, AdminShell, and the API.
  const claimedRole =
    (hasUsableAccessToken(accessToken) ? readTokenRoleClaim(accessToken) : null) ??
    (hasUsableAccessToken(refreshToken) ? readTokenRoleClaim(refreshToken) : null);
  const claimsAdmin = claimedRole === 'admin';
  const claimsNonAdmin = claimedRole !== null && claimedRole !== 'admin';

  if (hasSession && claimsAdmin && (isDashboard || pathname === '/')) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }
  if (hasSession && claimsNonAdmin && isAdminRoute) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  if (pathname === '/' && hasSession) {
    const requestedNext = req.nextUrl.searchParams.get('next');
    let safeNext: URL | null = null;
    if (requestedNext) {
      try {
        const nextUrl = new URL(requestedNext, req.url);
        if (nextUrl.origin === req.nextUrl.origin) safeNext = nextUrl;
      } catch {
        // Ignore malformed destinations and use the default dashboard route.
      }
    }
    if (req.nextUrl.searchParams.has('auth') && safeNext) {
      return NextResponse.redirect(safeNext);
    }
    return NextResponse.redirect(new URL('/dashboard/invitations/new', req.url));
  }
  if ((isDashboard || isCommunity) && !hasSession) {
    const modalUrl = new URL('/', req.url);
    modalUrl.searchParams.set('auth', 'login');
    modalUrl.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(modalUrl);
  }
  if (isAdminRoute && !hasSession) {
    // Role enforcement stays authoritative in the API (@Roles('admin'));
    // the admin login form additionally rejects non-admin sessions client-side.
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
  if (pathname === '/login' || pathname === '/register') {
    if (hasSession && claimsAdmin) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    const requestedNext = req.nextUrl.searchParams.get('next');
    if (hasSession) {
      let safeNext: URL | null = null;
      if (requestedNext) {
        try {
          const nextUrl = new URL(requestedNext, req.url);
          if (nextUrl.origin === req.nextUrl.origin) safeNext = nextUrl;
        } catch {
          // Ignore malformed destinations and use the default dashboard route.
        }
      }
      return NextResponse.redirect(safeNext ?? new URL('/dashboard/invitations/new', req.url));
    }
    const modalUrl = new URL('/', req.url);
    modalUrl.searchParams.set('auth', pathname === '/register' ? 'register' : 'login');
    if (requestedNext) modalUrl.searchParams.set('next', requestedNext);
    return NextResponse.redirect(modalUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/community/:path*', '/admin/:path*', '/login', '/register'],
};
