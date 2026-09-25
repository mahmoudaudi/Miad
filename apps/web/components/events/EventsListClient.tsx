'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { deleteEvent, EventRecord, listEvents } from '@/lib/events';
import { DeleteEventDialog } from './DeleteEventDialog';
import { EventsListState, EventsListView } from './EventsListView';

export function EventsListClient() {
  const router = useRouter();
  const [state, setState] = useState<EventsListState>({ status: 'loading' });
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', events: await listEvents() });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login?next=%2Fdashboard%2Fevents');
        return;
      }
      setState({ status: 'error', message: 'Check your connection and try again.' });
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmDelete() {
    if (!selected || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteEvent(selected.id);
      setState((current) =>
        current.status === 'ready'
          ? { ...current, events: current.events.filter((event) => event.id !== selected.id) }
          : current
      );
      setSuccess(`“${selected.title}” was deleted.`);
      setSelected(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login?next=%2Fdashboard%2Fevents');
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
      <EventsListView
        state={state}
        successMessage={success}
        onRetry={() => void load()}
        onDelete={(event) => {
          setSuccess(null);
          setDeleteError(null);
          setSelected(event);
        }}
      />
      {selected && (
        <DeleteEventDialog
          eventTitle={selected.title}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            if (!deleting) setSelected(null);
          }}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </>
  );
}
