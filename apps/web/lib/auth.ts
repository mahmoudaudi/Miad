import { getApiUrl } from './env';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
};

export class AuthApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiUrl().replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: 'include',
    // Same rule as api-client: no Content-Type without a body, so simple
    // GETs skip the CORS preflight roundtrip.
    headers: {
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (!res.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? `Request failed (${res.status})`);
    throw new AuthApiError(res.status, message);
  }
  return body as T;
}

export function register(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  return authRequest<AuthUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function login(input: { email: string; password: string }): Promise<AuthUser> {
  return authRequest<AuthUser>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function requestPasswordReset(email: string): Promise<{ status: 'accepted' }> {
  return authRequest<{ status: 'accepted' }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(input: { token: string; password: string }): Promise<{ status: 'reset' }> {
  return authRequest<{ status: 'reset' }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function startGoogleSignIn(): void {
  window.location.assign(`${getApiUrl().replace(/\/$/, '')}/auth/google`);
}

async function logoutOnce(): Promise<{ status: 'ok' }> {
  return authRequest<{ status: 'ok' }>('/auth/logout', { method: 'POST' });
}

/**
 * Logs out even when the short-lived access token expired while the page was
 * open. A successful refresh gives logout a valid access token; an invalid
 * refresh is cleared by the API and already represents an unusable session.
 */
export async function logout(): Promise<{ status: 'ok' }> {
  try {
    return await logoutOnce();
  } catch (error) {
    if (!(error instanceof AuthApiError) || error.status !== 401) throw error;
    try {
      await refreshSession();
    } catch (refreshError) {
      if (refreshError instanceof AuthApiError && refreshError.status === 401) {
        return { status: 'ok' };
      }
      throw refreshError;
    }
    return logoutOnce();
  }
}

export function refreshSession(): Promise<AuthUser> {
  return authRequest<AuthUser>('/auth/refresh', { method: 'POST' });
}

/** Returns the current user, or null when not authenticated. */
export async function me(): Promise<AuthUser | null> {
  try {
    return await authRequest<AuthUser>('/auth/me');
  } catch (e) {
    if (e instanceof AuthApiError && e.status === 401) return null;
    throw e;
  }
}

/** Restores the current session once when the access token has expired. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const current = await me();
  if (current) return current;
  try {
    return await refreshSession();
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) return null;
    throw error;
  }
}
