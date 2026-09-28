import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SETTLED_PAYMENT_STATUSES } from './admin.constants';
import { AdminUserItem, AdminUsersResponse } from './admin-users.types';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';

const ACTIVE_SUBSCRIPTION_STATUSES = ['ACTIVE', 'TRIALING'];
const FREE_PLAN = 'Free';

function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim() || 'Unknown user';
}

type UsersCountsRow = { total: bigint; newThisWeek: bigint; prevWeek: bigint; suspended: bigint };

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  private buildUserWhere(
    query: AdminUsersQueryDto,
    weekAgo: Date,
    monthAgo: Date
  ): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'suspended') where.isActive = false;
    if (query.joined === '7d') where.createdAt = { gte: weekAgo };
    if (query.joined === '30d') where.createdAt = { gte: monthAgo };
    return where;
  }

  /** Platform-wide user counters in a single roundtrip (BigInt narrowed here). */
  private async getUsersCounts(weekAgo: Date, fortnightAgo: Date): Promise<UsersCountsRow> {
    const rows = await this.prisma.$queryRaw<UsersCountsRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "users") AS "total",
        (SELECT COUNT(*) FROM "users" WHERE "created_at" >= ${weekAgo}) AS "newThisWeek",
        (SELECT COUNT(*) FROM "users" WHERE "created_at" >= ${fortnightAgo} AND "created_at" < ${weekAgo}) AS "prevWeek",
        (SELECT COUNT(*) FROM "users" WHERE NOT "is_active") AS "suspended"
    `;
    return (
      rows[0] ?? { total: 0n, newThisWeek: 0n, prevWeek: 0n, suspended: 0n }
    );
  }

  /** KPIs, distribution, and top-AI block (fetched once per filter set). */
  async getUsersSummary(): Promise<Omit<AdminUsersResponse, 'table'>> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fortnightAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [counts, activeSubs, recentEventUsers, recentAiUsers, settledPayments, topAiGroups] =
      await Promise.all([
        this.getUsersCounts(weekAgo, fortnightAgo),
        this.prisma.subscription.findMany({
          where: { status: { in: ACTIVE_SUBSCRIPTION_STATUSES } },
          orderBy: { createdAt: 'desc' },
          select: { userId: true, plan: { select: { name: true } } },
        }),
        this.prisma.event.findMany({
          where: { createdAt: { gte: monthAgo } },
          select: { userId: true },
        }),
        this.prisma.aiUsage.findMany({
          where: { createdAt: { gte: monthAgo } },
          select: { userId: true },
        }),
        this.prisma.payment.groupBy({
          by: ['currency'],
          where: { status: { in: SETTLED_PAYMENT_STATUSES } },
          _sum: { amount: true },
        }),
        this.prisma.aiUsage.groupBy({
          by: ['userId'],
          where: { createdAt: { gte: monthAgo } },
          _count: { _all: true },
          orderBy: { _count: { userId: 'desc' } },
          take: 5,
        }),
      ]);

    const total = Number(counts.total);
    const newThisWeek = Number(counts.newThisWeek);
    const prevWeek = Number(counts.prevWeek);
    const active30d = new Set([
      ...recentEventUsers.map((e) => e.userId),
      ...recentAiUsers.map((a) => a.userId),
    ]).size;
    const growthRate =
      prevWeek > 0
        ? Math.round(((newThisWeek - prevWeek) / prevWeek) * 1000) / 10
        : newThisWeek > 0
          ? 100
          : 0;

    const distributionMap = new Map<string, number>();
    for (const sub of activeSubs) {
      distributionMap.set(sub.plan.name, (distributionMap.get(sub.plan.name) ?? 0) + 1);
    }
    const subscribedUsers = new Set(activeSubs.map((s) => s.userId)).size;
    const distribution = [
      { plan: FREE_PLAN, count: Math.max(0, total - subscribedUsers) },
      ...[...distributionMap.entries()]
        .map(([plan, count]) => ({ plan, count }))
        .sort((a, b) => b.count - a.count),
    ];

    let revenueTotal = 0;
    for (const row of settledPayments) revenueTotal += row._sum.amount?.toNumber() ?? 0;

    const topUserIds = topAiGroups.map((g) => g.userId);
    const topUsers = topUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: topUserIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const topUserById = new Map(topUsers.map((u) => [u.id, u]));
    const topAi = topAiGroups.flatMap((g) => {
      const u = topUserById.get(g.userId);
      return u
        ? [{ id: u.id, name: fullName(u.firstName, u.lastName), email: u.email, runs: g._count._all }]
        : [];
    });

    return {
      kpis: {
        total,
        newThisWeek,
        growthRate,
        active30d,
        activeSubscriptions: subscribedUsers,
        suspended: Number(counts.suspended),
      },
      distribution,
      avgRevenuePerUser: total > 0 ? Math.round((revenueTotal / total) * 100) / 100 : 0,
      topAi,
    };
  }

  /** Paginated directory table with scans scoped to the filtered ids. */
  async getUsersTable(query: AdminUsersQueryDto): Promise<AdminUsersResponse['table']> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const where = this.buildUserWhere(query, weekAgo, monthAgo);

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        createdAt: true,
        role: { select: { name: true } },
      },
    });
    const ids = users.map((u) => u.id);
    const [eventGroups, aiGroups, subs] =
      ids.length === 0
        ? [[], [], []]
        : await Promise.all([
            this.prisma.event.groupBy({
              by: ['userId'],
              where: { userId: { in: ids } },
              _count: { _all: true },
            }),
            this.prisma.aiUsage.groupBy({
              by: ['userId'],
              where: { userId: { in: ids } },
              _count: { _all: true },
            }),
            this.prisma.subscription.findMany({
              where: { userId: { in: ids }, status: { in: ACTIVE_SUBSCRIPTION_STATUSES } },
              orderBy: { createdAt: 'desc' },
              select: { userId: true, plan: { select: { name: true } } },
            }),
          ]);

    const eventCounts = new Map(
      (eventGroups as Array<{ userId: string; _count: { _all: number } }>).map((g) => [
        g.userId,
        g._count._all,
      ])
    );
    const aiCounts = new Map(
      (aiGroups as Array<{ userId: string; _count: { _all: number } }>).map((g) => [
        g.userId,
        g._count._all,
      ])
    );
    // Latest-first order: the first row per user is their current plan.
    const planByUser = new Map<string, string>();
    for (const sub of subs as Array<{ userId: string; plan: { name: string } }>) {
      if (!planByUser.has(sub.userId)) planByUser.set(sub.userId, sub.plan.name);
    }

    let items: AdminUserItem[] = users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role.name,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      invitationsCount: eventCounts.get(u.id) ?? 0,
      aiRuns: aiCounts.get(u.id) ?? 0,
      plan: planByUser.get(u.id) ?? FREE_PLAN,
    }));

    if (query.plan) {
      items = items.filter((item) => item.plan === query.plan);
    }
    const sort = query.sort ?? 'newest';
    items.sort((a, b) => {
      if (sort === 'invitations') return b.invitationsCount - a.invitationsCount;
      if (sort === 'aiRuns') return b.aiRuns - a.aiRuns;
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

  async listUsers(query: AdminUsersQueryDto): Promise<AdminUsersResponse> {
    const [summary, table] = await Promise.all([
      this.getUsersSummary(),
      this.getUsersTable(query),
    ]);
    return { ...summary, table };
  }

  async createUser(dto: CreateAdminUserDto) {
    const email = dto.email.toLowerCase().trim();
    const [existing, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.role.findUnique({ where: { name: dto.role } }),
    ]);
    if (existing) throw new ConflictException('An account with this email already exists.');
    if (!role) throw new NotFoundException(`Role '${dto.role}' does not exist.`);
    try {
      const user = await this.prisma.user.create({
        data: {
          roleId: role.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email,
          passwordHash: await bcrypt.hash(dto.password, 12),
          isActive: true,
        },
        include: { role: true },
      });
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        isActive: user.isActive,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }
  }

  async setStatus(adminId: string, id: string, isActive: boolean) {
    if (adminId === id) throw new ForbiddenException('You cannot change your own status.');
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { isActive },
        include: { role: true },
      });
      return { id: user.id, isActive: user.isActive };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found.');
      }
      throw error;
    }
  }

  async setRole(adminId: string, id: string, roleName: string) {
    if (adminId === id) throw new ForbiddenException('You cannot change your own role.');
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Role '${roleName}' does not exist.`);
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { roleId: role.id },
        include: { role: true },
      });
      return { id: user.id, role: user.role.name };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found.');
      }
      throw error;
    }
  }

  async removeUser(adminId: string, id: string) {
    if (adminId === id) throw new ForbiddenException('You cannot delete your own account.');
    try {
      await this.prisma.user.delete({ where: { id } });
      return { id, deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('User has platform data and cannot be deleted. Suspend instead.');
      }
      throw error;
    }
  }
}
