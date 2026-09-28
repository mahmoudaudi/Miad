import { describe, expect, it } from 'vitest';
import { filterInvitationGuests, summarizeInvitationGuests } from './InvitationGuestsClient';
import type { GuestRecord } from '@/lib/guests';

const records: GuestRecord[] = [
  {
    id: '1',
    name: 'Zara',
    email: 'zara@example.com',
    phone: null,
    createdAt: '2026-09-02',
    updatedAt: '',
    rsvp: { status: 'ATTENDING', attendeesCount: 3, message: null, respondedAt: null },
  },
  {
    id: '2',
    name: 'Adam',
    email: null,
    phone: '+961 70 123',
    createdAt: '2026-09-01',
    updatedAt: '',
    rsvp: null,
  },
  {
    id: '3',
    name: 'Mira',
    email: null,
    phone: null,
    createdAt: '2026-09-03',
    updatedAt: '',
    rsvp: { status: 'NOT_ATTENDING', attendeesCount: 0, message: null, respondedAt: null },
  },
];

describe('invitation guest list controls', () => {
  it('counts guest statuses and expected attendees using party size', () => {
    expect(summarizeInvitationGuests(records)).toEqual({
      total: 3,
      pending: 1,
      attending: 1,
      declined: 1,
      expected: 3,
    });
  });

  it('searches across names and contact fields', () => {
    expect(
      filterInvitationGuests(records, 'zara@', 'ALL', 'newest').map((guest) => guest.id)
    ).toEqual(['1']);
    expect(
      filterInvitationGuests(records, '+961', 'ALL', 'newest').map((guest) => guest.id)
    ).toEqual(['2']);
  });

  it('filters pending guests, including manual guests without an RSVP row', () => {
    expect(
      filterInvitationGuests(records, '', 'PENDING', 'newest').map((guest) => guest.id)
    ).toEqual(['2']);
  });

  it('sorts by name and creation date', () => {
    expect(filterInvitationGuests(records, '', 'ALL', 'name').map((guest) => guest.name)).toEqual([
      'Adam',
      'Mira',
      'Zara',
    ]);
    expect(filterInvitationGuests(records, '', 'ALL', 'oldest').map((guest) => guest.id)).toEqual([
      '2',
      '1',
      '3',
    ]);
  });
});
