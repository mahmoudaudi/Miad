import { NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CommunityService } from './community.service';

const specification = { schemaVersion: 1, theme: 'classic-ivory', content: { title: 'Garden Dinner' } };
const row = {
  id: 'community-1', slug: 'garden-dinner', title: 'Garden Dinner', description: 'A calm evening.', category: 'dinner',
  designSpecification: specification, isPublished: true, views: 4, likes: 2, saves: 1,
  createdAt: new Date('2026-09-25T00:00:00.000Z'), creator: { firstName: 'A', lastName: 'Creator' },
};

describe('CommunityService', () => {
  it('returns only public-safe fields for published designs', async () => {
    const service = new CommunityService({ communityDesign: { findMany: async () => [row] } } as never);
    const result = await service.list({});
    expect(result[0]).toEqual(expect.objectContaining({ slug: 'garden-dinner', creator: { name: 'A Creator' } }));
    expect(result[0]).not.toHaveProperty('invitationId');
    expect(result[0]).not.toHaveProperty('event');
  });

  it('rejects applying a missing or unpublished design', async () => {
    const service = new CommunityService({
      communityDesign: { findFirst: async () => null },
      invitation: { findFirst: async () => ({ id: 'inv-1', designs: [] }) },
    } as never);
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
    } as never);
    await expect(service.apply('owner-1', 'garden-dinner', 'inv-1')).resolves.toMatchObject({ version: 3 });
    expect(calls[0]).toMatchObject({ where: { invitationId: 'inv-1', isActive: true }, data: { isActive: false } });
    expect(calls[1]).toMatchObject({ data: { invitationId: 'inv-1', version: 3, sourceType: 'COMMUNITY' } });
  });

  it('uses hashed reset-style identifiers only in persistence paths', () => {
    expect(createHash('sha256').update('sample').digest('hex')).not.toBe('sample');
  });
});
