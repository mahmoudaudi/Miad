import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Event, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvitationsService } from '../invitations/invitations.service';
import type { CreateEventDto } from './dto/create-event.dto';
import type { UpdateEventDto } from './dto/update-event.dto';

export type EventResponse = {
  id: string;
  invitationId: string | null;
  title: string;
  eventType: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly invitations?: InvitationsService
  ) {}

  async findAll(userId: string): Promise<EventResponse[]> {
    const events = await this.prisma.event.findMany({
      where: { userId },
      include: { invitation: { select: { id: true } } },
      orderBy: [{ eventDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'desc' }],
    });
    return events.map((event) => this.toResponse(event));
  }

  async create(userId: string, dto: CreateEventDto): Promise<EventResponse> {
    const event = await this.prisma.event.create({
      data: {
        userId,
        title: dto.title,
        eventType: dto.eventType,
        description: dto.description ?? null,
        eventDate: this.parseDate(dto.eventDate),
        startTime: this.parseTime(dto.startTime),
        endTime: this.parseTime(dto.endTime),
        venueName: dto.venueName ?? null,
        venueAddress: dto.venueAddress ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
      },
    });
    return this.toResponse(event);
  }

  async findOne(userId: string, id: string): Promise<EventResponse> {
    const event = await this.prisma.event.findFirst({
      where: { id, userId },
      include: { invitation: { select: { id: true } } },
    });
    if (!event) throw new NotFoundException('Event not found.');
    return this.toResponse(event);
  }

  async update(userId: string, id: string, dto: UpdateEventDto): Promise<EventResponse> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one event field is required.');
    }

    const data: Prisma.EventUpdateManyMutationInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.eventType !== undefined) data.eventType = dto.eventType;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.eventDate !== undefined) data.eventDate = this.parseDate(dto.eventDate);
    if (dto.startTime !== undefined) data.startTime = this.parseTime(dto.startTime);
    if (dto.endTime !== undefined) data.endTime = this.parseTime(dto.endTime);
    if (dto.venueName !== undefined) data.venueName = dto.venueName;
    if (dto.venueAddress !== undefined) data.venueAddress = dto.venueAddress;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;

    const updated = await this.prisma.event.updateMany({ where: { id, userId }, data });
    if (updated.count !== 1) throw new NotFoundException('Event not found.');
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const event = await this.prisma.event.findFirst({
      where: { id, userId },
      select: {
        id: true,
        invitation: {
          select: { id: true, images: { select: { userId: true, fileUrl: true } } },
        },
      },
    });
    if (!event) throw new NotFoundException('Event not found.');
    // An event owns at most one invitation — delete its whole subtree first
    // so event deletion never traps on related invitation data.
    try {
      if (event.invitation) {
        if (!this.invitations) {
          throw new ConflictException('This event cannot be deleted while it has related data.');
        }
        await this.invitations.deleteInvitationSubtree(
          event.invitation.id,
          event.invitation.images
        );
      }
      const deleted = await this.prisma.event.deleteMany({ where: { id, userId } });
      if (deleted.count !== 1) throw new NotFoundException('Event not found.');
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof ConflictException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('This event cannot be deleted while it has related data.');
      }
      throw error;
    }
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('eventDate must be a valid calendar date.');
    }
    return parsed;
  }

  private parseTime(value: string | null | undefined): Date | null {
    if (!value) return null;
    return new Date(`1970-01-01T${value}:00.000Z`);
  }

  private toResponse(event: Event & { invitation?: { id: string } | null }): EventResponse {
    return {
      id: event.id,
      invitationId: event.invitation?.id ?? null,
      title: event.title,
      eventType: event.eventType,
      description: event.description,
      eventDate: event.eventDate.toISOString().slice(0, 10),
      startTime: event.startTime?.toISOString().slice(11, 16) ?? null,
      endTime: event.endTime?.toISOString().slice(11, 16) ?? null,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      latitude: event.latitude?.toNumber() ?? null,
      longitude: event.longitude?.toNumber() ?? null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}
