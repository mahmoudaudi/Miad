import { BillingService } from './billing.service';

const plan = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-1',
  name: 'Free',
  description: 'Try AI invitations',
  price: 0,
  billingInterval: 'MONTHLY',
  isActive: true,
  planFeatures: [
    {
      enabled: true,
      limitValue: 10,
      feature: { name: 'AI_CREDITS_PER_CYCLE', description: null },
    },
  ],
  ...overrides,
});

function serviceWith(plans: unknown[]) {
  const prisma = {
    plan: {
      findMany: async () => plans,
    },
    subscription: { findFirst: async () => null },
  };
  return new BillingService(prisma as never);
}

describe('BillingService plan credits (Phase 3)', () => {
  it('exposes the monthly credit allowance so the client never hardcodes it', async () => {
    const plans = await serviceWith([plan()]).listPlans();
    expect(plans[0] as { creditsPerCycle: number | null }).toMatchObject({
      name: 'Free',
      creditsPerCycle: 10,
    });
  });

  it('reads a different allowance per plan without any client knowledge', async () => {
    const plans = await serviceWith([
      plan({ id: 'a', name: 'Free', price: 0 }),
      plan({ id: 'b', name: 'Pro', price: 29.99, planFeatures: [
        { enabled: true, limitValue: 500, feature: { name: 'AI_CREDITS_PER_CYCLE', description: null } },
      ] }),
    ]).listPlans();
    expect(plans.map((entry) => entry.creditsPerCycle)).toEqual([10, 500]);
  });

  it('reports null when a plan has no enabled credit feature', async () => {
    const plans = await serviceWith([
      plan({ planFeatures: [
        { enabled: false, limitValue: 10, feature: { name: 'AI_CREDITS_PER_CYCLE', description: null } },
      ] }),
    ]).listPlans();
    expect((plans[0] as { creditsPerCycle: number | null }).creditsPerCycle).toBeNull();
  });

  it('returns null subscription for an account with none', async () => {
    await expect(serviceWith([]).currentSubscription('user-1')).resolves.toBeNull();
  });
});
