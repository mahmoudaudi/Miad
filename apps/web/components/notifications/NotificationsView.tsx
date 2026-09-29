import React from 'react';
import { formatNotificationTime, NotificationRecord } from '@/lib/notifications';

export type NotificationsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: NotificationRecord[]; nextCursor: string | null };

type Props = {
  admin?: boolean;
  state: NotificationsState;
  saving: 'none' | 'one' | 'all';
  savingId: string | null;
  actionError: string | null;
  successMessage: string | null;
  loadingMore: boolean;
  loadMoreError: string | null;
  onRetryLoad: () => void;
  onLoadMore: () => void;
  onMarkOne: (id: string) => void;
  onMarkAll: () => void;
  onRetryAction: () => void;
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function NotificationsView({
  admin = false,
  state,
  saving,
  savingId,
  actionError,
  successMessage,
  loadingMore,
  loadMoreError,
  onRetryLoad,
  onLoadMore,
  onMarkOne,
  onMarkAll,
  onRetryAction,
}: Props) {
  const items = state.status === 'ready' ? state.items : [];
  const unreadCount = items.filter((item) => !item.isRead).length;
  const markAllBusy = saving === 'all';
  const markAllDisabled = markAllBusy || unreadCount === 0;

  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label-sm uppercase tracking-[0.16em] text-accent">In-app updates</p>
          <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
            Notifications
          </h1>
          {state.status === 'ready' && (
            <p className="miad-badge mt-3" role="status">
              {unreadCount ? `${unreadCount} unread in this view` : 'You’re all caught up'}
            </p>
          )}
          <p className="mt-3 text-body-lg text-muted">
            {admin ? 'Platform activity, newest first.' : 'Attendance confirmations from your guests, newest first.'}
          </p>
        </div>
        {state.status === 'ready' && items.length > 0 && (
          <button
            type="button"
            onClick={onMarkAll}
            disabled={markAllDisabled}
            className={`w-full shrink-0 rounded-xl px-5 py-3 text-label-md transition-colors sm:w-auto ${
              markAllDisabled
                ? 'cursor-not-allowed border border-line text-muted'
                : 'bg-primary text-white hover:bg-primary/90'
            } ${focusRing}`}
          >
            {markAllBusy ? 'Saving…' : 'Mark all as read'}
          </button>
        )}
      </div>

      {successMessage && (
        <p
          role="status"
          className="mt-8 rounded-xl border border-accent/25 bg-surface px-4 py-3 text-body-sm text-ink"
        >
          {successMessage}
        </p>
      )}
      {actionError && (
        <div
          role="alert"
          className="mt-8 flex flex-col gap-3 rounded-xl border border-error/20 bg-surface px-4 py-3 text-body-sm text-error sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={onRetryAction}
            className={`self-start rounded-lg border border-error/40 px-4 py-2 text-label-md text-error hover:bg-error/5 sm:self-auto ${focusRing}`}
          >
            Retry
          </button>
        </div>
      )}

      {state.status === 'loading' && (
        <div
          aria-busy="true"
          aria-label="Loading notifications"
          className="mt-10 animate-pulse rounded-2xl border border-line bg-surface"
        >
          <div className="h-20 border-b border-line" />
          <div className="h-20 border-b border-line" />
          <div className="h-20" />
        </div>
      )}
      {state.status === 'error' && (
        <section className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center">
          <h2 className="font-display text-headline-md text-ink">
            We could not load notifications
          </h2>
          <p role="alert" className="mt-3 text-body-md text-muted">
            {state.message}
          </p>
          <button
            type="button"
            onClick={onRetryLoad}
            className={`mt-6 rounded-xl border border-line px-5 py-3 text-label-md ${focusRing}`}
          >
            Try again
          </button>
        </section>
      )}
      {state.status === 'ready' && items.length === 0 && (
        <section className="mt-10 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-line bg-surface p-8 text-center shadow-subtle">
          <span className="material-symbols-outlined text-3xl text-accent" aria-hidden="true">
            notifications
          </span>
          <h2 className="mt-4 font-display text-headline-md text-ink">No notifications yet</h2>
          <p className="mt-3 max-w-md text-body-md text-muted">
            {admin
              ? 'New registrations and community publications will appear here.'
              : 'When guests respond to a published invitation, their attendance confirmation will appear here.'}
          </p>
        </section>
      )}
      {state.status === 'ready' && items.length > 0 && (
        <>
          <ul className="mt-10 overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle">
            {items.map((item, index) => {
              const rowBusy = saving === 'one' && savingId === item.id;
              const listBusy = saving !== 'none';
              return (
                <li
                  key={item.id}
                  className={`flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-6 ${
                    index > 0 ? 'border-t border-line' : ''
                  } ${item.isRead ? '' : 'bg-primary/[0.04]'}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      {!item.isRead && (
                        <span
                          className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0">
                        <p
                          className={`break-words text-body-md text-ink ${
                            item.isRead ? 'font-normal' : 'font-semibold'
                          }`}
                        >
                          {item.title}
                          {!item.isRead && <span className="sr-only"> (unread)</span>}
                        </p>
                        <p className="mt-1 break-words text-body-sm text-muted">{item.message}</p>
                        <time dateTime={item.createdAt} className="mt-2 block text-xs text-muted">
                          {formatNotificationTime(item.createdAt)}
                        </time>
                      </div>
                    </div>
                  </div>
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={() => onMarkOne(item.id)}
                      disabled={listBusy}
                      className={`w-full shrink-0 rounded-lg border border-line px-4 py-2 text-label-md text-ink hover:border-muted disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${focusRing}`}
                    >
                      {rowBusy ? 'Saving…' : 'Mark as read'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {loadMoreError && (
            <p role="alert" className="mt-4 text-body-sm text-error">
              {loadMoreError}
            </p>
          )}
          {state.nextCursor && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className={`rounded-xl border border-line px-5 py-3 text-label-md text-ink hover:border-muted disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
