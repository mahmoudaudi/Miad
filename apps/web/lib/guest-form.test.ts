import { describe, expect, it } from 'vitest';
import { emptyGuestForm, guestToForm, validateGuestForm } from './guest-form';

describe('guest form', () => {
  it('validates required name and email format', () => {
    expect(validateGuestForm(emptyGuestForm).errors.name).toBeTruthy();
    expect(validateGuestForm({ name: 'Nadia', email: 'bad', phone: '' }).errors.email).toBeTruthy();
  });

  it('normalizes a valid guest and reopens saved values', () => {
    expect(
      validateGuestForm({ name: ' Nadia ', email: ' NADIA@EXAMPLE.COM ', phone: ' 123 ' }).input
    ).toEqual({ name: 'Nadia', email: 'nadia@example.com', phone: '123' });
    expect(
      guestToForm({
        id: 'guest-1',
        name: 'Nadia',
        email: null,
        phone: '123',
        createdAt: '',
        updatedAt: '',
        rsvp: null,
      })
    ).toEqual({ name: 'Nadia', email: '', phone: '123' });
  });
});
