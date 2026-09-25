'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { deleteInvitation, InvitationRecord, listInvitations } from '@/lib/invitations';
import { DeleteInvitationDialog } from './DeleteInvitationDialog';
import { InvitationsListState, InvitationsListView } from './InvitationsListView';

export function InvitationsListClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, setState] = useState<InvitationsListState>({ status: 'loading' });
  const [selected, setSelected] = useState<InvitationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', invitations: await listInvitations(eventId) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(`/dashboard/events/${eventId}/invitations`)}`
        );
        return;
      }
      setState({ status: 'error', message: 'Check your connection and try again.' });
    }
  }, [eventId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove() {
    if (!selected || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteInvitation(selected.id);
      setState({ status: 'ready', invitations: [] });
      setSuccess(`“${selected.slug}” was deleted.`);
      setSelected(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(`/dashboard/events/${eventId}/invitations`)}`
        );
        return;
      }
      setDeleteError(
        error instanceof ApiError
          ? error.message
          : 'We could not delete this invitation. Please try again.'
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <InvitationsListView
        eventId={eventId}
        state={state}
        successMessage={success}
        onRetry={() => void load()}
        onDelete={(invitation) => {
          setSuccess(null);
          setDeleteError(null);
          setSelected(invitation);
        }}
      />
      {selected && (
        <DeleteInvitationDialog
          slug={selected.slug}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            if (!deleting) setSelected(null);
          }}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}
