'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { deleteEvent } from '@/lib/events';
import { deleteInvitation, getInvitation, updateInvitationPublication } from '@/lib/invitations';
import { DeleteInvitationDialog } from './DeleteInvitationDialog';
import { InvitationDetailsState, InvitationDetailsView } from './InvitationDetailsView';

export function InvitationDetailsClient({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const loaded = useRef(false);
  const [state, setState] = useState<InvitationDetailsState>({ status: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publicationError, setPublicationError] = useState<string | null>(null);
  const [publicationSuccess, setPublicationSuccess] = useState<string | null>(null);
  const [publicOrigin, setPublicOrigin] = useState('');

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setPublicationError(null);
    setPublicationSuccess(null);
    try {
      setState({ status: 'ready', invitation: await getInvitation(invitationId) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(`/dashboard/invitations/${invitationId}`)}`
        );
      } else if (error instanceof ApiError && error.status === 404) {
        setState({ status: 'not-found' });
      } else {
        setState({ status: 'error', message: 'Check your connection and try again.' });
      }
    }
  }, [invitationId, router]);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setPublicOrigin(window.location.origin);
    void load();
  }, [load]);

  async function remove() {
    if (state.status !== 'ready' || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteInvitation(state.invitation.id);
      await deleteEvent(state.invitation.eventId);
      router.replace('/dashboard/invitations');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(`/dashboard/invitations/${invitationId}`)}`
        );
        return;
      }
      setDeleteError(
        error instanceof ApiError
          ? error.message
          : 'We could not delete this invitation. Please try again.'
      );
      setDeleting(false);
    }
  }

  async function setPublication(published: boolean) {
    if (state.status !== 'ready' || publishing) return;
    setPublishing(true);
    setPublicationError(null);
    setPublicationSuccess(null);
    try {
      const invitation = await updateInvitationPublication(state.invitation.id, published);
      setState({ status: 'ready', invitation });
      setPublicationSuccess(published ? 'Invitation published.' : 'Invitation unpublished.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(`/dashboard/invitations/${invitationId}`)}`
        );
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        setState({ status: 'not-found' });
        return;
      }
      setPublicationError(
        error instanceof ApiError
          ? error.message
          : 'We could not update publication. Please try again.'
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <InvitationDetailsView
        state={state}
        publishing={publishing}
        publicationError={publicationError}
        publicationSuccess={publicationSuccess}
        publicOrigin={publicOrigin}
        onRetry={() => void load()}
        onDelete={() => setConfirming(true)}
        onPublicationChange={(published) => void setPublication(published)}

      />
      {confirming && state.status === 'ready' && (
        <DeleteInvitationDialog
          slug={state.invitation.slug}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            if (!deleting) {
              setConfirming(false);
              setDeleteError(null);
            }
          }}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}
