import type { Metadata } from 'next';
import { InvitationAnalyticsClient } from '@/components/invitations/InvitationAnalyticsClient';

export const metadata: Metadata = { title: 'Analytics — Miad' };

export default async function InvitationAnalyticsPage({ params }: { params: { id: string } }) {
  return <InvitationAnalyticsClient invitationId={params.id} />;
}
