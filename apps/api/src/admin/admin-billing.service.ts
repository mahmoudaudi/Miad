import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SETTLED_PAYMENT_STATUSES } from './admin.constants';
import { AdminBillingResponse, AdminBillingTier } from './admin-billing.types';
import { AdminBillingQueryDto } from './dto/admin-billing-query.dto';

const BILLABLE_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

/** Monthly-normalized plan price. Unknown intervals pass through untouched. */
function monthlyPrice(price: number, interval: string): number {
  const normalized = interval.trim().toLowerCase();
  if (normalized.includes('annual') || normalized.includes('year')) return price / 12;
  return price;
}

/** First instant of the given year/month in UTC (avoids local-zone month shifts). */
function utcMonthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1));
}

function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim() || 'Unknown user';
}

@Injectable()
export class AdminBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getBilling(query: AdminBillingQueryDto): Promise<AdminBillingResponse> {
    const txPage = query.txPage ?? 1;
    const txLimit = query.txLimit ?? 6;
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [subscriptions, plans, settledPayments, transactions] = await Promise.all([
      this.prisma.subscription.findMany({
        select: {
          userId: true,
          status: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          plan: { select: { name: true, price: true, billingInterval: true } },
        },
      }),
      this.prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' },
        select: { name: true, price: true, billingInterval: true },
      }),
      this.prisma.payment.groupBy({
        by: ['currency'],
        where: { status: { in: SETTLED_PAYMENT_STATUSES } },
        _sum: { amount: true },
      }),
      this.getTransactions(txPage, txLimit),
    ]);

    const isBillable = (status: string) => BILLABLE_STATUSES.includes(status);
    const activeSubs = subscriptions.filter((s) => isBillable(s.status));
    const mrr = activeSubs.reduce(
      (sum, s) => sum + monthlyPrice(s.plan.price.toNumber(), s.plan.billingInterval),
      0
    );
    const newSubs30d = subscriptions.filter((s) => s.createdAt >= monthAgo).length;
    const endedSubs = subscriptions.filter((s) => s.endDate && s.endDate < now).length;
    const churnBase = activeSubs.length + endedSubs;

    // MRR per month: subscriptions overlapping that month × normalized price.
    const base = new Date(now.getTime());
    const monthly = Array.from({ length: 6 }, (_, i) => {
      const start = utcMonthStart(base.getUTCFullYear(), base.getUTCMonth() - (5 - i));
      const end = utcMonthStart(start.getUTCFullYear(), start.getUTCMonth() + 1);
      const monthMrr = subscriptions
        .filter(
          (s) =>
            isBillable(s.status) && s.startDate < end && (!s.endDate || s.endDate >= start)
        )
        .reduce((sum, s) => sum + monthlyPrice(s.plan.price.toNumber(), s.plan.billingInterval), 0);
      return { month: start.toISOString(), mrr: Math.round(monthMrr * 100) / 100 };
    });

    const subsByPlan = new Map<string, typeof activeSubs>();
    for (const sub of activeSubs) {
      const list = subsByPlan.get(sub.plan.name) ?? [];
      list.push(sub);
      subsByPlan.set(sub.plan.name, list);
    }
    const tiers: AdminBillingTier[] = plans.map((plan) => {
      const subs = subsByPlan.get(plan.name) ?? [];
      const price = plan.price.toNumber();
      const tierMrr = subs.reduce((sum) => sum + monthlyPrice(price, plan.billingInterval), 0);
      return {
        plan: plan.name,
        price,
        interval: plan.billingInterval,
        subscribers: new Set(subs.map((s) => s.userId)).size,
        mrr: Math.round(tierMrr * 100) / 100,
      };
    });

    let totalRevenue = 0;
    let currency = 'USD';
    let settled = false;
    for (const row of settledPayments) {
      const sum = row._sum.amount?.toNumber() ?? 0;
      if (!settled && sum > 0) {
        currency = row.currency;
        settled = true;
      }
      if (row.currency === currency) totalRevenue += sum;
    }

    return {
      kpis: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        currency,
        mrr: Math.round(mrr * 100) / 100,
        activeSubscriptions: new Set(activeSubs.map((s) => s.userId)).size,
        newSubs30d,
        endedSubs,
        churnRate:
          churnBase > 0 ? Math.round((endedSubs / churnBase) * 1000) / 10 : 0,
      },
      monthly,
      tiers,
      transactions,
    };
  }

  /** Paginated transactions block (fetched alone on table page turns). */
  async getTransactions(
    txPage: number,
    txLimit: number
  ): Promise<AdminBillingResponse['transactions']> {
    const [total, rows] = await Promise.all([
      this.prisma.payment.count(),
      this.prisma.payment.findMany({
        orderBy: { paymentDate: 'desc' },
        skip: (txPage - 1) * txLimit,
        take: txLimit,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          transactionReference: true,
          paymentDate: true,
          subscription: {
            select: {
              plan: { select: { name: true, billingInterval: true } },
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      }),
      this.prisma.payment.groupBy({
        by: ['currency'],
        where: { status: { in: SETTLED_PAYMENT_STATUSES } },
        _sum: { amount: true },
      }),
    ]);
    // Page rows carry their own currency; the summary block owns the
    // settled-payments currency. No extra aggregate query per page turn.
    const currency = rows[0]?.currency ?? 'USD';
    const gross = rows.reduce((sum, t) => sum + t.amount.toNumber(), 0);
    return {
      items: rows.map((t) => ({
        id: t.id,
        reference: t.transactionReference ?? t.id.slice(0, 8).toUpperCase(),
        customerName: fullName(t.subscription.user.firstName, t.subscription.user.lastName),
        customerEmail: t.subscription.user.email,
        plan: t.subscription.plan.name,
        amount: t.amount.toNumber(),
        currency: t.currency,
        cycle: t.subscription.plan.billingInterval,
        status: t.status,
        processedAt: t.paymentDate.toISOString(),
      })),
      page: txPage,
      limit: txLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / txLimit)),
      gross: Math.round(gross * 100) / 100,
      currency,
    };
  }
}
