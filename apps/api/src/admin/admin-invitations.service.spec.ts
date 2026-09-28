import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminInvitationsService } from './admin-invitations.service';

/** AdminInvitationsService unit tests — Prisma + collaborators are stubbed. No DB needed. */
describe('AdminInvitationsService (unit)', () => {
  const createdAt = new Date('2026-09-20T10:00:00Z');

  function makeDeps(over: { invitationRow?: unknown } = {}) {
    const invitationRow =
      'invitationRow' in over
        ? over.invitationRow
        : { id: 'i-1', status: 'DRAFT', designs: [{ version: 2 }] };
    const prisma = {
      $queryRaw: async () => [
        {
          total: 1n,
          published: 1n,
          newThisWeek: 1n,
          prevWeek: 0n,
          totalViews: 10n,
          totalRsvps: 4n,
        },
      ],
      invitation: {
        findMany: async () => [
          {
            id: 'i-1',
            slug: 'gala',
            status: 'PUBLISHED',
            createdAt,
            updatedAt: createdAt,
            event: {
              title: 'Gala',
              eventType: 'Wedding',
              user: { firstName: 'Ahmad', lastName: 'Khalil', email: 'ahmad@k.me' },
            },
          },
        ],
        count: async () => 1,
        findUnique: async () => invitationRow,
        update: async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: args.where.id,
          status: args.data.status,
        }),
      },
      invitationView: {
        groupBy: async () => [{ invitationId: 'i-1', _count: { _all: 10 } }],
        count: async () => 10,
      },
      guest: {
        groupBy: async () => [{ invitationId: 'i-1', _count: { _all: 4 } }],
      },
      rsvp: { count: async () => 4 },
      subscription: { findMany: async () => [] },
      user: {
        findMany: async () => [{ id: 'u-1', email: 'ahmad@k.me' }],
      },
      event: { groupBy: async () => [{ eventType: 'Wedding' }] },
    };
    const invitations = {
      deleteInvitationSubtree: async () => undefined,
    };
    const analytics = {
      findForOwner: async () => ({ views: 10, rsvps: 4 }),
    };
    return { prisma, invitations, analytics };
  }

  const makeService = (deps: ReturnType<typeof makeDeps>) =>
    new AdminInvitationsService(deps.prisma as never, deps.invitations as never, deps.analytics as never);

  it('lists invitations with real views, rsvps, and owner plans', async () => {
    const service = makeService(makeDeps());
    const res = await service.listInvitations({});

    expect(res.kpis.total).toBe(1);
    expect(res.kpis.published).toBe(1);
    expect(res.kpis.totalViews).toBe(10);
    expect(res.kpis.totalRsvps).toBe(4);
    expect(res.eventTypes).toEqual(['Wedding']);
    expect(res.table.items[0]).toMatchObject({
      title: 'Gala',
      slug: 'gala',
      status: 'PUBLISHED',
      views: 10,
      rsvps: 4,
      owner: { email: 'ahmad@k.me', plan: 'Free' },
    });
    expect(res.kpis.creations30d).toHaveLength(30);
  });

  it('publishes only when a design exists', async () => {
    const service = makeService(
      makeDeps({ invitationRow: { id: 'i-1', status: 'DRAFT', designs: [] } })
    );
    await expect(service.setStatus('i-1', 'PUBLISHED')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('unpublishes freely and reports missing rows', async () => {
    const service = makeService(makeDeps());
    await expect(service.setStatus('i-1', 'DRAFT')).resolves.toMatchObject({
      id: 'i-1',
      status: 'DRAFT',
    });
    await expect(
      makeService(makeDeps({ invitationRow: null })).setStatus('missing', 'DRAFT')
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('bulk status skips invalid rows and reports counts', async () => {
    const deps = makeDeps();
    let calls = 0;
    const rows = [{ id: 'a', status: 'DRAFT', designs: [{ version: 1 }] }, null];
    // Sequential per-id lookups: first row publishes, second is missing.
    deps.prisma.invitation.findUnique = (async () => rows[calls++] ?? null) as typeof deps.prisma.invitation.findUnique;
    const service = makeService(deps);
    await expect(service.bulkStatus(['a', 'missing'], 'PUBLISHED')).resolves.toEqual({
      updated: 1,
      total: 2,
    });
  });
});
