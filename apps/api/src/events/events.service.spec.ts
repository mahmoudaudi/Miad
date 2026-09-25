import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventsService } from './events.service';

const record = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: 'owner-1',
  title: 'Garden Dinner',
  eventType: 'Dinner',
  description: null,
  eventDate: new Date('2026-10-12T00:00:00.000Z'),
  startTime: new Date('1970-01-01T18:30:00.000Z'),
  endTime: null,
  venueName: null,
  venueAddress: null,
  latitude: new Prisma.Decimal('33.8938'),
  longitude: null,
  createdAt: new Date('2026-09-20T00:00:00.000Z'),
  updatedAt: new Date('2026-09-20T00:00:00.000Z'),
};

const input = {
  title: 'Garden Dinner',
  eventType: 'Dinner',
  description: null,
  eventDate: '2026-10-12',
  startTime: '18:30',
  endTime: null,
  venueName: null,
  venueAddress: null,
  latitude: 33.8938,
  longitude: null,
};

describe('EventsService', () => {
  it('lists only the authenticated owner events in stable date order', async () => {
    let query: unknown;
    const prisma = {
      event: {
        findMany: async (args: unknown) => {
          query = args;
          return [record];
        },
      },
    };
    const result = await new EventsService(prisma as never).findAll('owner-1');
    expect(query).toMatchObject({ where: { userId: 'owner-1' } });
    expect(result[0]).toMatchObject({ eventDate: '2026-10-12', startTime: '18:30' });
    expect(result[0]).not.toHaveProperty('userId');
  });

  it('creates an event with ownership sourced from the authenticated user', async () => {
    let data: Record<string, unknown> = {};
    const prisma = {
      event: {
        create: async (args: { data: Record<string, unknown> }) => {
          data = args.data;
          return record;
        },
      },
    };
    await new EventsService(prisma as never).create('owner-1', input);
    expect(data.userId).toBe('owner-1');
    expect(data.eventDate).toEqual(new Date('2026-10-12T00:00:00.000Z'));
  });

  it('rejects impossible calendar dates before a database write', async () => {
    const service = new EventsService({ event: { create: jest.fn() } } as never);
    await expect(service.create('owner-1', { ...input, eventDate: '2026-02-30' })).rejects.toThrow(
      'valid calendar date'
    );
  });

  it('returns the same safe not-found response for missing or non-owned events', async () => {
    const service = new EventsService({ event: { findFirst: async () => null } } as never);
    await expect(service.findOne('owner-1', record.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates only a row matching both event id and owner id', async () => {
    let where: unknown;
    const prisma = {
      event: {
        updateMany: async (args: { where: unknown }) => {
          where = args.where;
          return { count: 1 };
        },
        findFirst: async () => ({ ...record, title: 'Updated' }),
      },
    };
    const result = await new EventsService(prisma as never).update('owner-1', record.id, {
      title: 'Updated',
    });
    expect(where).toEqual({ id: record.id, userId: 'owner-1' });
    expect(result.title).toBe('Updated');
  });

  it('cannot delete another user event', async () => {
    const service = new EventsService({
      event: {
        findFirst: async () => null,
        deleteMany: async () => ({ count: 0 }),
      },
    } as never);
    await expect(service.remove('owner-2', record.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes an event without invitation through a single owned delete', async () => {
    const queries: unknown[] = [];
    const prisma = {
      event: {
        findFirst: async (args: unknown) => {
          queries.push(args);
          return { id: record.id, invitation: null };
        },
        deleteMany: async (args: unknown) => {
          queries.push(args);
          return { count: 1 };
        },
      },
    };
    await new EventsService(prisma as never).remove('owner-1', record.id);
    expect(queries[0]).toMatchObject({ where: { id: record.id, userId: 'owner-1' } });
    expect(queries[1]).toMatchObject({ where: { id: record.id, userId: 'owner-1' } });
  });

  it('cascades an owned invitation subtree before deleting the event', async () => {
    const subtree: unknown[] = [];
    const prisma = {
      event: {
        findFirst: async () => ({
          id: record.id,
          invitation: { id: 'inv-1', media: [{ fileUrl: 'bucket/key' }] },
        }),
        deleteMany: async () => ({ count: 1 }),
      },
    };
    const invitations = {
      deleteInvitationSubtree: async (id: string, assets: unknown) => {
        subtree.push([id, assets]);
      },
    };
    await new EventsService(prisma as never, invitations as never).remove('owner-1', record.id);
    expect(subtree).toEqual([['inv-1', [{ fileUrl: 'bucket/key' }]]]);
  });
});
