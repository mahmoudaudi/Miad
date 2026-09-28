import type { Metadata } from 'next';
import { BillingView } from '@/components/admin/billing/BillingView';

export const metadata: Metadata = {
  title: 'Billing & Subscriptions — Miad Admin Portal',
  description: 'Monitor platform revenue, subscriptions, tiers, and payment transactions.',
  robots: { index: false, follow: false },
};

export default function AdminBillingPage() {
  return <BillingView />;
}
