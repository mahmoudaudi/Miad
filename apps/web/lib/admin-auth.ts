import { AuthUser, login, logout } from './auth';

/**
 * Admin-area auth helpers.
 *
 * Login, session restore, and cookies are shared with the user app
 * (see ./auth). The only admin-specific rule is the role check: the API
 * remains authoritative via @Roles('admin') + RolesGuard, and the web app
 * mirrors it here so non-admin sessions never enter /admin routes.
 */

export const ADMIN_ROLE = 'admin';
export const ADMIN_LOGIN_PATH = '/admin/login';
export const ADMIN_HOME_PATH = '/admin';

export function isAdminRole(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE;
}

export class AdminAccessDeniedError extends Error {
  constructor() {
    super('This portal is for admin accounts only.');
  }
}

/**
 * Signs in through the shared auth API and enforces the admin role. A
 * signed-in non-admin session is logged out before denial so a user cookie
 * can never linger into the admin area.
 */
export async function signInAsAdmin(input: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const user = await login(input);
  if (isAdminRole(user.role)) return user;
  try {
    await logout();
  } catch {
    // The session is unusable for admin either way; surface access denial.
  }
  throw new AdminAccessDeniedError();
}
