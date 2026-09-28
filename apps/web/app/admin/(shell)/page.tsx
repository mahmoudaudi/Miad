import type { Metadata } from 'next';
import { OverviewView } from '@/components/admin/overview/OverviewView';

export const metadata: Metadata = {
  title: 'Overview — Miad Admin Portal',
  description: 'Live platform overview: users, invitations, RSVPs, revenue, and AI telemetry.',
  robots: { index: false, follow: false },
};

export default function AdminOverviewPage() {
  return <OverviewView />;
}
