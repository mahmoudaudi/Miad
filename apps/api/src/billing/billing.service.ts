import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Name of the plan feature that carries the monthly credit allowance. The
 * value lives in the database (see prisma/seed.ts); the client is told the
 * amount explicitly so no price or credit figure is ever hardcoded in the UI.
 */
export const AI_CREDITS_FEATURE = 'AI_CREDITS_PER_CYCLE';

const planSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  billingInterval: true,
  planFeatures: { select: { enabled: true, limitValue: true, feature: { select: { name: true, description: true } } } },
} satisfies Prisma.PlanSelect;

type PlanWithFeatures = Prisma.PlanGetPayload<{ select: typeof planSelect }>;

/** Adds the credit allowance so the client never has to infer it from feature names. */
function withCreditsPerCycle<T extends PlanWithFeatures>(plan: T) {
  const feature = plan.planFeatures.find((item) => item.feature.name === AI_CREDITS_FEATURE);
  return {
    ...plan,
    creditsPerCycle: feature?.enabled ? feature.limitValue : null,
  };
}

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  listPlans() {
    return this.prisma.plan
      .findMany({ where: { isActive: true }, select: planSelect, orderBy: { price: 'asc' } })
      .then((plans) => plans.map(withCreditsPerCycle));
  }

  async currentSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({ where: { userId, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, startDate: true, endDate: true, autoRenew: true, plan: { select: planSelect } } });
    return subscription
      ? {
          ...subscription,
          startDate: subscription.startDate.toISOString(),
          endDate: subscription.endDate?.toISOString() ?? null,
          plan: withCreditsPerCycle(subscription.plan),
        }
      : null;
  }
}
