import type { Metadata } from 'next';
import { InvitationIndexClient } from '@/components/invitations/InvitationIndexClient';

export const metadata: Metadata = { title: 'Invitations — Miad' };

export default function InvitationsPage() {
  return <InvitationIndexClient />;
}
