import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const planSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  billingInterval: true,
  planFeatures: { select: { enabled: true, limitValue: true, feature: { select: { name: true, description: true } } } },
} satisfies Prisma.PlanSelect;

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  listPlans() {
    return this.prisma.plan.findMany({ where: { isActive: true }, select: planSelect, orderBy: { price: 'asc' } });
  }

  async currentSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({ where: { userId, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, startDate: true, endDate: true, autoRenew: true, plan: { select: planSelect } } });
    return subscription ? { ...subscription, startDate: subscription.startDate.toISOString(), endDate: subscription.endDate?.toISOString() ?? null } : null;
  }
}
