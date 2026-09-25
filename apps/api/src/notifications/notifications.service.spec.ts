import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  composeRsvpNotification,
  NotificationsService,
  RSVP_NOTIFICATION_TYPE,
} from './notifications.service';

const now = new Date('2026-09-23T12:00:00.000Z');
const notificationId = '55555555-5555-4555-8555-555555555555';
const otherId = '66666666-6666-4666-8666-666666666666';
const notification = {
  id: notificationId,
  type: RSVP_NOTIFICATION_TYPE,
  title: 'New attendance confirmation from Nadia',
  message: 'Nadia responded: Attending.',
  isRead: false,
  createdAt: now,
};

function prismaWith(overrides: Record<string, unknown>) {
  return { notification: {}, ...overrides } as never;
}

describe('composeRsvpNotification', () => {
  it('generates the type, title, and message entirely on the server', () => {
    expect(
      composeRsvpNotification({ userId: 'owner-1', guestName: '  Nadia  ', status: 'ATTENDING' })
    ).toEqual({
      type: 'RSVP_RECEIVED',
      title: 'New attendance confirmation from Nadia',
      message: 'Nadia responded: Attending.',
      isRead: false,
    });
    expect(
      composeRsvpNotification({ userId: 'owner-1', guestName: 'Omar', status: 'NOT_ATTENDING' })
    ).toMatchObject({
      title: 'New attendance confirmation from Omar',
      message: 'Omar responded: Not attending.',
    });
    expect(
      composeRsvpNotification({ userId: 'owner-1', guestName: 'Lea', status: 'PENDING' })
    ).toMatchObject({ message: 'Lea responded: Pending.' });
  });

  it('sanitizes blank names and keeps the title within column limits', () => {
    const blank = composeRsvpNotification({ userId: 'owner-1', guestName: '   ', status: 'PENDING' });
    expect(blank.title).toBe('New attendance confirmation from A guest');
    const long = composeRsvpNotification({
      userId: 'owner-1',
      guestName: 'N'.repeat(400),
      status: 'ATTENDING',
    });
    expect(long.title.length).toBeLessThanOrEqual(255);
    expect(long.message.startsWith('N'.repeat(50))).toBe(true);
  });
});

describe('NotificationsService', () => {
  it('composes and persists the RSVP notification through the active transaction', async () => {
    let created: Record<string, unknown> | undefined;
    const service = new NotificationsService(prismaWith({}));
    const tx = {
      notification: {
        create: async (args: { data: Record<string, unknown> }) => {
          created = args.data;
          return { id: notificationId, ...args.data };
        },
      },
    };
    await service.createRsvpNotification(tx as never, {
      userId: 'owner-1',
      guestName: 'Nadia',
      status: 'ATTENDING',
    });
    expect(created).toMatchObject({
      userId: 'owner-1',
      type: 'RSVP_RECEIVED',
      title: 'New attendance confirmation from Nadia',
      isRead: false,
    });
    expect(created).not.toHaveProperty('userId_from_client');
  });

  it('lists only the owner’s notifications newest-first with safe fields and a keyset cursor', async () => {
    let where: unknown;
    let orderBy: unknown;
    let taken: number | undefined;
    const rows = [
      { ...notification, id: notificationId, createdAt: new Date(now.getTime() - 1000) },
      { ...notification, id: otherId, createdAt: new Date(now.getTime() - 2000) },
      { ...notification, id: '77777777-7777-4777-8777-777777777777', createdAt: now },
    ];
    const service = new NotificationsService(
      prismaWith({
        notification: {
          findMany: async (args: {
            where: unknown;
            orderBy: unknown;
            take: number;
            select: unknown;
          }) => {
            where = args.where;
            orderBy = args.orderBy;
            taken = args.take;
            return rows;
          },
        },
      })
    );
    const page = await service.list('owner-1', undefined, 2);
    expect(where).toMatchObject({ userId: 'owner-1' });
    expect(orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
    expect(taken).toBe(3);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe(rows[1]?.id);
    expect(Object.keys(page.items[0] ?? {}).sort()).toEqual(
      ['createdAt', 'id', 'isRead', 'message', 'title', 'type'].sort()
    );
    expect(page.items[0]?.createdAt).toBe(rows[0]?.createdAt.toISOString());
  });

  it('returns an empty first page with no cursor when there is nothing to show', async () => {
    const service = new NotificationsService(
      prismaWith({ notification: { findMany: async () => [] } })
    );
    await expect(service.list('owner-1')).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('rejects malformed, missing, and cross-user cursors with the same safe 400', async () => {
    const service = new NotificationsService(
      prismaWith({
        notification: {
          findFirst: async () => null,
          findMany: async () => [],
        },
      })
    );
    await expect(service.list('owner-1', 'bogus')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list('owner-1', otherId)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list('owner-1', undefined, 0)).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    await expect(service.list('owner-1', undefined, 51)).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('applies the cursor anchor scoped to the owner', async () => {
    const anchors: unknown[] = [];
    let listWhere: unknown;
    const service = new NotificationsService(
      prismaWith({
        notification: {
          findFirst: async (args: { where: unknown }) => {
            anchors.push(args.where);
            return { id: otherId, createdAt: now };
          },
          findMany: async (args: { where: unknown }) => {
            listWhere = args.where;
            return [];
          },
        },
      })
    );
    await service.list('owner-1', otherId);
    expect(anchors[0]).toEqual({ id: otherId, userId: 'owner-1' });
    expect(listWhere).toMatchObject({
      userId: 'owner-1',
      OR: [{ createdAt: { lt: now } }, { createdAt: now, id: { gt: otherId } }],
    });
  });

  it('marks an owned unread notification read and stays idempotent when already read', async () => {
    let updateData: unknown;
    const service = new NotificationsService(
      prismaWith({
        notification: {
          findFirst: async () => ({ ...notification, isRead: false }),
          update: async (args: { data: { isRead: boolean } }) => {
            updateData = args.data;
            return { ...notification, isRead: true };
          },
        },
      })
    );
    const first = await service.markRead('owner-1', notificationId);
    expect(first).toMatchObject({ id: notificationId, isRead: true });
    expect(updateData).toEqual({ isRead: true });

    const alreadyRead = new NotificationsService(
      prismaWith({
        notification: {
          findFirst: async () => ({ ...notification, isRead: true }),
          update: async () => {
            throw new Error('must not write when already read');
          },
        },
      })
    );
    await expect(alreadyRead.markRead('owner-1', notificationId)).resolves.toMatchObject({
      isRead: true,
    });
  });

  it('returns the same safe 404 for missing and cross-user notification access', async () => {
    const service = new NotificationsService(
      prismaWith({ notification: { findFirst: async () => null } })
    );
    await expect(service.markRead('owner-2', notificationId)).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.markRead('owner-2', '99999999-9999-4999-8999-999999999999')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('marks all of the owner’s unread notifications read and reports the count changed', async () => {
    let updateWhere: unknown;
    const service = new NotificationsService(
      prismaWith({
        notification: {
          updateMany: async (args: { where: unknown }) => {
            updateWhere = args.where;
            return { count: 3 };
          },
        },
      })
    );
    await expect(service.markAllRead('owner-1')).resolves.toEqual({ updated: 3 });
    expect(updateWhere).toEqual({ userId: 'owner-1', isRead: false });

    const none = new NotificationsService(
      prismaWith({ notification: { updateMany: async () => ({ count: 0 }) } })
    );
    await expect(none.markAllRead('owner-1')).resolves.toEqual({ updated: 0 });
  });
});
