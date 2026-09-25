import type { Metadata } from 'next';
import { AiStudioClient } from '@/components/invitations/AiStudioClient';

export const metadata: Metadata = { title: 'AI Studio — Miad' };

export default function NewInvitationPage() {
  return <AiStudioClient />;
}
