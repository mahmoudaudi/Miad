import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdminAnalytics } from '@/lib/admin';
import { AnalyticsKpis } from './AnalyticsKpis';
import { FunnelChart } from './FunnelChart';
import { RsvpDonut } from './RsvpDonut';

const data: AdminAnalytics = {
  range: { from: '2026-08-28T00:00:00.000Z', to: '2026-09-27T00:00:00.000Z', label: 'Last 30 Days' },
  kpis: {
    newUsers: 50,
    newUsersTrend: 100,
    activeCreators: 21,
    published: 4,
    publishedRate: 10.8,
    rsvpResponses: 1,
    rsvpRate: 100,
  },
  daily: [{ day: '2026-09-27T00:00:00.000Z', created: 2, published: 0, views: 1 }],
  funnel: { created: 37, published: 4, opened: 8 },
  rsvp: { attending: 1, notAttending: 0, pending: 0, attendingGuests: 1 },
  ai: { generations: 32, refinements: 2, successful: 8, failed: 24, successRate: 25 },
  devices: [{ device: 'mobile', views: 5 }],
  top: [],
};

describe('AnalyticsKpis', () => {
  it('renders engagement metrics without DAU/WAU fiction', () => {
    const html = renderToStaticMarkup(<AnalyticsKpis data={data} />);
    expect(html).toContain('50');
    expect(html).toContain('21');
    expect(html).not.toMatch(/Daily Active|Weekly Active|Stickiness|Peak concurrent/);
  });
});

describe('FunnelChart', () => {
  it('renders the real created/published/opened funnel', () => {
    const html = renderToStaticMarkup(<FunnelChart data={data} />);
    expect(html).toContain('37');
    expect(html).not.toContain('Shared');
    expect(html).not.toContain('412,000');
  });
});

describe('RsvpDonut', () => {
  it('renders stored RSVP disposition', () => {
    const html = renderToStaticMarkup(<RsvpDonut data={data} />);
    expect(html).toContain('Attending');
    expect(html).toContain('Not Attending');
    expect(html).toContain('Pending');
    expect(html).not.toContain('Maybe');
    expect(html).not.toContain('684,000');
  });
});
