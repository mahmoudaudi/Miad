import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getCommunityDesigns } from '@/lib/community';
import { TemplateShowcase } from './TemplateShowcase';

vi.mock('@/lib/community', () => ({ getCommunityDesigns: vi.fn() }));

describe('landing community template showcase', () => {
  it('renders published community designs returned by the real community data path', async () => {
    vi.mocked(getCommunityDesigns).mockResolvedValue([
      {
        id: 'community-1',
        slug: 'garden-dinner',
        title: 'Garden Dinner',
        description: 'A calm evening.',
        category: 'garden-party',
        specification: {
          colors: { background: '#f5efe5', text: '#241c18', accent: '#8b7355' },
          content: { dateLine: 'Saturday evening' },
          typography: { headingFamily: 'Georgia' },
        },
        creator: { name: 'A Creator' },
        engagement: { views: 4, likes: 2, saves: 1 },
        isPublished: true,
        createdAt: '2026-09-29T00:00:00.000Z',
      },
    ]);

    const html = renderToStaticMarkup(await TemplateShowcase({ locale: 'en' }));

    expect(getCommunityDesigns).toHaveBeenCalledWith({ limit: 8 });
    expect(html).toContain('Garden Dinner');
    expect(html).toContain('By A Creator');
    expect(html).toContain('Garden Party');
    expect(html).toContain('Saturday evening');
  });

  it('keeps the honest empty state when no community designs are published', async () => {
    vi.mocked(getCommunityDesigns).mockResolvedValue([]);
    const html = renderToStaticMarkup(await TemplateShowcase({ locale: 'en' }));
    expect(html).toContain('No templates in this category yet.');
  });
});
