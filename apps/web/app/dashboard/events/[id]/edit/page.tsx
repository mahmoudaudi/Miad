import type { Metadata } from 'next';
import { EditEventClient } from '@/components/events/EditEventClient';

export const metadata: Metadata = { title: 'Edit Invitation — Miad' };

export default function EditEventPage({ params }: { params: { id: string } }) {
  return <EditEventClient eventId={params.id} />;
}
