import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RecordViewDto } from './dto/record-view.dto';

export type InvitationAnalytics = {
  views: number;
  uniqueVisitors: number;
  rsvps: number;
  attending: number;
  notAttending: number;
  pending: number;
  attendingGuests: number;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordPublicView(slug: string, dto: RecordViewDto): Promise<{ recorded: true }> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { slug, status: 'PUBLISHED', publishedAt: { not: null } },
      select: { id: true },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');

    await this.prisma.invitationView.create({
      data: {
        invitationId: invitation.id,
        sessionIdentifier: dto.sessionIdentifier ?? null,
        deviceType: dto.deviceType ?? null,
      },
    });
    return { recorded: true };
  }

  async findForOwner(userId: string, invitationId: string): Promise<InvitationAnalytics> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, event: { userId } },
      select: {
        views: { select: { sessionIdentifier: true } },
        guests: { select: { rsvp: { select: { status: true, attendeesCount: true } } } },
      },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');

    const responses = invitation.guests.flatMap((guest) => (guest.rsvp ? [guest.rsvp] : []));
    return {
      views: invitation.views.length,
      uniqueVisitors: new Set(
        invitation.views.map((view) => view.sessionIdentifier).filter((value): value is string => Boolean(value))
      ).size,
      rsvps: responses.length,
      attending: responses.filter((response) => response.status === 'ATTENDING').length,
      notAttending: responses.filter((response) => response.status === 'NOT_ATTENDING').length,
      pending: responses.filter((response) => response.status === 'PENDING').length,
      attendingGuests: responses
        .filter((response) => response.status === 'ATTENDING')
        .reduce((total, response) => total + response.attendeesCount, 0),
    };
  }
}
