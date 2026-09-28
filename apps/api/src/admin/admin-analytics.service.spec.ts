import { BadRequestException } from '@nestjs/common';
import { AdminAnalyticsService } from './admin-analytics.service';

/** AdminAnalyticsService unit tests — Prisma is stubbed. No DB needed. */
describe('AdminAnalyticsService (unit)', () => {
  const createdAt = new Date('2026-09-20T10:00:00Z');

  function makePrisma() {
    return {
      user: {
        count: async () => 9,
      },
      event: {
        findMany: async () => [{ userId: 'u-1' }, { userId: 'u-2' }],
      },
      aiUsage: {
        findMany: async () => [{ userId: 'u-1' }],
        groupBy: async () => [
          { operationType: 'GENERATE_DESIGN', status: 'SUCCEEDED', _count: { _all: 6 } },
          { operationType: 'GENERATE_DESIGN', status: 'FAILED', _count: { _all: 2 } },
        ],
      },
      invitation: {
        findMany: async (args?: { where?: { createdAt?: unknown } }) => {
          // Range creation rows for the summary; top-lookup rows otherwise.
          if (args?.where && 'createdAt' in (args.where as object)) {
            return [
              { status: 'PUBLISHED', createdAt },
              { status: 'DRAFT', createdAt },
            ];
          }
          return [
            {
              id: 'i-1',
              slug: 'gala',
              event: { title: 'Gala' },
              guests: [{ rsvp: { id: 'r-1' } }, { rsvp: null }],
            },
          ];
        },
      },
      invitationView: {
        findMany: async () => [
          { invitationId: 'i-1', deviceType: 'mobile', viewedAt: createdAt },
          { invitationId: 'i-1', deviceType: 'desktop', viewedAt: createdAt },
        ],
        groupBy: async (args?: { by?: string[] }) => {
          if (args?.by?.includes('deviceType')) {
            return [
              { deviceType: 'mobile', _count: { _all: 1 } },
              { deviceType: 'desktop', _count: { _all: 1 } },
            ];
          }
          return [{ invitationId: 'i-1', _count: { _all: 2 } }];
        },
      },
      rsvp: {
        findMany: async () => [
          { status: 'ATTENDING', attendeesCount: 3 },
          { status: 'PENDING', attendeesCount: 1 },
        ],
      },
    };
  }

  it('aggregates range analytics from stored rows only', async () => {
    const service = new AdminAnalyticsService(makePrisma() as never);
    const res = await service.getAnalytics({ range: '30d' });

    expect(res.kpis.newUsers).toBe(9);
    expect(res.kpis.activeCreators).toBe(2);
    expect(res.kpis.published).toBe(1);
    expect(res.kpis.publishedRate).toBe(50);
    expect(res.kpis.rsvpResponses).toBe(2);
    expect(res.funnel).toMatchObject({ created: 2, published: 1, opened: 2 });
    expect(res.rsvp).toMatchObject({ attending: 1, pending: 1, attendingGuests: 3 });
    expect(res.ai).toMatchObject({ generations: 8, successful: 6, failed: 2 });
    expect(res.devices).toContainEqual({ device: 'mobile', views: 1 });
    expect(res.top[0]).toMatchObject({ slug: 'gala', views: 2, rsvps: 1 });
    expect(res.daily).toHaveLength(30);
    expect(res.range.label).toBe('Last 30 Days');
    // Nothing invented: no DAU/WAU, shares, browsers, or latencies.
    expect(JSON.stringify(res)).not.toMatch(/dau|wau|share|browser|latency|coefficient/i);
  });

  it('rejects invalid custom ranges', async () => {
    const service = new AdminAnalyticsService(makePrisma() as never);
    await expect(
      service.getAnalytics({ from: new Date('2026-09-20'), to: new Date('2026-09-10') })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
