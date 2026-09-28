import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdminOverview } from '@/lib/admin';
import { AiStrip, KpiCards } from './StatsCards';

const overview: AdminOverview = {
  users: { total: 12482, active: 9840, activeRate: 78.8, newLast24h: 12 },
  invitations: { total: 28391, published: 19812, draft: 8579 },
  rsvps: { total: 482910, attending: 341000, attendingRate: 70.6 },
  revenue: { total: 0, currency: 'USD', activeSubscriptions: 0 },
  ai: { generations: 19284, refinements: 14620, successful: 33596, failed: 308, successRate: 99.1 },
  series: [],
  activity: [],
  generations: { items: [], page: 1, limit: 6, total: 0, totalPages: 1 },
};

describe('KpiCards', () => {
  it('renders live aggregates, never mock copy', () => {
    const html = renderToStaticMarkup(<KpiCards overview={overview} />);
    expect(html).toContain('12,482');
    expect(html).toContain('28,391');
    expect(html).toContain('482,910');
    expect(html).toContain('No settled payments yet');
    expect(html).not.toContain('$24,820');
  });
});

describe('AiStrip', () => {
  it('renders AI telemetry from ai_usage', () => {
    const html = renderToStaticMarkup(<AiStrip overview={overview} />);
    expect(html).toContain('19,284');
    expect(html).toContain('14,620');
    expect(html).toContain('99.1%');
    expect(html).toContain('308');
  });
});
