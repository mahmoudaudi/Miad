import { AdminService } from './admin.service';

/** AdminService unit tests — Prisma is stubbed. No DB needed. */
describe('AdminService (unit)', () => {
  const createdAt = new Date('2026-09-27T16:00:00Z');

  const fullCounts = [
    {
      userTotal: 10n,
      userActive: 10n,
      userNew: 10n,
      invitationTotal: 4n,
      invitationPublished: 4n,
      rsvpTotal: 20n,
      attendingSum: 14n,
    },
  ];
  const emptyCounts = [
    {
      userTotal: 0n,
      userActive: 0n,
      userNew: 0n,
      invitationTotal: 0n,
      invitationPublished: 0n,
      rsvpTotal: 0n,
      attendingSum: 0n,
    },
  ];

  function makePrisma(
    overrides: Record<string, Record<string, () => Promise<unknown>>> = {},
    counts: typeof fullCounts = fullCounts
  ) {
    const base = {
      $queryRaw: async () => counts,
      user: {
        count: async () => 10,
        findMany: async () => [
          {
            id: 'u-1',
            firstName: 'Karim',
            lastName: 'Mansour',
            email: 'karim@domain.io',
            createdAt,
          },
        ],
      },
      invitation: {
        count: async () => 4,
        findMany: async () => [
          {
            id: 'i-1',
            status: 'PUBLISHED',
            updatedAt: createdAt,
            event: { title: 'Gala' },
          },
        ],
      },
      rsvp: {
        count: async () => 20,
        aggregate: async () => ({ _sum: { attendeesCount: 14 } }),
      },
      aiUsage: {
        groupBy: async () => [
          { operationType: 'GENERATE_DESIGN', status: 'SUCCEEDED', _count: { _all: 6 } },
          { operationType: 'EDIT_DESIGN', status: 'SUCCEEDED', _count: { _all: 3 } },
          { operationType: 'GENERATE_DESIGN', status: 'FAILED', _count: { _all: 1 } },
        ],
        count: async () => 10,
        findMany: async () => [],
      },
      payment: { groupBy: async () => [] },
      subscription: { count: async () => 2 },
    };
    for (const [model, methods] of Object.entries(overrides)) {
      Object.assign(base[model as keyof typeof base], methods);
    }
    return base;
  }

  it('aggregates real counts with no mock figures', async () => {
    const prisma = makePrisma({
      aiUsage: {
        findMany: async () => [
          {
            id: 'a-1',
            operationType: 'GENERATE_DESIGN',
            status: 'SUCCEEDED',
            tokensUsed: 1200,
            createdAt,
            user: { firstName: 'Ahmad', lastName: 'Khalil', email: 'ahmad.k@gmail.com' },
            invitation: { slug: 'wedding-gala', event: { title: 'Wedding Gala' } },
          },
        ],
      },
    });
    const service = new AdminService(prisma as never);
    const overview = await service.getOverview({ page: 1, limit: 6 });

    expect(overview.users).toEqual({ total: 10, active: 10, activeRate: 100, newLast24h: 10 });
    expect(overview.invitations).toEqual({ total: 4, published: 4, draft: 0 });
    expect(overview.rsvps).toEqual({ total: 20, attending: 14, attendingRate: 70 });
    expect(overview.ai).toEqual({
      generations: 7,
      refinements: 3,
      successful: 9,
      failed: 1,
      successRate: 90,
    });
    expect(overview.revenue).toEqual({ total: 0, currency: 'USD', activeSubscriptions: 2 });
    expect(overview.activity.map((a) => a.kind)).toContain('user_registered');
    expect(overview.activity.map((a) => a.kind)).toContain('invitation_published');
    expect(overview.generations.items[0]).toMatchObject({
      userEmail: 'ahmad.k@gmail.com',
      invitationName: 'Wedding Gala',
      invitationSlug: 'wedding-gala',
      tokensUsed: 1200,
    });
    expect(overview.generations.total).toBe(10);
    expect(overview.series).toHaveLength(24);
  });

  it('sums settled payments in their own currency', async () => {
    const prisma = makePrisma({
      payment: {
        groupBy: async () => [
          { currency: 'USD', _sum: { amount: { toNumber: () => 120.5 } } },
          { currency: 'USD', _sum: { amount: { toNumber: () => 30 } } },
        ],
      },
    });
    const service = new AdminService(prisma as never);
    const overview = await service.getOverview({});
    expect(overview.revenue).toEqual({ total: 150.5, currency: 'USD', activeSubscriptions: 2 });
  });

  it('reports zeros on an empty platform', async () => {
    const zero = async () => 0;
    const prisma = makePrisma(
      {
        user: { count: zero, findMany: async () => [] },
        invitation: { count: zero, findMany: async () => [] },
        rsvp: { count: zero, aggregate: async () => ({ _sum: { attendeesCount: null } }) },
        aiUsage: { groupBy: async () => [], count: zero, findMany: async () => [] },
        subscription: { count: zero },
      },
      emptyCounts
    );
    const service = new AdminService(prisma as never);
    const overview = await service.getOverview({});
    expect(overview.users.activeRate).toBe(0);
    expect(overview.ai.successRate).toBe(0);
    expect(overview.activity).toEqual([]);
    expect(overview.generations.totalPages).toBe(1);
  });
});
