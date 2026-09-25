import type { Metadata } from 'next';
import { CreateInvitationClient } from '@/components/invitations/CreateInvitationClient';

export const metadata: Metadata = { title: 'Create Invitation — Miad' };

export default function NewInvitationPage({ params }: { params: { id: string } }) {
  return <CreateInvitationClient eventId={params.id} />;
}
