import { authenticatedApiClient } from './api-client';
import { getApiUrl } from './env';

export type InvitationAnalytics = {
  views: number;
  uniqueVisitors: number;
  rsvps: number;
  attending: number;
  notAttending: number;
  pending: number;
  attendingGuests: number;
};

export const getInvitationAnalytics = (invitationId: string) =>
  authenticatedApiClient<InvitationAnalytics>(`/invitations/${invitationId}/analytics`);

export async function recordPublicView(slug: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const key = `miad:view:${slug}`;
  let sessionIdentifier = window.sessionStorage.getItem(key);
  if (!sessionIdentifier) {
    sessionIdentifier = crypto.randomUUID();
    window.sessionStorage.setItem(key, sessionIdentifier);
  }
  const deviceType = window.matchMedia('(max-width: 640px)').matches
    ? 'mobile'
    : window.matchMedia('(max-width: 1024px)').matches
      ? 'tablet'
      : 'desktop';
  const base = getApiUrl().replace(/\/$/, '');
  await fetch(`${base}/public/invitations/${encodeURIComponent(slug)}/view`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionIdentifier, deviceType }),
    keepalive: true,
  });
}
