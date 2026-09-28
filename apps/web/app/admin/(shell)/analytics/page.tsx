import type { Metadata } from 'next';
import { AnalyticsView } from '@/components/admin/analytics/AnalyticsView';

export const metadata: Metadata = {
  title: 'Platform Analytics — Miad Admin Portal',
  description: 'Engagement, funnel, RSVP, AI, and device analytics from live platform data.',
  robots: { index: false, follow: false },
};

export default function AdminAnalyticsPage() {
  return <AnalyticsView />;
}
