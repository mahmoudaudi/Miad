'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import {
  isRetryableNotificationError,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationRecord,
} from '@/lib/notifications';
import { NotificationsState, NotificationsView } from './NotificationsView';

type PendingAction = { kind: 'one'; id: string } | { kind: 'all' };

export function NotificationsClient() {
  const router = useRouter();
  const loaded = useRef(false);
  const pendingRef = useRef<PendingAction | null>(null);
  const runningRef = useRef(false);
  const [state, setState] = useState<NotificationsState>({ status: 'loading' });
  const [saving, setSaving] = useState<'none' | 'one' | 'all'>('none');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const path = '/dashboard/notifications';

  const redirectToLogin = useCallback(() => {
    router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [path, router]);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setLoadMoreError(null);
    try {
      const page = await listNotifications();
      setState({ status: 'ready', items: page.items, nextCursor: page.nextCursor });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) redirectToLogin();
      else setState({ status: 'error', message: 'Check your connection and try again.' });
    }
  }, [redirectToLogin]);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void load();
  }, [load]);

  const runAction = useCallback(
    async (action: PendingAction) => {
      if (runningRef.current) return;
      runningRef.current = true;
      pendingRef.current = action;
      setActionError(null);
      setSuccessMessage(null);
      setSaving(action.kind === 'all' ? 'all' : 'one');
      setSavingId(action.kind === 'one' ? action.id : null);
      try {
        if (action.kind === 'one') {
          const updated = await markNotificationRead(action.id);
          setState((current) =>
            current.status === 'ready'
              ? {
                  status: 'ready',
                  items: current.items.map((item: NotificationRecord) =>
                    item.id === updated.id ? updated : item
                  ),
                  nextCursor: current.nextCursor,
                }
              : current
          );
          setSuccessMessage('Marked as read.');
        } else {
          const result = await markAllNotificationsRead();
          setState((current) =>
            current.status === 'ready'
              ? {
                  status: 'ready',
                  items: current.items.map((item: NotificationRecord) =>
                    item.isRead ? item : { ...item, isRead: true }
                  ),
                  nextCursor: current.nextCursor,
                }
              : current
          );
          setSuccessMessage(
            result.updated === 1
              ? 'Marked 1 notification as read.'
              : `Marked ${result.updated} notifications as read.`
          );
        }
        pendingRef.current = null;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          redirectToLogin();
          return;
        }
        if (error instanceof ApiError && error.status === 404 && action.kind === 'one') {
          // Already gone — reflect that locally and finish successfully.
          setState((current) =>
            current.status === 'ready'
              ? {
                  status: 'ready',
                  items: current.items.filter((item) => item.id !== action.id),
                  nextCursor: current.nextCursor,
                }
              : current
          );
          pendingRef.current = null;
          setSuccessMessage('Marked as read.');
          return;
        }
        const retryable = isRetryableNotificationError(error);
        setActionError(
          error instanceof ApiError
            ? error.message
            : 'We could not update this notification. Please try again.'
        );
        if (!retryable) pendingRef.current = null;
      } finally {
        setSaving('none');
        setSavingId(null);
        runningRef.current = false;
      }
    },
    [redirectToLogin]
  );

  const onLoadMore = useCallback(async () => {
    if (state.status !== 'ready' || !state.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await listNotifications(state.nextCursor);
      setState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              items: [
                ...current.items,
                ...page.items.filter(
                  (item) => !current.items.some((existing) => existing.id === item.id)
                ),
              ],
              nextCursor: page.nextCursor,
            }
          : current
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) redirectToLogin();
      else setLoadMoreError('We could not load more notifications. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, redirectToLogin, state]);

  const onRetryAction = useCallback(() => {
    const action = pendingRef.current;
    if (action) void runAction(action);
  }, [runAction]);

  return (
    <NotificationsView
      state={state}
      saving={saving}
      savingId={savingId}
      actionError={actionError}
      successMessage={successMessage}
      loadingMore={loadingMore}
      loadMoreError={loadMoreError}
      onRetryLoad={() => void load()}
      onLoadMore={() => void onLoadMore()}
      onMarkOne={(id) => void runAction({ kind: 'one', id })}
      onMarkAll={() => void runAction({ kind: 'all' })}
      onRetryAction={onRetryAction}
    />
  );
}
