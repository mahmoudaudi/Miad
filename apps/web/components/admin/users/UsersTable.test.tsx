import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdminUserItem } from '@/lib/admin';
import { UsersTable } from './UsersTable';

const items: AdminUserItem[] = [
  {
    id: 'u-1',
    firstName: 'Karim',
    lastName: 'Mansour',
    email: 'karim@domain.io',
    role: 'admin',
    isActive: true,
    createdAt: '2024-10-28T10:00:00Z',
    invitationsCount: 28,
    aiRuns: 412,
    plan: 'Studio Pro',
  },
  {
    id: 'u-2',
    firstName: 'Omar',
    lastName: 'Farooq',
    email: 'omar.f@tech.co',
    role: 'user',
    isActive: false,
    createdAt: '2024-10-22T10:00:00Z',
    invitationsCount: 5,
    aiRuns: 25,
    plan: 'Free',
  },
];

const noop = () => undefined;
const table = { items, page: 1, limit: 8, total: 2, totalPages: 1 };
const filters = { sort: 'newest' as const, page: 1, limit: 8 };

describe('UsersTable', () => {
  it('renders real directory rows with honest columns', () => {
    const html = renderToStaticMarkup(
      <UsersTable
        table={table}
        plans={['Free', 'Studio Pro']}
        filters={filters}
        onFiltersChange={noop}
        onToggleStatus={noop}
        onChangeRole={noop}
        onDelete={noop}
        sessionUserId="admin-1"
        busyId={null}
      />
    );
    expect(html).toContain('Karim');
    expect(html).toContain('karim@domain.io');
    expect(html).toContain('Studio Pro');
    expect(html).toContain('Suspended');
    expect(html).toContain('Showing');
    expect(html).toContain('users');
    // The SaaS tracks no logins, quotas, or verification flags.
    expect(html).not.toContain('Active:');
    expect(html).not.toContain('verified');
    expect(html).not.toContain('quota');
  });

  it('marks the session account and disables self-actions', () => {
    const html = renderToStaticMarkup(
      <UsersTable
        table={table}
        plans={['Free', 'Studio Pro']}
        filters={filters}
        onFiltersChange={noop}
        onToggleStatus={noop}
        onChangeRole={noop}
        onDelete={noop}
        sessionUserId="u-1"
        busyId={null}
      />
    );
    expect(html).toContain('You');
    expect(html).toContain('You cannot suspend your own account');
  });
});
