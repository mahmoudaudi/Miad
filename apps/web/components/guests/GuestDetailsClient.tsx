'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { DeleteConfirmationDialog } from '@/components/dashboard/DeleteConfirmationDialog';
import { ApiError } from '@/lib/api-client';
import { deleteGuest, getGuest } from '@/lib/guests';
import { GuestDetailsState, GuestDetailsView } from './GuestDetailsView';

export function GuestDetailsClient({ eventId, guestId }: { eventId: string; guestId: string }) {
  const router = useRouter();
  const [state, setState] = useState<GuestDetailsState>({ status: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const base = `/dashboard/events/${eventId}/guests`;
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', guest: await getGuest(eventId, guestId) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        router.replace(`/login?next=${encodeURIComponent(`${base}/${guestId}`)}`);
      else if (error instanceof ApiError && error.status === 404) setState({ status: 'not-found' });
      else setState({ status: 'error', message: 'Check your connection and try again.' });
    }
  }, [base, eventId, guestId, router]);
  useEffect(() => {
    void load();
  }, [load]);
  const remove = async () => {
    if (state.status !== 'ready' || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteGuest(eventId, guestId);
      router.replace(base);
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'We could not delete this guest.');
      setDeleting(false);
    }
  };
  return (
    <>
      <GuestDetailsView
        eventId={eventId}
        state={state}
        onRetry={() => void load()}
        onDelete={() => setConfirming(true)}
      />
      {confirming && state.status === 'ready' && (
        <DeleteConfirmationDialog
          title="Delete this guest?"
          description={`“${state.guest.name}” and their attendance confirmation will be permanently removed.`}
          confirmLabel="Delete guest"
          busyLabel="Deleting…"
          busy={deleting}
          error={deleteError}
          onCancel={() => {
            if (!deleting) setConfirming(false);
          }}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}
