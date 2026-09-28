import type { Metadata } from 'next';
import { BillingOverviewClient } from '@/components/billing/BillingOverviewClient';

export const metadata: Metadata = {
  title: 'Credits and plans — Miad',
  description: 'Track your AI credit balance, compare plans, and review recent AI activity.',
};

export default function BillingPage() {
  return <BillingOverviewClient />;
}
