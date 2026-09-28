import { redirect } from 'next/navigation';

export default function InvitationEditorPage({ params }: { params: { id: string } }) {
  redirect(`/dashboard/invitations/new?invitationId=${encodeURIComponent(params.id)}`);
}
