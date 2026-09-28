import { AdminAiTelemetryService } from './admin-ai-telemetry.service';

/** AdminAiTelemetryService unit tests — Prisma + routing are stubbed. No DB needed. */
describe('AdminAiTelemetryService (unit)', () => {
  const createdAt = new Date('2026-09-20T10:00:00Z');

  function makeDeps(over: { empty?: boolean } = {}) {
    const prisma = {
      aiUsage: {
        groupBy: async () =>
          over.empty
            ? []
            : [
                { operationType: 'GENERATE_DESIGN', status: 'SUCCEEDED', _count: { _all: 6 }, _avg: { tokensUsed: 1000 }, _sum: { tokensUsed: 6000 } },
                { operationType: 'EDIT_DESIGN', status: 'SUCCEEDED', _count: { _all: 3 }, _avg: { tokensUsed: 500 }, _sum: { tokensUsed: 1500 } },
                { operationType: 'GENERATE_DESIGN', status: 'FAILED', _count: { _all: 1 }, _avg: { tokensUsed: null }, _sum: { tokensUsed: null } },
              ],
        aggregate: async () =>
          over.empty
            ? { _sum: { tokensUsed: null }, _count: { _all: 0 } }
            : { _sum: { tokensUsed: 7500 }, _count: { _all: 10 } },
        count: async () => (over.empty ? 0 : 1),
        findMany: async (args?: { where?: { status?: string }; take?: number }) => {
          if (over.empty) return [];
          if (args?.where?.status === 'FAILED') {
            return [
              {
                id: 'f-1',
                operationType: 'GENERATE_DESIGN',
                tokensUsed: null,
                createdAt,
                user: { email: 'omar@x.co' },
                invitation: { slug: 'bash', event: { title: 'Bash' } },
              },
            ];
          }
          return [
            {
              id: 'o-1',
              operationType: 'GENERATE_DESIGN',
              tokensUsed: 1200,
              createdAt,
              invitation: { slug: 'gala', event: { title: 'Gala' } },
            },
          ];
        },
      },
    };
    const routing = {
      modelOptions: async () => ({
        models: [
          { id: 'a', available: true },
          { id: 'b', available: false },
        ],
      }),
    };
    return { prisma, routing };
  }

  it('aggregates telemetry with no invented durations, costs, or models', async () => {
    const deps = makeDeps();
    const service = new AdminAiTelemetryService(deps.prisma as never, deps.routing as never);
    const res = await service.getTelemetry({});

    expect(res.kpis).toMatchObject({
      total: 10,
      generations: 7,
      refinements: 3,
      successful: 9,
      failed: 1,
      successRate: 90,
      tokensTotal: 7500,
      avgTokensPerRun: 750,
      modelsConfigured: 2,
      modelsAvailable: 1,
    });
    expect(res.operations).toEqual([
      { operation: 'GENERATE_DESIGN', runs: 7, share: 70, successRate: 85.7, avgTokens: 857 },
      { operation: 'EDIT_DESIGN', runs: 3, share: 30, successRate: 100, avgTokens: 500 },
    ]);
    expect(res.daily).toHaveLength(30);
    expect(res.recentOutputs[0]).toMatchObject({ slug: 'gala', tokensUsed: 1200 });
    expect(res.failures.items[0]).toMatchObject({
      slug: 'bash',
      userEmail: 'omar@x.co',
      operation: 'GENERATE_DESIGN',
    });
    expect(res.failures.total).toBe(1);
    // Nothing invented: no latency, cost, error-message, or fallback fields.
    // (modelsConfigured/Available describe the real routing config.)
    expect(JSON.stringify(res)).not.toMatch(/latency|cost|errorMessage|fallback|duration/i);
  });

  it('reports zeros on an empty pipeline', async () => {
    const deps = makeDeps({ empty: true });
    const service = new AdminAiTelemetryService(deps.prisma as never, deps.routing as never);
    const res = await service.getTelemetry({});
    expect(res.kpis.total).toBe(0);
    expect(res.kpis.successRate).toBe(0);
    expect(res.operations).toEqual([]);
    expect(res.failures.totalPages).toBe(1);
  });
});
