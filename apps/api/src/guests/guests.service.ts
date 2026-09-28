import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { INVITATION_SLUG_PATTERN } from '../invitations/dto/create-invitation.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateGuestDto } from './dto/create-guest.dto';
import type { CreateRsvpDto } from './dto/create-rsvp.dto';
import type { UpdateGuestDto } from './dto/update-guest.dto';

const guestSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
  rsvp: {
    select: {
      status: true,
      attendeesCount: true,
      message: true,
      respondedAt: true,
    },
  },
} satisfies Prisma.GuestSelect;

type GuestResult = Prisma.GuestGetPayload<{ select: typeof guestSelect }>;

export type GuestResponse = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  rsvp: {
    status: string;
    attendeesCount: number;
    message: string | null;
    respondedAt: string | null;
  } | null;
};

@Injectable()
export class GuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  async findAll(userId: string, eventId: string): Promise<GuestResponse[]> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, userId },
      select: {
        invitation: {
          select: {
            guests: {
              select: guestSelect,
              orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            },
          },
        },
      },
    });
    if (!event) throw new NotFoundException('Event not found.');
    return (event.invitation?.guests ?? []).map((guest) => this.toResponse(guest));
  }

  async findAllForInvitation(userId: string, invitationId: string): Promise<GuestResponse[]> {
    const eventId = await this.ownedInvitationEventId(userId, invitationId);
    return this.findAll(userId, eventId);
  }

  async createForInvitation(userId: string, invitationId: string, dto: CreateGuestDto) {
    const eventId = await this.ownedInvitationEventId(userId, invitationId);
    return this.create(userId, eventId, dto);
  }

  async findOneForInvitation(userId: string, invitationId: string, guestId: string) {
    const eventId = await this.ownedInvitationEventId(userId, invitationId);
    return this.findOne(userId, eventId, guestId);
  }

  async updateForInvitation(
    userId: string,
    invitationId: string,
    guestId: string,
    dto: UpdateGuestDto
  ) {
    const eventId = await this.ownedInvitationEventId(userId, invitationId);
    return this.update(userId, eventId, guestId, dto);
  }

  async removeForInvitation(userId: string, invitationId: string, guestId: string) {
    const eventId = await this.ownedInvitationEventId(userId, invitationId);
    return this.remove(userId, eventId, guestId);
  }

  async create(userId: string, eventId: string, dto: CreateGuestDto): Promise<GuestResponse> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, userId },
      select: { invitation: { select: { id: true } } },
    });
    if (!event) throw new NotFoundException('Event not found.');
    if (!event.invitation) {
      throw new BadRequestException('Create an invitation before adding guests.');
    }

    const guest = await this.prisma.guest.create({
      data: {
        invitationId: event.invitation.id,
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        rsvp: {
          create: {
            status: dto.status ?? 'PENDING',
            attendeesCount: this.manualPartySize(dto.status ?? 'PENDING', dto.partySize),
            message: dto.notes ?? null,
            respondedAt: dto.status && dto.status !== 'PENDING' ? new Date() : null,
          },
        },
      },
      select: guestSelect,
    });
    return this.toResponse(guest);
  }

  async findOne(userId: string, eventId: string, id: string): Promise<GuestResponse> {
    const guest = await this.findOwnedGuest(userId, eventId, id);
    return this.toResponse(guest);
  }

  async update(
    userId: string,
    eventId: string,
    id: string,
    dto: UpdateGuestDto
  ): Promise<GuestResponse> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one guest field is required.');
    }
    const existing = await this.findOwnedGuest(userId, eventId, id);

    const data: Prisma.GuestUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;

    try {
      const status = dto.status ?? existing.rsvp?.status ?? 'PENDING';
      const partySize = this.manualPartySize(
        status as 'ATTENDING' | 'PENDING' | 'NOT_ATTENDING',
        dto.partySize ?? (dto.status ? undefined : existing.rsvp?.attendeesCount)
      );
      const respondedAt =
        status === 'PENDING'
          ? null
          : dto.status && dto.status !== existing.rsvp?.status
            ? new Date()
            : (existing.rsvp?.respondedAt ?? new Date());
      const guest = await this.prisma.$transaction(async (transaction) => {
        await transaction.guest.update({ where: { id }, data });
        await transaction.rsvp.upsert({
          where: { guestId: id },
          create: {
            guestId: id,
            status,
            attendeesCount: partySize,
            message: dto.notes ?? null,
            respondedAt,
          },
          update: {
            ...(dto.status !== undefined || dto.partySize !== undefined
              ? { status, attendeesCount: partySize, respondedAt }
              : {}),
            ...(dto.notes !== undefined ? { message: dto.notes } : {}),
          },
        });
        return transaction.guest.findUniqueOrThrow({ where: { id }, select: guestSelect });
      });
      return this.toResponse(guest);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Guest not found.');
      }
      throw error;
    }
  }

  async remove(userId: string, eventId: string, id: string): Promise<void> {
    await this.findOwnedGuest(userId, eventId, id);
    try {
      await this.prisma.$transaction([
        this.prisma.rsvp.deleteMany({ where: { guestId: id } }),
        this.prisma.guest.delete({ where: { id } }),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Guest not found.');
      }
      throw error;
    }
  }

  async createPublicRsvp(slug: string, dto: CreateRsvpDto): Promise<{ status: 'received' }> {
    if (slug.length > 255 || !INVITATION_SLUG_PATTERN.test(slug)) {
      throw new NotFoundException('Invitation not found.');
    }
    const attendeesCount = dto.attendeesCount ?? (dto.status === 'ATTENDING' ? 1 : 0);
    if (dto.status === 'ATTENDING' && attendeesCount < 1) {
      throw new BadRequestException('Attending responses require at least one attendee.');
    }
    if (dto.status === 'NOT_ATTENDING' && attendeesCount !== 0) {
      throw new BadRequestException('Declined responses must have zero attendees.');
    }

    try {
      await this.prisma.$transaction(
        async (transaction) => {
          const invitation = await transaction.invitation.findFirst({
            where: { slug, status: 'PUBLISHED', publishedAt: { not: null } },
            select: { id: true, event: { select: { userId: true } } },
          });
          if (!invitation) throw new NotFoundException('Invitation not found.');

          const matches = await transaction.guest.findMany({
            where: {
              invitationId: invitation.id,
              name: { equals: dto.name, mode: 'insensitive' },
            },
            select: { id: true, rsvp: { select: { id: true } } },
            take: 2,
          });
          if (matches.length > 1) {
            throw new ConflictException(
              'Multiple guests share this name. Please contact the host.'
            );
          }

          const rsvp = {
            status: dto.status,
            attendeesCount,
            message: dto.message ?? null,
            respondedAt: new Date(),
          };
          const existingGuest = matches[0];
          if (existingGuest) {
            await transaction.rsvp.upsert({
              where: { guestId: existingGuest.id },
              create: { guestId: existingGuest.id, ...rsvp },
              update: rsvp,
            });
          } else {
            await transaction.guest.create({
              data: {
                invitationId: invitation.id,
                name: dto.name,
                rsvp: { create: rsvp },
              },
              select: { id: true },
            });
          }

          // Same transaction: the owner notification commits or rolls back
          // with the RSVP. The recipient is the server-resolved event owner.
          await this.notifications.createRsvpNotification(transaction, {
            userId: invitation.event.userId,
            guestName: dto.name,
            status: dto.status,
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          // The shared pooler can add seconds per query; keep the atomic
          // window well above observed latency without changing semantics.
          maxWait: 10_000,
          timeout: 20_000,
        }
      );
      return { status: 'received' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034' || error.code === 'P2028')
      ) {
        throw new ConflictException(
          'This attendance confirmation could not be recorded. Please try again.'
        );
      }
      throw error;
    }
  }

  private async findOwnedGuest(userId: string, eventId: string, id: string): Promise<GuestResult> {
    const guest = await this.prisma.guest.findFirst({
      where: { id, invitation: { event: { id: eventId, userId } } },
      select: guestSelect,
    });
    if (!guest) throw new NotFoundException('Guest not found.');
    return guest;
  }

  private async ownedInvitationEventId(userId: string, invitationId: string): Promise<string> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, event: { userId } },
      select: { eventId: true },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');
    return invitation.eventId;
  }

  private manualPartySize(
    status: 'ATTENDING' | 'PENDING' | 'NOT_ATTENDING',
    partySize?: number
  ): number {
    if (status === 'ATTENDING') {
      const count = partySize ?? 1;
      if (count < 1)
        throw new BadRequestException('Attending responses require at least one attendee.');
      return count;
    }
    if (status === 'NOT_ATTENDING' && (partySize ?? 0) !== 0) {
      throw new BadRequestException('Declined responses must have zero attendees.');
    }
    return status === 'PENDING' ? (partySize ?? 0) : 0;
  }

  private toResponse(guest: GuestResult): GuestResponse {
    return {
      id: guest.id,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      createdAt: guest.createdAt.toISOString(),
      updatedAt: guest.updatedAt.toISOString(),
      rsvp: guest.rsvp
        ? {
            status: guest.rsvp.status,
            attendeesCount: guest.rsvp.attendeesCount,
            message: guest.rsvp.message,
            respondedAt: guest.rsvp.respondedAt?.toISOString() ?? null,
          }
        : null,
    };
  }
}
