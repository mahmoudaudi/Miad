'use client';

import React from 'react';
import { DeleteConfirmationDialog } from '@/components/dashboard/DeleteConfirmationDialog';

type Props = {
  slug: string;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteInvitationDialog({ slug, deleting, error, onCancel, onConfirm }: Props) {
  return (
    <DeleteConfirmationDialog
      title="Delete this invitation?"
      description={`The invitation “${slug}” will be permanently removed. This cannot be undone.`}
      confirmLabel="Delete invitation"
      busyLabel="Deleting…"
      busy={deleting}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
