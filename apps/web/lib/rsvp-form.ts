import { getApiUrl } from './env';
import { ApiError } from './api-client';

export type RsvpStatus = 'ATTENDING' | 'NOT_ATTENDING';
export type RsvpFormValues = {
  name: string;
  status: RsvpStatus;
  attendeesCount: string;
  message: string;
};
export type RsvpFormErrors = Partial<Record<keyof RsvpFormValues, string>>;
export type PublicRsvpInput = {
  name: string;
  status: RsvpStatus;
  attendeesCount?: number;
  message: string | null;
};

export const emptyRsvpForm: RsvpFormValues = {
  name: '',
  status: 'ATTENDING',
  attendeesCount: '',
  message: '',
};

export function validateRsvpForm(values: RsvpFormValues): {
  input?: PublicRsvpInput;
  errors: RsvpFormErrors;
} {
  const errors: RsvpFormErrors = {};
  const name = values.name.trim();
  const message = values.message.trim();
  const count = values.attendeesCount === '' ? undefined : Number(values.attendeesCount);
  if (!name) errors.name = 'Name is required.';
  else if (name.length > 255) errors.name = 'Name must be 255 characters or fewer.';
  if (message.length > 1000) errors.message = 'Message must be 1,000 characters or fewer.';
  if (count !== undefined && (!Number.isInteger(count) || count < 0 || count > 20)) {
    errors.attendeesCount = 'Guest count must be between 0 and 20.';
  } else if (values.status === 'ATTENDING' && count !== undefined && count < 1) {
    errors.attendeesCount = 'Add at least one attendee.';
  } else if (values.status === 'NOT_ATTENDING' && count !== undefined && count !== 0) {
    errors.attendeesCount = 'Declined responses must use zero attendees.';
  }
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    input: {
      name,
      status: values.status,
      ...(count === undefined ? {} : { attendeesCount: count }),
      message: message || null,
    },
  };
}

export async function submitPublicRsvp(slug: string, input: PublicRsvpInput): Promise<void> {
  const base = getApiUrl().replace(/\/$/, '');
  const response = await fetch(`${base}/public/invitations/${encodeURIComponent(slug)}/rsvp`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? 'We could not record your attendance confirmation.');
    throw new ApiError(response.status, message);
  }
}
