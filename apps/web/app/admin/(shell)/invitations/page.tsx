import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InvitationsView } from '@/components/admin/invitations/InvitationsView';

export const metadata: Metadata = {
  title: 'Invitations Directory — Miad Admin Portal',
  description: 'Manage event websites, deployment status, and RSVP traffic.',
  robots: { index: false, follow: false },
};

export default function AdminInvitationsPage() {
  return (
    <Suspense>
      <InvitationsView />
    </Suspense>
  );
}
