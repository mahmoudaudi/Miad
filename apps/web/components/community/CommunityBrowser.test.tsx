import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityBrowser } from './CommunityBrowser';
import type { CommunityDesignRecord } from '@/lib/community';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const makeDesign = (specification: unknown): CommunityDesignRecord => ({
  id: 'community-1',
  slug: 'garden-dinner',
  title: 'Garden Dinner',
  description: 'A calm evening.',
  category: 'dinner',
  specification,
  creator: { name: 'Miad creator' },
  engagement: { views: 0, likes: 0, saves: 0 },
  isPublished: true,
  createdAt: '2026-09-28T00:00:00.000Z',
});

describe('CommunityBrowser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a safe fallback for legacy specifications without colors', () => {
    const html = renderToStaticMarkup(
      createElement(CommunityBrowser, { designs: [makeDesign({ content: { title: 'Legacy' } })] })
    );
    expect(html).toContain('Preview unavailable');
    expect(html).toContain('Use this design');
    expect(html).not.toContain('undefined');
  });

  it('shows an unavailable fallback instead of dereferencing null specifications', () => {
    const html = renderToStaticMarkup(
      createElement(CommunityBrowser, { designs: [makeDesign(null)] })
    );
    expect(html).toContain('Preview unavailable');
    expect(html).toContain('This design is unavailable.');
  });

  it('shows the empty state when there are no public designs', () => {
    const html = renderToStaticMarkup(createElement(CommunityBrowser, { designs: [] }));
    expect(html).toContain('No community designs match this search.');
  });
});
