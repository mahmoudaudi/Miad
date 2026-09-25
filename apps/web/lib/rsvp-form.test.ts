import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyRsvpForm, submitPublicRsvp, validateRsvpForm } from './rsvp-form';

describe('RSVP form', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requires contact details and enforces status-specific guest counts', () => {
    expect(validateRsvpForm({ ...emptyRsvpForm, name: 'Nadia' }).errors.contact).toBeTruthy();
    expect(
      validateRsvpForm({
        ...emptyRsvpForm,
        name: 'Nadia',
        email: 'n@example.com',
        status: 'NOT_ATTENDING',
        attendeesCount: '1',
      }).errors.attendeesCount
    ).toBeTruthy();
  });

  it('produces a normalized valid payload', () => {
    expect(
      validateRsvpForm({
        ...emptyRsvpForm,
        name: ' Nadia ',
        email: ' N@EXAMPLE.COM ',
        message: ' Hello ',
      }).input
    ).toMatchObject({
      name: 'Nadia',
      email: 'n@example.com',
      status: 'ATTENDING',
      attendeesCount: 1,
      message: 'Hello',
    });
  });

  it('posts anonymously and exposes safe server errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'received' }) });
    vi.stubGlobal('fetch', fetchMock);
    const input = validateRsvpForm({ ...emptyRsvpForm, name: 'Nadia', phone: '123' }).input!;
    await submitPublicRsvp('garden-party', input);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/public/invitations/garden-party/rsvp'),
      expect.objectContaining({ method: 'POST', credentials: 'omit' })
    );
  });
});
