import { Injectable } from '@nestjs/common';
import { AiModelRoutingService } from '../invitation-designs/ai-model-routing.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminAiOperation,
  AdminAiTelemetryResponse,
} from './admin-ai-telemetry.types';
import { AdminAiTelemetryQueryDto } from './dto/admin-ai-telemetry-query.dto';
import { GENERATION_OPERATIONS } from './admin-operations';

@Injectable()
export class AdminAiTelemetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: AiModelRoutingService
  ) {}

  async getTelemetry(query: AdminAiTelemetryQueryDto): Promise<AdminAiTelemetryResponse> {
    const failPage = query.failPage ?? 1;
    const failLimit = query.failLimit ?? 5;
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [groups, failures, outputs, monthRows, models] = await Promise.all([
      this.prisma.aiUsage.groupBy({
        by: ['operationType', 'status'],
        _count: { _all: true },
        _avg: { tokensUsed: true },
        _sum: { tokensUsed: true },
      }),
      this.getFailures(failPage, failLimit),
      this.prisma.aiUsage.findMany({
        where: { status: 'SUCCEEDED' },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          operationType: true,
          tokensUsed: true,
          createdAt: true,
          invitation: { select: { slug: true, event: { select: { title: true } } } },
        },
      }),
      this.prisma.aiUsage.findMany({
        where: { createdAt: { gte: monthAgo } },
        select: { status: true, createdAt: true },
      }),
      this.routing.modelOptions(),
    ]);

    let generations = 0;
    let refinements = 0;
    let successful = 0;
    let failed = 0;
    const byOperation = new Map<
      string,
      { runs: number; successful: number; tokens: number; tokenRows: number }
    >();
    for (const group of groups) {
      const count = group._count._all;
      if (GENERATION_OPERATIONS.has(group.operationType)) generations += count;
      else refinements += count;
      if (group.status === 'SUCCEEDED') successful += count;
      else if (group.status === 'FAILED') failed += count;
      const entry = byOperation.get(group.operationType) ?? {
        runs: 0,
        successful: 0,
        tokens: 0,
        tokenRows: 0,
      };
      entry.runs += count;
      if (group.status === 'SUCCEEDED') entry.successful += count;
      // _avg/_sum are null when no row in the group recorded tokens.
      entry.tokens += group._sum.tokensUsed ?? 0;
      entry.tokenRows += 1;
      byOperation.set(group.operationType, entry);
    }

    const total = successful + failed;
    const tokensTotal = groups.reduce((sum, g) => sum + (g._sum.tokensUsed ?? 0), 0);
    const operations: AdminAiOperation[] = [...byOperation.entries()]
      .map(([operation, entry]) => ({
        operation,
        runs: entry.runs,
        share: total > 0 ? Math.round((entry.runs / total) * 1000) / 10 : 0,
        successRate:
          entry.runs > 0 ? Math.round((entry.successful / entry.runs) * 1000) / 10 : 0,
        avgTokens: entry.runs > 0 ? Math.round(entry.tokens / entry.runs) : 0,
      }))
      .sort((a, b) => b.runs - a.runs);

    const daily = Array.from({ length: 30 }, (_, i) => {
      const day = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
      day.setHours(0, 0, 0, 0);
      return { day, successful: 0, failed: 0 };
    });
    for (const row of monthRows) {
      const t = row.createdAt.getTime();
      const index = daily.findIndex(
        (d) => t >= d.day.getTime() && t < d.day.getTime() + 24 * 60 * 60 * 1000
      );
      const bucket = index === -1 ? undefined : daily[index];
      if (!bucket) continue;
      if (row.status === 'SUCCEEDED') bucket.successful += 1;
      else if (row.status === 'FAILED') bucket.failed += 1;
    }

    return {
      kpis: {
        total,
        generations,
        refinements,
        successful,
        failed,
        successRate: total > 0 ? Math.round((successful / total) * 1000) / 10 : 0,
        tokensTotal,
        avgTokensPerRun: total > 0 ? Math.round(tokensTotal / total) : 0,
        modelsConfigured: models.models.length,
        modelsAvailable: models.models.filter((m) => m.available).length,
      },
      operations,
      daily: daily.map((d) => ({
        day: d.day.toISOString(),
        successful: d.successful,
        failed: d.failed,
      })),
      recentOutputs: outputs.map((o) => ({
        id: o.id,
        title: o.invitation.event.title,
        slug: o.invitation.slug,
        operation: o.operationType,
        tokensUsed: o.tokensUsed,
        createdAt: o.createdAt.toISOString(),
      })),
      failures,
    };
  }

  /** Paginated failures block (fetched alone on table page turns). */
  async getFailures(
    failPage: number,
    failLimit: number
  ): Promise<AdminAiTelemetryResponse['failures']> {
    const [total, rows] = await Promise.all([
      this.prisma.aiUsage.count({ where: { status: 'FAILED' } }),
      this.prisma.aiUsage.findMany({
        where: { status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
        skip: (failPage - 1) * failLimit,
        take: failLimit,
        select: {
          id: true,
          operationType: true,
          tokensUsed: true,
          createdAt: true,
          user: { select: { email: true } },
          invitation: { select: { slug: true, event: { select: { title: true } } } },
        },
      }),
    ]);
    return {
      items: rows.map((f) => ({
        id: f.id,
        createdAt: f.createdAt.toISOString(),
        slug: f.invitation.slug,
        title: f.invitation.event.title,
        userEmail: f.user.email,
        operation: f.operationType,
        tokensUsed: f.tokensUsed,
      })),
      page: failPage,
      limit: failLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / failLimit)),
    };
  }
}
