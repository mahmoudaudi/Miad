import type { Metadata } from 'next';
import Link from 'next/link';
import { PublishCommunityForm } from '@/components/community/PublishCommunityForm';

export const metadata: Metadata = { title: 'Publish to Community — Miad' };

export default function PublishCommunityPage({ params }: { params: { id: string } }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <Link href={`/dashboard/invitations/${params.id}`} className="text-label-md text-muted hover:text-ink">← Back to invitation</Link>
      <header className="mt-8"><p className="text-label-sm uppercase tracking-[0.16em] text-accent">Community</p><h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">Share this design</h1><p className="mt-3 text-body-lg text-muted">Only the design snapshot and the details below will be public. Personal event, guest, and RSVP details stay private.</p></header>
      <PublishCommunityForm invitationId={params.id} />
    </main>
  );
}
