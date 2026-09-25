import { ApiError, authenticatedApiClient } from './api-client';

export type NotificationRecord = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type NotificationListResponse = {
  items: NotificationRecord[];
  nextCursor: string | null;
};

export const listNotifications = (cursor?: string) =>
  authenticatedApiClient<NotificationListResponse>(
    `/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
  );

export const markNotificationRead = (id: string) =>
  authenticatedApiClient<NotificationRecord>(
    `/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' }
  );

export const markAllNotificationsRead = () =>
  authenticatedApiClient<{ updated: number }>('/notifications/read-all', {
    method: 'PATCH',
  });

export function isRetryableNotificationError(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status >= 500;
}

export function formatNotificationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
