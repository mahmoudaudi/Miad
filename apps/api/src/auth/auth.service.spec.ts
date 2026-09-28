import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CreditsService } from '../billing/credits.service';
import { FreeCreditsService } from '../billing/free-credits.service';
import { AuthService } from './auth.service';

/** AuthService unit tests — Prisma is stubbed, bcrypt + JWT are real. No DB needed. */
describe('AuthService (unit)', () => {
  const configStub = {
    getOrThrow: (k: string) =>
      ({ JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) })[k] as string,
    get: (k: string) => ({ JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '30d' })[k] as string,
  };
  /** Records the grant the auth flow asks for, without touching a database. */
  const freeCreditsStub = () => {
    const calls: Array<{ userId: string; role: string | null | undefined }> = [];
    const service = {
      calls,
      grantFreeCreditsSafely: async (userId: string, role: string | null | undefined) => {
        calls.push({ userId, role });
      },
    } as unknown as FreeCreditsService & { calls: typeof calls };
    return service;
  };
  const makeService = (
    prisma: Record<string, unknown>,
    freeCredits: FreeCreditsService = freeCreditsStub()
  ) => new AuthService(prisma as never, new JwtService({}), configStub as never, freeCredits);

  it('register: hashes password, assigns user role, never leaks the hash', async () => {
    let captured: Record<string, unknown> = {};
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async (args: { data: Record<string, unknown> }) => {
          captured = args.data;
          return { id: 'u-1', tokenVersion: 0, ...args.data, role: { id: 'r-1', name: 'user' } };
        },
      },
      role: { findUnique: async () => ({ id: 'r-1', name: 'user' }) },
    };
    const { user, tokens } = await makeService(prisma).register({
      firstName: 'A',
      lastName: 'B',
      email: 'A@B.co',
      password: 'long-enough-pw',
    });
    expect(user.email).toBe('a@b.co');
    expect(user.role).toBe('user');
    expect('passwordHash' in user).toBe(false);
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(await bcrypt.compare('long-enough-pw', captured.passwordHash as string)).toBe(true);
  });

  it('register: rejects duplicate email', async () => {
    const prisma = {
      user: { findUnique: async () => ({ id: 'u-1' }) },
      role: { findUnique: async () => ({ id: 'r-1', name: 'user' }) },
    };
    await expect(
      makeService(prisma).register({
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.co',
        password: 'long-enough-pw',
      })
    ).rejects.toThrow('already exists');
  });

  it('register: grants free credits to the new normal user', async () => {
    const freeCredits = freeCreditsStub();
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async (args: { data: Record<string, unknown> }) => ({
          id: 'u-1',
          tokenVersion: 0,
          ...args.data,
          role: { id: 'r-1', name: 'user' },
        }),
      },
      role: { findUnique: async () => ({ id: 'r-1', name: 'user' }) },
    };

    await makeService(prisma, freeCredits).register({
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.co',
      password: 'long-enough-pw',
    });

    expect(freeCredits.calls).toEqual([{ userId: 'u-1', role: 'user' }]);
  });

  it('register: still succeeds when the credit ledger is unavailable', async () => {
    // Real FreeCreditsService over a database that is down: registration must
    // not be blocked by a billing problem.
    const brokenPrisma = {
      $transaction: async () => {
        throw new Error('billing unavailable');
      },
    };
    const freeCredits = new FreeCreditsService(
      new CreditsService(brokenPrisma as never),
      undefined
    );
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async (args: { data: Record<string, unknown> }) => ({
          id: 'u-1',
          tokenVersion: 0,
          ...args.data,
          role: { id: 'r-1', name: 'user' },
        }),
      },
      role: { findUnique: async () => ({ id: 'r-1', name: 'user' }) },
    };

    const { user } = await makeService(prisma, freeCredits).register({
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.co',
      password: 'long-enough-pw',
    });

    expect(user.id).toBe('u-1');
  });

  it('login: an existing user is not re-granted at sign-in time', async () => {
    const freeCredits = freeCreditsStub();
    const prisma = {
      user: {
        findUnique: async () => ({
          id: 'u-1',
          email: 'a@b.co',
          passwordHash: await bcrypt.hash('long-enough-pw', 4),
          isActive: true,
          tokenVersion: 0,
          role: { id: 'r-1', name: 'user' },
        }),
      },
    };

    await makeService(prisma, freeCredits).login({
      email: 'a@b.co',
      password: 'long-enough-pw',
    });

    // Password sign-in never grants; only account creation does. The grant key
    // is per user, so a later backfill cannot double it either.
    expect(freeCredits.calls).toEqual([]);
  });

  it('login: rejects unknown email with a generic message', async () => {
    const svc = makeService({ user: { findUnique: async () => null } });
    await expect(svc.login({ email: 'x@y.co', password: 'whatever-pw' })).rejects.toThrow(
      'Invalid credentials'
    );
  });

  it('refresh: rejects bad sessions', async () => {
    const svc = makeService({ user: { findUnique: async () => null } });
    await expect(svc.refresh('not-a-token')).rejects.toThrow('Invalid session');
    await expect(svc.refresh('')).rejects.toThrow('Invalid session');
  });

  it('refresh: rejects tokens with a stale version', async () => {
    const stale = new JwtService({}).sign(
      { sub: 'u-1', email: 'a@b.co', role: 'user', v: 0 },
      { secret: 'b'.repeat(32) }
    );
    const prisma = {
      user: {
        updateMany: async () => ({ count: 0 }),
      },
    };
    await expect(makeService(prisma).refresh(stale)).rejects.toThrow('Invalid session');
  });

  it('refresh: rotates once and rejects reuse of the consumed token', async () => {
    const jwt = new JwtService({});
    const original = jwt.sign(
      { sub: 'u-1', email: 'a@b.co', role: 'user', v: 0 },
      { secret: 'b'.repeat(32), expiresIn: '30d' }
    );
    let tokenVersion = 0;
    const user = {
      id: 'u-1',
      email: 'a@b.co',
      firstName: 'A',
      lastName: 'B',
      isActive: true,
      role: { id: 'r-1', name: 'user' },
    };
    const prisma = {
      user: {
        updateMany: async (args: { where: { tokenVersion: number } }) => {
          if (args.where.tokenVersion !== tokenVersion) return { count: 0 };
          tokenVersion += 1;
          return { count: 1 };
        },
        findUnique: async () => ({ ...user, tokenVersion }),
      },
    };
    const service = makeService(prisma);
    const rotated = await service.refresh(original);
    const payload = await jwt.verifyAsync<{ v: number }>(rotated.tokens.refreshToken, {
      secret: 'b'.repeat(32),
    });
    expect(payload.v).toBe(1);
    await expect(service.refresh(original)).rejects.toThrow('Invalid session');
  });

  it('refresh: rejects an expired token before accessing the database', async () => {
    const expired = new JwtService({}).sign(
      { sub: 'u-1', email: 'a@b.co', role: 'user', v: 0 },
      { secret: 'b'.repeat(32), expiresIn: -1 }
    );
    const service = makeService({ user: {} });
    await expect(service.refresh(expired)).rejects.toThrow('Invalid session');
  });

  it('logout: bumps the token version', async () => {
    let bumped: unknown = null;
    const prisma = {
      user: {
        update: async (args: unknown) => {
          bumped = args;
          return {};
        },
      },
    };
    await makeService(prisma).logout('u-1');
    expect(bumped).toMatchObject({ where: { id: 'u-1' } });
  });

  it('reset: rejects an invalid token before changing the password', async () => {
    const service = makeService({
      passwordResetToken: { findFirst: async () => null },
      $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback({
        passwordResetToken: { findFirst: async () => null },
      }),
    });
    await expect(service.resetPassword({ token: 'a'.repeat(32), password: 'new-long-password' })).rejects.toThrow('Invalid or expired');
  });

  it('google: returns a safe configuration error when credentials are absent', () => {
    expect(() => makeService({}).googleAuthorizationUrl('state')).toThrow('Google sign-in is not configured');
  });
});
