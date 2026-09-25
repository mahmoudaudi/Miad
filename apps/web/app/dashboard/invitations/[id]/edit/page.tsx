import type { Metadata } from 'next';
import { EditInvitationClient } from '@/components/invitations/EditInvitationClient';

export const metadata: Metadata = { title: 'Edit Invitation — Miad' };

export default function EditInvitationPage({ params }: { params: { id: string } }) {
  return <EditInvitationClient invitationId={params.id} />;
}
