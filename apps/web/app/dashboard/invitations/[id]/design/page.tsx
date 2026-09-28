import { redirect } from 'next/navigation';

export default function InvitationDesignPage({ params }: { params: { id: string } }) {
  redirect(`/dashboard/invitations/new?invitationId=${encodeURIComponent(params.id)}`);
}
