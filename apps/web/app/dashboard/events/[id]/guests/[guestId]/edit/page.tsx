import type { Metadata } from 'next';
import { EditGuestClient } from '@/components/guests/EditGuestClient';

export const metadata: Metadata = { title: 'Edit Guest — Miad' };
export default function EditGuestPage({ params }: { params: { id: string; guestId: string } }) {
  return <EditGuestClient eventId={params.id} guestId={params.guestId} />;
}
