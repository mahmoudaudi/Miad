import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InvitationImagesService } from './invitation-images.service';

const invitationId = '22222222-2222-4222-8222-222222222222';
const imageId = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-09-22T12:00:00.000Z');
const image = {
  id: imageId,
  userId: 'owner-1',
  invitationId,
  fileName: 'shot.jpg',
  fileUrl: `invitation-media/user-1/${invitationId}/${imageId}.jpg`,
  fileType: 'image/jpeg',
  fileSize: BigInt(1024),
  createdAt: now,
};
const validJpeg = { fileName: 'shot.jpg', fileType: 'image/jpeg', fileSize: 1024 };

function storage(overrides: Record<string, unknown> = {}) {
  return {
    createSignedUploadUrl: async () => ({
      uploadUrl: 'https://storage/upload?token=t',
      token: 't',
    }),
    createSignedPreviewUrls: async (keys: string[]) => keys.map((key) => `https://preview/${key}`),
    getObjectInfo: async () => ({ size: 1024, mimetype: 'image/jpeg' }),
    downloadObject: async () => new Uint8Array([0xff, 0xd8, 0xff, 0, 0]),
    removeObject: async () => undefined,
    ...overrides,
  } as never;
}

function prisma(overrides: Record<string, unknown> = {}) {
  return {
    invitation: { findFirst: async () => ({ id: invitationId }) },
    invitationImage: {},
    ...overrides,
  } as never;
}

describe('InvitationImagesService', () => {
  it('rejects invalid metadata before accessing storage', async () => {
    const service = new InvitationImagesService(prisma(), storage());
    await expect(
      service.requestUpload('owner-1', invitationId, {
        fileName: 'a.svg',
        fileType: 'image/svg+xml',
        fileSize: 10,
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('checks invitation ownership and returns a server controlled image upload id', async () => {
    let signedPath = '';
    const service = new InvitationImagesService(
      prisma(),
      storage({
        createSignedUploadUrl: async (path: string) => {
          signedPath = path;
          return { uploadUrl: 'https://storage/upload?token=t', token: 't' };
        },
      })
    );
    const result = await service.requestUpload('owner-1', invitationId, validJpeg);
    expect(result.imageId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(signedPath).toBe(`owner-1/${invitationId}/${result.imageId}.jpg`);
  });

  it('returns safe 404s for non-owned image operations', async () => {
    const service = new InvitationImagesService(
      prisma({ invitation: { findFirst: async () => null } }),
      storage()
    );
    await expect(service.requestUpload('other', invitationId, validJpeg)).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(
      service.completeUpload('other', invitationId, imageId, validJpeg)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps pending uploads owned by the authenticated user', async () => {
    const pending = { ...image, userId: 'owner-1', invitationId: null };
    const service = new InvitationImagesService(
      prisma({ invitationImage: { findUnique: async () => pending } }),
      storage()
    );
    await expect(
      service.completePendingUpload('other-user', imageId, validJpeg)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('verifies and persists an uploaded image, returning a preview URL', async () => {
    let persisted: Record<string, unknown> | undefined;
    const service = new InvitationImagesService(
      prisma({
        invitationImage: {
          findUnique: async () => null,
          create: async ({ data }: { data: Record<string, unknown> }) => {
            persisted = data;
            return { ...image, ...data };
          },
        },
      }),
      storage()
    );
    const result = await service.completeUpload('owner-1', invitationId, imageId, validJpeg);
    expect(result).toMatchObject({ id: imageId, fileName: 'shot.jpg', fileSize: 1024 });
    expect(result.previewUrl).toContain(`owner-1/${invitationId}/${imageId}.jpg`);
    expect(persisted).toMatchObject({
      userId: 'owner-1',
      invitationId,
      fileUrl: `invitation-media/owner-1/${invitationId}/${imageId}.jpg`,
    });
  });

  it('reuses an existing completion without downloading the object again', async () => {
    let downloads = 0;
    const service = new InvitationImagesService(
      prisma({ invitationImage: { findUnique: async () => image } }),
      storage({
        downloadObject: async () => {
          downloads += 1;
          return new Uint8Array();
        },
      })
    );
    await expect(
      service.completeUpload('owner-1', invitationId, imageId, validJpeg)
    ).resolves.toMatchObject({ id: imageId });
    expect(downloads).toBe(0);
  });

  it('removes invalid image bytes and rejects the completion', async () => {
    const removed: string[] = [];
    const service = new InvitationImagesService(
      prisma({ invitationImage: { findUnique: async () => null } }),
      storage({
        downloadObject: async () => new Uint8Array([1, 2, 3]),
        removeObject: async (key: string) => {
          removed.push(key);
        },
      })
    );
    await expect(
      service.completeUpload('owner-1', invitationId, imageId, validJpeg)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(removed).toEqual([`owner-1/${invitationId}/${imageId}.jpg`]);
  });

  it('maps storage failures to a safe 503', async () => {
    const service = new InvitationImagesService(
      prisma(),
      storage({
        createSignedUploadUrl: async () => {
          throw new Error('storage offline');
        },
      })
    );
    await expect(service.requestUpload('owner-1', invitationId, validJpeg)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
