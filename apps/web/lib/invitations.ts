import { authenticatedApiClient } from './api-client';

export type InvitationRecord = {
  id: string;
  eventId: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  publishedDesignVersion?: number | null;
  createdAt: string;
  updatedAt: string;
  hasDesign: boolean;
  event: { id: string; title: string; eventDate: string };
};

export const listInvitations = (eventId?: string) =>
  authenticatedApiClient<InvitationRecord[]>(
    `/invitations${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`
  );

export const getInvitation = (id: string) =>
  authenticatedApiClient<InvitationRecord>(`/invitations/${id}`);

export const createInvitation = (input: { eventId: string; slug: string }) =>
  authenticatedApiClient<InvitationRecord>('/invitations', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateInvitation = (id: string, input: { slug: string }) =>
  authenticatedApiClient<InvitationRecord>(`/invitations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const updateInvitationPublication = (id: string, published: boolean) =>
  authenticatedApiClient<InvitationRecord>(`/invitations/${id}/publication`, {
    method: 'PATCH',
    body: JSON.stringify({ published }),
  });

export const deleteInvitation = (id: string) =>
  authenticatedApiClient<void>(`/invitations/${id}`, { method: 'DELETE' });
