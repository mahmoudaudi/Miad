import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminCommunityService } from './admin-community.service';

/** AdminCommunityService unit tests — Prisma is stubbed. No DB needed. */
describe('AdminCommunityService (unit)', () => {
  const createdAt = new Date('2026-09-20T10:00:00Z');

  function makePrisma() {
    return {
      $queryRaw: async () => [
        { published: 2n, hidden: 2n, totalViews: 122n, totalLikes: 14n, newThisWeek: 2n },
      ],
      communityDesign: {
        findMany: async () => [
          {
            id: 'c-1',
            title: 'Neon Gala',
            slug: 'neon-gala',
            category: 'Wedding',
            isPublished: true,
            views: 120,
            likes: 14,
            saves: 3,
            createdAt,
            updatedAt: createdAt,
            creator: { firstName: 'Ahmad', lastName: 'K', email: 'ahmad@k.me' },
            invitation: { slug: 'neon-gala-inv' },
          },
          {
            id: 'c-2',
            title: 'Hidden Draft',
            slug: 'hidden-draft',
            category: 'Birthday',
            isPublished: false,
            views: 2,
            likes: 0,
            saves: 0,
            createdAt,
            updatedAt: createdAt,
            creator: { firstName: 'Sara', lastName: 'H', email: 'sara@h.io' },
            invitation: { slug: 'hidden-draft-inv' },
          },
        ],
        count: async () => 2,
        aggregate: async () => ({ _sum: { views: 122, likes: 14 } }),
        groupBy: async () => [{ category: 'Wedding' }, { category: 'Birthday' }],
        update: async (args: { where: { id: string }; data: { isPublished: boolean } }) => ({
          id: args.where.id,
          isPublished: args.data.isPublished,
        }),
        delete: async (args: { where: { id: string } }) => ({ id: args.where.id }),
      },
    };
  }

  it('lists designs with real counters and KPIs', async () => {
    const service = new AdminCommunityService(makePrisma() as never);
    const res = await service.listDesigns({});

    expect(res.kpis).toMatchObject({
      published: 2,
      hidden: 2,
      totalViews: 122,
      totalLikes: 14,
      newThisWeek: 2,
    });
    expect(res.categories).toEqual(['Birthday', 'Wedding']);
    expect(res.table.items.find((i) => i.id === 'c-1')).toMatchObject({
      title: 'Neon Gala',
      views: 120,
      likes: 14,
      saves: 3,
      creator: { email: 'ahmad@k.me' },
      invitationSlug: 'neon-gala-inv',
    });
    // Nothing invented: no reports, flags, bans, or featured markers.
    expect(JSON.stringify(res)).not.toMatch(/report|flag|ban|featured|severity|resolved/i);
  });

  it('toggles publication as the takedown equivalent', async () => {
    const service = new AdminCommunityService(makePrisma() as never);
    await expect(service.setPublication('c-1', false)).resolves.toEqual({
      id: 'c-1',
      isPublished: false,
    });
  });

  it('reports missing designs on mutation', async () => {
    const prisma = makePrisma();
    const err = new Prisma.PrismaClientKnownRequestError('missing', {
      code: 'P2025',
      clientVersion: 'test',
    });
    prisma.communityDesign.update = async () => {
      throw err;
    };
    prisma.communityDesign.delete = async () => {
      throw err;
    };
    const service = new AdminCommunityService(prisma as never);
    await expect(service.setPublication('nope', true)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
