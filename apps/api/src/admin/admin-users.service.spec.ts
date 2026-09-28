import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';

/** AdminUsersService unit tests — Prisma is stubbed. No DB needed. */
describe('AdminUsersService (unit)', () => {
  const createdAt = new Date('2026-09-20T10:00:00Z');

  function makePrisma(over: { existingUser?: unknown; roleRow?: unknown } = {}) {
    const roleRow = 'roleRow' in over ? over.roleRow : { id: 'r-1', name: 'user' };
    const queryRaw = async () => [
      { total: 2n, newThisWeek: 2n, prevWeek: 0n, suspended: 2n },
    ];
    const rows = [
      {
        id: 'u-1',
        firstName: 'Karim',
        lastName: 'Mansour',
        email: 'karim@domain.io',
        isActive: true,
        createdAt,
        role: { name: 'admin' },
      },
      {
        id: 'u-2',
        firstName: 'Omar',
        lastName: 'Farooq',
        email: 'omar.f@tech.co',
        isActive: false,
        createdAt,
        role: { name: 'user' },
      },
    ];
    return {
      $queryRaw: queryRaw,
      user: {
        // Mirrors the real query contract for the filters under test.
        findMany: async (args?: { where?: { isActive?: boolean } }) =>
          typeof args?.where?.isActive === 'boolean'
            ? rows.filter((r) => r.isActive === args.where?.isActive)
            : rows,
        count: async () => 2,
        findUnique: async () => over.existingUser ?? null,
        create: async (args: { data: Record<string, unknown> }) => ({
          id: 'u-3',
          ...args.data,
          role: { id: 'r-1', name: 'user' },
        }),
        update: async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: args.where.id,
          firstName: 'A',
          lastName: 'B',
          email: 'a@b.co',
          ...args.data,
          role: { id: 'r-1', name: 'user' },
        }),
        delete: async (args: { where: { id: string } }) => ({ id: args.where.id }),
      },
      event: {
        groupBy: async () => [{ userId: 'u-1', _count: { _all: 3 } }],
        findMany: async () => [{ userId: 'u-1' }],
      },
      aiUsage: {
        groupBy: async () => [{ userId: 'u-1', _count: { _all: 5 } }],
        findMany: async () => [{ userId: 'u-1' }],
      },
      subscription: {
        findMany: async () => [{ userId: 'u-1', plan: { name: 'Studio Pro' } }],
        count: async () => 1,
      },
      payment: { groupBy: async () => [] },
      role: { findUnique: async () => roleRow },
    };
  }

  it('lists users with real counts, plans, and KPIs', async () => {
    const service = new AdminUsersService(makePrisma() as never);
    const res = await service.listUsers({});

    expect(res.kpis.total).toBe(2);
    expect(res.kpis.suspended).toBe(2);
    expect(res.table.total).toBe(2);
    const karim = res.table.items.find((i) => i.id === 'u-1');
    expect(karim).toMatchObject({
      invitationsCount: 3,
      aiRuns: 5,
      plan: 'Studio Pro',
      role: 'admin',
    });
    const omar = res.table.items.find((i) => i.id === 'u-2');
    expect(omar).toMatchObject({ invitationsCount: 0, aiRuns: 0, plan: 'Free' });
    expect(res.distribution).toContainEqual({ plan: 'Free', count: 1 });
    expect(res.topAi).toEqual([
      { id: 'u-1', name: 'Karim Mansour', email: 'karim@domain.io', runs: 5 },
    ]);
  });

  it('filters by plan and status', async () => {
    const service = new AdminUsersService(makePrisma() as never);
    const free = await service.listUsers({ plan: 'Free' });
    expect(free.table.items.map((i) => i.id)).toEqual(['u-2']);
    const suspended = await service.listUsers({ status: 'suspended' });
    expect(suspended.table.items.map((i) => i.id)).toEqual(['u-2']);
  });

  it('creates a user with a hashed password and real role', async () => {
    const service = new AdminUsersService(makePrisma() as never);
    const created = await service.createUser({
      firstName: 'Sara',
      lastName: 'H',
      email: 'Sara@X.io',
      password: 'long-enough-pw',
      role: 'user',
    });
    expect(created.email).toBeDefined();
    expect(created.role).toBe('user');
  });

  it('rejects duplicate email on create', async () => {
    const service = new AdminUsersService(makePrisma({ existingUser: { id: 'u-1' } }) as never);
    await expect(
      service.createUser({
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.co',
        password: 'long-enough-pw',
        role: 'user',
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects unknown roles on create', async () => {
    const service = new AdminUsersService(makePrisma({ roleRow: null }) as never);
    await expect(
      service.createUser({
        firstName: 'A',
        lastName: 'B',
        email: 'new@b.co',
        password: 'long-enough-pw',
        role: 'superadmin',
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('protects the admin from self-suspend, self-demote, and self-delete', async () => {
    const service = new AdminUsersService(makePrisma() as never);
    await expect(service.setStatus('u-1', 'u-1', false)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.setRole('u-1', 'u-1', 'user')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.removeUser('u-1', 'u-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
