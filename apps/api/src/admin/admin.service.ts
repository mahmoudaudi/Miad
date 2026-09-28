import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SETTLED_PAYMENT_STATUSES } from './admin.constants';
import { GENERATION_OPERATIONS } from './admin-operations';
import {
  AdminActivityItem,
  AdminGenerationItem,
  AdminOverviewResponse,
} from './admin-overview.types';
import { AdminOverviewQueryDto } from './dto/admin-overview-query.dto';

const HOURS_IN_DAY = 24;

function toRate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim() || 'Unknown user';
}

type OverviewCountsRow = {
  userTotal: bigint;
  userActive: bigint;
  userNew: bigint;
  invitationTotal: bigint;
  invitationPublished: bigint;
  rsvpTotal: bigint;
  attendingSum: bigint | null;
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Platform-wide counters in a single roundtrip. COUNT/SUM results arrive
   * as BigInt and are narrowed here (platform scale fits safely in Number).
   */
  private async getOverviewCounts(dayAgo: Date): Promise<OverviewCountsRow> {
    const rows = await this.prisma.$queryRaw<OverviewCountsRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "users") AS "userTotal",
        (SELECT COUNT(*) FROM "users" WHERE "is_active") AS "userActive",
        (SELECT COUNT(*) FROM "users" WHERE "created_at" >= ${dayAgo}) AS "userNew",
        (SELECT COUNT(*) FROM "invitations") AS "invitationTotal",
        (SELECT COUNT(*) FROM "invitations" WHERE "status" = 'PUBLISHED') AS "invitationPublished",
        (SELECT COUNT(*) FROM "rsvps") AS "rsvpTotal",
        (SELECT COALESCE(SUM("attendees_count"), 0) FROM "rsvps" WHERE "status" = 'ATTENDING') AS "attendingSum"
    `;
    const row = rows[0];
    if (!row) {
      return {
        userTotal: 0n,
        userActive: 0n,
        userNew: 0n,
        invitationTotal: 0n,
        invitationPublished: 0n,
        rsvpTotal: 0n,
        attendingSum: 0n,
      };
    }
    return row;
  }

  /** Paginated AI generations block (fetched alone on table page turns). */
  async getGenerations(
    page: number,
    limit: number
  ): Promise<AdminOverviewResponse['generations']> {
    const [total, rows] = await Promise.all([
      this.prisma.aiUsage.count(),
      this.prisma.aiUsage.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          operationType: true,
          status: true,
          tokensUsed: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true, email: true } },
          invitation: {
            select: { slug: true, event: { select: { title: true } } },
          },
        },
      }),
    ]);
    const items: AdminGenerationItem[] = rows.map((row) => ({
      id: row.id,
      userName: fullName(row.user.firstName, row.user.lastName),
      userEmail: row.user.email,
      invitationName: row.invitation.event.title,
      invitationSlug: row.invitation.slug,
      operation: row.operationType,
      tokensUsed: row.tokensUsed,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));
    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getOverview(query: AdminOverviewQueryDto): Promise<AdminOverviewResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 6;
    const now = new Date();
    const dayAgo = new Date(now.getTime() - HOURS_IN_DAY * 60 * 60 * 1000);

    const [
      counts,
      aiGroups,
      settledPayments,
      activeSubscriptions,
      recentUsers,
      recentInvitations,
      recentAi,
      generations,
      dayAiUsage,
    ] = await Promise.all([
      this.getOverviewCounts(dayAgo),
      this.prisma.aiUsage.groupBy({ by: ['operationType', 'status'], _count: { _all: true } }),
      this.prisma.payment.groupBy({
        by: ['currency'],
        where: { status: { in: SETTLED_PAYMENT_STATUSES } },
        _sum: { amount: true },
      }),
      this.prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] } } }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, firstName: true, lastName: true, email: true, createdAt: true },
      }),
      this.prisma.invitation.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          updatedAt: true,
          event: { select: { title: true } },
        },
      }),
      this.prisma.aiUsage.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, operationType: true, status: true, createdAt: true },
      }),
      this.getGenerations(page, limit),
      this.prisma.aiUsage.findMany({
        where: { createdAt: { gte: dayAgo } },
        select: { status: true, createdAt: true },
      }),
    ]);

    const userTotal = Number(counts.userTotal);
    const userActive = Number(counts.userActive);
    const invitationTotal = Number(counts.invitationTotal);
    const invitationPublished = Number(counts.invitationPublished);
    const rsvpTotal = Number(counts.rsvpTotal);
    const attending = Number(counts.attendingSum ?? 0n);

    let generationCount = 0;
    let refinementCount = 0;
    let successful = 0;
    let failed = 0;
    for (const group of aiGroups) {
      const count = group._count._all;
      if (GENERATION_OPERATIONS.has(group.operationType)) generationCount += count;
      else refinementCount += count;
      if (group.status === 'SUCCEEDED') successful += count;
      else if (group.status === 'FAILED') failed += count;
    }

    let revenueTotal = 0;
    let revenueCurrency = 'USD';
    let revenueCount = 0;
    for (const row of settledPayments) {
      const sum = row._sum.amount?.toNumber() ?? 0;
      if (sum > 0 && revenueCount === 0) revenueCurrency = row.currency;
      revenueCount += 1;
      if (row.currency === revenueCurrency) revenueTotal += sum;
    }

    const activity: AdminActivityItem[] = [
      ...recentUsers.map((u) => ({
        id: `user-${u.id}`,
        kind: 'user_registered' as const,
        title: 'New user registered',
        detail: `${fullName(u.firstName, u.lastName)} (${u.email})`,
        occurredAt: u.createdAt.toISOString(),
      })),
      ...recentInvitations.map((i) => ({
        id: `inv-${i.id}-${i.updatedAt.toISOString()}`,
        kind: (i.status === 'PUBLISHED' ? 'invitation_published' : 'invitation_created') as
          | 'invitation_created'
          | 'invitation_published',
        title: i.status === 'PUBLISHED' ? 'Invitation published' : 'Invitation created',
        detail: i.event.title,
        occurredAt: i.updatedAt.toISOString(),
      })),
      ...recentAi.map((a) => ({
        id: `ai-${a.id}`,
        kind: (a.status === 'SUCCEEDED' ? 'ai_completed' : 'ai_failed') as
          | 'ai_completed'
          | 'ai_failed',
        title: a.status === 'SUCCEEDED' ? 'AI generation completed' : 'AI generation failed',
        detail: a.operationType,
        occurredAt: a.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
      .slice(0, 7);

    return {
      users: {
        total: userTotal,
        active: userActive,
        activeRate: toRate(userActive, userTotal),
        newLast24h: Number(counts.userNew),
      },
      invitations: {
        total: invitationTotal,
        published: invitationPublished,
        draft: invitationTotal - invitationPublished,
      },
      rsvps: {
        total: rsvpTotal,
        attending,
        attendingRate: toRate(attending, rsvpTotal),
      },
      revenue: {
        total: Math.round(revenueTotal * 100) / 100,
        currency: revenueCurrency,
        activeSubscriptions,
      },
      ai: {
        generations: generationCount,
        refinements: refinementCount,
        successful,
        failed,
        successRate: toRate(successful, successful + failed),
      },
      series: this.buildHourlySeries(dayAiUsage, now),
      activity,
      generations,
    };
  }

  private buildHourlySeries(
    rows: Array<{ status: string; createdAt: Date }>,
    now: Date
  ): AdminOverviewResponse['series'] {
    const buckets = Array.from({ length: HOURS_IN_DAY }, (_, i) => {
      const start = new Date(now.getTime() - (HOURS_IN_DAY - 1 - i) * 60 * 60 * 1000);
      start.setMinutes(0, 0, 0);
      return { start, successful: 0, failed: 0 };
    });
    for (const row of rows) {
      const t = row.createdAt.getTime();
      const index = buckets.findIndex(
        (b) => t >= b.start.getTime() && t < b.start.getTime() + 60 * 60 * 1000
      );
      if (index === -1) continue;
      const bucket = buckets[index];
      if (!bucket) continue;
      if (row.status === 'SUCCEEDED') bucket.successful += 1;
      else if (row.status === 'FAILED') bucket.failed += 1;
    }
    return buckets.map((b) => ({
      hour: b.start.toISOString(),
      successful: b.successful,
      failed: b.failed,
    }));
  }
}
