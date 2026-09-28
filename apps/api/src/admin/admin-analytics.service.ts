import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GENERATION_OPERATIONS } from './admin-operations';
import {
  AdminAnalyticsDay,
  AdminAnalyticsResponse,
} from './admin-analytics.types';
import { AdminAnalyticsQueryDto } from './dto/admin-analytics-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;

function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(query: AdminAnalyticsQueryDto): Promise<AdminAnalyticsResponse> {
    const now = new Date();
    let dayCount: number = RANGE_DAYS[query.range ?? '30d'];
    let to = now;
    let from = new Date(now.getTime() - dayCount * DAY_MS);
    let label = `Last ${dayCount} Days`;
    if (query.from && query.to) {
      if (query.from >= query.to) throw new BadRequestException('Custom range is invalid.');
      if (query.to.getTime() - query.from.getTime() > 365 * DAY_MS) {
        throw new BadRequestException('Custom range is limited to 365 days.');
      }
      from = query.from;
      to = query.to;
      dayCount = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
      label = 'Custom Range';
    }
    const span = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - span);
    const bucketCount = Math.min(dayCount, 90);

    const [
      newUsers,
      newUsersPrev,
      rangeEvents,
      rangeAiUsers,
      rangeInvitations,
      rangeViews,
      rangeRsvps,
      aiGroups,
      deviceGroups,
      topViews,
    ] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: from, lt: to } } }),
      this.prisma.user.count({ where: { createdAt: { gte: prevFrom, lt: from } } }),
      this.prisma.event.findMany({
        where: { createdAt: { gte: from, lt: to } },
        select: { userId: true },
      }),
      this.prisma.aiUsage.findMany({
        where: { createdAt: { gte: from, lt: to } },
        select: { userId: true },
      }),
      this.prisma.invitation.findMany({
        where: { createdAt: { gte: from, lt: to } },
        select: { status: true, createdAt: true },
      }),
      this.prisma.invitationView.findMany({
        where: { viewedAt: { gte: from, lt: to } },
        select: { invitationId: true, deviceType: true, viewedAt: true },
      }),
      this.prisma.rsvp.findMany({
        where: { createdAt: { gte: from, lt: to } },
        select: { status: true, attendeesCount: true },
      }),
      this.prisma.aiUsage.groupBy({
        by: ['operationType', 'status'],
        where: { createdAt: { gte: from, lt: to } },
        _count: { _all: true },
      }),
      this.prisma.invitationView.groupBy({
        by: ['deviceType'],
        where: { viewedAt: { gte: from, lt: to } },
        _count: { _all: true },
      }),
      this.prisma.invitationView.groupBy({
        by: ['invitationId'],
        where: { viewedAt: { gte: from, lt: to } },
        _count: { _all: true },
        orderBy: { _count: { invitationId: 'desc' } },
        take: 5,
      }),
    ]);

    const activeCreators = new Set([
      ...rangeEvents.map((e) => e.userId),
      ...rangeAiUsers.map((a) => a.userId),
    ]).size;
    const published = rangeInvitations.filter((i) => i.status === 'PUBLISHED').length;

    let generations = 0;
    let refinements = 0;
    let successful = 0;
    let failed = 0;
    for (const group of aiGroups) {
      const count = group._count._all;
      if (GENERATION_OPERATIONS.has(group.operationType)) generations += count;
      else refinements += count;
      if (group.status === 'SUCCEEDED') successful += count;
      else if (group.status === 'FAILED') failed += count;
    }

    const attending = rangeRsvps.filter((r) => r.status === 'ATTENDING');
    const attendingGuests = attending.reduce((sum, r) => sum + r.attendeesCount, 0);

    const daily: AdminAnalyticsDay[] = Array.from({ length: bucketCount }, (_, i) => {
      const day = startOfDay(new Date(from.getTime() + i * DAY_MS));
      return { day: day.toISOString(), created: 0, published: 0, views: 0 };
    });
    const bucketIndex = (t: number) => {
      const dayStart = startOfDay(new Date(t)).getTime();
      return daily.findIndex((d) => new Date(d.day).getTime() === dayStart);
    };
    for (const inv of rangeInvitations) {
      const index = bucketIndex(inv.createdAt.getTime());
      const bucket = index === -1 ? undefined : daily[index];
      if (!bucket) continue;
      bucket.created += 1;
      if (inv.status === 'PUBLISHED') bucket.published += 1;
    }
    for (const view of rangeViews) {
      const index = bucketIndex(view.viewedAt.getTime());
      const bucket = index === -1 ? undefined : daily[index];
      if (bucket) bucket.views += 1;
    }

    const viewsById = new Map<string, number>();
    for (const view of rangeViews) {
      viewsById.set(view.invitationId, (viewsById.get(view.invitationId) ?? 0) + 1);
    }
    const topIds = topViews.map((t) => t.invitationId);
    const topInvitations =
      topIds.length === 0
        ? []
        : await this.prisma.invitation.findMany({
            where: { id: { in: topIds } },
            select: {
              id: true,
              slug: true,
              event: { select: { title: true } },
              guests: { select: { rsvp: { select: { id: true } } } },
            },
          });
    const topById = new Map(topInvitations.map((i) => [i.id, i]));
    const top = topViews.flatMap((t) => {
      const inv = topById.get(t.invitationId);
      if (!inv) return [];
      return [
        {
          id: inv.id,
          title: inv.event.title,
          slug: inv.slug,
          views: viewsById.get(t.invitationId) ?? t._count._all,
          rsvps: inv.guests.filter((g) => g.rsvp).length,
        },
      ];
    });

    const devices = deviceGroups.map((g) => ({
      device: g.deviceType ?? 'unknown',
      views: g._count._all,
    }));

    return {
      range: { from: from.toISOString(), to: to.toISOString(), label },
      kpis: {
        newUsers,
        newUsersTrend:
          newUsersPrev > 0
            ? Math.round(((newUsers - newUsersPrev) / newUsersPrev) * 1000) / 10
            : newUsers > 0
              ? 100
              : 0,
        activeCreators,
        published,
        publishedRate:
          rangeInvitations.length > 0
            ? Math.round((published / rangeInvitations.length) * 1000) / 10
            : 0,
        rsvpResponses: rangeRsvps.length,
        rsvpRate:
          rangeRsvps.length > 0
            ? Math.round((attending.length / rangeRsvps.length) * 1000) / 10
            : 0,
      },
      daily,
      funnel: { created: rangeInvitations.length, published, opened: rangeViews.length },
      rsvp: {
        attending: attending.length,
        notAttending: rangeRsvps.filter((r) => r.status === 'NOT_ATTENDING').length,
        pending: rangeRsvps.filter((r) => r.status === 'PENDING').length,
        attendingGuests,
      },
      ai: {
        generations,
        refinements,
        successful,
        failed,
        successRate:
          successful + failed > 0
            ? Math.round((successful / (successful + failed)) * 1000) / 10
            : 0,
      },
      devices,
      top,
    };
  }
}
