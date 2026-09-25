import { createHmac } from 'node:crypto';
import { AuthController } from './auth.controller';

const accessSecret = 'test-access-secret-for-oauth-state';
const frontendUrl = 'http://localhost:3000';
const tokens = { accessToken: 'test-access-token', refreshToken: 'test-refresh-token' };

function makeController(loginWithGoogle = jest.fn().mockResolvedValue({ user: {}, tokens })) {
  const auth = { loginWithGoogle };
  const config = {
    get: (key: string) =>
      ({
        frontendUrl,
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '30d',
      })[key],
    getOrThrow: () => accessSecret,
  };
  return { controller: new AuthController(auth as never, config as never), loginWithGoogle };
}

function stateValue(nonce: string): string {
  const signature = createHmac('sha256', accessSecret).update(nonce).digest('hex');
  return `${nonce}.${signature}`;
}

describe('AuthController Google OAuth callback', () => {
  it('sets the normal application cookies and redirects to the authenticated dashboard', async () => {
    const { controller, loginWithGoogle } = makeController();
    const state = stateValue('test-nonce');
    const cookie = jest.fn();
    const redirect = jest.fn();
    const clearCookie = jest.fn();
    const response = { cookie, redirect, clearCookie };

    await controller.googleCallback(
      'google-authorization-code',
      state,
      { cookies: { oauth_state: state } } as never,
      response as never
    );

    expect(loginWithGoogle).toHaveBeenCalledWith('google-authorization-code');
    expect(cookie).toHaveBeenCalledTimes(2);
    expect(cookie).toHaveBeenNthCalledWith(
      1,
      'access_token',
      tokens.accessToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' })
    );
    expect(cookie).toHaveBeenNthCalledWith(
      2,
      'refresh_token',
      tokens.refreshToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' })
    );
    expect(clearCookie).toHaveBeenCalledWith(
      'oauth_state',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' })
    );
    expect(redirect).toHaveBeenCalledWith(`${frontendUrl}/dashboard/invitations/new`);
  });

  it('returns invalid callback attempts to login with a generic error marker', async () => {
    const { controller, loginWithGoogle } = makeController();
    const redirect = jest.fn();
    await controller.googleCallback(
      undefined,
      undefined,
      { cookies: {} } as never,
      { redirect } as never
    );

    expect(loginWithGoogle).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(`${frontendUrl}/login?oauth=error`);
  });

  it('returns exchange failures to login without exposing provider details', async () => {
    const { controller } = makeController(jest.fn().mockRejectedValue(new Error('private provider detail')));
    const state = stateValue('failure-nonce');
    const redirect = jest.fn();
    await controller.googleCallback(
      'bad-code',
      state,
      { cookies: { oauth_state: state } } as never,
      { redirect } as never
    );

    expect(redirect).toHaveBeenCalledWith(`${frontendUrl}/login?oauth=error`);
    expect(redirect.mock.calls.flat().join(' ')).not.toContain('private provider detail');
  });
});
