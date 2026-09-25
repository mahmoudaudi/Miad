import type { Metadata } from 'next';
import { EventsListClient } from '@/components/events/EventsListClient';

export const metadata: Metadata = { title: 'Invitations — Miad' };

export default function EventsPage() {
  return <EventsListClient />;
}
