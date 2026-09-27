'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { deleteEvent, EventRecord, listEvents } from '@/lib/events';
import { InvitationRecord, listInvitations } from '@/lib/invitations';
import { DeleteEventDialog } from './DeleteEventDialog';
import { EventsListState, EventsListView } from './EventsListView';

export function EventsListClient() {
  const router = useRouter();
  const [state, setState] = useState<EventsListState>({ status: 'loading' });
  const [projects, setProjects] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; invitations: InvitationRecord[] }
  >({ status: 'loading' });
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setProjects({ status: 'loading' });
    const [eventsResult, invitationsResult] = await Promise.allSettled([
      listEvents(),
      listInvitations(),
    ]);
    if (eventsResult.status === 'fulfilled') {
      setState({ status: 'ready', events: eventsResult.value });
    } else {
      if (eventsResult.reason instanceof ApiError && eventsResult.reason.status === 401) {
        router.replace('/login?next=%2Fdashboard%2Fevents');
        return;
      }
      setState({ status: 'error', message: 'Check your connection and try again.' });
    }
    if (invitationsResult.status === 'fulfilled') {
      setProjects({ status: 'ready', invitations: invitationsResult.value });
    } else if (
      invitationsResult.reason instanceof ApiError &&
      invitationsResult.reason.status === 401
    ) {
      router.replace('/login?next=%2Fdashboard%2Fevents');
    } else {
      setProjects({ status: 'error', message: 'Check your connection and try again.' });
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
        projects={projects}
        successMessage={success}
        onRetry={() => void load()}
        onRetryProjects={() => void load()}
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
