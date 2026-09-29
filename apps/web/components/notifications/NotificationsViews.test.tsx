import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NotificationsView } from './NotificationsView';

const noop = () => undefined;
const unread = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'RSVP_RECEIVED',
  title: 'New attendance confirmation from Nadia',
  message: 'Nadia responded: Attending.',
  isRead: false,
  createdAt: '2026-09-23T10:30:00.000Z',
};
const read = {
  id: '22222222-2222-4222-8222-222222222222',
  type: 'RSVP_RECEIVED',
  title: 'New attendance confirmation from Omar',
  message: 'Omar responded: Not attending.',
  isRead: true,
  createdAt: '2026-09-22T09:00:00.000Z',
};

function render(overrides: Partial<React.ComponentProps<typeof NotificationsView>> = {}) {
  return renderToStaticMarkup(
    <NotificationsView
      state={{ status: 'ready', items: [unread, read], nextCursor: null }}
      saving="none"
      savingId={null}
      actionError={null}
      successMessage={null}
      loadingMore={false}
      loadMoreError={null}
      onRetryLoad={noop}
      onLoadMore={noop}
      onMarkOne={noop}
      onMarkAll={noop}
      onRetryAction={noop}
      {...overrides}
    />
  );
}

describe('notifications view', () => {
  it('renders the loading skeleton and the error state with a real retry', () => {
    const loading = render({ state: { status: 'loading' } });
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('Loading notifications');
    const error = render({ state: { status: 'error', message: 'Offline' } });
    expect(error).toContain('Offline');
    expect(error).toContain('We could not load notifications');
    expect(error).toContain('Try again');
  });

  it('renders a genuine empty state when there are no notifications', () => {
    const html = render({ state: { status: 'ready', items: [], nextCursor: null } });
    expect(html).toContain('No notifications yet');
    expect(html).toContain('published invitation');
    expect(html).not.toContain('Mark all as read');
    expect(html).not.toContain('Mark as read');
  });

  it('explains which activity fills the admin inbox', () => {
    const html = render({ admin: true, state: { status: 'ready', items: [], nextCursor: null } });
    expect(html).toContain('New registrations and community publications');
    expect(html).not.toContain('When guests respond');
  });

  it('renders notification rows with read/unread presentation and safe text wrapping', () => {
    const html = render();
    expect(html).toContain('New attendance confirmation from Nadia');
    expect(html).toContain('Nadia responded: Attending.');
    expect(html).toContain('New attendance confirmation from Omar');
    expect(html).toContain('(unread)');
    expect(html).toContain('font-semibold');
    expect(html).toContain('break-words');
    expect(html).toContain('Sep 23, 2026');
    // Unread row gets the marker + per-row action; read row gets neither.
    expect(html).toContain('Mark as read');
    expect(html.match(/Mark as read/g)).toHaveLength(1);
    expect(html).toContain('bg-primary/[0.04]');
  });

  it('offers mark-all only when something is unread and disables it otherwise', () => {
    const withUnread = render();
    expect(withUnread).toContain('Mark all as read');
    expect(withUnread).not.toContain('disabled=""');

    // Nothing unread → disabled (plan: hide or disable), no per-row actions.
    const allRead = render({ state: { status: 'ready', items: [read], nextCursor: null } });
    expect(allRead).toContain('Mark all as read');
    expect(allRead).toContain('disabled=""');
    expect(allRead).not.toContain('Mark as read');

    const busy = render({ saving: 'all' });
    expect(busy).toContain('Saving…');
    expect(busy).toContain('disabled=""');
  });

  it('disables in-flight row actions and shows success/action-error with retry', () => {
    const rowBusy = render({ saving: 'one', savingId: unread.id });
    expect(rowBusy).toContain('Saving…');
    expect(rowBusy).toContain('disabled=""');

    const success = render({ successMessage: 'Marked as read.' });
    expect(success).toContain('role="status"');
    expect(success).toContain('Marked as read.');

    const failed = render({ actionError: 'We could not update this notification.' });
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('Retry');
    expect(failed).toContain('We could not update this notification.');
  });

  it('renders pagination only when a next page exists and surfaces load-more failures', () => {
    const more = render({ state: { status: 'ready', items: [unread], nextCursor: 'cursor' } });
    expect(more).toContain('Load more');
    const loading = render({
      state: { status: 'ready', items: [unread], nextCursor: 'cursor' },
      loadingMore: true,
    });
    expect(loading).toContain('Loading…');
    const failed = render({
      state: { status: 'ready', items: [unread], nextCursor: 'cursor' },
      loadMoreError: 'We could not load more notifications. Please try again.',
    });
    expect(failed).toContain('We could not load more notifications. Please try again.');
    const done = render({ state: { status: 'ready', items: [unread], nextCursor: null } });
    expect(done).not.toContain('Load more');
  });

  it('renders the page heading with an unread count from loaded notifications', () => {
    const html = render();
    expect(html).toContain('Notifications');
    expect(html).toContain('Attendance confirmations from your guests');
    expect(html).toContain('1 unread in this view');
  });
});
