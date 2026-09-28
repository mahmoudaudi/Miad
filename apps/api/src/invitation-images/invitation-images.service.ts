import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CompleteImageUploadDto } from './dto/complete-image-upload.dto';
import type { CreateImageUploadDto } from './dto/create-image-upload.dto';
import { InvitationImageStorageService } from './invitation-image-storage.service';
import {
  INVITATION_IMAGE_BUCKET,
  isAllowedImageType,
  matchesFileTypeSignature,
  newImageId,
  pendingStorageKeyFor,
  sanitizeFileName,
  storageKeyFor,
  storageKeyFromUrl,
  validateUploadMetadata,
} from './invitation-image-validation';

const PREVIEW_URL_TTL_SECONDS = 3600;

const imageSelect = {
  id: true,
  userId: true,
  invitationId: true,
  fileName: true,
  fileUrl: true,
  fileType: true,
  fileSize: true,
  createdAt: true,
} satisfies Prisma.InvitationImageSelect;

type ImageResult = Prisma.InvitationImageGetPayload<{ select: typeof imageSelect }>;

export type InvitationImageResponse = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  previewUrl: string | null;
};

export type ImageUploadTargetResponse = {
  imageId: string;
  uploadUrl: string;
};

@Injectable()
export class InvitationImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: InvitationImageStorageService
  ) {}

  async requestUpload(
    userId: string,
    invitationId: string,
    dto: CreateImageUploadDto
  ): Promise<ImageUploadTargetResponse> {
    const metadataError = validateUploadMetadata(dto);
    if (metadataError) throw new BadRequestException(metadataError);
    await this.findOwnedInvitation(userId, invitationId);

    const fileType = dto.fileType;
    if (!isAllowedImageType(fileType)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are supported.');
    }
    const imageId = newImageId();
    const objectKey = storageKeyFor({ userId, invitationId, imageId, fileType });
    try {
      const { uploadUrl } = await this.storage.createSignedUploadUrl(objectKey);
      return { imageId, uploadUrl };
    } catch (error) {
      throw this.storageUnavailable(error);
    }
  }

  async requestPendingUpload(
    userId: string,
    dto: CreateImageUploadDto
  ): Promise<ImageUploadTargetResponse> {
    const metadataError = validateUploadMetadata(dto);
    if (metadataError) throw new BadRequestException(metadataError);
    if (!isAllowedImageType(dto.fileType)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are supported.');
    }
    const imageId = newImageId();
    const objectKey = pendingStorageKeyFor({ userId, imageId, fileType: dto.fileType });
    try {
      const { uploadUrl } = await this.storage.createSignedUploadUrl(objectKey);
      return { imageId, uploadUrl };
    } catch (error) {
      throw this.storageUnavailable(error);
    }
  }

  async completeUpload(
    userId: string,
    invitationId: string,
    imageId: string,
    dto: CompleteImageUploadDto
  ): Promise<InvitationImageResponse> {
    await this.findOwnedInvitation(userId, invitationId);

    const metadataError = validateUploadMetadata(dto);
    if (metadataError) {
      // Metadata no longer matches the signed target — clean the pending object.
      await this.discardPendingObject(userId, invitationId, imageId, dto.fileType);
      throw new BadRequestException(metadataError);
    }
    const fileType = dto.fileType;
    if (!isAllowedImageType(fileType)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are supported.');
    }

    // Idempotent completion: a previous successful attempt wins.
    const existing = await this.prisma.invitationImage.findUnique({
      where: { id: imageId },
      select: imageSelect,
    });
    if (existing) {
      if (existing.userId !== userId || existing.invitationId !== invitationId) {
        throw new NotFoundException('Image not found.');
      }
      return this.toRecord(existing, await this.signPreview(this.objectKey(existing)));
    }

    const objectKey = storageKeyFor({ userId, invitationId, imageId, fileType });
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

      const asset = await this.prisma.invitationImage.create({
        data: {
          id: imageId,
          userId,
          invitationId,
          fileName: sanitizeFileName(dto.fileName),
          fileUrl: `${INVITATION_IMAGE_BUCKET}/${objectKey}`,
          fileType,
          fileSize: BigInt(info.size),
        },
        select: imageSelect,
      });
      return this.toRecord(asset, await this.signPreview(objectKey));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Concurrent completion of the same imageId — return the winner.
          const raced = await this.prisma.invitationImage.findUnique({
            where: { id: imageId },
            select: imageSelect,
          });
          if (raced && raced.invitationId === invitationId) {
            return this.toRecord(raced, await this.signPreview(this.objectKey(raced)));
          }
          throw new NotFoundException('Image not found.');
        }
        if (error.code === 'P2003') throw new NotFoundException('Invitation not found.');
        throw error;
      }
      throw this.storageUnavailable(error);
    }
  }

  async completePendingUpload(
    userId: string,
    imageId: string,
    dto: CompleteImageUploadDto
  ): Promise<InvitationImageResponse> {
    const metadataError = validateUploadMetadata(dto);
    if (metadataError) {
      await this.discardPendingStudioObject(userId, imageId, dto.fileType);
      throw new BadRequestException(metadataError);
    }
    if (!isAllowedImageType(dto.fileType)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are supported.');
    }

    const existing = await this.prisma.invitationImage.findUnique({
      where: { id: imageId },
      select: imageSelect,
    });
    if (existing) {
      if (existing.userId !== userId || existing.invitationId !== null) {
        throw new NotFoundException('Image not found.');
      }
      return this.toRecord(existing, await this.signPreview(this.objectKey(existing)));
    }

    const objectKey = pendingStorageKeyFor({ userId, imageId, fileType: dto.fileType });
    try {
      const info = await this.storage.getObjectInfo(objectKey);
      if (!info || info.size !== dto.fileSize || info.size <= 0) {
        await this.storage.removeObject(objectKey).catch(() => undefined);
        throw new BadRequestException('Uploaded file does not match the requested file.');
      }
      if (
        info.mimetype &&
        info.mimetype !== 'application/octet-stream' &&
        info.mimetype !== dto.fileType
      ) {
        await this.storage.removeObject(objectKey).catch(() => undefined);
        throw new BadRequestException('Uploaded file type is not allowed.');
      }
      const bytes = await this.storage.downloadObject(objectKey);
      if (!bytes || !matchesFileTypeSignature(dto.fileType, bytes)) {
        await this.storage.removeObject(objectKey).catch(() => undefined);
        throw new BadRequestException('Uploaded file is not a valid image of the declared type.');
      }
      const asset = await this.prisma.invitationImage.create({
        data: {
          id: imageId,
          userId,
          invitationId: null,
          fileName: sanitizeFileName(dto.fileName),
          fileUrl: `${INVITATION_IMAGE_BUCKET}/${objectKey}`,
          fileType: dto.fileType,
          fileSize: BigInt(info.size),
        },
        select: imageSelect,
      });
      return this.toRecord(asset, await this.signPreview(objectKey));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw this.storageUnavailable(error);
    }
  }

  async removeImage(
    userId: string,
    imageId: string,
    invitationId: string | null
  ): Promise<{ removed: true }> {
    const image = await this.prisma.invitationImage.findFirst({
      where: { id: imageId, userId, invitationId },
      select: imageSelect,
    });
    if (!image) throw new NotFoundException('Image not found.');
    if (invitationId) {
      const activeDesign = await this.prisma.invitationDesign.findFirst({
        where: { invitationId, isActive: true },
        select: { designSpecification: true },
      });
      if (
        activeDesign &&
        JSON.stringify(activeDesign.designSpecification).includes(`image://${imageId}`)
      ) {
        throw new ConflictException('This image is already used by the invitation.');
      }
    }
    try {
      await this.storage.removeObject(this.objectKey(image));
      await this.prisma.invitationImage.delete({ where: { id: imageId } });
      return { removed: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw this.storageUnavailable(error);
    }
  }

  async downloadOwnedImage(
    userId: string,
    invitationId: string,
    imageId: string
  ): Promise<{ bytes: Uint8Array; fileType: string }> {
    await this.findOwnedInvitation(userId, invitationId);
    const image = await this.prisma.invitationImage.findFirst({
      where: { id: imageId, userId, invitationId },
      select: { fileUrl: true, fileType: true },
    });
    if (!image) throw new NotFoundException('Image not found.');
    const key = storageKeyFromUrl(image.fileUrl);
    if (!key) throw new NotFoundException('Image not found.');
    try {
      const bytes = await this.storage.downloadObject(key);
      if (!bytes) throw new NotFoundException('Image not found.');
      return { bytes, fileType: image.fileType };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw this.storageUnavailable(error);
    }
  }

  /**
   * Public photo bytes for a published invitation. Returns null for anything
   * unpublished, missing, or unreadable — the controller maps that to 404.
   * Only ever serves rows scoped to the published invitation (no IDOR).
   */
  async downloadPublicImage(
    slug: string,
    imageId: string
  ): Promise<{ bytes: Uint8Array; fileType: string } | null> {
    if (!/^[0-9a-fA-F-]{36}$/.test(imageId)) return null;
    const invitation = await this.prisma.invitation.findFirst({
      where: { slug, status: 'PUBLISHED', publishedAt: { not: null } },
      select: { id: true },
    });
    if (!invitation) return null;
    const asset = await this.prisma.invitationImage.findFirst({
      where: { id: imageId, invitationId: invitation.id },
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
    imageId: string,
    fileType: string
  ): Promise<void> {
    if (!isAllowedImageType(fileType)) return;
    try {
      await this.storage.removeObject(storageKeyFor({ userId, invitationId, imageId, fileType }));
    } catch {
      // Cleanup is best-effort; object paths are unique and never reused.
    }
  }

  private async discardPendingStudioObject(
    userId: string,
    imageId: string,
    fileType: string
  ): Promise<void> {
    if (!isAllowedImageType(fileType)) return;
    try {
      await this.storage.removeObject(pendingStorageKeyFor({ userId, imageId, fileType }));
    } catch {
      // Cleanup is best-effort; object paths are unique and never reused.
    }
  }

  private objectKey(asset: { fileUrl: string }): string {
    const key = storageKeyFromUrl(asset.fileUrl);
    if (!key) throw new BadRequestException('Image not found.');
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

  private toRecord(asset: ImageResult, previewUrl: string | null): InvitationImageResponse {
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
    return new ServiceUnavailableException('Image storage is unavailable. Please try again.');
  }
}
