'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { deleteEvent, getEvent } from '@/lib/events';
import { DeleteEventDialog } from './DeleteEventDialog';
import { EventDetailsState, EventDetailsView } from './EventDetailsView';

export function EventDetailsClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, setState] = useState<EventDetailsState>({ status: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', event: await getEvent(eventId) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/dashboard/events/${eventId}`)}`);
      } else if (error instanceof ApiError && error.status === 404) {
        setState({ status: 'not-found' });
      } else {
        setState({ status: 'error', message: 'Check your connection and try again.' });
      }
    }
  }, [eventId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove() {
    if (state.status !== 'ready' || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteEvent(state.event.id);
      router.replace('/dashboard/events');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/dashboard/events/${eventId}`)}`);
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

  return (
    <>
      <EventDetailsView
        state={state}
        onRetry={() => void load()}
        onDelete={() => setConfirming(true)}
      />
      {confirming && state.status === 'ready' && (
        <DeleteEventDialog
          eventTitle={state.event.title}
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
