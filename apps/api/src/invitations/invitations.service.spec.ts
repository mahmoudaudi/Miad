import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvitationsService } from './invitations.service';

const record = {
  id: '11111111-1111-4111-8111-111111111111',
  eventId: '22222222-2222-4222-8222-222222222222',
  slug: 'garden-dinner',
  status: 'DRAFT',
  publishedAt: null,
  createdAt: new Date('2026-09-20T00:00:00.000Z'),
  updatedAt: new Date('2026-09-20T00:00:00.000Z'),
  event: {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Garden Dinner',
    eventDate: new Date('2026-10-12T00:00:00.000Z'),
  },
  designs: [{ id: '33333333-3333-4333-8333-333333333333' }],
};
const validDesigns = { findOwnedRenderable: async () => ({}) };

describe('InvitationsService', () => {
  it('lists invitations with one owner-scoped query and selected event fields', async () => {
    let query: unknown;
    const prisma = {
      invitation: {
        findMany: async (args: unknown) => {
          query = args;
          return [record];
        },
      },
    };
    const result = await new InvitationsService(prisma as never, validDesigns as never).findAll(
      'owner-1',
      record.eventId
    );
    expect(query).toMatchObject({
      where: { event: { userId: 'owner-1' }, eventId: record.eventId },
      select: { designs: { where: { isActive: true }, select: { id: true } } },
    });
    expect(result[0]).toMatchObject({ slug: 'garden-dinner', status: 'DRAFT', hasDesign: true });
    expect(result[0]?.event).not.toHaveProperty('userId');
  });

  it('checks event ownership before creating a draft invitation', async () => {
    let data: unknown;
    const prisma = {
      event: { findFirst: async () => ({ id: record.eventId }) },
      invitation: {
        create: async (args: { data: unknown }) => {
          data = args.data;
          return record;
        },
      },
    };
    await new InvitationsService(prisma as never, validDesigns as never).create('owner-1', {
      eventId: record.eventId,
      slug: record.slug,
    });
    expect(data).toEqual({
      eventId: record.eventId,
      slug: record.slug,
      status: 'DRAFT',
      publishedAt: null,
    });
  });

  it('cannot create inside a missing or non-owned event', async () => {
    const service = new InvitationsService(
      { event: { findFirst: async () => null } } as never,
      validDesigns as never
    );
    await expect(
      service.create('owner-2', { eventId: record.eventId, slug: record.slug })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a safe not-found response for a non-owned invitation', async () => {
    const service = new InvitationsService(
      {
        invitation: { findFirst: async () => null },
      } as never,
      validDesigns as never
    );
    await expect(service.findOne('owner-2', record.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('publishes and unpublishes an owned invitation with an active design', async () => {
    const updates: unknown[] = [];
    const validateDesign = jest.fn(async () => ({}));
    let currentStatus = 'DRAFT';
    let currentPublishedAt: Date | null = null;
    let currentPublishedDesignVersion: number | null = null;
    const prisma = {
      invitation: {
        findFirst: async () => ({
          id: record.id,
          status: currentStatus,
          publishedAt: currentPublishedAt,
          publishedDesignVersion: currentPublishedDesignVersion,
          designs: [{ version: 3 }],
        }),
        update: async (args: { data: unknown }) => {
          updates.push(args.data);
          const data = args.data as {
            status: string;
            publishedAt: Date | null;
            publishedDesignVersion: number | null;
          };
          currentStatus = data.status;
          currentPublishedAt = data.publishedAt;
          currentPublishedDesignVersion = data.publishedDesignVersion;
          return { ...record, status: data.status, publishedAt: data.publishedAt };
        },
      },
    };
    const service = new InvitationsService(
      prisma as never,
      { findOwnedRenderable: validateDesign } as never
    );
    const published = await service.updatePublication('owner-1', record.id, true);
    const unpublished = await service.updatePublication('owner-1', record.id, false);
    expect(updates[0]).toMatchObject({
      status: 'PUBLISHED',
      publishedAt: expect.any(Date),
      publishedDesignVersion: 3,
    });
    expect(updates[1]).toEqual({
      status: 'DRAFT',
      publishedAt: null,
      publishedDesignVersion: null,
    });
    expect(published.status).toBe('PUBLISHED');
    expect(published.slug).toBe(record.slug);
    expect(validateDesign).toHaveBeenCalledTimes(1);
    expect(unpublished).toMatchObject({ status: 'DRAFT', publishedAt: null });
  });

  it('refuses to publish a design rejected by the safe render validator', async () => {
    const update = jest.fn();
    const service = new InvitationsService(
      {
        invitation: {
          findFirst: async () => ({
            id: record.id,
            status: 'DRAFT',
            publishedAt: null,
            publishedDesignVersion: null,
            designs: [{ version: 1 }],
          }),
          update,
        },
      } as never,
      {
        findOwnedRenderable: async () => {
          throw new BadRequestException('Invalid design');
        },
      } as never
    );
    await expect(service.updatePublication('owner-1', record.id, true)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('requires ownership and an active design before publishing', async () => {
    const missing = new InvitationsService(
      {
        invitation: { findFirst: async () => null },
      } as never,
      validDesigns as never
    );
    await expect(missing.updatePublication('owner-2', record.id, true)).rejects.toBeInstanceOf(
      NotFoundException
    );

    const undesigned = new InvitationsService(
      {
        invitation: {
          findFirst: async () => ({
            id: record.id,
            status: 'DRAFT',
            publishedAt: null,
            publishedDesignVersion: null,
            designs: [],
          }),
        },
      } as never,
      validDesigns as never
    );
    await expect(undesigned.updatePublication('owner-1', record.id, true)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('deletes an owned invitation with its whole subtree in one transaction', async () => {
    const whereClauses: unknown[] = [];
    const removedObjects: unknown[] = [];
    const track = (label: string) => async (args: { where: unknown }) => {
      whereClauses.push([label, args.where]);
      return { count: 1 };
    };
    const prisma = {
      invitation: {
        updateMany: async (args: { where: unknown }) => {
          whereClauses.push(['invitation.updateMany', args.where]);
          return { count: 1 };
        },
        findFirst: async () => ({ ...record, slug: 'updated-slug', media: [] }),
        delete: async (args: { where: unknown }) => {
          whereClauses.push(['invitation.delete', args.where]);
          return record;
        },
      },
      rsvp: { deleteMany: track('rsvp.deleteMany') },
      guest: { deleteMany: track('guest.deleteMany') },
      mediaAsset: { deleteMany: track('mediaAsset.deleteMany') },
      aiUsage: { deleteMany: track('aiUsage.deleteMany') },
      invitationView: { deleteMany: track('invitationView.deleteMany') },
      invitationDesign: { deleteMany: track('invitationDesign.deleteMany') },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    const storage = { removeObject: async (key: unknown) => void removedObjects.push(key) };
    const service = new InvitationsService(
      prisma as never,
      validDesigns as never,
      storage as never
    );
    await service.update('owner-1', record.id, { slug: 'updated-slug' });
    await service.remove('owner-1', record.id);
    expect(whereClauses).toEqual([
      ['invitation.updateMany', { id: record.id, event: { userId: 'owner-1' } }],
      ['rsvp.deleteMany', { guest: { invitationId: record.id } }],
      ['guest.deleteMany', { invitationId: record.id }],
      ['mediaAsset.deleteMany', { invitationId: record.id }],
      ['aiUsage.deleteMany', { invitationId: record.id }],
      ['invitationView.deleteMany', { invitationId: record.id }],
      ['invitationDesign.deleteMany', { invitationId: record.id }],
      ['invitation.delete', { id: record.id }],
    ]);
    expect(removedObjects).toEqual([]);
  });

  it('removes stored media objects best-effort before deleting rows', async () => {
    const removed: unknown[] = [];
    const prisma = {
      invitation: {
        findFirst: async () => ({
          id: record.id,
          media: [{ fileUrl: 'invitation-media/owner-1/inv-1/good' }],
        }),
        delete: async () => record,
      },
      rsvp: { deleteMany: async () => ({ count: 0 }) },
      guest: { deleteMany: async () => ({ count: 0 }) },
      mediaAsset: { deleteMany: async () => ({ count: 1 }) },
      aiUsage: { deleteMany: async () => ({ count: 0 }) },
      invitationView: { deleteMany: async () => ({ count: 0 }) },
      invitationDesign: { deleteMany: async () => ({ count: 0 }) },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    const storage = {
      removeObject: async (key: unknown) => void removed.push(key),
    };
    await new InvitationsService(prisma as never, validDesigns as never, storage as never).remove(
      'owner-1',
      record.id
    );
    expect(removed).toEqual(['owner-1/inv-1/good']);
  });

  it('still deletes rows when storage cleanup fails', async () => {
    let deleted = false;
    const prisma = {
      invitation: {
        findFirst: async () => ({
          id: record.id,
          media: [{ fileUrl: 'invitation-media/owner-1/inv-1/stale' }],
        }),
        delete: async () => {
          deleted = true;
          return record;
        },
      },
      rsvp: { deleteMany: async () => ({ count: 0 }) },
      guest: { deleteMany: async () => ({ count: 0 }) },
      mediaAsset: { deleteMany: async () => ({ count: 1 }) },
      aiUsage: { deleteMany: async () => ({ count: 1 }) },
      invitationView: { deleteMany: async () => ({ count: 0 }) },
      invitationDesign: { deleteMany: async () => ({ count: 1 }) },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    const storage = {
      removeObject: async () => {
        throw new Error('storage down');
      },
    };
    await new InvitationsService(prisma as never, validDesigns as never, storage as never).remove(
      'owner-1',
      record.id
    );
    expect(deleted).toBe(true);
  });

  it('returns not-found for a non-owned invitation without deleting anything', async () => {
    let writes = 0;
    const write = async () => {
      writes += 1;
      return { count: 0 };
    };
    const prisma = {
      invitation: { findFirst: async () => null, delete: write },
      rsvp: { deleteMany: write },
      guest: { deleteMany: write },
      mediaAsset: { deleteMany: write },
      aiUsage: { deleteMany: write },
      invitationView: { deleteMany: write },
      invitationDesign: { deleteMany: write },
    };
    await expect(
      new InvitationsService(prisma as never, validDesigns as never).remove('owner-2', record.id)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(writes).toBe(0);
  });
});
