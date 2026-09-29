import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_NOTIFICATIONS_PAGE_SIZE,
  MAX_NOTIFICATIONS_PAGE_SIZE,
} from './dto/list-notifications-query.dto';

export const RSVP_NOTIFICATION_TYPE = 'RSVP_RECEIVED';

/** Fan out platform activity to active administrators without exposing it to users. */
export async function notifyAdmins(
  prisma: PrismaService,
  type: string,
  title: string,
  message: string
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { name: 'admin' } },
    select: { id: true },
  });
  if (!admins.length) return;
  await prisma.notification.createMany({
    data: admins.map(({ id }) => ({ userId: id, type, title, message, isRead: false })),
  });
}

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

type NotificationResult = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

export type NotificationResponse = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type NotificationListResponse = {
  items: NotificationResponse[];
  nextCursor: string | null;
};

export type RsvpNotificationInput = {
  userId: string;
  guestName: string;
  status: string;
};

const RSVP_STATUS_LABELS: Record<string, string> = {
  ATTENDING: 'Attending',
  PENDING: 'Pending',
  NOT_ATTENDING: 'Not attending',
};

function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  return cleaned || 'A guest';
}

/**
 * Server-only RSVP notification composition. The recipient, type, title, and
 * message are derived exclusively from server-resolved RSVP data — never from
 * client-supplied notification fields.
 */
export function composeRsvpNotification(input: RsvpNotificationInput): {
  type: string;
  title: string;
  message: string;
  isRead: false;
} {
  const name = sanitizeName(input.guestName);
  const label = RSVP_STATUS_LABELS[input.status] ?? 'Pending';
  const titleBase = `New attendance confirmation from ${name}`;
  return {
    type: RSVP_NOTIFICATION_TYPE,
    title: titleBase.length > 255 ? `${titleBase.slice(0, 252)}...` : titleBase,
    message: `${name} responded: ${label}.`,
    isRead: false,
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  countUnread(userId: string): Promise<{ count: number }> {
    return this.prisma.notification.count({ where: { userId, isRead: false } })
      .then((count) => ({ count }));
  }

  /**
   * Creates the owner notification inside the caller's active RSVP transaction
   * so the RSVP and the notification commit or roll back together.
   */
  async createRsvpNotification(
    transaction: Prisma.TransactionClient,
    input: RsvpNotificationInput
  ): Promise<void> {
    await transaction.notification.create({
      data: { userId: input.userId, ...composeRsvpNotification(input) },
    });
  }

  async list(
    userId: string,
    cursor?: string,
    limit?: number
  ): Promise<NotificationListResponse> {
    const pageSize = Math.min(
      Math.max(limit ?? DEFAULT_NOTIFICATIONS_PAGE_SIZE, 1),
      MAX_NOTIFICATIONS_PAGE_SIZE
    );

    let cursorFilter: Prisma.NotificationWhereInput = {};
    if (cursor) {
      const anchor = await this.prisma.notification.findFirst({
        where: { id: cursor, userId },
        select: { id: true, createdAt: true },
      });
      if (!anchor) throw new BadRequestException('Invalid pagination cursor.');
      cursorFilter = {
        OR: [
          { createdAt: { lt: anchor.createdAt } },
          { createdAt: anchor.createdAt, id: { gt: anchor.id } },
        ],
      };
    }

    const rows = await this.prisma.notification.findMany({
      where: { userId, ...cursorFilter },
      select: notificationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: pageSize + 1,
    });

    const hasMore = rows.length > pageSize;
    const page = hasMore ? rows.slice(0, pageSize) : rows;
    const last = page[page.length - 1];
    return {
      items: page.map((row) => this.toResponse(row)),
      nextCursor: hasMore && last ? last.id : null,
    };
  }

  async markRead(userId: string, id: string): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: notificationSelect,
    });
    if (!notification) throw new NotFoundException('Notification not found.');
    if (notification.isRead) return this.toResponse(notification);

    const updated = await this.prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true },
      select: notificationSelect,
    });
    return this.toResponse(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }

  private toResponse(notification: NotificationResult): NotificationResponse {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
