import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdminGenerationItem } from '@/lib/admin';
import { GenerationsTable } from './GenerationsTable';

const items: AdminGenerationItem[] = [
  {
    id: 'a-1',
    userName: 'Ahmad Khalil',
    userEmail: 'ahmad.k@gmail.com',
    invitationName: 'Wedding Gala',
    invitationSlug: 'wedding-gala',
    operation: 'GENERATE_DESIGN',
    tokensUsed: 1200,
    status: 'SUCCEEDED',
    createdAt: '2026-09-27T16:00:00Z',
  },
  {
    id: 'a-2',
    userName: 'Omar Farooq',
    userEmail: 'omar.f@tech.co',
    invitationName: 'Graduation Bash',
    invitationSlug: 'graduation-bash',
    operation: 'GENERATE_DESIGN',
    tokensUsed: null,
    status: 'FAILED',
    createdAt: '2026-09-27T15:00:00Z',
  },
];

const noop = () => undefined;

describe('GenerationsTable', () => {
  it('renders real rows with preview links and honest pagination', () => {
    const html = renderToStaticMarkup(
      <GenerationsTable
        items={items}
        page={1}
        totalPages={248}
        total={1482}
        limit={6}
        onPage={noop}
      />
    );
    expect(html).toContain('Ahmad Khalil');
    expect(html).toContain('/invite/wedding-gala');
    expect(html).toContain('Successful');
    expect(html).toContain('Failed');
    expect(html).toContain('1,482');
    // No duration column: the SaaS stores no per-run durations.
    expect(html).not.toContain('Duration');
    expect(html).not.toContain('DeepSeek');
  });

  it('explains an empty platform instead of faking rows', () => {
    const html = renderToStaticMarkup(
      <GenerationsTable items={[]} page={1} totalPages={1} total={0} limit={6} onPage={noop} />
    );
    expect(html).toContain('No AI generations yet');
  });
});
