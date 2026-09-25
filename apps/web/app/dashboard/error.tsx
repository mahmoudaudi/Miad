'use client';
import { ErrorState } from '@/components/ui/ErrorState';

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="This page couldn’t load"
      description="Please try again. Your saved invitations are still in your workspace."
      onRetry={reset}
      backHref="/dashboard/invitations/new"
      backLabel="Back to workspace"
    />
  );
}
