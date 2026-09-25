import type { Metadata } from 'next';
import { GuestDetailsClient } from '@/components/guests/GuestDetailsClient';

export const metadata: Metadata = { title: 'Guest Details — Miad' };
export default function GuestPage({ params }: { params: { id: string; guestId: string } }) {
  return <GuestDetailsClient eventId={params.id} guestId={params.guestId} />;
}
