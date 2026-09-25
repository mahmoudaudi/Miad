import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTemplates } from './templates';

afterEach(() => {
  vi.unstubAllGlobals();
});

function apiResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const apiRow = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'classic-ivory',
  name: 'Classic Ivory',
  description: 'Warm ivory.',
  category: 'wedding',
  specification: { schemaVersion: 1, theme: 'classic-ivory' },
  createdAt: '2026-09-23T00:00:00.000Z',
};

describe('template catalog client', () => {
  it('returns validated API rows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse([apiRow])));
    const rows = await getTemplates();
    expect(rows).toEqual([apiRow]);
  });

  it('returns an empty catalog on API failure instead of mock templates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(getTemplates()).resolves.toEqual([]);
  });

  it('returns an empty catalog when the API shape is unexpected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse({ wrong: true })));
    await expect(getTemplates()).resolves.toEqual([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse([{ slug: 'x' }])));
    await expect(getTemplates()).resolves.toEqual([]);
  });

  it('caches the catalog request hourly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(apiResponse([apiRow]));
    vi.stubGlobal('fetch', fetchMock);
    await getTemplates();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ next: { revalidate: 3600 } });
  });
});
