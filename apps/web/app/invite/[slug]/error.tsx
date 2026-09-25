'use client';
import { ErrorState } from '@/components/ui/ErrorState';

export default function InvitationError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="The invitation couldn’t load"
      description="There may be a temporary connection problem. Please try again in a moment."
      onRetry={reset}
      backHref="/"
      backLabel="Miad home"
    />
  );
}
