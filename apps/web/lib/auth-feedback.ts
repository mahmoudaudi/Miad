import { AuthApiError } from './auth';

export const AUTH_SUCCESS_MESSAGES = {
  signup: 'Account created successfully!',
  login: 'Welcome back!',
  logout: 'Logged out successfully.',
} as const;

export function safeAuthErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof AuthApiError)) return fallback;
  const message = error.message.trim();
  if (
    !message ||
    message.length > 180 ||
    /(?:password|token|secret|authorization|api[\s_-]*key|bearer|jwt|cookie)/i.test(message) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(message) ||
    /\b(?:eyJ[A-Za-z0-9_-]{8,}\.)?[A-Fa-f0-9]{32,}\b/.test(message)
  ) {
    return fallback;
  }
  return message;
}

/** Runs an existing auth operation and emits feedback only after its result is known. */
export async function withAuthFeedback<T>(
  action: () => Promise<T>,
  successMessage: string,
  fallback: string,
  notify: (message: string, kind: 'success' | 'error') => void
): Promise<T> {
  try {
    const result = await action();
    notify(successMessage, 'success');
    return result;
  } catch (error) {
    notify(safeAuthErrorMessage(error, fallback), 'error');
    throw error;
  }
}
