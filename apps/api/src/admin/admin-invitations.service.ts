import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { InvitationsService } from '../invitations/invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminInvitationItem,
  AdminInvitationsResponse,
  AdminTopViewedItem,
} from './admin-invitations.types';
import { AdminInvitationsQueryDto } from './dto/admin-invitations-query.dto';

const ACTIVE_SUBSCRIPTION_STATUSES = ['ACTIVE', 'TRIALING'];
const FREE_PLAN = 'Free';

function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim() || 'Unknown user';
}

type InvitationCountsRow = {
  total: bigint;
  published: bigint;
  newThisWeek: bigint;
  prevWeek: bigint;
  totalViews: bigint;
  totalRsvps: bigint;
};

@Injectable()
export class AdminInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitations: InvitationsService,
    private readonly analytics: AnalyticsService
  ) {}

  private buildInvitationWhere(
    query: AdminInvitationsQueryDto,
    weekAgo: Date,
    monthAgo: Date
  ): Prisma.InvitationWhereInput {
    const where: Prisma.InvitationWhereInput = {};
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { event: { title: { contains: q, mode: 'insensitive' } } },
        { slug: { contains: q, mode: 'insensitive' } },
        { event: { user: { firstName: { contains: q, mode: 'insensitive' } } } },
        { event: { user: { lastName: { contains: q, mode: 'insensitive' } } } },
        { event: { user: { email: { contains: q, mode: 'insensitive' } } } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.eventType)
      where.event = { ...((where.event as object) ?? {}), eventType: query.eventType };
    if (query.created === '7d') where.createdAt = { gte: weekAgo };
    if (query.created === '30d') where.createdAt = { gte: monthAgo };
    return where;
  }

  /** Platform-wide invitation counters in a single roundtrip (BigInt narrowed here). */
  private async getInvitationCounts(
    weekAgo: Date,
    fortnightAgo: Date
  ): Promise<InvitationCountsRow> {
    const rows = await this.prisma.$queryRaw<InvitationCountsRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "invitations") AS "total",
        (SELECT COUNT(*) FROM "invitations" WHERE "status" = 'PUBLISHED') AS "published",
        (SELECT COUNT(*) FROM "invitations" WHERE "created_at" >= ${weekAgo}) AS "newThisWeek",
        (SELECT COUNT(*) FROM "invitations" WHERE "created_at" >= ${fortnightAgo} AND "created_at" < ${weekAgo}) AS "prevWeek",
        (SELECT COUNT(*) FROM "invitation_views") AS "totalViews",
        (SELECT COUNT(*) FROM "rsvps") AS "totalRsvps"
    `;
    return (
      rows[0] ?? {
        total: 0n,
        published: 0n,
        newThisWeek: 0n,
        prevWeek: 0n,
        totalViews: 0n,
        totalRsvps: 0n,
      }
    );
  }

  /** KPIs, event types, and sparklines (fetched once per filter set). */
  async getInvitationsSummary(): Promise<Omit<AdminInvitationsResponse, 'table'>> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fortnightAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [counts, monthCreations, eventTypes] = await Promise.all([
      this.getInvitationCounts(weekAgo, fortnightAgo),
      this.prisma.invitation.findMany({
        where: { createdAt: { gte: monthAgo } },
        select: { status: true, createdAt: true },
      }),
      this.prisma.event.groupBy({ by: ['eventType'] }),
    ]);

    const total = Number(counts.total);
    const published = Number(counts.published);
    const newThisWeek = Number(counts.newThisWeek);
    const prevWeek = Number(counts.prevWeek);

    const creations30d = Array.from({ length: 30 }, () => 0);
    const published30d = Array.from({ length: 30 }, () => 0);
    for (const row of monthCreations) {
      const day = Math.floor((now.getTime() - row.createdAt.getTime()) / (24 * 60 * 60 * 1000));
      if (day >= 0 && day < 30) {
        const bucket = creations30d[29 - day];
        if (bucket !== undefined) creations30d[29 - day] = bucket + 1;
        if (row.status === 'PUBLISHED') {
          const publishedBucket = published30d[29 - day];
          if (publishedBucket !== undefined) published30d[29 - day] = publishedBucket + 1;
        }
      }
    }

    return {
      kpis: {
        total,
        published,
        draft: total - published,
        publishedRate: total > 0 ? Math.round((published / total) * 1000) / 10 : 0,
        newThisWeek,
        growthRate:
          prevWeek > 0
            ? Math.round(((newThisWeek - prevWeek) / prevWeek) * 1000) / 10
            : newThisWeek > 0
              ? 100
              : 0,
        totalViews: Number(counts.totalViews),
        totalRsvps: Number(counts.totalRsvps),
        creations30d,
        published30d,
      },
      eventTypes: eventTypes.map((e) => e.eventType).sort(),
    };
  }

  /** Paginated directory table with scans scoped to the filtered ids. */
  async getInvitationsTable(
    query: AdminInvitationsQueryDto
  ): Promise<AdminInvitationsResponse['table']> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 6;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const where = this.buildInvitationWhere(query, weekAgo, monthAgo);

    const invitations = await this.prisma.invitation.findMany({
      where,
      select: {
        id: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        event: {
          select: {
            title: true,
            eventType: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
    const ids = invitations.map((i) => i.id);
    const ownerEmails = [...new Set(invitations.map((i) => i.event.user.email))];

    type CountGroup = { invitationId: string; _count: { _all: number } };
    const [viewGroups, rsvpGroups, owners] =
      ids.length === 0
        ? [[], [], []]
        : await Promise.all([
            this.prisma.invitationView.groupBy({
              by: ['invitationId'],
              where: { invitationId: { in: ids } },
              _count: { _all: true },
            }),
            this.prisma.guest.groupBy({
              by: ['invitationId'],
              where: { invitationId: { in: ids }, rsvp: { isNot: null } },
              _count: { _all: true },
            }),
            this.prisma.user.findMany({
              where: { email: { in: ownerEmails } },
              select: { id: true, email: true },
            }),
          ]);
    const viewsById = new Map(
      (viewGroups as CountGroup[]).map((g) => [g.invitationId, g._count._all])
    );
    const rsvpsById = new Map(
      (rsvpGroups as CountGroup[]).map((g) => [g.invitationId, g._count._all])
    );

    const ownerIds = (owners as Array<{ id: string; email: string }>).map((o) => o.id);
    const subs =
      ownerIds.length === 0
        ? []
        : await this.prisma.subscription.findMany({
            where: { userId: { in: ownerIds }, status: { in: ACTIVE_SUBSCRIPTION_STATUSES } },
            orderBy: { createdAt: 'desc' },
            select: { userId: true, plan: { select: { name: true } } },
          });
    const planByUserId = new Map<string, string>();
    for (const sub of subs) {
      if (!planByUserId.has(sub.userId)) planByUserId.set(sub.userId, sub.plan.name);
    }
    const userIdByEmail = new Map(
      (owners as Array<{ id: string; email: string }>).map((o) => [o.email, o.id])
    );
    const planByEmail = new Map<string, string>();
    for (const [email, id] of userIdByEmail) {
      planByEmail.set(email, planByUserId.get(id) ?? FREE_PLAN);
    }

    const items: AdminInvitationItem[] = invitations.map((inv) => ({
      id: inv.id,
      title: inv.event.title,
      slug: inv.slug,
      eventType: inv.event.eventType,
      status: inv.status as 'PUBLISHED' | 'DRAFT',
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
      owner: {
        name: fullName(inv.event.user.firstName, inv.event.user.lastName),
        email: inv.event.user.email,
        plan: planByEmail.get(inv.event.user.email) ?? FREE_PLAN,
      },
      views: viewsById.get(inv.id) ?? 0,
      rsvps: rsvpsById.get(inv.id) ?? 0,
    }));

    const sort = query.sort ?? 'newest';
    items.sort((a, b) => {
      if (sort === 'mostViewed') return b.views - a.views;
      if (sort === 'mostRsvps') return b.rsvps - a.rsvps;
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

  async listInvitations(query: AdminInvitationsQueryDto): Promise<AdminInvitationsResponse> {
    const [summary, table] = await Promise.all([
      this.getInvitationsSummary(),
      this.getInvitationsTable(query),
    ]);
    return { ...summary, table };
  }

  async topViewed(limit = 10): Promise<AdminTopViewedItem[]> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    type CountGroup = { invitationId: string; _count: { _all: number } };
    const [totals, recent] = await Promise.all([
      this.prisma.invitationView
        .groupBy({
          by: ['invitationId'],
          _count: { _all: true },
          orderBy: { _count: { invitationId: 'desc' } },
          take: limit,
        })
        .then((rows) => rows as CountGroup[]),
      this.prisma.invitationView
        .groupBy({
          by: ['invitationId'],
          where: { viewedAt: { gte: dayAgo } },
          _count: { _all: true },
        })
        .then((rows) => rows as CountGroup[]),
    ]);
    if (totals.length === 0) return [];
    const recentById = new Map(recent.map((g) => [g.invitationId, g._count._all]));
    const invitations = await this.prisma.invitation.findMany({
      where: { id: { in: totals.map((t) => t.invitationId) }, status: 'PUBLISHED' },
      select: {
        id: true,
        slug: true,
        event: { select: { title: true } },
        guests: { select: { rsvp: { select: { id: true } } } },
      },
    });
    const byId = new Map(invitations.map((i) => [i.id, i]));
    return totals.flatMap((t) => {
      const inv = byId.get(t.invitationId);
      if (!inv) return [];
      return [
        {
          id: inv.id,
          title: inv.event.title,
          slug: inv.slug,
          views: t._count._all,
          views24h: recentById.get(t.invitationId) ?? 0,
          rsvps: inv.guests.filter((g) => g.rsvp).length,
        },
      ];
    });
  }

  async analyticsFor(id: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
      select: { id: true, event: { select: { userId: true } } },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');
    return this.analytics.findForOwner(invitation.event.userId, invitation.id);
  }

  async setStatus(id: string, status: 'PUBLISHED' | 'DRAFT') {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        designs: { select: { version: true }, take: 1, orderBy: { version: 'desc' } },
      },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');
    if (status === 'PUBLISHED' && invitation.designs.length === 0) {
      throw new BadRequestException('Save an invitation design before publishing.');
    }
    const updated = await this.prisma.invitation.update({
      where: { id },
      data:
        status === 'PUBLISHED'
          ? {
              status,
              publishedAt: new Date(),
              publishedDesignVersion: invitation.designs[0]?.version ?? null,
            }
          : { status, publishedAt: null, publishedDesignVersion: null },
      select: { id: true, status: true },
    });
    return updated;
  }

  async bulkStatus(ids: string[], status: 'PUBLISHED' | 'DRAFT') {
    const unique = [...new Set(ids)];
    let updated = 0;
    for (const id of unique) {
      try {
        await this.setStatus(id, status);
        updated += 1;
      } catch (error) {
        // Publish guards (e.g. designless drafts) skip the row instead of
        // failing the whole batch; missing rows are ignored the same way.
        if (error instanceof NotFoundException || error instanceof BadRequestException) continue;
        throw error;
      }
    }
    return { updated, total: unique.length };
  }

  async remove(id: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
      select: { id: true, images: { select: { userId: true, fileUrl: true } } },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');
    try {
      await this.invitations.deleteInvitationSubtree(invitation.id, invitation.images);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('This invitation cannot be deleted while it has related data.');
      }
      throw error;
    }
    return { id, deleted: true };
  }
}
