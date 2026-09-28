import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyRsvpForm } from '@/lib/rsvp-form';
import { PublicRsvpFormView } from './PublicRsvpForm';

const noop = () => undefined;
describe('PublicRsvpFormView', () => {
  it('renders real response choices, fields, and submitting/error states', () => {
    const html = renderToStaticMarkup(
      <PublicRsvpFormView
        values={emptyRsvpForm}
        errors={{ name: 'Full name is required' }}
        submitting={true}
        submitted={false}
        serverError="Try again"
        onChange={noop}
        onSubmit={noop}
      />
    );
    expect(html).toContain('Attendance');
    expect(html).toContain('Yes');
    expect(html).toContain('No');
    expect(html).toContain('Full Name');
    expect(html).toContain('Number of Guests');
    expect(html).toContain('Message/Note');
    expect(html).not.toMatch(/Email|Phone|Dietary|Address/);
    expect(html).toContain('Sending response…');
    expect(html).toContain('Full name is required');
    expect(html).toContain('Try again');
  });

  it('renders a clear success state after persistence', () => {
    const html = renderToStaticMarkup(
      <PublicRsvpFormView
        values={emptyRsvpForm}
        errors={{}}
        submitting={false}
        submitted={true}
        serverError={null}
        onChange={noop}
        onSubmit={noop}
      />
    );
    expect(html).toContain('Response received');
    expect(html).not.toContain('Confirm Attendance');
  });
});
