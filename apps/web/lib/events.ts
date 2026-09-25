import { authenticatedApiClient } from './api-client';

export type EventRecord = {
  id: string;
  invitationId: string | null;
  title: string;
  eventType: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
};

export type EventInput = {
  title: string;
  eventType: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  latitude: number | null;
  longitude: number | null;
};

export const listEvents = () => authenticatedApiClient<EventRecord[]>('/events');

export const getEvent = (id: string) => authenticatedApiClient<EventRecord>(`/events/${id}`);

export const createEvent = (input: EventInput) =>
  authenticatedApiClient<EventRecord>('/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateEvent = (id: string, input: EventInput) =>
  authenticatedApiClient<EventRecord>(`/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteEvent = (id: string) =>
  authenticatedApiClient<void>(`/events/${id}`, { method: 'DELETE' });

export function formatEventDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatEventTime(start: string | null, end: string | null): string | null {
  const format = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    const date = new Date(2000, 0, 1, hours, minutes);
    return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);
  };
  if (start && end) return `${format(start)} – ${format(end)}`;
  if (start) return format(start);
  if (end) return `Ends ${format(end)}`;
  return null;
}
