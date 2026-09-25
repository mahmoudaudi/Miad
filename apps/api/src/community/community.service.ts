import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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
      take: 100,
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
