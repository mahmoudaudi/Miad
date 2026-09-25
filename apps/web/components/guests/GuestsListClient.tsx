'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { deleteGuest, GuestRecord, listGuests } from '@/lib/guests';
import { DeleteConfirmationDialog } from '@/components/dashboard/DeleteConfirmationDialog';
import { GuestsListState, GuestsListView } from './GuestsListView';

export function GuestsListClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, setState] = useState<GuestsListState>({ status: 'loading' });
  const [selected, setSelected] = useState<GuestRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const path = `/dashboard/events/${eventId}/guests`;
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', guests: await listGuests(eventId) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        router.replace(`/login?next=${encodeURIComponent(path)}`);
      else if (error instanceof ApiError && error.status === 404) setState({ status: 'not-found' });
      else setState({ status: 'error', message: 'Check your connection and try again.' });
    }
  }, [eventId, path, router]);
  useEffect(() => {
    void load();
  }, [load]);
  const remove = async () => {
    if (!selected || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteGuest(eventId, selected.id);
      setState((current) =>
        current.status === 'ready'
          ? { ...current, guests: current.guests.filter((guest) => guest.id !== selected.id) }
          : current
      );
      setSuccess(`“${selected.name}” was deleted.`);
      setSelected(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        router.replace(`/login?next=${encodeURIComponent(path)}`);
      else
        setDeleteError(
          error instanceof ApiError ? error.message : 'We could not delete this guest.'
        );
    } finally {
      setDeleting(false);
    }
  };
  return (
    <>
      <GuestsListView
        eventId={eventId}
        state={state}
        successMessage={success}
        onRetry={() => void load()}
        onDelete={(guest) => {
          setSuccess(null);
          setDeleteError(null);
          setSelected(guest);
        }}
      />
      {selected && (
        <DeleteConfirmationDialog
          title="Delete this guest?"
          description={`“${selected.name}” and their attendance confirmation will be permanently removed.`}
          confirmLabel="Delete guest"
          busyLabel="Deleting…"
          busy={deleting}
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
