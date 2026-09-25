import type { Metadata } from 'next';
import { CreateEventClient } from '@/components/events/CreateEventClient';

export const metadata: Metadata = { title: 'Create Invitation — Miad' };

export default function NewEventPage() {
  return <CreateEventClient />;
}
