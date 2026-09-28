import { apiClient, authenticatedApiClient } from './api-client';

export type BillingPlanFeature = {
  enabled: boolean;
  limitValue: number | null;
  feature: { name: string; description: string | null };
};

export type BillingPlan = {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  billingInterval: string;
  /** Monthly credit allowance, resolved server-side from the plan's features. */
  creditsPerCycle: number | null;
  planFeatures: BillingPlanFeature[];
};

export type SubscriptionRecord =
  | {
      id: string;
      status: string;
      startDate: string;
      endDate: string | null;
      autoRenew: boolean;
      plan: BillingPlan;
    }
  | null;

/** Balance projection: `used` is derived from the ledger, never stored twice. */
export type CreditSummary = {
  balance: number;
  totalGranted: number;
  used: number;
};

export type CreditUsageEntry = {
  id: string;
  operationType: string;
  status: string;
  creditsConsumed: number;
  creditsReserved: number;
  creditsRefunded: number;
  invitationId: string | null;
  invitationTitle: string | null;
  createdAt: string;
  completedAt: string | null;
};

export const getBillingPlans = () => apiClient<BillingPlan[]>('/billing/plans');
export const getCurrentSubscription = () =>
  authenticatedApiClient<SubscriptionRecord>('/billing/subscription');
export const getCreditSummary = () => authenticatedApiClient<CreditSummary>('/billing/credits');
export const getCreditUsage = (limit = 20) =>
  authenticatedApiClient<CreditUsageEntry[]>(`/billing/credits/usage?limit=${limit}`);

/** Human label for an AI operation type, so the UI never invents its own copy. */
export const operationLabels: Record<string, string> = {
  GENERATE_DESIGN: 'Generation',
  REGENERATE_DESIGN: 'Regeneration',
  EDIT_DESIGN: 'Edit',
};

export function operationLabel(operationType: string): string {
  return operationLabels[operationType] ?? 'AI request';
}

/** Paid plans need checkout, which does not exist yet. */
export function isUpgradePlan(plan: BillingPlan): boolean {
  const amount = Number(plan.price);
  return Number.isFinite(amount) && amount > 0;
}
