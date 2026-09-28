'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import {
  getBillingPlans,
  getCreditSummary,
  getCreditUsage,
  getCurrentSubscription,
} from '@/lib/billing';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { BillingView, currentPlanIdFor, type BillingViewState } from './billing-view';

const GENERIC_ERROR = 'Check your connection and try again.';

export function BillingOverviewClient() {
  const router = useRouter();
  const { locale } = useLocale();
  const [state, setState] = useState<BillingViewState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const [plans, subscription, summary, usage] = await Promise.all([
        getBillingPlans(),
        getCurrentSubscription(),
        getCreditSummary(),
        getCreditUsage(20),
      ]);
      setState({
        status: 'ready',
        plans,
        currentPlanId: currentPlanIdFor(plans, subscription?.plan.id ?? null),
        subscriptionStatus: subscription?.status ?? null,
        summary,
        usage,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(`/login?next=${encodeURIComponent('/dashboard/billing')}`);
        return;
      }
      setState({
        status: 'error',
        message: error instanceof ApiError ? error.message : GENERIC_ERROR,
        onRetry: () => void load(),
      });
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return <BillingView state={state} locale={locale} />;
}
