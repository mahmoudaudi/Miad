import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdminInvitationsResponse } from '@/lib/admin';
import { InvitationsTable } from './InvitationsTable';

const data: AdminInvitationsResponse = {
  kpis: {
    total: 37,
    published: 4,
    draft: 33,
    publishedRate: 10.8,
    newThisWeek: 36,
    growthRate: 500,
    totalViews: 120,
    totalRsvps: 12,
    creations30d: Array.from({ length: 30 }, () => 1),
    published30d: Array.from({ length: 30 }, () => 0),
  },
  eventTypes: ['Wedding', 'Birthday'],
  table: {
    items: [
      {
        id: 'i-1',
        title: 'Gala Night',
        slug: 'gala-night',
        eventType: 'Wedding',
        status: 'PUBLISHED',
        createdAt: '2026-09-20T10:00:00Z',
        updatedAt: '2026-09-21T10:00:00Z',
        owner: { name: 'Ahmad Khalil', email: 'ahmad@k.me', plan: 'Free' },
        views: 100,
        rsvps: 10,
      },
      {
        id: 'i-2',
        title: 'Draft Party',
        slug: 'draft-party',
        eventType: 'Birthday',
        status: 'DRAFT',
        createdAt: '2026-09-19T10:00:00Z',
        updatedAt: '2026-09-19T10:00:00Z',
        owner: { name: 'Sara H', email: 'sara@h.io', plan: 'Free' },
        views: 0,
        rsvps: 0,
      },
    ],
    page: 1,
    limit: 6,
    total: 2,
    totalPages: 1,
  },
};

const noop = () => undefined;
const filters = { sort: 'newest' as const, page: 1, limit: 6 };

describe('InvitationsTable', () => {
  it('renders the real directory with honest statuses', () => {
    const html = renderToStaticMarkup(
      <InvitationsTable
        data={data}
        filters={filters}
        onFiltersChange={noop}
        selected={[]}
        onToggleSelect={noop}
        onToggleSelectAll={noop}
        onClearSelection={noop}
        onBulkPublish={noop}
        onBulkUnpublish={noop}
        onExportSelected={noop}
        onTogglePublish={noop}
        onDelete={noop}
        analyticsFor={null}
        analyticsData={null}
        analyticsLoading={false}
        onToggleAnalytics={noop}
        busyId={null}
      />
    );
    expect(html).toContain('Gala Night');
    expect(html).toContain('/invite/gala-night');
    expect(html).toContain('Published');
    expect(html).toContain('Draft');
    expect(html).toContain('/admin/users?search=');
    // The SaaS has no archive, report, tag, or custom-domain concepts.
    expect(html).not.toContain('Archived');
    expect(html).not.toContain('Reported');
    expect(html).not.toContain('Custom');
    expect(html).not.toContain('Apply Tag');
  });

  it('shows the batch bar only with a selection', () => {
    const render = (selected: string[]) =>
      renderToStaticMarkup(
        <InvitationsTable
          data={data}
          filters={filters}
          onFiltersChange={noop}
          selected={selected}
          onToggleSelect={noop}
          onToggleSelectAll={noop}
          onClearSelection={noop}
          onBulkPublish={noop}
          onBulkUnpublish={noop}
          onExportSelected={noop}
          onTogglePublish={noop}
          onDelete={noop}
          analyticsFor={null}
          analyticsData={null}
          analyticsLoading={false}
          onToggleAnalytics={noop}
          busyId={null}
        />
      );
    expect(render([])).not.toContain('invitations selected');
    expect(render(['i-1', 'i-2'])).toContain('2 invitations selected');
  });
});
