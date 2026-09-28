/**
 * Billing payload. The SaaS stores plans, subscriptions, and payments — but
 * no payment methods, coupons, invoices, refunds, or dunning state, so none
 * is reported. MRR is derived from active subscriptions × normalized price.
 */

export type AdminBillingKpis = {
  totalRevenue: number;
  currency: string;
  mrr: number;
  activeSubscriptions: number;
  newSubs30d: number;
  endedSubs: number;
  churnRate: number;
};

export type AdminBillingMonth = { month: string; mrr: number };

export type AdminBillingTier = {
  plan: string;
  price: number;
  interval: string;
  subscribers: number;
  mrr: number;
};

export type AdminTransaction = {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  plan: string;
  amount: number;
  currency: string;
  cycle: string;
  status: string;
  processedAt: string;
};

export type AdminBillingResponse = {
  kpis: AdminBillingKpis;
  monthly: AdminBillingMonth[];
  tiers: AdminBillingTier[];
  transactions: {
    items: AdminTransaction[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    gross: number;
    currency: string;
  };
};
