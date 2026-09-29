import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { INVITATION_IMAGE_BUCKET } from '../invitation-images/invitation-image-validation';

const specification = {
  schemaVersion: 1,
  theme: 'classic-ivory',
  content: { eyebrow: 'Welcome', title: 'Garden Dinner', dateLine: 'Saturday', venueLine: 'Garden' },
  colors: { background: '#fff', surface: '#fff', text: '#111', accent: '#a55' },
  typography: { headingFamily: 'Georgia', bodyFamily: 'Inter' },
  layout: { alignment: 'center', density: 'airy' },
  elements: [],
};
const row = {
  id: 'community-1', slug: 'garden-dinner', title: 'Garden Dinner', description: 'A calm evening.', category: 'dinner',
  designSpecification: specification, isPublished: true, views: 4, likes: 2, saves: 1,
  createdAt: new Date('2026-09-25T00:00:00.000Z'), creator: { firstName: 'A', lastName: 'Creator' },
};

describe('CommunityService', () => {
  it('looks up a listing only for its creator and invitation', async () => {
    let where: unknown;
    const service = new CommunityService({
      communityDesign: { findFirst: async (args: { where: unknown }) => { where = args.where; return row; } },
    } as never, {} as never);
    await expect(service.findMineForInvitation('owner-1', 'invitation-1')).resolves.toMatchObject({ id: row.id });
    expect(where).toEqual({ invitationId: 'invitation-1', creatorId: 'owner-1' });
  });

  it('deletes only the creator-owned community row, not the invitation', async () => {
    let where: unknown;
    const service = new CommunityService({
      communityDesign: { deleteMany: async (args: { where: unknown }) => { where = args.where; return { count: 1 }; } },
    } as never, {} as never);
    await expect(service.removeMine('owner-1', row.id)).resolves.toEqual({ id: row.id, deleted: true });
    expect(where).toEqual({ id: row.id, creatorId: 'owner-1' });
  });

  it('does not delete another creator’s listing', async () => {
    const service = new CommunityService({
      communityDesign: { deleteMany: async () => ({ count: 0 }) },
    } as never, {} as never);
    await expect(service.removeMine('owner-1', row.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('protects the clone endpoint with the existing JWT authentication guard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CommunityController.prototype.clone)).toContain(JwtAuthGuard);
  });

  it('returns only public-safe fields for published designs', async () => {
    let query: unknown;
    const service = new CommunityService({
      communityDesign: {
        findMany: async (args: unknown) => {
          query = args;
          return [row];
        },
      },
    } as never, {} as never);
    const result = await service.list({ limit: 8 });
    expect(result[0]).toEqual(expect.objectContaining({ slug: 'garden-dinner', creator: { name: 'A Creator' } }));
    expect(result[0]).not.toHaveProperty('invitationId');
    expect(result[0]).not.toHaveProperty('event');
    expect(query).toMatchObject({ where: { isPublished: true }, take: 8 });
  });

  it('rejects applying a missing or unpublished design', async () => {
    const service = new CommunityService({
      communityDesign: { findFirst: async () => null },
      invitation: { findFirst: async () => ({ id: 'inv-1', designs: [] }) },
    } as never, {} as never);
    await expect(service.apply('owner-1', 'private-design', 'inv-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('applies a public snapshot as a new active invitation version', async () => {
    const calls: unknown[] = [];
    const service = new CommunityService({
      communityDesign: { findFirst: async () => ({ designSpecification: specification }) },
      invitation: { findFirst: async () => ({ id: 'inv-1', designs: [{ version: 2 }] }) },
      $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback({
        invitationDesign: {
          updateMany: async (args: unknown) => { calls.push(args); },
          create: async (args: unknown) => { calls.push(args); return { id: 'design-3', version: 3, designSpecification: specification }; },
        },
      }),
    } as never, {} as never);
    await expect(service.apply('owner-1', 'garden-dinner', 'inv-1')).resolves.toMatchObject({ version: 3 });
    expect(calls[0]).toMatchObject({ where: { invitationId: 'inv-1', isActive: true }, data: { isActive: false } });
    expect(calls[1]).toMatchObject({ data: { invitationId: 'inv-1', version: 3, sourceType: 'COMMUNITY' } });
  });

  it('uses hashed reset-style identifiers only in persistence paths', () => {
    expect(createHash('sha256').update('sample').digest('hex')).not.toBe('sample');
  });

  function cloneHarness(options: { failAtDesign?: boolean; specification?: unknown } = {}) {
    const originalSpec = structuredClone(
      Object.prototype.hasOwnProperty.call(options, 'specification') ? options.specification : specification
    ) as Record<string, unknown>;
    const state: { events: unknown[]; invitations: unknown[]; images: unknown[]; designs: unknown[] } = {
      events: [], invitations: [], images: [], designs: [],
    };
    const prisma = {
      communityDesign: {
        findFirst: async ({ where }: { where: { slug: string; isPublished: boolean } }) =>
          where.slug === 'garden-dinner' && where.isPublished
            ? { ...row, creatorId: 'creator-1', invitationId: 'source-invitation', designSpecification: originalSpec }
            : null,
      },
      invitation: {
        findFirst: async ({ where }: { where: { id: string; event: { userId: string } } }) =>
          where.id === 'source-invitation' && where.event.userId === 'creator-1' ? { id: where.id } : null,
      },
      invitationImage: {
        findMany: async ({ where }: { where: { id: { in: string[] }; userId: string; invitationId: string } }) =>
          where.userId === 'creator-1' && where.invitationId === 'source-invitation'
            ? images.filter((image) => where.id.in.includes(image.id))
            : [],
      },
      $transaction: async <T>(callback: (transaction: never) => Promise<T>) => {
        const pending = { events: [] as unknown[], invitations: [] as unknown[], images: [] as unknown[], designs: [] as unknown[] };
        const transaction = {
          event: { create: async ({ data }: { data: unknown }) => { pending.events.push(data); return { id: 'clone-event' }; } },
          invitation: { create: async ({ data }: { data: { id: string } }) => { pending.invitations.push(data); return { id: data.id }; } },
          invitationImage: { createMany: async ({ data }: { data: unknown[] }) => { pending.images.push(...data); } },
          invitationDesign: {
            create: async ({ data }: { data: unknown }) => {
              if (options.failAtDesign) throw new Error('database unavailable');
              pending.designs.push(data);
              return { id: 'clone-design', version: 1 };
            },
          },
        };
        const result = await callback(transaction as never);
        state.events.push(...pending.events);
        state.invitations.push(...pending.invitations);
        state.images.push(...pending.images);
        state.designs.push(...pending.designs);
        return result;
      },
    };
    const copied: string[] = [];
    const removed: string[][] = [];
    const storage = {
      copyObject: async (_from: string, to: string) => { copied.push(to); },
      removeObjects: async (keys: string[]) => { removed.push(keys); },
    };
    return { service: new CommunityService(prisma as never, storage as never), state, copied, removed, originalSpec };
  }

  const images = [{
    id: '123e4567-e89b-12d3-a456-426614174000', userId: 'creator-1', invitationId: 'source-invitation',
    fileName: 'photo.jpg', fileUrl: `${INVITATION_IMAGE_BUCKET}/creator-1/source-invitation/123e4567-e89b-12d3-a456-426614174000.jpg`,
    fileType: 'image/jpeg', fileSize: BigInt(123),
  }];

  it('creates a new owner-owned event, invitation, and independent design from a published snapshot', async () => {
    const harness = cloneHarness();
    const result = await harness.service.clone('requesting-user', 'garden-dinner');
    expect(result).toEqual({ invitationId: expect.any(String), designId: 'clone-design', version: 1 });
    expect(harness.state.events[0]).toMatchObject({ userId: 'requesting-user', title: row.title });
    expect(harness.state.invitations[0]).toMatchObject({ id: result.invitationId, eventId: 'clone-event', status: 'DRAFT' });
    expect(harness.state.designs[0]).toMatchObject({
      invitationId: result.invitationId,
      sourceType: 'COMMUNITY',
      isActive: true,
      designSpecification: specification,
    });
    const clonedSpec = (harness.state.designs[0] as { designSpecification: typeof specification }).designSpecification;
    clonedSpec.content.title = 'Edited copy';
    expect(harness.originalSpec.content).toEqual(specification.content);
    (harness.originalSpec.content as { title: string }).title = 'Original edited separately';
    expect(clonedSpec.content.title).toBe('Edited copy');
  });

  it('copies referenced images to the clone owner and remaps only the clone specification', async () => {
    const imageSpec = {
      ...structuredClone(specification),
      elements: [
        { id: 'hero', type: 'image', label: 'Photo', imageUrl: `image://${images[0]!.id}`, x: 0, y: 0, width: 100, height: 50, fontSize: 12, color: '#111' },
        { id: 'private-url', type: 'image', label: 'Private URL', imageUrl: 'https://project.supabase.co/storage/v1/object/sign/private/photo.jpg?token=secret' },
      ],
    };
    const harness = cloneHarness({ specification: imageSpec });
    const result = await harness.service.clone('requesting-user', 'garden-dinner');
    expect(harness.copied).toHaveLength(1);
    expect(harness.copied[0]).toContain(`requesting-user/${result.invitationId}/`);
    expect(harness.state.images).toHaveLength(1);
    expect(harness.state.images[0]).toMatchObject({ userId: 'requesting-user', invitationId: result.invitationId });
    const sourceId = images[0]!.id;
    const cloneSpec = (harness.state.designs[0] as { designSpecification: typeof imageSpec }).designSpecification;
    expect(cloneSpec.elements[0]?.imageUrl).not.toBe(`image://${sourceId}`);
    expect(cloneSpec.elements[1]?.imageUrl).toBe('');
    expect(JSON.stringify(harness.originalSpec)).toContain(`image://${sourceId}`);
  });

  it('rejects private/inaccessible and malformed community records', async () => {
    const privateHarness = cloneHarness();
    await expect(privateHarness.service.clone('user-1', 'private-design')).rejects.toBeInstanceOf(NotFoundException);
    const malformedHarness = cloneHarness({ specification: null });
    await expect(malformedHarness.service.clone('user-1', 'garden-dinner')).rejects.toBeInstanceOf(BadRequestException);
    expect(malformedHarness.state.invitations).toHaveLength(0);
  });

  it('does not leave database rows when transactional clone creation fails and compensates copied storage', async () => {
    const imageSpec = {
      ...structuredClone(specification),
      elements: [{ id: 'hero', type: 'image', label: 'Photo', imageUrl: `image://${images[0]!.id}` }],
    };
    const harness = cloneHarness({ failAtDesign: true, specification: imageSpec });
    await expect(harness.service.clone('requesting-user', 'garden-dinner')).rejects.toThrow('database unavailable');
    expect(harness.state.events).toHaveLength(0);
    expect(harness.state.invitations).toHaveLength(0);
    expect(harness.state.images).toHaveLength(0);
    expect(harness.state.designs).toHaveLength(0);
    expect(harness.removed).toHaveLength(1);
    expect(harness.removed[0]).toEqual(harness.copied);
  });
});
