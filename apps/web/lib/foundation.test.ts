import { afterEach, describe, expect, it, vi } from 'vitest';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/env';
import { apiClient } from '@/lib/api-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('frontend foundation', () => {
  it('joins class names', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('provides a default API url', () => {
    expect(typeof getApiUrl()).toBe('string');
  });

  it('sends cookies through the generic API client', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiClient<{ status: string }>('/health');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.objectContaining({ credentials: 'include' })
    );
  });
});
