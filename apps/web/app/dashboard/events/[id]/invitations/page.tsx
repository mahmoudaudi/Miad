import type { Metadata } from 'next';
import { InvitationsListClient } from '@/components/invitations/InvitationsListClient';

export const metadata: Metadata = { title: 'Invitation — Miad' };

export default function EventInvitationsPage({ params }: { params: { id: string } }) {
  return <InvitationsListClient eventId={params.id} />;
}
