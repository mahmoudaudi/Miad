import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdminUsersResponse } from '@/lib/admin';
import { UsersKpis } from './UsersKpis';

const data: AdminUsersResponse = {
  kpis: {
    total: 50,
    newThisWeek: 9,
    growthRate: 12.5,
    active30d: 21,
    activeSubscriptions: 2,
    suspended: 1,
  },
  distribution: [
    { plan: 'Free', count: 48 },
    { plan: 'Studio Pro', count: 2 },
  ],
  avgRevenuePerUser: 0,
  topAi: [],
  table: { items: [], page: 1, limit: 8, total: 50, totalPages: 7 },
};

describe('UsersKpis', () => {
  it('renders live user metrics', () => {
    const html = renderToStaticMarkup(<UsersKpis data={data} />);
    expect(html).toContain('50');
    expect(html).toContain('+9 this week');
    expect(html).toContain('21');
    expect(html).toContain('Requires action');
    expect(html).not.toContain('98.2% verified');
  });

  it('shows all-clear when nothing is suspended', () => {
    const clear: AdminUsersResponse = {
      ...data,
      kpis: { ...data.kpis, suspended: 0 },
    };
    const html = renderToStaticMarkup(<UsersKpis data={clear} />);
    expect(html).toContain('All clear');
  });
});
