import { ADMIN_HOME_PATH, isAdminRole } from './admin-auth';

/** Normal authenticated users always land in AI Studio. */
export const USER_HOME_PATH = '/dashboard/invitations/new';

/**
 * Single role-to-home rule shared by every post-auth destination.
 * Admins always land on the admin portal; everyone else on AI Studio.
 */
export function getRoleHomePath(role: string | null | undefined): string {
  return isAdminRole(role) ? ADMIN_HOME_PATH : USER_HOME_PATH;
}

/** Resolve a same-origin destination after login or registration. */
export function getAuthRedirectTarget(search: string, fallback: string): string {
  const requestedNext = new URLSearchParams(search).get('next');
  if (!requestedNext) return fallback;

  try {
    const currentOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
    const target = new URL(requestedNext, currentOrigin);
    if (target.origin !== currentOrigin) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Post-auth destination with the admin rule applied first. An admin always
 * lands on the admin portal, ignoring next=/dashboard/..., pending-prompt
 * targets, and any previous dashboard route. Normal users keep the existing
 * same-origin next-parameter behavior.
 */
export function getPostAuthRedirectTarget(input: {
  role: string | null | undefined;
  search: string;
  fallback: string;
}): string {
  if (isAdminRole(input.role)) return ADMIN_HOME_PATH;
  return getAuthRedirectTarget(input.search, input.fallback);
}
