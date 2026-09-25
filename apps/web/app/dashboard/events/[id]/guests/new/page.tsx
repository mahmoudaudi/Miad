import type { Metadata } from 'next';
import { CreateGuestClient } from '@/components/guests/CreateGuestClient';

export const metadata: Metadata = { title: 'Add Guest — Miad' };
export default function NewGuestPage({ params }: { params: { id: string } }) {
  return <CreateGuestClient eventId={params.id} />;
}
