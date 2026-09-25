import type { Metadata } from 'next';
import { EventDetailsClient } from '@/components/events/EventDetailsClient';

export const metadata: Metadata = { title: 'Invitation Details — Miad' };

export default function EventPage({ params }: { params: { id: string } }) {
  return <EventDetailsClient eventId={params.id} />;
}
