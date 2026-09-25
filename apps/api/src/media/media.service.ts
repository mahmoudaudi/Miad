import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CompleteMediaUploadDto } from './dto/complete-media-upload.dto';
import type { CreateMediaUploadDto } from './dto/create-media-upload.dto';
import { MediaStorageService } from './media-storage.service';
import {
  formatListCursor,
  INVITATION_MEDIA_BUCKET,
  isAllowedMediaType,
  matchesFileTypeSignature,
  newMediaId,
  parseListCursor,
  sanitizeFileName,
  storageKeyFor,
  storageKeyFromUrl,
  validateUploadMetadata,
} from './media-validation';

const PREVIEW_URL_TTL_SECONDS = 3600;

const mediaSelect = {
  id: true,
  invitationId: true,
  fileName: true,
  fileUrl: true,
  fileType: true,
  fileSize: true,
  createdAt: true,
} satisfies Prisma.MediaAssetSelect;

type MediaResult = Prisma.MediaAssetGetPayload<{ select: typeof mediaSelect }>;

export type MediaRecordResponse = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  previewUrl: string | null;
};

export type MediaListResponse = {
  items: MediaRecordResponse[];
  nextCursor: string | null;
};

export type MediaUploadTargetResponse = {
  mediaId: string;
  uploadUrl: string;
};

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService
  ) {}

  async list(
    userId: string,
    invitationId: string,
    cursor?: string,
    limit?: number
  ): Promise<MediaListResponse> {
    await this.findOwnedInvitation(userId, invitationId);
    const pageSize = Math.min(Math.max(limit ?? 24, 1), 48);

    let cursorFilter: Prisma.MediaAssetWhereInput = {};
    if (cursor) {
      const parsed = parseListCursor(cursor);
      if (!parsed) throw new BadRequestException('Invalid pagination cursor.');
      cursorFilter = {
        OR: [
          { createdAt: { lt: new Date(parsed.createdAtMs) } },
          { createdAt: new Date(parsed.createdAtMs), id: { gt: parsed.id } },
        ],
      };
    }

    const rows = await this.prisma.mediaAsset.findMany({
      where: { invitationId, ...cursorFilter },
      select: mediaSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: pageSize + 1,
    });

    const hasMore = rows.length > pageSize;
    const page = hasMore ? rows.slice(0, pageSize) : rows;
    const previews = await this.signPreviews(page.map((row) => this.objectKey(row)));
    const items = page.map((row, index) => this.toRecord(row, previews[index] ?? null));
    const last = page[page.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? formatListCursor(last.createdAt, last.id) : null,
    };
  }

  async requestUpload(
    userId: string,
    invitationId: string,
    dto: CreateMediaUploadDto
  ): Promise<MediaUploadTargetResponse> {
    const metadataError = validateUploadMetadata(dto);
    if (metadataError) throw new BadRequestException(metadataError);
    await this.findOwnedInvitation(userId, invitationId);

    const fileType = dto.fileType;
    if (!isAllowedMediaType(fileType)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are supported.');
    }
    const mediaId = newMediaId();
    const objectKey = storageKeyFor({ userId, invitationId, mediaId, fileType });
    try {
      const { uploadUrl } = await this.storage.createSignedUploadUrl(objectKey);
      return { mediaId, uploadUrl };
    } catch (error) {
      throw this.storageUnavailable(error);
    }
  }

  async completeUpload(
    userId: string,
    invitationId: string,
    mediaId: string,
    dto: CompleteMediaUploadDto
  ): Promise<MediaRecordResponse> {
    await this.findOwnedInvitation(userId, invitationId);

    const metadataError = validateUploadMetadata(dto);
    if (metadataError) {
      // Metadata no longer matches the signed target — clean the pending object.
      await this.discardPendingObject(userId, invitationId, mediaId, dto.fileType);
      throw new BadRequestException(metadataError);
    }
    const fileType = dto.fileType;
    if (!isAllowedMediaType(fileType)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are supported.');
    }

    // Idempotent completion: a previous successful attempt wins.
    const existing = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
      select: mediaSelect,
    });
    if (existing) {
      if (existing.invitationId !== invitationId) throw new NotFoundException('Media not found.');
      return this.toRecord(existing, await this.signPreview(this.objectKey(existing)));
    }

    const objectKey = storageKeyFor({ userId, invitationId, mediaId, fileType });
    try {
      const info = await this.storage.getObjectInfo(objectKey);
      if (!info) {
        throw new BadRequestException('Upload not found. Please upload the file again.');
      }
      if (info.size !== dto.fileSize || info.size <= 0) {
        await this.storage.removeObject(objectKey).catch(() => undefined);
        throw new BadRequestException('Uploaded file does not match the requested file.');
      }
      if (
        info.mimetype &&
        info.mimetype !== 'application/octet-stream' &&
        info.mimetype !== fileType
      ) {
        await this.storage.removeObject(objectKey).catch(() => undefined);
        throw new BadRequestException('Uploaded file type is not allowed.');
      }
      const bytes = await this.storage.downloadObject(objectKey);
      if (!bytes) {
        throw new BadRequestException('Upload not found. Please upload the file again.');
      }
      if (!matchesFileTypeSignature(fileType, bytes)) {
        await this.storage.removeObject(objectKey).catch(() => undefined);
        throw new BadRequestException('Uploaded file is not a valid image of the declared type.');
      }

      const asset = await this.prisma.mediaAsset.create({
        data: {
          id: mediaId,
          userId,
          invitationId,
          fileName: sanitizeFileName(dto.fileName),
          fileUrl: `${INVITATION_MEDIA_BUCKET}/${objectKey}`,
          fileType,
          fileSize: BigInt(info.size),
        },
        select: mediaSelect,
      });
      return this.toRecord(asset, await this.signPreview(objectKey));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Concurrent completion of the same mediaId — return the winner.
          const raced = await this.prisma.mediaAsset.findUnique({
            where: { id: mediaId },
            select: mediaSelect,
          });
          if (raced && raced.invitationId === invitationId) {
            return this.toRecord(raced, await this.signPreview(this.objectKey(raced)));
          }
          throw new NotFoundException('Media not found.');
        }
        if (error.code === 'P2003') throw new NotFoundException('Invitation not found.');
        throw error;
      }
      throw this.storageUnavailable(error);
    }
  }

  /**
   * Public photo bytes for a published invitation. Returns null for anything
   * unpublished, missing, or unreadable — the controller maps that to 404.
   * Only ever serves rows scoped to the published invitation (no IDOR).
   */
  async downloadPublicMedia(
    slug: string,
    mediaId: string
  ): Promise<{ bytes: Uint8Array; fileType: string } | null> {
    if (!/^[0-9a-fA-F-]{36}$/.test(mediaId)) return null;
    const invitation = await this.prisma.invitation.findFirst({
      where: { slug, status: 'PUBLISHED', publishedAt: { not: null } },
      select: { id: true },
    });
    if (!invitation) return null;
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, invitationId: invitation.id },
      select: { fileUrl: true, fileType: true },
    });
    if (!asset) return null;
    const key = storageKeyFromUrl(asset.fileUrl);
    if (!key) return null;
    try {
      const bytes = await this.storage.downloadObject(key);
      if (!bytes) return null;
      return { bytes, fileType: asset.fileType };
    } catch {
      return null;
    }
  }

  async remove(userId: string, invitationId: string, mediaId: string): Promise<void> {    await this.findOwnedInvitation(userId, invitationId);
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, invitationId, invitation: { event: { userId } } },
      select: mediaSelect,
    });
    if (!asset) throw new NotFoundException('Media not found.');

    try {
      // Storage first (idempotent), then the row — a retry always converges.
      await this.storage.removeObject(this.objectKey(asset));
      await this.prisma.mediaAsset.delete({ where: { id: asset.id } });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') return;
        throw error;
      }
      throw this.storageUnavailable(error);
    }
  }

  private async findOwnedInvitation(userId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, event: { userId } },
      select: { id: true },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');
    return invitation;
  }

  private async discardPendingObject(
    userId: string,
    invitationId: string,
    mediaId: string,
    fileType: string
  ): Promise<void> {
    if (!isAllowedMediaType(fileType)) return;
    try {
      await this.storage.removeObject(storageKeyFor({ userId, invitationId, mediaId, fileType }));
    } catch {
      // Cleanup is best-effort; object paths are unique and never reused.
    }
  }

  private objectKey(asset: { fileUrl: string }): string {
    const key = storageKeyFromUrl(asset.fileUrl);
    if (!key) throw new BadRequestException('Media not found.');
    return key;
  }

  private async signPreview(objectKey: string): Promise<string | null> {
    try {
      const [url] = await this.storage.createSignedPreviewUrls(
        [objectKey],
        PREVIEW_URL_TTL_SECONDS
      );
      return url ?? null;
    } catch {
      return null;
    }
  }

  private async signPreviews(objectKeys: string[]): Promise<(string | null)[]> {
    if (objectKeys.length === 0) return [];
    try {
      return await this.storage.createSignedPreviewUrls(objectKeys, PREVIEW_URL_TTL_SECONDS);
    } catch {
      return objectKeys.map(() => null);
    }
  }

  private toRecord(asset: MediaResult, previewUrl: string | null): MediaRecordResponse {
    return {
      id: asset.id,
      fileName: asset.fileName,
      fileType: asset.fileType,
      fileSize: Number(asset.fileSize),
      createdAt: asset.createdAt.toISOString(),
      previewUrl,
    };
  }

  private storageUnavailable(_error: unknown): ServiceUnavailableException {
    return new ServiceUnavailableException('Media storage is unavailable. Please try again.');
  }
}
