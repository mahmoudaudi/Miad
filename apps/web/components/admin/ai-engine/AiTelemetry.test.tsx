import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdminAiTelemetry } from '@/lib/admin';
import { AiKpis } from './AiKpis';
import { FailuresTable } from './FailuresTable';

const data: AdminAiTelemetry = {
  kpis: {
    total: 32,
    generations: 30,
    refinements: 2,
    successful: 8,
    failed: 24,
    successRate: 25,
    tokensTotal: 45000,
    avgTokensPerRun: 1406,
    modelsConfigured: 4,
    modelsAvailable: 3,
  },
  operations: [
    { operation: 'GENERATE_DESIGN', runs: 30, share: 93.8, successRate: 23.3, avgTokens: 1400 },
    { operation: 'EDIT_DESIGN', runs: 2, share: 6.2, successRate: 50, avgTokens: 1500 },
  ],
  daily: [],
  recentOutputs: [],
  failures: {
    items: [
      {
        id: 'f-1',
        createdAt: '2026-09-27T20:22:10Z',
        slug: 'bash',
        title: 'Graduation Bash',
        userEmail: 'omar@x.co',
        operation: 'GENERATE_DESIGN',
        tokensUsed: null,
      },
    ],
    page: 1,
    limit: 5,
    total: 24,
    totalPages: 5,
  },
};

const noop = () => undefined;

describe('AiKpis', () => {
  it('renders live pipeline counts', () => {
    const html = renderToStaticMarkup(<AiKpis data={data} />);
    expect(html).toContain('32');
    expect(html).toContain('45,000');
    expect(html).toContain('3/4');
    // No invented latency, cost, or per-model figures.
    expect(html).not.toMatch(/42\.6s|\$1,842|DeepSeek|Claude/);
  });
});

describe('FailuresTable', () => {
  it('renders failed runs with exactly the stored fields', () => {
    const html = renderToStaticMarkup(<FailuresTable data={data} onPage={noop} />);
    expect(html).toContain('Graduation Bash');
    expect(html).toContain('omar@x.co');
    expect(html).toContain('Generate Design');
    expect(html).toContain('of 24 failures');
    // The SaaS stores no error messages, models, or retry states per run.
    expect(html).not.toContain('Retry Status');
    expect(html).not.toContain('Stack Trace');
    expect(html).not.toContain('Model Engine');
  });

  it('celebrates a clean pipeline instead of faking rows', () => {
    const clean: AdminAiTelemetry = {
      ...data,
      failures: { items: [], page: 1, limit: 5, total: 0, totalPages: 1 },
    };
    const html = renderToStaticMarkup(<FailuresTable data={clean} onPage={noop} />);
    expect(html).toContain('pipeline is clean');
  });
});
