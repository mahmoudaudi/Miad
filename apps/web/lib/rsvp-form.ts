import { getApiUrl } from './env';
import { ApiError } from './api-client';

export type RsvpStatus = 'ATTENDING' | 'PENDING' | 'NOT_ATTENDING';
export type RsvpFormValues = {
  name: string;
  email: string;
  phone: string;
  status: RsvpStatus;
  attendeesCount: string;
  message: string;
};
export type RsvpFormErrors = Partial<Record<keyof RsvpFormValues | 'contact', string>>;
export type PublicRsvpInput = {
  name: string;
  email: string | null;
  phone: string | null;
  status: RsvpStatus;
  attendeesCount: number;
  message: string | null;
};

export const emptyRsvpForm: RsvpFormValues = {
  name: '',
  email: '',
  phone: '',
  status: 'ATTENDING',
  attendeesCount: '1',
  message: '',
};

export function validateRsvpForm(values: RsvpFormValues): {
  input?: PublicRsvpInput;
  errors: RsvpFormErrors;
} {
  const errors: RsvpFormErrors = {};
  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  const phone = values.phone.trim();
  const message = values.message.trim();
  const count = Number(values.attendeesCount);
  if (!name) errors.name = 'Name is required.';
  else if (name.length > 255) errors.name = 'Name must be 255 characters or fewer.';
  if (!email && !phone) errors.contact = 'Add an email address or phone number.';
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255)) {
    errors.email = 'Enter a valid email address.';
  }
  if (phone.length > 50) errors.phone = 'Phone must be 50 characters or fewer.';
  if (message.length > 1000) errors.message = 'Message must be 1,000 characters or fewer.';
  if (!Number.isInteger(count) || count < 0 || count > 20) {
    errors.attendeesCount = 'Guest count must be between 0 and 20.';
  } else if (values.status === 'ATTENDING' && count < 1) {
    errors.attendeesCount = 'Add at least one attendee.';
  } else if (values.status === 'NOT_ATTENDING' && count !== 0) {
    errors.attendeesCount = 'Declined responses must use zero attendees.';
  }
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    input: {
      name,
      email: email || null,
      phone: phone || null,
      status: values.status,
      attendeesCount: count,
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
