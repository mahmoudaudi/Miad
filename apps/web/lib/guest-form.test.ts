import { describe, expect, it } from 'vitest';
import { emptyGuestForm, guestToForm, validateGuestForm } from './guest-form';

describe('guest form', () => {
  it('validates required name and email format', () => {
    expect(validateGuestForm(emptyGuestForm).errors.name).toBeTruthy();
    expect(
      validateGuestForm({ ...emptyGuestForm, name: 'Nadia', email: 'bad' }).errors.email
    ).toBeTruthy();
  });

  it('normalizes a valid guest and reopens saved values', () => {
    expect(
      validateGuestForm({
        ...emptyGuestForm,
        name: ' Nadia ',
        email: ' NADIA@EXAMPLE.COM ',
        phone: ' 123 ',
      }).input
    ).toEqual({
      name: 'Nadia',
      email: 'nadia@example.com',
      phone: '123',
      status: 'PENDING',
      partySize: 0,
      notes: null,
    });
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
    ).toEqual({
      name: 'Nadia',
      email: '',
      phone: '123',
      status: 'PENDING',
      partySize: 0,
      notes: '',
    });
  });

  it('requires a positive party size only for attending guests', () => {
    expect(
      validateGuestForm({ ...emptyGuestForm, name: 'Nadia', status: 'ATTENDING', partySize: 1 })
        .input?.partySize
    ).toBe(1);
    expect(
      validateGuestForm({ ...emptyGuestForm, name: 'Nadia', status: 'ATTENDING', partySize: 0 })
        .errors.partySize
    ).toBeTruthy();
    expect(
      validateGuestForm({ ...emptyGuestForm, name: 'Nadia', status: 'NOT_ATTENDING', partySize: 0 })
        .input?.partySize
    ).toBe(0);
  });
});
