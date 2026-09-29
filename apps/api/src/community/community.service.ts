import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { InvitationImageStorageService } from '../invitation-images/invitation-image-storage.service';
import {
  isAllowedImageType,
  storageKeyFor,
  storageKeyFromUrl,
} from '../invitation-images/invitation-image-validation';
import { PrismaService } from '../prisma/prisma.service';
import { notifyAdmins } from '../notifications/notifications.service';
import type { ListCommunityQueryDto } from './dto/list-community-query.dto';
import type { PublishCommunityDesignDto } from './dto/publish-community-design.dto';

const communitySelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  category: true,
  designSpecification: true,
  views: true,
  likes: true,
  saves: true,
  isPublished: true,
  createdAt: true,
  creator: { select: { firstName: true, lastName: true } },
} satisfies Prisma.CommunityDesignSelect;

type CommunityRow = Prisma.CommunityDesignGetPayload<{ select: typeof communitySelect }>;
export type CommunityDesignResponse = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  specification: Prisma.JsonValue;
  creator: { name: string };
  engagement: { views: number; likes: number; saves: number };
  isPublished: boolean;
  createdAt: string;
};

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageStorage: InvitationImageStorageService
  ) {}

  async list(query: ListCommunityQueryDto): Promise<CommunityDesignResponse[]> {
    const search = query.search?.trim();
    const rows = await this.prisma.communityDesign.findMany({
      where: {
        isPublished: true,
        ...(query.category ? { category: query.category.trim() } : {}),
        ...(search
          ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] }
          : {}),
      },
      select: communitySelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: query.limit ?? 100,
    });
    return rows.map((row) => this.toResponse(row));
  }

  async findPublic(slug: string): Promise<CommunityDesignResponse> {
    const row = await this.prisma.communityDesign.findFirst({
      where: { slug, isPublished: true },
      select: communitySelect,
    });
    if (!row) throw new NotFoundException('Community design not found.');
    return this.toResponse(row);
  }

  async listMine(userId: string): Promise<CommunityDesignResponse[]> {
    const rows = await this.prisma.communityDesign.findMany({
      where: { creatorId: userId },
      select: communitySelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.toResponse(row));
  }

  async findMineForInvitation(userId: string, invitationId: string): Promise<CommunityDesignResponse | null> {
    const row = await this.prisma.communityDesign.findFirst({
      where: { invitationId, creatorId: userId },
      select: communitySelect,
    });
    return row ? this.toResponse(row) : null;
  }

  async removeMine(userId: string, id: string): Promise<{ id: string; deleted: true }> {
    const result = await this.prisma.communityDesign.deleteMany({ where: { id, creatorId: userId } });
    if (result.count !== 1) throw new NotFoundException('Community design not found.');
    return { id, deleted: true };
  }

  async publish(userId: string, invitationId: string, dto: PublishCommunityDesignDto) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, event: { userId } },
      select: { id: true, designs: { where: { isActive: true }, take: 1, select: { designSpecification: true } } },
    });
    const design = invitation?.designs[0];
    if (!invitation || !design) throw new NotFoundException('A saved invitation design is required.');
    const slug = this.slugFor(dto.slug ?? dto.title);
    try {
      const row = await this.prisma.communityDesign.upsert({
        where: { invitationId },
        create: {
          creatorId: userId,
          invitationId,
          slug,
          title: dto.title.trim(),
          description: dto.description.trim(),
          category: dto.category.trim(),
          designSpecification: this.inputJson(design.designSpecification),
        },
        update: {
          slug,
          title: dto.title.trim(),
          description: dto.description.trim(),
          category: dto.category.trim(),
          designSpecification: this.inputJson(design.designSpecification),
          isPublished: true,
        },
        select: communitySelect,
      });
      try {
        await notifyAdmins(this.prisma, 'COMMUNITY_PUBLISHED', 'Community design published',
          `A creator published “${row.title}” to the community.`);
      } catch {
        // Publication succeeded; notification delivery is best effort.
      }
      return this.toResponse(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That community slug is already in use.');
      }
      throw error;
    }
  }

  async updatePublication(userId: string, id: string, published: boolean) {
    const row = await this.prisma.communityDesign.updateMany({
      where: { id, creatorId: userId },
      data: { isPublished: published },
    });
    if (row.count !== 1) throw new NotFoundException('Community design not found.');
    return { published };
  }

  async apply(userId: string, slug: string, invitationId: string) {
    const [community, invitation] = await Promise.all([
      this.prisma.communityDesign.findFirst({ where: { slug, isPublished: true }, select: { designSpecification: true } }),
      this.prisma.invitation.findFirst({ where: { id: invitationId, event: { userId } }, select: { id: true, designs: { select: { version: true }, orderBy: { version: 'desc' }, take: 1 } } }),
    ]);
    if (!community || !invitation) throw new NotFoundException('Community design or invitation not found.');
    const version = (invitation.designs[0]?.version ?? 0) + 1;
    const created = await this.prisma.$transaction(async (transaction) => {
      await transaction.invitationDesign.updateMany({ where: { invitationId, isActive: true }, data: { isActive: false } });
      return transaction.invitationDesign.create({
        data: {
          invitationId,
          version,
          sourceType: 'COMMUNITY',
          isActive: true,
          designSpecification: this.inputJson(community.designSpecification),
        },
        select: { id: true, version: true, designSpecification: true },
      });
    });
    return created;
  }

  /**
   * Creates a wholly new event, invitation, design version, and (when used)
   * owner-scoped copies of the published design's image assets. Storage copies
   * are compensated if the single database transaction fails.
   */
  async clone(userId: string, slug: string) {
    const community = await this.prisma.communityDesign.findFirst({
      where: { slug, isPublished: true },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        category: true,
        creatorId: true,
        invitationId: true,
        designSpecification: true,
      },
    });
    if (!community) throw new NotFoundException('Community design not found.');
    if (!this.isJsonObject(community.designSpecification)) {
      throw new BadRequestException('This community design is not available to clone.');
    }

    // A publication is only a clone source when its source invitation is still
    // owned by the publishing creator; this prevents stale/corrupt links from
    // crossing account boundaries.
    const sourceInvitation = await this.prisma.invitation.findFirst({
      where: { id: community.invitationId, event: { userId: community.creatorId } },
      select: { id: true },
    });
    if (!sourceInvitation) throw new NotFoundException('Community design not found.');

    const sourceImageIds = this.imageIds(community.designSpecification);
    const sourceImages = sourceImageIds.length
      ? await this.prisma.invitationImage.findMany({
          where: {
            id: { in: sourceImageIds },
            userId: community.creatorId,
            invitationId: community.invitationId,
          },
          select: { id: true, userId: true, invitationId: true, fileName: true, fileUrl: true, fileType: true, fileSize: true },
        })
      : [];
    if (sourceImages.length !== sourceImageIds.length) {
      throw new BadRequestException('A design image is no longer available to clone.');
    }

    const newInvitationId = randomUUID();
    const cloneImageRecords: Array<{
      id: string;
      userId: string;
      invitationId: string;
      fileName: string;
      fileUrl: string;
      fileType: string;
      fileSize: bigint;
    }> = [];
    const copiedObjectKeys: string[] = [];
    const imageIdMap = new Map<string, string>();

    try {
      for (const sourceImage of sourceImages) {
        if (!isAllowedImageType(sourceImage.fileType)) {
          throw new BadRequestException('A design image is not in a supported format.');
        }
        const sourceKey = storageKeyFromUrl(sourceImage.fileUrl);
        const expectedPrefix = `${community.creatorId}/${community.invitationId}/`;
        if (!sourceKey || !sourceKey.startsWith(expectedPrefix)) {
          throw new BadRequestException('A design image is not available to clone.');
        }
        const id = randomUUID();
        const destinationKey = storageKeyFor({
          userId,
          invitationId: newInvitationId,
          imageId: id,
          fileType: sourceImage.fileType,
        });
        await this.imageStorage.copyObject(sourceKey, destinationKey);
        copiedObjectKeys.push(destinationKey);
        imageIdMap.set(sourceImage.id, id);
        cloneImageRecords.push({
          id,
          userId,
          invitationId: newInvitationId,
          fileName: sourceImage.fileName,
          fileUrl: `invitation-media/${destinationKey}`,
          fileType: sourceImage.fileType,
          fileSize: sourceImage.fileSize,
        });
      }

      const specification = this.remapImages(community.designSpecification, imageIdMap);
      const eventDate = new Date();
      eventDate.setUTCHours(0, 0, 0, 0);
      const invitationSlug = `community-${community.slug}-${randomUUID().slice(0, 8)}`.slice(0, 255);
      const created = await this.prisma.$transaction(async (transaction) => {
        const event = await transaction.event.create({
          data: {
            userId,
            title: community.title,
            eventType: community.category,
            description: community.description,
            eventDate,
          },
          select: { id: true },
        });
        const invitation = await transaction.invitation.create({
          data: { id: newInvitationId, eventId: event.id, slug: invitationSlug, status: 'DRAFT' },
          select: { id: true },
        });
        if (cloneImageRecords.length > 0) {
          await transaction.invitationImage.createMany({ data: cloneImageRecords });
        }
        const design = await transaction.invitationDesign.create({
          data: {
            invitationId: invitation.id,
            version: 1,
            designSpecification: specification as Prisma.InputJsonValue,
            sourceType: 'COMMUNITY',
            isActive: true,
          },
          select: { id: true, version: true },
        });
        return { invitationId: invitation.id, designId: design.id, version: design.version };
      });
      return created;
    } catch (error) {
      if (copiedObjectKeys.length > 0) {
        try {
          await this.imageStorage.removeObjects(copiedObjectKeys);
        } catch {
          // The database transaction remains rolled back; an unreachable,
          // owner-scoped orphan is safer than exposing or reusing source data.
        }
      }
      throw error;
    }
  }

  private isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private imageIds(specification: Prisma.JsonObject): string[] {
    const elements = specification.elements;
    if (!Array.isArray(elements)) return [];
    const ids = elements.flatMap((candidate) => {
      if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return [];
      const element = candidate as Prisma.JsonObject;
      if (element.type !== 'image' || typeof element.imageUrl !== 'string') return [];
      const match = /^(?:image|media):\/\/([0-9a-fA-F-]{36})$/.exec(element.imageUrl);
      return match?.[1] ? [match[1]] : [];
    });
    return [...new Set(ids)];
  }

  private remapImages(specification: Prisma.JsonObject, imageIds: Map<string, string>): Prisma.InputJsonValue {
    const copy = JSON.parse(JSON.stringify(specification)) as Record<string, unknown>;
    if (Array.isArray(copy.elements)) {
      copy.elements = copy.elements.map((candidate) => {
        if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return candidate;
        const element = candidate as Record<string, unknown>;
        if (element.type !== 'image' || typeof element.imageUrl !== 'string') return element;
        const match = /^(?:image|media):\/\/([0-9a-fA-F-]{36})$/.exec(element.imageUrl);
        const sourceId = match?.[1];
        const cloneId = sourceId ? imageIds.get(sourceId) : undefined;
        if (cloneId) return { ...element, imageUrl: `image://${cloneId}` };
        if (/^(?:image|media):\/\//.test(element.imageUrl)) return { ...element, imageUrl: '' };
        // Never carry a source owner's time-limited/private Storage URL into
        // the clone. Stable public HTTPS assets may remain shared by design.
        try {
          const url = new URL(element.imageUrl);
          if (
            !['http:', 'https:'].includes(url.protocol) ||
            /\/storage\/v1\/object\/(?:sign|authenticated)\//.test(url.pathname) ||
            [...url.searchParams.keys()].some((key) => /token|signature|access[_-]?key|auth/i.test(key))
          ) {
            return { ...element, imageUrl: '' };
          }
          return element;
        } catch {
          return { ...element, imageUrl: '' };
        }
      });
    }
    return copy as Prisma.InputJsonValue;
  }

  private slugFor(value: string): string {
    const normalized = value.normalize('NFKD').replace(/[^a-zA-Z0-9\s-]/g, '').trim().toLowerCase().replace(/[\s-]+/g, '-').slice(0, 100);
    return normalized || `community-${Date.now()}`;
  }

  private inputJson(value: Prisma.JsonValue): Prisma.InputJsonValue {
    if (value === null) throw new NotFoundException('The saved design is invalid.');
    return value as Prisma.InputJsonValue;
  }

  private toResponse(row: CommunityRow | Omit<CommunityRow, 'creator'>): CommunityDesignResponse {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category,
      specification: row.designSpecification,
      creator: {
        name:
          'creator' in row
            ? `${row.creator.firstName} ${row.creator.lastName}`.trim() || 'Miad creator'
            : 'Miad creator',
      },
      engagement: { views: row.views, likes: row.likes, saves: row.saves },
      isPublished: row.isPublished,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
