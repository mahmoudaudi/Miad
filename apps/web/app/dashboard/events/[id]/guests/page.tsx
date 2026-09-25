import type { Metadata } from 'next';
import { GuestsListClient } from '@/components/guests/GuestsListClient';

export const metadata: Metadata = { title: 'Guests — Miad' };
export default function GuestsPage({ params }: { params: { id: string } }) {
  return <GuestsListClient eventId={params.id} />;
}
