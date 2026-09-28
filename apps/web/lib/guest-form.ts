import type { GuestInput, GuestRecord } from './guests';

import type { RsvpRecord } from './guests';

export type GuestFormValues = {
  name: string;
  email: string;
  phone: string;
  status: RsvpRecord['status'];
  partySize: number;
  notes: string;
};
export type GuestFormErrors = Partial<Record<keyof GuestFormValues, string>>;

export const emptyGuestForm: GuestFormValues = {
  name: '',
  email: '',
  phone: '',
  status: 'PENDING',
  partySize: 0,
  notes: '',
};

export const guestToForm = (guest: GuestRecord): GuestFormValues => ({
  name: guest.name,
  email: guest.email ?? '',
  phone: guest.phone ?? '',
  status: guest.rsvp?.status ?? 'PENDING',
  partySize: guest.rsvp?.attendeesCount ?? 0,
  notes: guest.rsvp?.message ?? '',
});

export function validateGuestForm(values: GuestFormValues): {
  input?: GuestInput;
  errors: GuestFormErrors;
} {
  const errors: GuestFormErrors = {};
  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  const phone = values.phone.trim();
  if (!name) errors.name = 'Name is required.';
  else if (name.length > 255) errors.name = 'Name must be 255 characters or fewer.';
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255)) {
    errors.email = 'Enter a valid email address.';
  }
  if (phone.length > 50) errors.phone = 'Phone must be 50 characters or fewer.';
  const partySize = values.status === 'ATTENDING' ? values.partySize : 0;
  if (
    values.status === 'ATTENDING' &&
    (!Number.isInteger(partySize) || partySize < 1 || partySize > 20)
  ) {
    errors.partySize = 'Enter a party size from 1 to 20.';
  }
  if (values.notes.length > 1000) errors.notes = 'Notes must be 1,000 characters or fewer.';
  return Object.keys(errors).length
    ? { errors }
    : {
        errors,
        input: {
          name,
          email: email || null,
          phone: phone || null,
          status: values.status,
          partySize,
          notes: values.notes.trim() || null,
        },
      };
}
