import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyRsvpForm, submitPublicRsvp, validateRsvpForm } from './rsvp-form';

describe('RSVP form', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requires only a full name and enforces status-specific guest counts', () => {
    expect(validateRsvpForm({ ...emptyRsvpForm }).errors.name).toBeTruthy();
    expect(validateRsvpForm({ ...emptyRsvpForm, name: 'Nadia' }).input).toEqual({
      name: 'Nadia',
      status: 'ATTENDING',
      message: null,
    });
    expect(
      validateRsvpForm({
        ...emptyRsvpForm,
        name: 'Nadia',
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
        attendeesCount: '2',
        message: ' Hello ',
      }).input
    ).toMatchObject({
      name: 'Nadia',
      status: 'ATTENDING',
      attendeesCount: 2,
      message: 'Hello',
    });
  });

  it('posts anonymously and exposes safe server errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'received' }) });
    vi.stubGlobal('fetch', fetchMock);
    const input = validateRsvpForm({ ...emptyRsvpForm, name: 'Nadia' }).input!;
    await submitPublicRsvp('garden-party', input);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/public/invitations/garden-party/rsvp'),
      expect.objectContaining({ method: 'POST', credentials: 'omit' })
    );
  });
});
