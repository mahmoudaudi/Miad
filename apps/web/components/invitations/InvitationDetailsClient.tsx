'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { deleteEvent } from '@/lib/events';
import { deleteInvitation, getInvitation, updateInvitationPublication } from '@/lib/invitations';
import { deleteMyCommunityDesign, getMyCommunityDesignForInvitation, type CommunityDesignRecord } from '@/lib/community';
import { DeleteConfirmationDialog } from '@/components/dashboard/DeleteConfirmationDialog';
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
  const [communityDesign, setCommunityDesign] = useState<CommunityDesignRecord | null>(null);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [confirmingCommunityDelete, setConfirmingCommunityDelete] = useState(false);
  const [deletingCommunity, setDeletingCommunity] = useState(false);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setPublicationError(null);
    setPublicationSuccess(null);
    setCommunityError(null);
    try {
      const invitation = await getInvitation(invitationId);
      setState({ status: 'ready', invitation });
      try {
        setCommunityDesign(await getMyCommunityDesignForInvitation(invitationId));
      } catch {
        setCommunityError('Could not load community status. Try again.');
      }
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

  async function removeFromCommunity() {
    if (!communityDesign || deletingCommunity) return;
    setDeletingCommunity(true);
    setCommunityError(null);
    try {
      await deleteMyCommunityDesign(communityDesign.id);
      setCommunityDesign(null);
      setConfirmingCommunityDelete(false);
      router.refresh();
    } catch (error) {
      setCommunityError(error instanceof ApiError ? error.message : 'Could not remove this design from the community.');
    } finally {
      setDeletingCommunity(false);
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
        communityDesign={communityDesign}
        communityError={communityError}
        onRemoveFromCommunity={() => setConfirmingCommunityDelete(true)}

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
      {confirmingCommunityDelete && communityDesign && (
        <DeleteConfirmationDialog
          title="Remove from Community?"
          description={`“${communityDesign.title}” will be deleted from the Community showcase. Your original invitation and its public link will not be affected.`}
          confirmLabel="Remove from Community"
          busyLabel="Removing…"
          busy={deletingCommunity}
          error={communityError}
          onCancel={() => { if (!deletingCommunity) setConfirmingCommunityDelete(false); }}
          onConfirm={() => void removeFromCommunity()}
        />
      )}
    </>
  );
}
