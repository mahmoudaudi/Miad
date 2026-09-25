import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

const googleProfile = {
  sub: 'google-subject-123',
  email: 'person@example.com',
  email_verified: true,
  given_name: 'Google',
  family_name: 'User',
};

function makeService(prisma: Record<string, unknown>) {
  const config = {
    get: (key: string) =>
      ({
        googleClientId: 'client-id',
        googleClientSecret: 'client-secret-test-value',
        googleRedirectUri: 'http://localhost:3001/api/v1/auth/google/callback',
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '30d',
      })[key],
    getOrThrow: (key: string) =>
      ({ JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) })[key],
  };
  return new AuthService(prisma as never, new JwtService({}), config as never);
}

function mockGoogleFetch() {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    if (String(input).includes('/token')) {
      return { ok: true, json: async () => ({ access_token: 'google-access-token' }) } as Response;
    }
    return { ok: true, json: async () => googleProfile } as Response;
  });
}

describe('AuthService Google OAuth account handling', () => {
  afterEach(() => jest.restoreAllMocks());

  it('creates a new user and provider link, then issues the normal JWT pair', async () => {
    const fetch = mockGoogleFetch();
    const user = {
      id: 'new-user',
      email: googleProfile.email,
      firstName: 'Google',
      lastName: 'User',
      isActive: true,
      tokenVersion: 0,
      role: { name: 'user' },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(user),
      },
      oAuthAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-user' }) },
    };

    const result = await makeService(prisma).loginWithGoogle('authorization-code');

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: googleProfile.email,
          oauthAccounts: { create: { provider: 'google', providerAccountId: googleProfile.sub } },
        }),
      })
    );
    expect(result.user).toEqual({
      id: 'new-user',
      email: googleProfile.email,
      firstName: 'Google',
      lastName: 'User',
      role: 'user',
      isActive: true,
    });
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
  });

  it('links a verified Google email to the existing user and signs that account in', async () => {
    mockGoogleFetch();
    const existing = {
      id: 'existing-user',
      email: googleProfile.email,
      firstName: 'Existing',
      lastName: 'Account',
      isActive: true,
      tokenVersion: 2,
      role: { name: 'user' },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(existing) },
      oAuthAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const result = await makeService(prisma).loginWithGoogle('authorization-code');
    expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
      data: { userId: 'existing-user', provider: 'google', providerAccountId: googleProfile.sub },
    });
    expect(result.user.id).toBe('existing-user');
  });

  it('rejects inactive users as regular login does', async () => {
    mockGoogleFetch();
    const inactive = {
      id: 'inactive-user',
      email: googleProfile.email,
      firstName: 'Inactive',
      lastName: 'Account',
      isActive: false,
      tokenVersion: 0,
      role: { name: 'user' },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(inactive) },
      oAuthAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };

    await expect(makeService(prisma).loginWithGoogle('authorization-code')).rejects.toThrow(
      'Google sign-in could not be completed.'
    );
    expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
  });
});
