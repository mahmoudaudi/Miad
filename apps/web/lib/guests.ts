import { authenticatedApiClient } from './api-client';

export type RsvpRecord = {
  status: 'ATTENDING' | 'PENDING' | 'NOT_ATTENDING';
  attendeesCount: number;
  message: string | null;
  respondedAt: string | null;
};

export type GuestRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  rsvp: RsvpRecord | null;
};

export type GuestInput = { name: string; email: string | null; phone: string | null };

const base = (eventId: string) => `/events/${encodeURIComponent(eventId)}/guests`;

export const listGuests = (eventId: string) => authenticatedApiClient<GuestRecord[]>(base(eventId));

export const getGuest = (eventId: string, id: string) =>
  authenticatedApiClient<GuestRecord>(`${base(eventId)}/${encodeURIComponent(id)}`);

export const createGuest = (eventId: string, input: GuestInput) =>
  authenticatedApiClient<GuestRecord>(base(eventId), {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateGuest = (eventId: string, id: string, input: GuestInput) =>
  authenticatedApiClient<GuestRecord>(`${base(eventId)}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteGuest = (eventId: string, id: string) =>
  authenticatedApiClient<void>(`${base(eventId)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

export function rsvpLabel(status: RsvpRecord['status'] | null): string {
  if (status === 'ATTENDING') return 'Attending';
  if (status === 'PENDING') return 'Maybe';
  if (status === 'NOT_ATTENDING') return 'Declined';
  return 'Awaiting response';
}
