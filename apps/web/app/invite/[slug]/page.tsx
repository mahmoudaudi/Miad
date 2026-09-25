import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicInvitationView } from '@/components/invitations/PublicInvitationView';
import { PublicViewTracker } from '@/components/invitations/PublicViewTracker';
import { getPublicInvitation } from '@/lib/public-invitations';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const invitation = await getPublicInvitation(params.slug);
  if (!invitation) {
    return { title: 'Invitation not found — Miad', robots: { index: false, follow: false } };
  }
  if ('artifact' in invitation) {
    return {
      title: `${invitation.artifact.title} — Invitation`,
      description: invitation.artifact.description,
      robots: { index: true, follow: true },
    };
  }
  const { content } = invitation.designSpecification;
  return {
    title: `${content.title} — Invitation`,
    description: `${content.eyebrow} · ${content.dateLine}`,
    robots: { index: true, follow: true },
  };
}

export default async function PublicInvitationPage({ params }: { params: { slug: string } }) {
  const invitation = await getPublicInvitation(params.slug);
  if (!invitation) notFound();
  if ('artifact' in invitation) {
    return <><PublicViewTracker slug={params.slug} /><PublicInvitationView artifact={invitation.artifact} slug={params.slug} /></>;
  }
  return <><PublicViewTracker slug={params.slug} /><PublicInvitationView specification={invitation.designSpecification} slug={params.slug} /></>;
}
