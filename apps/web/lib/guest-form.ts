import type { GuestInput, GuestRecord } from './guests';

export type GuestFormValues = { name: string; email: string; phone: string };
export type GuestFormErrors = Partial<Record<keyof GuestFormValues, string>>;

export const emptyGuestForm: GuestFormValues = { name: '', email: '', phone: '' };

export const guestToForm = (guest: GuestRecord): GuestFormValues => ({
  name: guest.name,
  email: guest.email ?? '',
  phone: guest.phone ?? '',
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
  return Object.keys(errors).length
    ? { errors }
    : { errors, input: { name, email: email || null, phone: phone || null } };
}
