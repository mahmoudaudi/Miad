import { TemplatesService } from './templates.service';

const now = new Date('2026-09-23T12:00:00.000Z');
const row = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'classic-ivory',
  name: 'Classic Ivory',
  description: 'Warm ivory.',
  category: 'wedding',
  specification: { schemaVersion: 1, theme: 'classic-ivory' },
  createdAt: now,
};

describe('TemplatesService', () => {
  it('lists only active templates in display order with safe fields', async () => {
    let where: unknown;
    let orderBy: unknown;
    const service = new TemplatesService({
      template: {
        findMany: async (args: { where: unknown; orderBy: unknown }) => {
          where = args.where;
          orderBy = args.orderBy;
          return [row];
        },
      },
    } as never);
    const list = await service.list();
    expect(where).toEqual({ isActive: true });
    expect(orderBy).toEqual([{ sortOrder: 'asc' }, { createdAt: 'asc' }]);
    expect(list).toEqual([
      {
        id: row.id,
        slug: 'classic-ivory',
        name: 'Classic Ivory',
        description: 'Warm ivory.',
        category: 'wedding',
        specification: { schemaVersion: 1, theme: 'classic-ivory' },
        createdAt: now.toISOString(),
      },
    ]);
    expect(Object.keys(list[0] ?? {}).sort()).toEqual(
      ['category', 'createdAt', 'description', 'id', 'name', 'slug', 'specification'].sort()
    );
  });

  it('returns an empty catalog when nothing is active', async () => {
    const service = new TemplatesService({
      template: { findMany: async () => [] },
    } as never);
    await expect(service.list()).resolves.toEqual([]);
  });
});
