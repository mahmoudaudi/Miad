import type { Metadata } from 'next';
import { Suspense } from 'react';
import { UsersView } from '@/components/admin/users/UsersView';

export const metadata: Metadata = {
  title: 'Users Management — Miad Admin Portal',
  description: 'View, manage, and monitor all platform users, plans, and AI usage.',
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return (
    <Suspense>
      <UsersView />
    </Suspense>
  );
}
