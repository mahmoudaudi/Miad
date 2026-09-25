import type { Metadata } from 'next';
import { InvitationDesignClient } from '@/components/invitations/InvitationDesignClient';

export const metadata: Metadata = { title: 'Invitation Design — Miad' };

export default function InvitationDesignPage({ params }: { params: { id: string } }) {
  return <InvitationDesignClient invitationId={params.id} />;
}
