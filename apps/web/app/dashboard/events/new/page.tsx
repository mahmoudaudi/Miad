import { redirect } from 'next/navigation';

export default function NewEventPage() {
  redirect('/dashboard/invitations/new');
}
