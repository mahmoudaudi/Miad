import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { MediaService } from './media.service';

const now = new Date('2026-09-22T12:00:00.000Z');
const invitationId = '22222222-2222-4222-8222-222222222222';
const mediaId = '33333333-3333-4333-8333-333333333333';
const fileUrl = `invitation-media/user-1/${invitationId}/${mediaId}.jpg`;
const asset = {
  id: mediaId,
  invitationId,
  fileName: 'shot.jpg',
  fileUrl,
  fileType: 'image/jpeg',
  fileSize: BigInt(1024),
  createdAt: now,
};

const validJpeg = {
  fileName: 'shot.jpg',
  fileType: 'image/jpeg',
  fileSize: 1024,
};

function prismaWith(overrides: Record<string, unknown>) {
  return {
    invitation: { findFirst: async () => ({ id: invitationId }) },
    mediaAsset: {},
    ...overrides,
  } as never;
}

function storageMock(overrides: Record<string, unknown> = {}) {
  return {
    createSignedUploadUrl: async () => ({
      uploadUrl: 'https://example.supabase.co/storage/v1/object/upload/sign/x?token=t',
      token: 't',
    }),
    createSignedPreviewUrls: async (keys: string[]) => keys.map((key) => `https://preview/${key}`),
    getObjectInfo: async () => ({ size: 1024, mimetype: 'image/jpeg' }),
    downloadObject: async () => new Uint8Array([0xff, 0xd8, 0xff, 0, 0]),
    removeObject: async () => undefined,
    ...overrides,
  } as never;
}

describe('MediaService', () => {
  it('rejects invalid upload metadata before any storage or ownership work', async () => {
    const service = new MediaService(
      { invitation: { findFirst: async () => ({ id: invitationId }) } } as never,
      storageMock({ createSignedUploadUrl: async () => {
        throw new Error('should not sign');
      } }) as never
    );
    await expect(
      service.requestUpload('owner-1', invitationId, {
        fileName: 'a.svg',
        fileType: 'image/svg+xml',
        fileSize: 10,
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns the same safe 404 for missing and non-owned invitations', async () => {
    const service = new MediaService(
      prismaWith({ invitation: { findFirst: async () => null } }),
      storageMock()
    );
    await expect(service.list('owner-2', invitationId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.requestUpload('owner-2', invitationId, validJpeg)
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.completeUpload('owner-2', invitationId, mediaId, validJpeg)
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('owner-2', invitationId, mediaId)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('generates a server-controlled object path scoped to owner, invitation, and mediaId', async () => {
    let signedPath: string | undefined;
    const service = new MediaService(
      prismaWith({}),
      storageMock({
        createSignedUploadUrl: async (key: string) => {
          signedPath = key;
          return { uploadUrl: 'https://example/upload?token=t', token: 't' };
        },
      })
    );
    const result = await service.requestUpload('owner-1', invitationId, validJpeg);
    expect(signedPath).toBe(`owner-1/${invitationId}/${result.mediaId}.jpg`);
    expect(result.mediaId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.uploadUrl).toContain('https://example/upload');
  });

  it('persists a verified upload and is idempotent when completed twice', async () => {
    let created: Record<string, unknown> | undefined;
    let downloads = 0;
    const prisma = prismaWith({
      mediaAsset: {
        findUnique: async () => (created ? { ...asset, ...created } : null),
        create: async (args: { data: Record<string, unknown> }) => {
          created = args.data;
          return {
            id: args.data.id,
            invitationId,
            fileName: args.data.fileName,
            fileUrl: args.data.fileUrl,
            fileType: args.data.fileType,
            fileSize: BigInt(args.data.fileSize as bigint),
            createdAt: now,
          };
        },
      },
    });
    const service = new MediaService(
      prisma,
      storageMock({
        downloadObject: async () => {
          downloads += 1;
          return new Uint8Array([0xff, 0xd8, 0xff, 0, 0]);
        },
      })
    );
    const first = await service.completeUpload('owner-1', invitationId, mediaId, validJpeg);
    expect(first).toMatchObject({ id: mediaId, fileName: 'shot.jpg', fileSize: 1024 });
    expect(first.previewUrl).toContain(`owner-1/${invitationId}/${mediaId}.jpg`);
    expect(created).toMatchObject({
      userId: 'owner-1',
      invitationId,
      fileUrl: `invitation-media/owner-1/${invitationId}/${mediaId}.jpg`,
      fileType: 'image/jpeg',
    });

    const second = await service.completeUpload('owner-1', invitationId, mediaId, validJpeg);
    expect(second.id).toBe(mediaId);
    expect(downloads).toBe(1);
  });

  it('cleans up the uploaded object when the signature does not match', async () => {
    const removed: string[] = [];
    const service = new MediaService(
      prismaWith({ mediaAsset: { findUnique: async () => null, create: async () => asset } }),
      storageMock({
        downloadObject: async () => new Uint8Array([0x00, 0x01, 0x02]),
        removeObject: async (key: string) => {
          removed.push(key);
        },
      })
    );
    await expect(
      service.completeUpload('owner-1', invitationId, mediaId, validJpeg)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(removed).toEqual([`owner-1/${invitationId}/${mediaId}.jpg`]);
  });

  it('cleans up the uploaded object when the stored size does not match', async () => {
    const removed: string[] = [];
    const service = new MediaService(
      prismaWith({ mediaAsset: { findUnique: async () => null, create: async () => asset } }),
      storageMock({
        getObjectInfo: async () => ({ size: 999, mimetype: 'image/jpeg' }),
        removeObject: async (key: string) => {
          removed.push(key);
        },
      })
    );
    await expect(
      service.completeUpload('owner-1', invitationId, mediaId, validJpeg)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(removed).toHaveLength(1);
  });

  it('rejects completion when no object was uploaded', async () => {
    const service = new MediaService(
      prismaWith({ mediaAsset: { findUnique: async () => null } }),
      storageMock({ getObjectInfo: async () => null })
    );
    await expect(
      service.completeUpload('owner-1', invitationId, mediaId, validJpeg)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects metadata at completion only after ownership and cleans the pending object', async () => {
    const removed: string[] = [];
    const service = new MediaService(
      prismaWith({}),
      storageMock({
        removeObject: async (key: string) => {
          removed.push(key);
        },
      })
    );
    await expect(
      service.completeUpload('owner-1', invitationId, mediaId, {
        fileName: 'shot.jpg',
        fileType: 'image/jpeg',
        fileSize: 7 * 1024 * 1024,
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(removed).toEqual([`owner-1/${invitationId}/${mediaId}.jpg`]);
  });

  it('maps unexpected storage failures to a safe 503', async () => {
    const service = new MediaService(
      prismaWith({}),
      storageMock({ createSignedUploadUrl: async () => { throw new Error('network down'); } })
    );
    await expect(
      service.requestUpload('owner-1', invitationId, validJpeg)
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('lists a bounded page with batched previews, a keyset cursor, and validates bad cursors', async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
      ...asset,
      id: `44444444-4444-4444-8444-44444444444${index}`,
      createdAt: new Date(now.getTime() - index * 1000),
      fileUrl: `invitation-media/owner-1/${invitationId}/44444444-4444-4444-8444-44444444444${index}.jpg`,
    }));
    let taken: number | undefined;
    let batchedKeys: string[] | undefined;
    const service = new MediaService(
      prismaWith({
        mediaAsset: {
          findMany: async (args: { take: number; where: unknown }) => {
            taken = args.take;
            return rows;
          },
        },
      }),
      storageMock({
        createSignedPreviewUrls: async (keys: string[]) => {
          batchedKeys = keys;
          return keys.map((key) => `https://preview/${key}`);
        },
      })
    );

    const page = await service.list('owner-1', invitationId, undefined, 2);
    expect(taken).toBe(3);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeTruthy();
    expect(batchedKeys).toHaveLength(2);
    expect(page.items[0]?.previewUrl).toContain('https://preview/');

    await expect(service.list('owner-1', invitationId, 'bogus')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('deletes the storage object first and then the row, staying idempotent on retries', async () => {
    const order: string[] = [];
    const service = new MediaService(
      prismaWith({
        mediaAsset: {
          findFirst: async () => asset,
          delete: async () => {
            order.push('db');
            return asset;
          },
        },
      }),
      storageMock({
        removeObject: async () => {
          order.push('storage');
        },
      })
    );
    await service.remove('owner-1', invitationId, mediaId);
    expect(order).toEqual(['storage', 'db']);
  });

  it('keeps the database row when storage removal fails', async () => {
    let deleted = false;
    const service = new MediaService(
      prismaWith({
        mediaAsset: {
          findFirst: async () => asset,
          delete: async () => {
            deleted = true;
            return asset;
          },
        },
      }),
      storageMock({
        removeObject: async () => {
          throw new Error('remove-object-failed');
        },
      })
    );
    await expect(service.remove('owner-1', invitationId, mediaId)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(deleted).toBe(false);
  });

  it('returns a safe 404 when deleting another owner’s media', async () => {
    const service = new MediaService(
      prismaWith({ mediaAsset: { findFirst: async () => null } }),
      storageMock()
    );
    await expect(service.remove('owner-2', invitationId, mediaId)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
