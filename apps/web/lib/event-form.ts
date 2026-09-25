import type { EventInput, EventRecord } from './events';

export type EventFormValues = {
  title: string;
  eventType: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  venueAddress: string;
  latitude: string;
  longitude: string;
};

export type EventFormErrors = Partial<Record<keyof EventFormValues, string>>;

export const emptyEventForm: EventFormValues = {
  title: '',
  eventType: '',
  description: '',
  eventDate: '',
  startTime: '',
  endTime: '',
  venueName: '',
  venueAddress: '',
  latitude: '',
  longitude: '',
};

export function eventToForm(event: EventRecord): EventFormValues {
  return {
    title: event.title,
    eventType: event.eventType,
    description: event.description ?? '',
    eventDate: event.eventDate,
    startTime: event.startTime ?? '',
    endTime: event.endTime ?? '',
    venueName: event.venueName ?? '',
    venueAddress: event.venueAddress ?? '',
    latitude: event.latitude?.toString() ?? '',
    longitude: event.longitude?.toString() ?? '',
  };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function coordinate(
  value: string,
  label: string,
  min: number,
  max: number
): { value: number | null; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  if (!/^-?\d+(?:\.\d{1,7})?$/.test(trimmed)) {
    return { value: null, error: `${label} must be a number with up to 7 decimal places.` };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return { value: null, error: `${label} must be between ${min} and ${max}.` };
  }
  return { value: parsed };
}

export function validateEventForm(values: EventFormValues): {
  input?: EventInput;
  errors: EventFormErrors;
} {
  const errors: EventFormErrors = {};
  const title = values.title.trim();
  const eventType = values.eventType.trim();
  if (!title) errors.title = 'Title is required.';
  else if (title.length > 255) errors.title = 'Title must be 255 characters or fewer.';
  if (!eventType) errors.eventType = 'Event type is required.';
  else if (eventType.length > 100) errors.eventType = 'Event type must be 100 characters or fewer.';
  if (!values.eventDate) errors.eventDate = 'Event date is required.';
  else if (!isCalendarDate(values.eventDate)) errors.eventDate = 'Enter a valid event date.';
  if (values.venueName.trim().length > 255)
    errors.venueName = 'Venue name must be 255 characters or fewer.';

  const latitude = coordinate(values.latitude, 'Latitude', -90, 90);
  const longitude = coordinate(values.longitude, 'Longitude', -180, 180);
  if (latitude.error) errors.latitude = latitude.error;
  if (longitude.error) errors.longitude = longitude.error;

  if (Object.keys(errors).length > 0) return { errors };
  const optional = (value: string) => value.trim() || null;
  return {
    errors,
    input: {
      title,
      eventType,
      description: optional(values.description),
      eventDate: values.eventDate,
      startTime: optional(values.startTime),
      endTime: optional(values.endTime),
      venueName: optional(values.venueName),
      venueAddress: optional(values.venueAddress),
      latitude: latitude.value,
      longitude: longitude.value,
    },
  };
}
