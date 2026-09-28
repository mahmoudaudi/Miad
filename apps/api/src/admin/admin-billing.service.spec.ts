import { AdminBillingService } from './admin-billing.service';

/** AdminBillingService unit tests — Prisma is stubbed. No DB needed. */
describe('AdminBillingService (unit)', () => {
  function makeDeps(over: { empty?: boolean } = {}) {
    const price = (n: number) => ({ toNumber: () => n });
    const sub = (userId: string, plan: string, amount: number, interval: string, start: Date) => ({
      userId,
      status: 'ACTIVE',
      startDate: start,
      endDate: null,
      createdAt: start,
      plan: { name: plan, price: price(amount), billingInterval: interval },
    });
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    return {
      subscription: {
        findMany: async () =>
          over.empty
            ? []
            : [
                sub('u-1', 'Studio Pro', 29, 'MONTHLY', recent),
                sub('u-2', 'Studio Pro', 29, 'MONTHLY', old),
                sub('u-3', 'Enterprise', 2388, 'ANNUAL', old),
              ],
      },
      plan: {
        findMany: async () =>
          over.empty
            ? []
            : [
                { name: 'Studio Pro', price: price(29), billingInterval: 'MONTHLY' },
                { name: 'Enterprise', price: price(2388), billingInterval: 'ANNUAL' },
              ],
      },
      payment: {
        groupBy: async () =>
          over.empty ? [] : [{ currency: 'USD', _sum: { amount: price(58) } }],
        count: async () => (over.empty ? 0 : 2),
        findMany: async () =>
          over.empty
            ? []
            : [
                {
                  id: 'p-1',
                  amount: price(29),
                  currency: 'USD',
                  status: 'SUCCEEDED',
                  transactionReference: 'pi_123',
                  paymentDate: recent,
                  subscription: {
                    plan: { name: 'Studio Pro', billingInterval: 'MONTHLY' },
                    user: { firstName: 'Ahmad', lastName: 'K', email: 'ahmad@k.me' },
                  },
                },
              ],
      },
    };
  }

  it('derives MRR, tiers, and transactions from stored rows', async () => {
    const deps = makeDeps();
    const service = new AdminBillingService(deps as never);
    const res = await service.getBilling({});

    // 29 + 29 + 2388/12 = 257 MRR.
    expect(res.kpis.mrr).toBe(257);
    expect(res.kpis.activeSubscriptions).toBe(3);
    expect(res.kpis.newSubs30d).toBe(1);
    expect(res.kpis.totalRevenue).toBe(58);
    expect(res.tiers).toEqual([
      { plan: 'Studio Pro', price: 29, interval: 'MONTHLY', subscribers: 2, mrr: 58 },
      { plan: 'Enterprise', price: 2388, interval: 'ANNUAL', subscribers: 1, mrr: 199 },
    ]);
    expect(res.monthly).toHaveLength(6);
    expect(res.transactions.items[0]).toMatchObject({
      reference: 'pi_123',
      customerEmail: 'ahmad@k.me',
      plan: 'Studio Pro',
      amount: 29,
      status: 'SUCCEEDED',
    });
    // Nothing invented: no methods, coupons, invoices, or refunds.
    expect(JSON.stringify(res)).not.toMatch(/stripe|apple|coupon|invoice|refund|dunning/i);
  });

  it('reports zeros when billing is not yet live', async () => {
    const deps = makeDeps({ empty: true });
    const service = new AdminBillingService(deps as never);
    const res = await service.getBilling({});
    expect(res.kpis).toMatchObject({ totalRevenue: 0, mrr: 0, activeSubscriptions: 0 });
    expect(res.tiers).toEqual([]);
    expect(res.transactions.total).toBe(0);
  });
});
