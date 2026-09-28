import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatCompact,
  formatMoney,
  getAdminOverview,
  getOverviewGenerations,
  initialsOf,
  isAbortError,
  timeAgo,
} from './admin';

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('admin client helpers', () => {
  it('formats relative times', () => {
    const now = new Date('2026-09-27T18:00:00Z').getTime();
    expect(timeAgo('2026-09-27T17:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-09-27T17:58:00Z', now)).toBe('2 mins ago');
    expect(timeAgo('2026-09-27T17:00:00Z', now)).toBe('1 hour ago');
    expect(timeAgo('2026-09-25T18:00:00Z', now)).toBe('2 days ago');
  });

  it('derives initials', () => {
    expect(initialsOf('Mahmoud Abbas')).toBe('MA');
    expect(initialsOf('Maya')).toBe('M');
    expect(initialsOf('  ')).toBe('?');
  });

  it('compacts large numbers and formats money', () => {
    expect(formatCompact(482910)).toContain('482');
    expect(formatMoney(24820, 'USD')).toContain('24,820');
    expect(formatMoney(0, 'USD')).toContain('0');
  });

  it('requests the paginated overview endpoint', async () => {
    const payload = { users: { total: 1 } };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(payload, 200));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAdminOverview(2, 6)).resolves.toEqual(payload);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/admin/overview?page=2&limit=6');
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('detects fetch cancellations', () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    expect(isAbortError(abort)).toBe(true);
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError(new Error('Request failed (500)'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });

  it('passes an abort signal through to fetch', async () => {
    const payload = { items: [] };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(payload, 200));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(getOverviewGenerations(2, 6, controller.signal)).resolves.toEqual(payload);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal: controller.signal })
    );
  });
});
