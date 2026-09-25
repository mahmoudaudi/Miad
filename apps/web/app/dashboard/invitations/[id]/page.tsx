import type { Metadata } from 'next';
import { InvitationDetailsClient } from '@/components/invitations/InvitationDetailsClient';

export const metadata: Metadata = { title: 'Invitation Details — Miad' };

export default function InvitationPage({ params }: { params: { id: string } }) {
  return <InvitationDetailsClient invitationId={params.id} />;
}
