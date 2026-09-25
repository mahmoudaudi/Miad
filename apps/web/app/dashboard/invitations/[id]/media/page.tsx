import type { Metadata } from 'next';
import { MediaLibraryClient } from '@/components/media/MediaLibraryClient';

export const metadata: Metadata = { title: 'Invitation Media — Miad' };

export default function InvitationMediaPage({ params }: { params: { id: string } }) {
  return <MediaLibraryClient invitationId={params.id} />;
}
