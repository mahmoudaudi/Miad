import type { Metadata } from 'next';
import { NotificationsClient } from '@/components/notifications/NotificationsClient';

export const metadata: Metadata = { title: 'Notifications — Miad' };

export default function NotificationsPage() {
  return <NotificationsClient />;
}
