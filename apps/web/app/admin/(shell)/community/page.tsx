import type { Metadata } from 'next';
import { CommunityView } from '@/components/admin/community/CommunityView';

export const metadata: Metadata = {
  title: 'Community Moderation — Miad Admin Portal',
  description: 'Curate public invitation designs and monitor showcase engagement.',
  robots: { index: false, follow: false },
};

export default function AdminCommunityPage() {
  return <CommunityView />;
}
