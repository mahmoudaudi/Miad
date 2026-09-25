import { getApiUrl } from './env';
import { AuthApiError, refreshSession } from './auth';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Minimal typed API client foundation.
 * Usage (later phases): apiClient<HealthResponse>('/health')
 */
export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiUrl().replace(/\/$/, '');
  const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    credentials: 'include',
    // Only send a JSON content type when there is a body: a Content-Type on a
    // bodyless GET/DELETE forces a CORS preflight roundtrip for no benefit.
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
    throw new ApiError(res.status, message);
  }
  return body as T;
}

/** Retries one protected request after refreshing an expired access token. */
export async function authenticatedApiClient<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await apiClient<T>(path, init);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    try {
      await refreshSession();
    } catch (refreshError) {
      if (refreshError instanceof AuthApiError) {
        throw new ApiError(refreshError.status, refreshError.message);
      }
      throw refreshError;
    }
    return apiClient<T>(path, init);
  }
}

export type HealthResponse = {
  status: 'ok';
  service: string;
  timestamp: string;
};
