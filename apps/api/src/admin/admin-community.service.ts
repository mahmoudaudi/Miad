import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCommunityItem, AdminCommunityResponse } from './admin-community.types';
import { AdminCommunityQueryDto } from './dto/admin-community-query.dto';

function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim() || 'Unknown user';
}

@Injectable()
export class AdminCommunityService {
  constructor(private readonly prisma: PrismaService) {}

  private buildDesignWhere(query: AdminCommunityQueryDto): Prisma.CommunityDesignWhereInput {
    const where: Prisma.CommunityDesignWhereInput = {};
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { creator: { firstName: { contains: q, mode: 'insensitive' } } },
        { creator: { lastName: { contains: q, mode: 'insensitive' } } },
        { creator: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }
    if (query.category) where.category = query.category;
    if (query.status === 'published') where.isPublished = true;
    if (query.status === 'hidden') where.isPublished = false;
    return where;
  }

  /** Showcase counters in a single roundtrip (BigInt narrowed here). */
  async getCommunitySummary(): Promise<Omit<AdminCommunityResponse, 'table'>> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    type CountsRow = {
      published: bigint;
      hidden: bigint;
      totalViews: bigint | null;
      totalLikes: bigint | null;
      newThisWeek: bigint;
    };
    const [countRows, categories] = await Promise.all([
      this.prisma.$queryRaw<CountsRow[]>`
        SELECT
          (SELECT COUNT(*) FROM "community_designs" WHERE "is_published") AS "published",
          (SELECT COUNT(*) FROM "community_designs" WHERE NOT "is_published") AS "hidden",
          (SELECT COALESCE(SUM("views"), 0) FROM "community_designs") AS "totalViews",
          (SELECT COALESCE(SUM("likes"), 0) FROM "community_designs") AS "totalLikes",
          (SELECT COUNT(*) FROM "community_designs" WHERE "created_at" >= ${weekAgo}) AS "newThisWeek"
      `,
      this.prisma.communityDesign.groupBy({ by: ['category'] }),
    ]);
    const counts = countRows[0] ?? {
      published: 0n,
      hidden: 0n,
      totalViews: 0n,
      totalLikes: 0n,
      newThisWeek: 0n,
    };
    return {
      kpis: {
        published: Number(counts.published),
        hidden: Number(counts.hidden),
        totalViews: Number(counts.totalViews ?? 0n),
        totalLikes: Number(counts.totalLikes ?? 0n),
        newThisWeek: Number(counts.newThisWeek),
      },
      categories: categories.map((c) => c.category).sort(),
    };
  }

  /** Paginated showcase table (fetched alone on page/filter turns). */
  async getCommunityTable(
    query: AdminCommunityQueryDto
  ): Promise<AdminCommunityResponse['table']> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 6;
    const designs = await this.prisma.communityDesign.findMany({
      where: this.buildDesignWhere(query),
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        isPublished: true,
        views: true,
        likes: true,
        saves: true,
        createdAt: true,
        updatedAt: true,
        creator: { select: { firstName: true, lastName: true, email: true } },
        invitation: { select: { slug: true } },
      },
    });

    const sort = query.sort ?? 'newest';
    const items: AdminCommunityItem[] = designs
      .map((d) => ({
        id: d.id,
        title: d.title,
        slug: d.slug,
        category: d.category,
        isPublished: d.isPublished,
        views: d.views,
        likes: d.likes,
        saves: d.saves,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        creator: {
          name: fullName(d.creator.firstName, d.creator.lastName),
          email: d.creator.email,
        },
        invitationSlug: d.invitation.slug,
      }))
      .sort((a, b) => {
        if (sort === 'mostViewed') return b.views - a.views;
        if (sort === 'mostLiked') return b.likes - a.likes;
        return a.createdAt < b.createdAt ? 1 : -1;
      });

    const totalFiltered = items.length;
    return {
      items: items.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: totalFiltered,
      totalPages: Math.max(1, Math.ceil(totalFiltered / limit)),
    };
  }

  async listDesigns(query: AdminCommunityQueryDto): Promise<AdminCommunityResponse> {
    const [summary, table] = await Promise.all([
      this.getCommunitySummary(),
      this.getCommunityTable(query),
    ]);
    return { ...summary, table };
  }

  async setPublication(id: string, isPublished: boolean) {
    try {
      const design = await this.prisma.communityDesign.update({
        where: { id },
        data: { isPublished },
        select: { id: true, isPublished: true },
      });
      return design;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Community design not found.');
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.communityDesign.delete({ where: { id } });
      return { id, deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Community design not found.');
      }
      throw error;
    }
  }
}
