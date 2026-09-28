import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdminCommunity } from '@/lib/admin';
import { CommunityKpis } from './CommunityKpis';
import { CommunityTable } from './CommunityTable';

const data: AdminCommunity = {
  kpis: { published: 12, hidden: 2, totalViews: 1500, totalLikes: 180, newThisWeek: 3 },
  categories: ['Wedding', 'Birthday'],
  table: {
    items: [
      {
        id: 'c-1',
        title: 'Neon Gala',
        slug: 'neon-gala',
        category: 'Wedding',
        isPublished: true,
        views: 120,
        likes: 14,
        saves: 3,
        createdAt: '2026-09-20T10:00:00Z',
        updatedAt: '2026-09-21T10:00:00Z',
        creator: { name: 'Ahmad K', email: 'ahmad@k.me' },
        invitationSlug: 'neon-gala-inv',
      },
    ],
    page: 1,
    limit: 6,
    total: 1,
    totalPages: 1,
  },
};

const noop = () => undefined;
const filters = { sort: 'newest' as const, page: 1, limit: 6 };

describe('CommunityKpis', () => {
  it('renders live showcase counters', () => {
    const html = renderToStaticMarkup(<CommunityKpis data={data} />);
    expect(html).toContain('12');
    expect(html).toContain('1,500');
    expect(html).toContain('180');
    expect(html).not.toMatch(/Reported|Resolved|SLA/);
  });
});

describe('CommunityTable', () => {
  it('renders designs with moderation actions', () => {
    const html = renderToStaticMarkup(
      <CommunityTable
        data={data}
        filters={filters}
        onFiltersChange={noop}
        onTogglePublication={noop}
        onDelete={noop}
        busyId={null}
      />
    );
    expect(html).toContain('Neon Gala');
    expect(html).toContain('ahmad@k.me');
    expect(html).toContain('/invite/neon-gala-inv');
    expect(html).toContain('Hide from showcase');
    // The SaaS has no reports, bans, or featured flags.
    expect(html).not.toMatch(/Take Down|Ban User|Featured|Reported/);
  });
});
