import type { Metadata } from 'next';
import { InvitationEditorClient } from '@/components/invitations/InvitationEditorClient';

export const metadata: Metadata = { title: 'Invitation Editor — Miad' };

export default function InvitationEditorPage({ params }: { params: { id: string } }) {
  return <InvitationEditorClient invitationId={params.id} />;
}
