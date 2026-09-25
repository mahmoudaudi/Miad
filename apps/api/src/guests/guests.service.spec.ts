import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { GuestsService } from './guests.service';

const now = new Date('2026-09-21T12:00:00.000Z');
const guest = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Nadia',
  email: 'nadia@example.com',
  phone: null,
  createdAt: now,
  updatedAt: now,
  rsvp: null,
};

type NotificationCall = { userId: string; guestName: string; status: string };

function notificationsMock(overrides: Partial<Record<string, unknown>> = {}) {
  const calls: NotificationCall[] = [];
  const service = {
    createRsvpNotification: async (tx: { notification: { create: (args: unknown) => Promise<unknown> } }, input: NotificationCall) => {
      calls.push(input);
      await tx.notification.create({
        data: {
          userId: input.userId,
          type: 'RSVP_RECEIVED',
          title: `New attendance confirmation from ${input.guestName}`,
          message: `${input.guestName} responded: ${input.status}.`,
          isRead: false,
        },
      });
    },
    ...overrides,
  };
  return { service: service as never, calls };
}

/** Runs the interactive $transaction callback with snapshot/rollback semantics. */
function transactionalPrisma(options: {
  invitation?: Record<string, unknown> | null;
  guestMatches?: Array<{ id: string; rsvp: { id: string } | null }>;
  onNotificationCreate?: () => void;
}) {
  const staging = {
    guestCreates: [] as unknown[],
    rsvpCreates: [] as unknown[],
    notificationCreates: [] as unknown[],
  };
  const committed = {
    guestCreates: [] as unknown[],
    rsvpCreates: [] as unknown[],
    notificationCreates: [] as unknown[],
  };
  const snapshot = () => ({
    guestCreates: [...staging.guestCreates],
    rsvpCreates: [...staging.rsvpCreates],
    notificationCreates: [...staging.notificationCreates],
  });
  const restore = (snap: ReturnType<typeof snapshot>) => {
    staging.guestCreates = [...snap.guestCreates];
    staging.rsvpCreates = [...snap.rsvpCreates];
    staging.notificationCreates = [...snap.notificationCreates];
  };

  const prisma = {
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      const before = snapshot();
      const tx = {
        invitation: {
          findFirst: async () => options.invitation ?? { id: 'invitation-1', event: { userId: 'owner-1' } },
        },
        guest: {
          findMany: async () => options.guestMatches ?? [],
          create: async (args: { data: unknown }) => {
            staging.guestCreates.push(args.data);
            return { id: 'guest-new' };
          },
        },
        rsvp: {
          create: async (args: { data: unknown }) => {
            staging.rsvpCreates.push(args.data);
            return { id: 'rsvp-new' };
          },
        },
        notification: {
          create: async (args: { data: unknown }) => {
            options.onNotificationCreate?.();
            staging.notificationCreates.push(args.data);
            return { id: 'notification-new' };
          },
        },
      };
      try {
        const result = await run(tx);
        Object.assign(committed, {
          guestCreates: [...staging.guestCreates],
          rsvpCreates: [...staging.rsvpCreates],
          notificationCreates: [...staging.notificationCreates],
        });
        return result;
      } catch (error) {
        restore(before);
        throw error;
      }
    },
  };
  return { prisma: prisma as never, staging, committed };
}

describe('GuestsService', () => {
  it('lists only guests reached through the owned event and returns RSVP data', async () => {
    let where: unknown;
    const prisma = {
      event: {
        findFirst: async (args: { where: unknown }) => {
          where = args.where;
          return {
            invitation: {
              guests: [
                {
                  ...guest,
                  rsvp: { status: 'ATTENDING', attendeesCount: 2, message: null, respondedAt: now },
                },
              ],
            },
          };
        },
      },
    };
    const result = await new GuestsService(prisma as never, notificationsMock().service).findAll(
      'owner-1',
      'event-1'
    );
    expect(where).toEqual({ id: 'event-1', userId: 'owner-1' });
    expect(result[0]).toMatchObject({
      name: 'Nadia',
      rsvp: { status: 'ATTENDING', attendeesCount: 2 },
    });
  });

  it('requires an owned invitation before creating a guest', async () => {
    const service = new GuestsService(
      { event: { findFirst: async () => ({ invitation: null }) } } as never,
      notificationsMock().service
    );
    await expect(service.create('owner-1', 'event-1', { name: 'Nadia' })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('returns the same safe not-found result for a missing or non-owned guest', async () => {
    const service = new GuestsService(
      { guest: { findFirst: async () => null } } as never,
      notificationsMock().service
    );
    await expect(service.findOne('owner-2', 'event-1', guest.id)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('updates a guest only after the ownership-scoped lookup', async () => {
    let lookup: unknown;
    const prisma = {
      guest: {
        findFirst: async (args: { where: unknown }) => {
          lookup = args.where;
          return guest;
        },
        update: async () => ({ ...guest, name: 'Nadia A.' }),
      },
    };
    const result = await new GuestsService(prisma as never, notificationsMock().service).update(
      'owner-1',
      'event-1',
      guest.id,
      { name: 'Nadia A.' }
    );
    expect(lookup).toEqual({
      id: guest.id,
      invitation: { event: { id: 'event-1', userId: 'owner-1' } },
    });
    expect(result.name).toBe('Nadia A.');
  });

  it('rejects a public RSVP for a draft or missing invitation', async () => {
    const transaction = { invitation: { findFirst: async () => null } };
    const service = new GuestsService(
      {
        $transaction: async (run: (tx: unknown) => unknown) => run(transaction),
      } as never,
      notificationsMock().service
    );
    await expect(
      service.createPublicRsvp('garden-party', {
        name: 'Nadia',
        email: 'nadia@example.com',
        status: 'ATTENDING',
        attendeesCount: 1,
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('links a public response to a matching guest without changing guest identity', async () => {
    let rsvpData: unknown;
    const transaction = {
      invitation: {
        findFirst: async () => ({ id: 'invitation-1', event: { userId: 'owner-1' } }),
      },
      guest: { findMany: async () => [{ id: guest.id, rsvp: null }] },
      rsvp: {
        create: async (args: { data: unknown }) => {
          rsvpData = args.data;
        },
      },
      notification: { create: async () => ({ id: 'n-1' }) },
    };
    const notifications = notificationsMock();
    const service = new GuestsService(
      {
        $transaction: async (run: (tx: unknown) => unknown) => run(transaction),
      } as never,
      notifications.service
    );
    await expect(
      service.createPublicRsvp('garden-party', {
        name: 'Different display name',
        email: 'nadia@example.com',
        status: 'PENDING',
        attendeesCount: 1,
      })
    ).resolves.toEqual({ status: 'received' });
    expect(rsvpData).toMatchObject({ guestId: guest.id, status: 'PENDING' });
    expect(rsvpData).not.toHaveProperty('name');
    expect(notifications.calls).toEqual([
      { userId: 'owner-1', guestName: 'Different display name', status: 'PENDING' },
    ]);
  });

  it('rejects duplicate public responses and invalid attendance rules without creating a notification', async () => {
    const transaction = {
      invitation: {
        findFirst: async () => ({ id: 'invitation-1', event: { userId: 'owner-1' } }),
      },
      guest: { findMany: async () => [{ id: guest.id, rsvp: { id: 'rsvp-1' } }] },
      rsvp: { create: async () => ({ id: 'x' }) },
      notification: { create: async () => ({ id: 'n-1' }) },
    };
    const notifications = notificationsMock();
    const service = new GuestsService(
      {
        $transaction: async (run: (tx: unknown) => unknown) => run(transaction),
      } as never,
      notifications.service
    );
    await expect(
      service.createPublicRsvp('garden-party', {
        name: 'Nadia',
        email: 'nadia@example.com',
        status: 'ATTENDING',
        attendeesCount: 1,
      })
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.createPublicRsvp('garden-party', {
        name: 'Nadia',
        email: 'nadia@example.com',
        status: 'NOT_ATTENDING',
        attendeesCount: 1,
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(notifications.calls).toHaveLength(0);
  });

  it('creates exactly one owner-scoped RSVP notification inside the same transaction', async () => {
    const { prisma, staging, committed } = transactionalPrisma({});
    const notifications = notificationsMock();
    const service = new GuestsService(prisma, notifications.service);
    await expect(
      service.createPublicRsvp('garden-party', {
        name: 'Nadia',
        email: 'nadia@example.com',
        status: 'ATTENDING',
        attendeesCount: 2,
      })
    ).resolves.toEqual({ status: 'received' });
    expect(staging.guestCreates).toHaveLength(1);
    expect(staging.notificationCreates).toHaveLength(1);
    expect(notifications.calls).toEqual([
      { userId: 'owner-1', guestName: 'Nadia', status: 'ATTENDING' },
    ]);
    expect(committed.notificationCreates).toHaveLength(1);
  });

  it('rolls back the RSVP when notification creation fails, leaving no partial rows', async () => {
    const { prisma, staging, committed } = transactionalPrisma({
      onNotificationCreate: () => {
        throw new Error('notification insert failed');
      },
    });
    const notifications = notificationsMock();
    const service = new GuestsService(prisma, notifications.service);
    await expect(
      service.createPublicRsvp('garden-party', {
        name: 'Nadia',
        email: 'nadia@example.com',
        status: 'ATTENDING',
        attendeesCount: 1,
      })
    ).rejects.toThrow('notification insert failed');
    expect(staging.guestCreates).toHaveLength(0);
    expect(staging.rsvpCreates).toHaveLength(0);
    expect(staging.notificationCreates).toHaveLength(0);
    expect(committed.guestCreates).toHaveLength(0);
    expect(committed.notificationCreates).toHaveLength(0);
    expect(notifications.calls).toHaveLength(1);
  });
});
