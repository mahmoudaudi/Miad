import type { Metadata } from 'next';
import { NotificationsClient } from '@/components/notifications/NotificationsClient';

export const metadata: Metadata = { title: 'Notifications — Miad Admin Portal', robots: { index: false, follow: false } };

export default function AdminNotificationsPage() {
  return <NotificationsClient admin />;
}
