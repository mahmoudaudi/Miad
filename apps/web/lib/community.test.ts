import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCommunityDesigns } from './community';

afterEach(() => {
  vi.unstubAllGlobals();
});

const communityRow = {
  id: 'community-1',
  slug: 'garden-dinner',
  title: 'Garden Dinner',
  description: 'A calm evening.',
  category: 'dinner',
  specification: { colors: { background: '#fff', text: '#111', accent: '#a55' } },
  creator: { name: 'Miad creator' },
  engagement: { views: 4, likes: 2, saves: 1 },
  isPublished: true,
  createdAt: '2026-09-29T00:00:00.000Z',
};

describe('community catalog client', () => {
  it('loads a bounded published-community request for the landing showcase', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([communityRow]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCommunityDesigns({ limit: 8 })).resolves.toEqual([communityRow]);
    expect(fetchMock.mock.calls[0]).toEqual([
      expect.stringMatching(/\/community\?limit=8$/),
      expect.objectContaining({
        next: { revalidate: 60 },
        headers: { Accept: 'application/json' },
      }),
    ]);
  });

  it('rejects malformed API rows instead of passing untrusted shapes to the landing page', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify([{ ...communityRow, creator: null }]), { status: 200 })
        )
    );
    await expect(getCommunityDesigns({ limit: 8 })).resolves.toEqual([]);
  });
});
