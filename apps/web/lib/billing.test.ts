import { describe, expect, it } from 'vitest';
import { isUpgradePlan, operationLabel, type BillingPlan } from './billing';
import { currentPlanIdFor } from '@/components/billing/billing-view';

const plan = (overrides: Partial<BillingPlan> = {}): BillingPlan => ({
  id: 'plan-1',
  name: 'Free',
  description: null,
  price: 0,
  billingInterval: 'MONTHLY',
  creditsPerCycle: 10,
  planFeatures: [],
  ...overrides,
});

describe('operationLabel', () => {
  it('maps known AI operations to user-facing copy', () => {
    expect(operationLabel('GENERATE_DESIGN')).toBe('Generation');
    expect(operationLabel('REGENERATE_DESIGN')).toBe('Regeneration');
    expect(operationLabel('EDIT_DESIGN')).toBe('Edit');
  });

  it('falls back gracefully for an unknown operation type', () => {
    expect(operationLabel('SOMETHING_NEW')).toBe('AI request');
  });
});

describe('isUpgradePlan', () => {
  it('treats only priced plans as upgrades', () => {
    expect(isUpgradePlan(plan({ price: 0 }))).toBe(false);
    expect(isUpgradePlan(plan({ price: '9.99' }))).toBe(true);
    expect(isUpgradePlan(plan({ price: '0.00' }))).toBe(false);
  });

  it('does not treat an unreadable price as an upgrade', () => {
    expect(isUpgradePlan(plan({ price: 'n/a' }))).toBe(false);
  });
});

describe('currentPlanIdFor', () => {
  const plans = [
    plan({ id: 'free', name: 'Free', price: 0 }),
    plan({ id: 'pro', name: 'Pro', price: 29.99 }),
  ];

  it('uses the subscribed plan when there is one', () => {
    expect(currentPlanIdFor(plans, 'pro')).toBe('pro');
  });

  it('falls back to the free plan when there is no subscription', () => {
    expect(currentPlanIdFor(plans, null)).toBe('free');
  });

  it('ignores a subscription id that is not in the plan list', () => {
    expect(currentPlanIdFor(plans, 'retired-plan')).toBe('free');
  });

  it('returns null when no plan can be treated as current', () => {
    expect(currentPlanIdFor([], null)).toBeNull();
    expect(currentPlanIdFor([plan({ id: 'pro', price: 29.99 })], null)).toBeNull();
  });
});
