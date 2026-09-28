import { afterEach, describe, expect, it, vi } from 'vitest';
import { login, logout, register } from './auth';
import { AUTH_SUCCESS_MESSAGES, safeAuthErrorMessage, withAuthFeedback } from './auth-feedback';

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

const notify = vi.fn();

afterEach(() => {
  notify.mockClear();
  vi.unstubAllGlobals();
});

describe('authentication feedback', () => {
  it('shows login success only after login resolves', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(user, 200)));
    await expect(
      withAuthFeedback(
        () => login({ email: user.email, password: 'test-password' }),
        AUTH_SUCCESS_MESSAGES.login,
        'Login failed.',
        notify
      )
    ).resolves.toEqual(user);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('Welcome back!', 'success');
  });

  it('shows a safe login error when login rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ message: 'Invalid credentials' }, 401))
    );
    await expect(
      withAuthFeedback(
        () => login({ email: user.email, password: 'test-password' }),
        AUTH_SUCCESS_MESSAGES.login,
        'Login failed.',
        notify
      )
    ).rejects.toThrow('Invalid credentials');
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('Invalid credentials', 'error');
  });

  it('shows signup success only after registration resolves', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(user, 201)));
    await expect(
      withAuthFeedback(
        () =>
          register({
            firstName: 'Host',
            lastName: 'User',
            email: user.email,
            password: 'test-password',
          }),
        AUTH_SUCCESS_MESSAGES.signup,
        'Sign up failed.',
        notify
      )
    ).resolves.toEqual(user);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('Account created successfully!', 'success');
  });

  it('shows a safe signup error when registration rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ message: 'Email already in use' }, 409))
    );
    await expect(
      withAuthFeedback(
        () =>
          register({
            firstName: 'Host',
            lastName: 'User',
            email: user.email,
            password: 'test-password',
          }),
        AUTH_SUCCESS_MESSAGES.signup,
        'Sign up failed.',
        notify
      )
    ).rejects.toThrow('Email already in use');
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('Email already in use', 'error');
  });

  it('shows logout success only after logout resolves', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }, 200)));
    await expect(
      withAuthFeedback(() => logout(), AUTH_SUCCESS_MESSAGES.logout, 'Logout failed.', notify)
    ).resolves.toEqual({ status: 'ok' });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('Logged out successfully.', 'success');
  });

  it('shows a clear logout error when logout rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ message: 'Service unavailable' }, 503))
    );
    await expect(
      withAuthFeedback(() => logout(), AUTH_SUCCESS_MESSAGES.logout, 'Logout failed.', notify)
    ).rejects.toThrow('Service unavailable');
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('Service unavailable', 'error');
  });

  it('falls back when an API error could expose authentication details', async () => {
    const { AuthApiError } = await import('./auth');
    expect(
      safeAuthErrorMessage(
        new AuthApiError(500, 'Refresh token: private-value'),
        'Please try again.'
      )
    ).toBe('Please try again.');
  });
});
