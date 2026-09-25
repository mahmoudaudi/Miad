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
    await this.findOwnedGuest(userId, eventId, id);

    const data: Prisma.GuestUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;

    try {
      const guest = await this.prisma.guest.update({ where: { id }, data, select: guestSelect });
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
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email or phone is required.');
    }
    if (dto.status === 'ATTENDING' && dto.attendeesCount < 1) {
      throw new BadRequestException('Attending responses require at least one attendee.');
    }
    if (dto.status === 'NOT_ATTENDING' && dto.attendeesCount !== 0) {
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

          const contacts: Prisma.GuestWhereInput[] = [];
          if (dto.email) contacts.push({ email: dto.email });
          if (dto.phone) contacts.push({ phone: dto.phone });
          const matches = await transaction.guest.findMany({
            where: { invitationId: invitation.id, OR: contacts },
            select: { id: true, rsvp: { select: { id: true } } },
            take: 2,
          });
          if (matches.length > 1 || matches[0]?.rsvp) {
            throw new ConflictException(
              'An attendance confirmation already exists for these contact details.'
            );
          }

          const rsvp = {
            status: dto.status,
            attendeesCount: dto.attendeesCount,
            message: dto.message ?? null,
            respondedAt: new Date(),
          };
          const existingGuest = matches[0];
          if (existingGuest) {
            await transaction.rsvp.create({ data: { guestId: existingGuest.id, ...rsvp } });
          } else {
            await transaction.guest.create({
              data: {
                invitationId: invitation.id,
                name: dto.name,
                email: dto.email ?? null,
                phone: dto.phone ?? null,
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
