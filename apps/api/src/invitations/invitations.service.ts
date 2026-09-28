import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InvitationImageStorageService } from '../invitation-images/invitation-image-storage.service';
import { storageKeyFromUrl } from '../invitation-images/invitation-image-validation';
import { InvitationDesignsService } from '../invitation-designs/invitation-designs.service';
import { HtmlArtifactValidationError } from '../invitation-designs/html-artifact';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateInvitationDto } from './dto/create-invitation.dto';
import type { UpdateInvitationDto } from './dto/update-invitation.dto';

const invitationSelect = {
  id: true,
  eventId: true,
  slug: true,
  status: true,
  publishedAt: true,
  publishedDesignVersion: true,
  createdAt: true,
  updatedAt: true,
  event: { select: { id: true, title: true, eventDate: true } },
  designs: { where: { isActive: true }, take: 1, select: { id: true } },
} satisfies Prisma.InvitationSelect;

type InvitationResult = Prisma.InvitationGetPayload<{ select: typeof invitationSelect }>;

export type InvitationResponse = {
  id: string;
  eventId: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  publishedDesignVersion: number | null;
  createdAt: string;
  updatedAt: string;
  hasDesign: boolean;
  event: { id: string; title: string; eventDate: string };
};

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly designs: InvitationDesignsService,
    @Optional() private readonly imageStorage?: InvitationImageStorageService
  ) {}

  async findAll(userId: string, eventId?: string): Promise<InvitationResponse[]> {
    const invitations = await this.prisma.invitation.findMany({
      where: { event: { userId }, ...(eventId ? { eventId } : {}) },
      select: invitationSelect,
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map((invitation) => this.toResponse(invitation));
  }

  async create(userId: string, dto: CreateInvitationDto): Promise<InvitationResponse> {
    const event = await this.prisma.event.findFirst({
      where: { id: dto.eventId, userId },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Event not found.');

    try {
      const invitation = await this.prisma.invitation.create({
        data: { eventId: event.id, slug: dto.slug, status: 'DRAFT', publishedAt: null },
        select: invitationSelect,
      });
      return this.toResponse(invitation);
    } catch (error) {
      this.rethrowKnownConflict(error);
    }
  }

  async findOne(userId: string, id: string): Promise<InvitationResponse> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id, event: { userId } },
      select: invitationSelect,
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');
    return this.toResponse(invitation);
  }

  async update(userId: string, id: string, dto: UpdateInvitationDto): Promise<InvitationResponse> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one invitation field is required.');
    }

    try {
      const updated = await this.prisma.invitation.updateMany({
        where: { id, event: { userId } },
        data: { slug: dto.slug },
      });
      if (updated.count !== 1) throw new NotFoundException('Invitation not found.');
      return this.findOne(userId, id);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.rethrowKnownConflict(error);
    }
  }

  async updatePublication(
    userId: string,
    id: string,
    published: boolean
  ): Promise<InvitationResponse> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id, event: { userId } },
      select: {
        id: true,
        status: true,
        publishedAt: true,
        publishedDesignVersion: true,
        designs: {
          where: { isActive: true },
          orderBy: { version: 'desc' },
          take: 1,
          select: { version: true },
        },
      },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');
    const activeDesignVersion = invitation.designs[0]?.version ?? null;
    if (published && activeDesignVersion === null) {
      throw new BadRequestException('Save an invitation design before publishing.');
    }
    if (published) {
      try {
        // Reuse the exact validation and sanitization path used by preview/render.
        await this.designs.findOwnedRenderable(userId, id);
      } catch (error) {
        if (error instanceof NotFoundException || error instanceof HtmlArtifactValidationError) {
          throw new BadRequestException('Save a valid invitation design before publishing.');
        }
        throw error;
      }
    }

    const nextStatus = published ? 'PUBLISHED' : 'DRAFT';
    const publishedAt = published ? (invitation.publishedAt ?? new Date()) : null;
    const publishedDesignVersion = published ? activeDesignVersion : null;
    if (
      invitation.status === nextStatus &&
      invitation.publishedAt?.getTime() === publishedAt?.getTime() &&
      invitation.publishedDesignVersion === publishedDesignVersion
    ) {
      return this.findOne(userId, id);
    }

    try {
      const updated = await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: nextStatus, publishedAt, publishedDesignVersion },
        select: invitationSelect,
      });
      return this.toResponse(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Invitation not found.');
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id, event: { userId } },
      select: { id: true, images: { select: { userId: true, fileUrl: true } } },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');

    try {
      await this.deleteInvitationSubtree(invitation.id, invitation.images);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('This invitation cannot be deleted while it has related data.');
      }
      throw error;
    }
  }

  /**
   * Deletes an invitation with its entire subtree (publication, designs,
   * guests + RSVPs, images, AI usage, views). The caller must have verified ownership —
   * `remove()` scopes by user, `EventsService` by owned event.
   * Database writes stay uncommitted until the one batched Storage cleanup
   * succeeds, so a Storage failure rolls the relational deletion back.
   */
  async deleteInvitationSubtree(
    invitationId: string,
    images: Array<{ userId: string; fileUrl: string }> = []
  ): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        await tx.communityDesign.deleteMany({ where: { invitationId } });
        await tx.rsvp.deleteMany({ where: { guest: { invitationId } } });
        await tx.guest.deleteMany({ where: { invitationId } });
        await tx.invitationImage.deleteMany({ where: { invitationId } });
        await tx.aiUsage.deleteMany({ where: { invitationId } });
        await tx.invitationView.deleteMany({ where: { invitationId } });
        await tx.invitationDesign.deleteMany({ where: { invitationId } });
        await tx.invitation.delete({ where: { id: invitationId } });
        // Keep the transaction open until the external cleanup acknowledges
        // the whole batch. Throwing here rolls every relational delete back.
        await this.removeInvitationImages(invitationId, images);
      },
      { timeout: 15_000 }
    );
  }

  private async removeInvitationImages(
    invitationId: string,
    images: Array<{ userId: string; fileUrl: string }>
  ): Promise<void> {
    if (images.length === 0) return;
    if (!this.imageStorage) {
      throw new ServiceUnavailableException('Invitation media could not be cleaned up.');
    }
    const keys = images.map((image) => {
      const key = storageKeyFromUrl(image.fileUrl);
      const ownedInvitationPrefix = `${image.userId}/${invitationId}/`;
      const ownedPendingPrefix = `${image.userId}/pending/`;
      if (!key || (!key.startsWith(ownedInvitationPrefix) && !key.startsWith(ownedPendingPrefix))) {
        throw new ServiceUnavailableException('Invitation media could not be cleaned up.');
      }
      return key;
    });
    try {
      await this.imageStorage.removeObjects([...new Set(keys)]);
    } catch {
      throw new ServiceUnavailableException('Invitation media could not be cleaned up.');
    }
  }

  private rethrowKnownConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(
        'This event already has an invitation or the slug is unavailable.'
      );
    }
    throw error;
  }

  private toResponse(invitation: InvitationResult): InvitationResponse {
    return {
      id: invitation.id,
      eventId: invitation.eventId,
      slug: invitation.slug,
      status: invitation.status,
      publishedAt: invitation.publishedAt?.toISOString() ?? null,
      publishedDesignVersion: invitation.publishedDesignVersion ?? null,
      createdAt: invitation.createdAt.toISOString(),
      updatedAt: invitation.updatedAt.toISOString(),
      hasDesign: Boolean(invitation.designs?.length),
      event: {
        id: invitation.event.id,
        title: invitation.event.title,
        eventDate: invitation.event.eventDate.toISOString().slice(0, 10),
      },
    };
  }
}
