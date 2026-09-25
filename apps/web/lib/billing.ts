import { apiClient, authenticatedApiClient } from './api-client';

export type BillingPlan = { id: string; name: string; description: string | null; price: string | number; billingInterval: string; planFeatures: { enabled: boolean; limitValue: number | null; feature: { name: string; description: string | null } }[] };
export type SubscriptionRecord = { id: string; status: string; startDate: string; endDate: string | null; autoRenew: boolean; plan: BillingPlan } | null;

export const getBillingPlans = () => apiClient<BillingPlan[]>('/billing/plans');
export const getCurrentSubscription = () => authenticatedApiClient<SubscriptionRecord>('/billing/subscription');
