import { redirect } from 'next/navigation';

export default function NewInvitationPage({ params }: { params: { id: string } }) {
  redirect('/dashboard/invitations/new');
}
