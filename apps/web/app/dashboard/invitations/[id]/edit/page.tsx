import { redirect } from 'next/navigation';

export default function EditInvitationPage({ params }: { params: { id: string } }) {
  redirect(`/dashboard/invitations/new?invitationId=${encodeURIComponent(params.id)}`);
}
