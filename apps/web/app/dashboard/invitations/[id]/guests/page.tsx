import type { Metadata } from 'next';
import { InvitationGuestsClient } from '@/components/guests/InvitationGuestsClient';

export const metadata: Metadata = { title: 'Guests — Miad' };

export default function InvitationGuestsPage({ params }: { params: { id: string } }) {
  return <InvitationGuestsClient invitationId={params.id} />;
}
